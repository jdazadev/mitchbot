## Why

El módulo de mensajería aparenta estar terminado pero tiene numerosos controles sin función: los chips de canal están hardcodeados y no filtran, la búsqueda no hace nada, los chips de sugerencia/emoji/adjuntos son decorativos y "Take Over" no responde; el panel "AI Insights" pinta valores fijos. Tampoco hay forma de guardar al cliente como contacto desde la conversación ni de ver el conteo real de chats en el sidebar, lo que da una impresión de producto inacabado en la demo.

## What Changes

- **Filtros y búsqueda**: chips de canal generados desde la configuración del proyecto (solo los habilitados, incluido Web) con filtrado real; búsqueda funcional por nombre y último mensaje; agrupación de mensajes por fecha real (se elimina el divider fijo "Today").
- **Toma de control manual**: "Take Over" funcional y bidireccional (tomar control ↔ devolver a automático), conectado a `PUT /api/conversations/:id/mode` y reflejado en vivo.
- **Guardar como contacto**: nueva acción en la conversación respaldada por un endpoint que crea o vincula el contacto a partir de los datos del cliente, de forma idempotente y funcionando aunque la creación automática esté deshabilitada.
- **No leídos reales**: badge del sidebar con el total de mensajes no leídos del proyecto activo, actualizado en vivo; se elimina el número hardcodeado.
- **AI Insights real**: análisis de sentimiento/resumen automático tras cada respuesta del bot y manual desde un botón, con modelo dedicado por variable de entorno (`OPENROUTER_INSIGHTS_MODEL`, fallback al modelo de chat), persistido en la conversación y actualizado en vivo.
- **Limpieza del compositor**: se eliminan los controles decorativos (chips de sugerencia, emoji, adjuntos, imagen, filtro, menú de tres puntos, indicador "online" simulado y badge de confianza sin datos).

## Capabilities

### New Capabilities

- `agent-inbox`: bandeja de conversaciones del agente — filtrado por canales habilitados, búsqueda, agrupación por fecha, toma de control manual, guardado de contacto, conteo de no leídos y compositor con únicamente acciones funcionales.
- `conversation-insights`: análisis aproximado de la conversación (sentimiento y resumen), automático y manual, mostrado al agente en el panel de la conversación.

### Modified Capabilities

- (ninguna)

## Impact

- **Frontend**: `views/Messaging.vue`, `components/layout/Sidebar.vue`, `services/messaging.service.ts`, `services/socket.service.ts`, `services/project.service.ts` (canales), nuevo composable/store de conversaciones.
- **Backend**: `routes/messaging.routes.ts`, `controllers/messaging.controller.ts` (endpoint de contacto, insights y emisión de modo), nuevo `services/insights.service.ts`, `services/chat.service.ts` (hook de análisis), `config/env.ts`, `apps/backend/.env.example`.
- **Pruebas e2e**: filtros de canal, guardar contacto, toma de control e insights.
- **Documentación**: `AGENTS.md` y `changelog.md` (bump de versión menor).
