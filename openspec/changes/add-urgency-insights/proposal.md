# Add Urgency to AI Insights

## Why

La vista de conversación muestra hoy un estado de **urgencia** derivado en el cliente (sentimiento negativo + señales operacionales), no un veredicto del análisis. Además, el análisis de IA solo corre **después** de cada respuesta del bot: en `human_takeover` —justo cuando un humano decide prioridades— los insights se congelan, y el momento de máxima urgencia (el cliente escribiendo sin respuesta) es exactamente cuando el dato está más viejo.

## What Changes

- El análisis de IA evalúa **sentimiento + urgencia** en la misma llamada al modelo. La urgencia tiene 3 niveles (`low | medium | high`) y un motivo tipado (`none | deadline | incident | escalation | repetition`).
- Se persiste `aiInsights.urgency` y se propaga por el socket `chat:insights`, también a la room del dashboard para que la bandeja se actualice en vivo.
- **BREAKING (comportamiento)**: el disparador del análisis se mueve de "tras cada respuesta del bot" a "al recibir cada mensaje del cliente", desde el primer mensaje, en ambos modos (`auto_pilot` y `human_takeover`). Se retiran los dos disparadores post-respuesta.
- El bloque **Urgencia** del panel de la conversación pasa a mostrar el veredicto real, compuesto con las señales operacionales (una confirmación pendiente fuerza al menos Media). Sin análisis, cae a la heurística actual como respaldo.
- La **bandeja** muestra un indicador de urgencia por conversación (Media/Alta) actualizado en vivo.
- `GET /api/conversations/:id/insights` devuelve también `urgency`; el recálculo manual ("Analizar") lo incluye.
- Nuevas claves i18n `messaging.urgency.motive.*` (es/en); se conservan las claves operacionales existentes.

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `conversation-insights`: el análisis incluye la urgencia además del sentimiento; el disparador pasa a los mensajes entrantes del cliente; el panel muestra la urgencia real compuesta con señales operacionales.
- `agent-inbox`: la bandeja muestra un indicador de urgencia por conversación, actualizado en vivo.

## Impact

- **Backend**: `services/insights.service.ts`, `services/chat.service.ts`, `models/conversation.model.ts`, `controllers/messaging.controller.ts`.
- **Frontend**: `services/messaging.service.ts`, `views/Messaging.vue`, `composables/useConversations.ts`, `locales/es.json`, `locales/en.json`.
- **e2e**: `tests/stub/openai-stub.mjs`, `tests/e2e/specs/messaging.spec.ts`.
- **Datos**: `aiInsights.urgency` es opcional; los documentos existentes conservan su sentimiento y la UI cae a la heurística. No hay migración ni reindexado.
- **Sin cambios** de esquema de BD, variables de entorno ni dependencias: se reutiliza `OPENROUTER_INSIGHTS_MODEL` (con fallback al modelo de chat).
