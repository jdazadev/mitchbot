## MODIFIED Requirements

### Requirement: Entrada normalizada de mensajes

El sistema SHALL recibir los mensajes de todos los canales como un `InboundMessage` normalizado (proyecto, plataforma, identificador del cliente, id externo opcional, cuenta del canal opcional, nombre y datos de contacto del remitente, contenido y fecha) y procesarlos por un único punto de entrada. El chat público Web SHALL usar ese mismo punto de entrada sin cambiar su API HTTP. Un mensaje SHALL continuar la conversación abierta (`active` o `pending_human`) del mismo cliente en el mismo canal y proyecto. La conversación SHALL guardar la cuenta del canal que recibió el mensaje.

#### Scenario: Primer mensaje de un cliente

- **WHEN** llega un `InboundMessage` de un cliente sin conversación abierta en el proyecto
- **THEN** se crea la conversación en `auto_pilot` con el mensaje como primero
- **AND** se emite `chat:new_conversation` al proyecto

#### Scenario: Mensaje en una conversación existente

- **WHEN** llega un `InboundMessage` de un cliente con conversación activa
- **THEN** el mensaje se añade a esa conversación y el bot responde si está en `auto_pilot`

#### Scenario: Cliente que espera a una persona

- **WHEN** llega un `InboundMessage` de un cliente cuya conversación está en `pending_human`
- **THEN** el mensaje se añade a esa conversación en lugar de abrir una nueva

#### Scenario: Chat público sin cambios de contrato

- **WHEN** un cliente Web inicia o continúa una conversación por el chat público
- **THEN** recibe las mismas respuestas HTTP y eventos de socket que antes del cambio

### Requirement: Entrega por canal con cola

El sistema SHALL entregar las respuestas del bot y del operador a través de la cola de salida de su canal cuando la conversación pertenece a un canal externo **y** tiene cuenta de canal, sin bloquear la generación de la respuesta. Los mensajes internos de herramientas (`tool_call`, `tool_result`) SHALL NOT entregarse al cliente. Las conversaciones Web y las del simulador (sin cuenta de canal) SHALL seguir recibiendo las respuestas por socket, sin cola de salida. La entrega SHALL salir desde la cuenta del canal guardada en la conversación.

#### Scenario: Respuesta en un canal externo

- **WHEN** el bot responde en una conversación de un canal externo con cuenta de canal
- **THEN** el mensaje se guarda con `delivery.status = queued` y se encola en la cola de su canal
- **AND** al entregarse pasa a `sent` con el id externo y se emite `chat:message_updated`

#### Scenario: Mensajes internos

- **WHEN** se registra un `tool_call` o un `tool_result` en un canal externo
- **THEN** no se encola ninguna entrega

#### Scenario: Canal Web

- **WHEN** el bot responde en una conversación Web
- **THEN** el mensaje no lleva estado de entrega y llega al cliente por socket

#### Scenario: Conversación del simulador

- **WHEN** el bot responde en una conversación con plataforma WhatsApp creada desde el chat público
- **THEN** no se encola ninguna entrega y el mensaje llega por socket

## ADDED Requirements

### Requirement: Estados de entrega informados por el canal

El sistema SHALL actualizar el estado de entrega con los avisos del canal, localizando el mensaje por su id externo. Los estados SHALL avanzar en el orden `queued < sent < delivered < read` y SHALL NOT retroceder. Un fallo informado por el canal después de aceptar el mensaje SHALL tratarse como un fallo definitivo de entrega.

#### Scenario: Mensaje leído

- **WHEN** el canal informa `delivered` y después `read` de un mensaje enviado
- **THEN** el mensaje pasa a `delivered` y luego a `read`, y cada cambio se emite con `chat:message_updated`

#### Scenario: Aviso fuera de orden

- **WHEN** el canal informa `delivered` de un mensaje que ya está en `read`
- **THEN** el estado sigue en `read`

#### Scenario: Fallo asíncrono

- **WHEN** el canal informa `failed` de un mensaje en `sent`
- **THEN** el mensaje pasa a `failed` con el motivo, la conversación a `pending_human` y se notifica al proyecto
