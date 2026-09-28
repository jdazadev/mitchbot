## Context

Ver `proposal.md` — Why y las capabilities modificadas en los delta specs.

Estado actual relevante:

- `insightsService.analyzeConversation()` ya persiste en `conversations.aiInsights` y emite `chat:insights` a la room de la conversación. El modelo sale de `OPENROUTER_INSIGHTS_MODEL` con fallback al de chat.
- El disparo automático vive **dentro** de `chatService.generateBotResponse()` (`chat.service.ts:516` para respuesta directa y `:735` para la respuesta final tras herramientas), por lo que solo corre en `auto_pilot` y siempre después de responder.
- El bloque de urgencia (`Messaging.vue:420`) es un `computed` que combina `insights.sentiment` con señales operacionales (confirmación pendiente, último mensaje sin responder) y `chat.status`.
- Todos los mensajes entrantes del cliente pasan por `chatService.sendMessage(..., sender='contact')` (`public-chat.controller.ts:74`); los canales futuros (WhatsApp/Instagram) usarán el mismo punto.
- El endpoint de lista (`messaging.controller.ts:29`) no excluye `aiInsights`, así que el documento completo ya llega a la bandeja; el tipo `ChatConversation` del frontend no lo declara.
- Existe el patrón `emitToProjectDashboard(projectId, event, data, excludeRoom)` (`chat.service.ts:242`) para sincronizar el dashboard sin duplicar entregas.

## Goals / Non-Goals

**Goals:**

- Un único punto de cálculo (el análisis) que produce sentimiento **y** urgencia.
- Que la urgencia refleje el estado del cliente en el momento en que escribe, en cualquier modo.
- Que la bandeja y el panel muestren urgencia real y viva, sin migración de datos.

**Non-Goals:**

- No se cambia el modelo ni el proveedor de análisis.
- No se añade un cuarto nivel ni puntajes de urgencia (`urgencyScores`).
- No se reescribe el historial ni se recalcula en bloque para conversaciones antiguas: la urgencia llega con el próximo mensaje del cliente o el recálculo manual.
- No se añade rate limiting nuevo al análisis (ver Open Questions).

## Decisions

### 1. Una sola llamada con contrato extendido

El `SYSTEM_PROMPT` de `insights.service.ts` se extiende para pedir `urgency: { level, reason }` en el mismo JSON. `parse()` valida `level` contra `low|medium|high` y `reason` contra el enum, normalizando un `reason` inválido a `none`. `analyzeConversation()` añade `aiInsights.urgency` al `$set` y lo incluye en el payload de `chat:insights`.

- **Por qué**: costo y latencia iguales a hoy (una llamada), un solo punto de fallo, atomicidad entre sentimiento y urgencia.
- **Alternativa descartada**: segunda llamada dedicada a urgencia — duplica costo y permite estados inconsistentes.

### 2. Motivo como enum tipado, no texto libre

`reason ∈ {none, deadline, incident, escalation, repetition}`, con etiquetas localizadas nuevas `messaging.urgency.motive.*` (es/en).

- **Por qué**: el motivo en texto libre saldría en el idioma que elija el modelo y no se puede localizar; el enum es determinista y encaja con el estilo de frases localizadas que ya usa el panel.
- **Alternativa descartada**: texto libre — roto para i18n y difícil de testear.

### 3. El disparador se mueve, no se duplica

Se retiran los dos disparos post-respuesta y se añade uno en `sendMessage`, dentro del bloque `if (sender === 'contact')`, fire-and-forget y **sin condición de modo**. Todos los canales quedan cubiertos por ser el punto de entrada único.

Consecuencias asumidas:

- El análisis se mide sobre la transcripción que termina en el mensaje del cliente: es el momento "sin responder", que es lo que la urgencia quiere capturar.
- El sentimiento ya no se recalcula tras la respuesta del bot; si el bot calma al cliente, el dato se actualiza con el **siguiente** mensaje del cliente. Es coherente con "urgencia/sentimiento = estado del cliente".
- En `human_takeover` el análisis deja de congelarse (antes no había respuesta del bot, por lo que no había disparo).

**Guard de concurrencia**: se serializa el análisis por conversación (cadena de promesas en memoria, `Map<conversationId, Promise>`). Sin él, dos análisis solapados pueden terminar fuera de orden y dejar persistido el resultado más viejo (last-write-wins).

### 4. Urgencia del panel: veredicto del análisis compuesto con señales operacionales

Regla: `nivel mostrado = max(nivel analizado, nivel operacional)`, donde el nivel operacional es `medium` si hay una confirmación de herramienta pendiente y `low` en caso contrario. El motivo mostrado es el del nivel ganador (el del análisis, o "espera visto bueno" si gana la señal operacional).

- **Por qué**: el análisis no ve las `tool_call`/`confirmation_request` (se excluyen de la transcripción), así que la confirmación pendiente es una señal que solo el panel conoce; forzarla al menos a `medium` conserva el comportamiento útil actual sin fingir que la IA lo detectó.
- **Sin análisis**: se conserva la heurística derivada actual como respaldo, sin presentarla como resultado del análisis (el panel de sentimiento muestra su estado vacío).

### 5. Bandeja: reutilizar el dato ya presente y propagarlo a la room del dashboard

- El backend no cambia la agregación de la lista (ya devuelve `aiInsights`); solo se declara `aiInsights?: ConversationInsights` en `ChatConversation`.
- Para que el indicador viva, `chat:insights` se emite además a la room exclusiva del dashboard con el patrón `emitToProjectDashboard(projectId, 'chat:insights', payload, conversationId)`. El frontend (`useConversations`) aplica el evento sobre el elemento de la lista.
- El indicador se pinta solo para `medium` (`butter`) y `high` (`danger`); `low` y sin análisis no marcan.

### 6. Compatibilidad con datos previos

`aiInsights.urgency` es opcional. `GET /:id/insights` devuelve `urgency` solo si existe; con datos previos devuelve sentimiento y la UI cae al respaldo. Sin migración ni backfill.

## Risks / Trade-offs

- **Más llamadas al modelo en `human_takeover`** (antes 0, ahora 1 por mensaje entrante) → aceptado: es el objetivo (priorizar con dato fresco); el guard de serialización evita avalanchas por conversación, y el análisis es fire-and-forget con `maxTokens` acotado.
- **Cambio semántico del sentimiento** (medido antes de la respuesta del bot, no después) → documentado en proposal y specs; el próximo mensaje del cliente recalcula. Si se quiere el dato post-respuesta habría que duplicar llamadas, lo que se descartó.
- **Carreras de escritura** sobre el mismo documento (`lastMessage`/`unreadCount` vs `aiInsights`) → son `$set`/`$inc` sobre campos distintos; no hay conflicto. El único riesgo real es el orden entre análisis, resuelto por la serialización.
- **El modelo no respeta el JSON** → `parse()` ya extrae/valida; la urgencia malformada se normaliza y un fallo total conserva los insights anteriores (fallo silencioso).
- **Ruido visual en la bandeja** → solo Media/Alta marcan.
- **Una conversación con datos viejos no muestra urgencia hasta su próximo mensaje** → aceptado (Non-Goal el backfill).

## Migration Plan

Sin migración de datos. Despliegue backend primero (tolera `urgency` ausente y ya emite el evento), frontend después (consume el campo opcional). Rollback: revertir el commit; los documentos con `urgency` siguen siendo válidos para el código anterior (campo ignorado).

## Open Questions

- ¿Conviene un debounce adicional (p.ej. omitir el análisis si ya corrió hace N segundos para la misma conversación) si aparece abuso de mensajes? Diferible: la serialización ya evita el solapamiento y el costo es comparable al de hoy.
