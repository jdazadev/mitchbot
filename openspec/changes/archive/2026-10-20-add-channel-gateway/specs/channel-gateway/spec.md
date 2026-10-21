## ADDED Requirements

### Requirement: Entrada normalizada de mensajes

El sistema SHALL recibir los mensajes de todos los canales como un `InboundMessage` normalizado (proyecto, plataforma, identificador del cliente, id externo opcional, nombre y datos de contacto del remitente, contenido y fecha) y procesarlos por un único punto de entrada. El chat público Web SHALL usar ese mismo punto de entrada sin cambiar su API HTTP.

#### Scenario: Primer mensaje de un cliente

- **WHEN** llega un `InboundMessage` de un cliente sin conversación activa en el proyecto
- **THEN** se crea la conversación en `auto_pilot` con el mensaje como primero
- **AND** se emite `chat:new_conversation` al proyecto

#### Scenario: Mensaje en una conversación existente

- **WHEN** llega un `InboundMessage` de un cliente con conversación activa
- **THEN** el mensaje se añade a esa conversación y el bot responde si está en `auto_pilot`

#### Scenario: Chat público sin cambios de contrato

- **WHEN** un cliente Web inicia o continúa una conversación por el chat público
- **THEN** recibe las mismas respuestas HTTP y eventos de socket que antes del cambio

### Requirement: Idempotencia de mensajes entrantes

El sistema SHALL ignorar un mensaje entrante cuyo par (plataforma, id externo) ya esté registrado. Un duplicado SHALL NOT crear un segundo mensaje, incrementar los no leídos ni disparar otra respuesta del bot.

#### Scenario: Webhook repetido

- **WHEN** un canal entrega dos veces un mensaje con el mismo id externo
- **THEN** la conversación contiene un único mensaje
- **AND** el bot responde una sola vez

#### Scenario: Mensajes sin id externo

- **WHEN** llegan dos mensajes Web con el mismo texto
- **THEN** ambos se registran como mensajes distintos

### Requirement: Entrega por canal con cola

El sistema SHALL entregar las respuestas del bot y del operador en conversaciones de canales externos a través de una cola de salida propia de cada canal, sin bloquear la generación de la respuesta. Los mensajes internos de herramientas (`tool_call`, `tool_result`) SHALL NOT entregarse al cliente. Las conversaciones Web SHALL seguir recibiendo las respuestas por socket, sin cola de salida.

#### Scenario: Respuesta en un canal externo

- **WHEN** el bot responde en una conversación de un canal externo
- **THEN** el mensaje se guarda con `delivery.status = queued` y se encola en la cola de su canal
- **AND** al entregarse pasa a `sent` con el id externo y se emite `chat:message_updated`

#### Scenario: Mensajes internos

- **WHEN** se registra un `tool_call` o un `tool_result` en un canal externo
- **THEN** no se encola ninguna entrega

#### Scenario: Canal Web

- **WHEN** el bot responde en una conversación Web
- **THEN** el mensaje no lleva estado de entrega y llega al cliente por socket

### Requirement: Rate limiting por canal

Cada cola de salida SHALL limitar el número de envíos por intervalo según la configuración de su canal, de forma independiente al resto de canales.

#### Scenario: Ráfaga de respuestas

- **WHEN** se encolan más mensajes de los que admite el límite del canal en un intervalo
- **THEN** los excedentes esperan al siguiente intervalo en lugar de fallar
- **AND** el límite de un canal no retrasa a los demás

### Requirement: Reintentos según el tipo de error

El sistema SHALL reintentar con backoff exponencial las entregas que fallan por errores transitorios (red, 5xx, 429), respetando la espera indicada por el canal cuando la haya, hasta un máximo de intentos. Las entregas que fallan por errores permanentes SHALL NOT reintentarse.

#### Scenario: Fallo transitorio recuperado

- **WHEN** una entrega falla con un error transitorio y el siguiente intento tiene éxito
- **THEN** el mensaje termina en `sent` y `delivery.attempts` refleja los intentos

#### Scenario: Error permanente

- **WHEN** una entrega falla con un error permanente
- **THEN** el mensaje pasa a `failed` sin reintentos

### Requirement: Circuit breaker por canal

El sistema SHALL pausar la cola de salida de un canal tras un número configurable de fallos transitorios consecutivos, avisar a los proyectos afectados con `admin:notification` y reanudarla tras un tiempo de espera, cerrando el circuito con la primera entrega correcta. Los errores permanentes SHALL NOT contar para abrir el circuito.

#### Scenario: Proveedor caído

- **WHEN** un canal acumula el umbral de fallos transitorios consecutivos
- **THEN** su cola se pausa y el proyecto recibe un aviso
- **AND** los mensajes pendientes no se pierden

#### Scenario: Recuperación

- **WHEN** termina la espera y la siguiente entrega tiene éxito
- **THEN** el circuito se cierra y la cola sigue procesando

### Requirement: Fallo de entrega visible y recuperable

Cuando una entrega falla de forma definitiva, el sistema SHALL marcar el mensaje como `failed` con su motivo, pasar la conversación a `pending_human`, avisar al proyecto y mostrar el fallo en el hilo con una acción de reintento. El reintento SHALL aceptarse solo para mensajes en `failed`.

#### Scenario: Mensaje no entregado

- **WHEN** un mensaje agota los reintentos o falla de forma permanente
- **THEN** el hilo lo muestra como no entregado con la opción Reintentar
- **AND** la conversación pasa a `pending_human`

#### Scenario: Reintento del operador

- **WHEN** el operador reintenta un mensaje en `failed`
- **THEN** el mensaje vuelve a `queued` y se encola de nuevo

#### Scenario: Reintento no aplicable

- **WHEN** se pide reintentar un mensaje que no está en `failed`
- **THEN** la API responde 409 y no se encola ninguna entrega
