## Why

El badge de conversaciones no leídas del menú lateral "resucita" al recargar la página: el contador vive en MongoDB pero nunca se persiste la lectura, y además se incrementa por **cualquier** remitente (incluido el propio bot y el agente humano que responde), de modo que los valores guardados están inflados. En paralelo, al entrar al módulo de conversaciones se autoselecciona la primera conversación, lo que impone una vista que el agente no pidió.

## What Changes

- El contador de no leídos SHALL incrementarse **únicamente** con mensajes del cliente (`contact`); los mensajes del bot y del agente humano SHALL NOT sumar.
- Se agrega un endpoint `PUT /api/conversations/:id/read` que persiste `unreadCount = 0` y emite `chat:read` a la room del proyecto para sincronizar el badge en otras pestañas o sesiones del mismo proyecto.
- Al abrir una conversación se marca como leída en el servidor (no solo en memoria), por lo que la lectura **persiste** tras recargar.
- Si llega un mensaje del cliente a la conversación **abierta**, se re-marca como leída de inmediato (estilo WhatsApp), sin que el badge suba.
- Al entrar al módulo de conversaciones **no se selecciona ninguna conversación por defecto**; se mantiene el deep-link `?conversation=<id>` (botón "Ver conversación" de Clients).
- Se agrega un script one-off que resetea los `unreadCount` contaminados existentes y se ejecuta sobre la base actual.
- **BREAKING**: ninguno; cambia comportamiento del contador y de la selección inicial, no contratos de datos.

## Capabilities

### New Capabilities

<!-- Ninguna capacidad nueva: el comportamiento encaja en la bandeja del agente existente. -->

### Modified Capabilities

- `agent-inbox`: se reescribe el requisito "Conteo de conversaciones no leídas" (solo mensajes del cliente, persistencia del leído, re-marcado en conversación abierta, sincronización entre sesiones) y se agrega el requisito "Selección inicial de conversación" (sin autoselección; deep-link preservado).

## Impact

- **Backend**: `services/chat.service.ts` (incrementos de `unreadCount` y entrega en vivo al dashboard), `controllers/messaging.controller.ts` (nuevo handler de lectura), `routes/messaging.routes.ts` (nueva ruta), `websocket/socket.ts` (room de dashboard por proyecto), `scripts/reset-unread-counts.ts` (nuevo script one-off).
- **Frontend**: `services/messaging.service.ts`, `services/socket.service.ts`, `composables/useConversations.ts`, `views/Messaging.vue`.
- **Contrato API**: nueva ruta `PUT /api/conversations/:id/read`; nuevo evento WebSocket `chat:read`.
- **Datos**: reset puntual de `conversations.unreadCount` en la base existente.
- **Tests**: cobertura e2e nueva en `tests/e2e/specs/messaging.spec.ts`; se corre la suite para confirmar que la remoción de la autoselección no rompe los specs (ya hacen clic explícito).
