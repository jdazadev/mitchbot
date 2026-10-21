# Add Channel Gateway

## Why

Mitchbot solo atiende de verdad el canal Web: el cliente entra por los endpoints del chat público y recibe las respuestas porque su navegador está en la room de Socket.io. WhatsApp e Instagram funcionan al revés: **Meta empuja webhooks** que hay que contestar en segundos, **reintenta** los que no recibe a tiempo (duplicando mensajes si no se reconocen) y la respuesta del bot **se entrega llamando a su API**, que puede fallar, limitar el ritmo o caerse. Hoy no existe ninguna de esas piezas: no hay salida por canal, ni cola, ni idempotencia, ni estado de entrega. Montarlas antes de conectar Meta permite probar todo el camino con un stub y que los canales reales solo aporten su adaptador.

## What Changes

- **Mensaje normalizado**: un único `InboundMessage` (proyecto, canal, identificador del cliente, id externo, remitente, contenido, fecha) por el que entran todos los canales. El chat público Web pasa a construirlo y a usar el mismo punto de entrada (`receive`), sin cambiar su API HTTP.
- **Adaptadores de canal** (`src/channels/`): contrato `ChannelAdapter` (`parseWebhook`, `send`, clasificación de errores) y registro por plataforma. Este cambio incluye el adaptador **Web** (entrega por socket, como hoy); WhatsApp e Instagram llegan en cambios posteriores.
- **Broker con BullMQ sobre Redis** (sin servicios nuevos en Docker): cola `channel-inbound` para procesar webhooks fuera de la petición HTTP y una cola de salida **por canal** (`channel-outbound-<canal>`) para las respuestas del bot y del operador en canales externos. Web no pasa por la cola de salida.
- **Idempotencia**: los mensajes entrantes guardan `external { platform, messageId }` con índice único; un webhook repetido no crea un segundo mensaje ni dispara otra respuesta del bot.
- **Estado de entrega** en los mensajes salientes de canales externos: `delivery { status: queued | sent | failed, attempts, externalId?, error? }`, propagado en vivo con `chat:message_updated`.
- **Resiliencia**:
  - **Rate limiting por canal**: el limitador de cada cola de salida se configura por entorno (`CHANNEL_<CANAL>_RATE_MAX` / `_RATE_MS`).
  - **Reintentos** con backoff exponencial para errores transitorios (red, 5xx, 429); los permanentes (4xx de validación, token inválido) fallan sin reintentar.
  - **Failover operativo**: un *circuit breaker* por canal pausa la cola tras fallos consecutivos y avisa al proyecto (`admin:notification`); cuando un mensaje agota sus reintentos, se marca `failed`, la conversación pasa a `pending_human` y el operador ve el fallo en el hilo con un botón **Reintentar**.
- **Interfaz**: el hilo de Conversaciones muestra el estado de entrega de los mensajes salientes en canales externos (enviando / enviado / no entregado + Reintentar). Nuevas claves i18n `messaging.delivery.*` (es/en).
- **API**: `POST /api/conversations/:id/messages/:messageId/retry` reencola un mensaje `failed` (mismo control de acceso que enviar mensajes).
- **BREAKING (sin consumidores)**: se eliminan `POST /api/conversations/client/start` y `POST /api/conversations/client/:id/messages`. Nadie los usaba (el chat Web va por `/api/public/test-chat`) y eran una segunda entrada que se saltaría la idempotencia.

## Non-goals

- Conectar WhatsApp o Instagram (cambios `add-whatsapp-channel` y `add-instagram-channel`).
- Failover **entre proveedores o canales** (p. ej. reenviar por SMS si WhatsApp cae): cada canal tiene un único proveedor.
- Estados `delivered` / `read`: llegan con los webhooks de estado de cada canal.
- Mensajes multimedia salientes: el contrato los admite, pero este cambio solo envía texto.

## Capabilities

### New Capabilities

- `channel-gateway`: entrada normalizada e idempotente de mensajes, salida por canal con cola, rate limiting, reintentos, circuit breaker y estado de entrega visible.

### Modified Capabilities

- (ninguna: el chat Web conserva su contrato; el estado de entrega solo aparece en canales externos)

## Impact

- **Backend**: nuevo `src/channels/` (tipos, registro, adaptador Web, gateway, colas y workers, circuit breaker), `services/chat.service.ts` (entrada vía gateway y encolado de salida), `controllers/public-chat.controller.ts`, `controllers/messaging.controller.ts` + ruta de reintento, `models/message.model.ts` (`external`, `delivery`), índice en `messages`, `config/env.ts`, `index.ts` (arranque de workers).
- **Frontend**: `services/messaging.service.ts`, `views/Messaging.vue`, `locales/es.json`, `locales/en.json`.
- **Pruebas**: unitarios (normalización, clasificación de errores, política de backoff, circuit breaker, idempotencia), integración contra Redis/BullMQ con un adaptador falso, E2E de regresión del canal Web.
- **Datos**: campos nuevos opcionales; índice único parcial sobre `external.platform + external.messageId`. Sin migración.
- **Entorno**: variables opcionales de rate limiting y del circuit breaker con valores por defecto.
