## Why

Tres refinamientos de experiencia detectados en el uso diario: (1) el bot entrega su respuesta por streaming incremental, produciendo un efecto de "texto que se completa con el tiempo" en lugar de una respuesta directa; (2) el panel de insights muestra un resumen que se quiere retirar para dejar únicamente el sentimiento; y (3) desde el módulo de clientes no hay forma de abrir la conversación con un cliente concreto.

## What Changes

- El bot entrega su respuesta como **un único mensaje completo**: se dejan de emitir fragmentos parciales y se conserva el indicador de escritura mientras el modelo genera. El mensaje final sigue llegando por el canal de tiempo real existente.
- El análisis de insights deja de calcular, almacenar y mostrar el **resumen**; conserva el sentimiento y su distribución. El prompt, la validación, el modelo de datos, el panel y los textos se ajustan en consecuencia.
- Nuevo botón **"Ver conversación"** en la lista de clientes que abre la bandeja con la conversación de ese cliente preseleccionada. La conversación se resuelve en el servidor por contacto (prefiriendo la activa y, si no, la más reciente); si el cliente no tiene conversación vinculada, la acción no está disponible.

## Capabilities

### New Capabilities

- `client-directory`: directorio de clientes con acceso directo a la conversación del cliente.

### Modified Capabilities

- `messaging`: la respuesta del bot se entrega como un mensaje completo en lugar de fragmentos incrementales.
- `conversation-insights`: el análisis y el panel de insights dejan de incluir el resumen; solo sentimiento y distribución.

## Impact

- `apps/backend/src/services/chat.service.ts`: dejar de emitir fragmentos parciales en la respuesta directa y en la posterior a herramientas.
- `apps/backend/src/services/insights.service.ts`: retirar el resumen del prompt, del tipo, de la validación y de la persistencia.
- `apps/backend/src/models/conversation.model.ts`: retirar `aiInsights.summary`.
- `apps/backend/src/controllers/messaging.controller.ts`: filtro por `contactId` en el listado de conversaciones.
- `apps/frontend/src/views/Messaging.vue` y `TestChat.vue`: aplicar solo el mensaje final y soportar la conversación preseleccionada.
- `apps/frontend/src/views/Clients.vue`: botón "Ver conversación".
- `apps/frontend/src/services/messaging.service.ts`, `client.service.ts`, `composables/useConversations.ts`, `router/index.ts`: tipos y navegación.
- Textos `es.json`/`en.json`; stub e2e y specs de mensajería, tiempo real y clientes.
- Documentación: `AGENTS.md` y `changelog.md`.
