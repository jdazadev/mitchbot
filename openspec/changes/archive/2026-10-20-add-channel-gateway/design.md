## Context

Hoy un mensaje del cliente entra por `POST /api/public/test-chat/:slug/start` o `/:id/messages`, que llaman directamente a `chatService.createConversationFromClient` / `sendMessage`. Las respuestas (bot y operador) se guardan en `messages` y se emiten a la room de la conversación con Socket.io; el navegador del cliente Web está en esa room, y así recibe la respuesta. No existe una "salida" como tal.

Para WhatsApp e Instagram hacen falta tres cosas que hoy no hay:

1. **Responder rápido al webhook** y procesar después: Meta espera un 200 en pocos segundos y, si no llega, reintenta.
2. **Reconocer duplicados**: los reintentos de Meta repiten el mismo `message.id`.
3. **Entregar llamando a una API externa**, que puede fallar de forma transitoria (red, 5xx, 429) o permanente (número inválido, token caducado).

El backend ya usa BullMQ sobre Redis (colas `rag-upload` y `rag-reindex`), con la conexión compartida en `config/redis-bullmq.ts`.

## Goals / Non-Goals

**Goals**

- Un único punto de entrada normalizado para todos los canales, con idempotencia.
- Salida por canal desacoplada de la generación de la respuesta, con rate limiting, reintentos y un estado de entrega visible.
- Que conectar un canal nuevo sea escribir un adaptador, sin tocar `chat.service`.
- Que todo el camino se pueda probar sin Meta (adaptador falso en integración, stub HTTP en los cambios de cada canal).

**Non-Goals**

- Adaptadores de WhatsApp e Instagram, estados `delivered`/`read`, multimedia saliente y failover entre proveedores (ver proposal).

## Decisions

### 1. BullMQ sobre Redis como broker

Redis ya está en Docker y BullMQ en las dependencias. NATS (retirado en v0.1) daría pub/sub, pero no reintentos con backoff, limitador ni trabajos retrasados sin escribirlos a mano. **Alternativa descartada**: NATS JetStream; añade un servicio y la lógica de reintentos/limitación quedaría en nuestro código.

### 2. Una cola de entrada y una cola de salida por canal

- `channel-inbound`: un trabajo por `InboundMessage`. **Concurrencia 1** en esta etapa, para conservar el orden de los mensajes de una misma conversación sin cerrojos distribuidos. Si el volumen lo exige, se pasará a particionar por conversación (fuera de alcance).
- `channel-outbound-<canal>`: el limitador de BullMQ es **por cola**, así que una cola por canal da un rate limit independiente sin BullMQ Pro (grupos). Valores por defecto conservadores: WhatsApp 20 msg/s, Instagram 10 msg/s, configurables por entorno.

**Web no usa la cola de salida**: su entrega es el socket que ya existe y no tiene API externa que proteger. Su adaptador implementa `send` como no-op y el gateway no encola.

### 3. Entrada Web síncrona por el mismo gateway

El chat público sigue respondiendo en la misma petición (los E2E y el cliente dependen de ello), pero construye un `InboundMessage` y llama a `receive(message)`, que es lo mismo que hace el worker de `channel-inbound`. Así la normalización y la idempotencia tienen una sola implementación. Los mensajes Web no traen id externo; la idempotencia solo aplica cuando lo hay.

`receive` acepta un destino opcional (`{ conversationId }`): `POST /public/test-chat/:slug/:id/messages` escribe siempre en la conversación que abrió el navegador, aunque se haya cerrado, porque es la room que escucha. Sin destino, `receive` resuelve la conversación activa del cliente o crea una nueva.

Los endpoints autenticados `POST /api/conversations/client/start` y `/client/:id/messages` no tenían ningún consumidor y eran una segunda entrada que se saltaría la idempotencia: se eliminan.

### 4. Idempotencia por índice único parcial

`messages.external = { platform, messageId }` con índice único parcial (`partialFilterExpression: { 'external.messageId': { $exists: true } }`). `receive` inserta el mensaje y, si choca con el índice (código 11000), lo trata como duplicado: no actualiza contadores ni dispara el bot. Es atómico sin transacciones y sobrevive a reinicios (a diferencia de un set en Redis con TTL).

### 5. El gateway encola la salida al guardar el mensaje

`chatService.sendMessage` (y los mensajes finales del bot, que hoy se escriben en `generateBotResponse`) llaman a `dispatch(message, conversation)` cuando el remitente es `ai_agent` o `human_agent` y la conversación es de un canal externo. `dispatch` fija `delivery.status = 'queued'`, encola y devuelve. Los mensajes internos (`tool_call`, `tool_result`) **no** se entregan; `confirmation_request` sí, como texto (la confirmación por botones llega con cada canal). Tampoco se entrega el aviso "⚠️ Error del bot": es información para el operador, no para el cliente.

El worker de salida tiene **concurrencia 1** por canal: dos respuestas seguidas al mismo cliente deben llegarle en orden. El rendimiento lo marca el limitador; si hiciera falta más, se particionaría por destinatario.

Las colas y el estado del breaker usan el prefijo `CHANNEL_QUEUE_PREFIX` (por defecto `bull`), para que las pruebas de integración, el E2E y un backend de desarrollo que compartan Redis no se consuman los trabajos entre sí.

### 6. Clasificación de errores en el adaptador

`send` lanza `ChannelError { kind: 'transient' | 'permanent', retryAfterMs? }`. El worker reintenta los `transient` con backoff exponencial (5 intentos, base 2 s, tope 60 s, respetando `retryAfterMs` de un 429) y convierte los `permanent` en `UnrecoverableError` de BullMQ para no reintentar. La política vive en una función pura (`nextDelay`) que se prueba unitariamente.

### 7. Circuit breaker por canal

Estado en Redis por canal (`closed → open → half_open`): tras `CHANNEL_BREAKER_THRESHOLD` (5) fallos **transitorios** consecutivos se abre durante `CHANNEL_BREAKER_COOLDOWN_MS` (60 s) y se emite `admin:notification` al proyecto del mensaje que lo abrió. Mientras está abierto, cada trabajo que llega se **retrasa** hasta que expire la espera (`moveToDelayed` + `DelayedError`), sin gastar intentos; no se pausa la cola con temporizadores, así el comportamiento sobrevive a un reinicio. Al expirar pasa a `half_open`: la primera entrega correcta lo cierra y un fallo lo reabre. Los errores permanentes no cuentan: un número mal escrito no debe pausar el canal entero. La transición de estados es una función pura con pruebas unitarias; Redis solo guarda el estado.

### 8. Fallo definitivo visible y recuperable

Cuando un mensaje agota los reintentos o falla de forma permanente: `delivery.status = 'failed'` con el motivo, `chat:message_updated` al hilo, la conversación pasa a `pending_human` (el cliente no recibió la respuesta y alguien debe mirarlo) y `admin:notification`. El operador ve "No entregado · Reintentar" en el mensaje; `POST /api/conversations/:id/messages/:messageId/retry` lo reencola si está en `failed` (en otro estado responde 409, para no duplicar envíos).

## Risks / Trade-offs

- **Concurrencia 1 en la entrada** limita el rendimiento a un mensaje a la vez por instancia. Es suficiente para el volumen actual y evita respuestas desordenadas; se revisa con métricas reales.
- **Doble envío en un fallo ambiguo**: si la API externa recibe el mensaje pero la respuesta se pierde (timeout), el reintento puede duplicarlo en el teléfono del cliente. Meta no ofrece clave de idempotencia en el envío; se acepta y se mitiga con un timeout de envío holgado (10 s).
- **Redis como punto único**: si Redis cae, no se encolan entradas ni salidas. El webhook responderá 503 para que Meta reintente más tarde, en lugar de perder el mensaje.

## Migration Plan

Los campos son opcionales y el índice es parcial: los mensajes existentes no se ven afectados. El índice se crea al arrancar (`createIndex` idempotente), igual que los demás. Revertir es retirar las llamadas al gateway; los campos nuevos quedan inertes.

## Open Questions

- Ninguna bloqueante. Los límites por canal se ajustarán al tier real de la cuenta de WhatsApp Business cuando esté conectada.
