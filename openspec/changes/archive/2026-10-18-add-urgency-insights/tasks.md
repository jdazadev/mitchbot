## 1. Backend: contrato del análisis

- [x] 1.1 Extender `ConversationInsights` y el `SYSTEM_PROMPT` de `insights.service.ts` con `urgency: { level: low|medium|high, reason: none|deadline|incident|escalation|repetition }` en el mismo JSON; verificar que el typecheck del backend pasa
- [x] 1.2 Extender `parse()` para validar `level` (estricto) y normalizar `reason` inválido/ausente a `none`, preservando el clamp de `sentimentScores`; verificar que `analyzeConversation` persiste `aiInsights.urgency` y lo incluye en el payload de `chat:insights`
- [x] 1.3 Declarar `urgency?: { level; reason }` en `Conversation.aiInsights` (`conversation.model.ts`) y verificar typecheck

## 2. Backend: disparador y propagación

- [x] 2.1 Añadir un guard de serialización por conversación (cadena de promesas) alrededor del análisis y verificar que dos análisis solapados de la misma conversación no dejan persistido el resultado más viejo
- [x] 2.2 Retirar los disparos de `chat.service.ts:516` (respuesta directa) y `:735` (respuesta final tras herramientas) y verificar que generar una respuesta del bot ya no recalcula insights
- [x] 2.3 Disparar `refreshInBackground` en `sendMessage`, dentro del bloque `if (sender === 'contact')`, sin condición de modo; verificar que en `human_takeover` un mensaje del cliente recalcula sin respuesta del bot y que el primer mensaje de una conversación nueva deja insights
- [x] 2.4 Emitir `chat:insights` también a la room del dashboard con `emitToProjectDashboard(projectId, 'chat:insights', payload, conversationId)`; verificar que un socket del dashboard recibe el evento una sola vez

## 3. Backend: endpoint de lectura

- [x] 3.1 Devolver `urgency` en `GET /api/conversations/:id/insights` solo cuando exista (datos previos sin urgencia devuelven sentimiento y nada más) y verificar que `POST /:id/insights` incluye la urgencia en su respuesta

## 4. Frontend: tipos y estado

- [x] 4.1 Extender `ConversationInsights` con `urgency` opcional y declarar `aiInsights?: ConversationInsights` en `ChatConversation` (`messaging.service.ts`); verificar `vue-tsc --noEmit`
- [x] 4.2 Manejar `chat:insights` en `useConversations.ts` para actualizar el `aiInsights` del elemento listado; verificar que el indicador de la bandeja cambia en vivo sin recargar

## 5. Frontend: interfaz

- [x] 5.1 Añadir las claves `messaging.urgency.motive.{none,deadline,incident,escalation,repetition}` en `es.json` y `en.json` conservando las operacionales existentes; verificar paridad es/en
- [x] 5.2 Reescribir el `computed` de `urgency` en `Messaging.vue`: `max(nivel analizado, señal operacional)`, motivo del ganador y respaldo heurístico sin análisis; verificar los casos Baja/Media/Alta y el escalado por confirmación pendiente
- [x] 5.3 Añadir el indicador de urgencia en las filas de la bandeja, visible solo para Media (`butter`) y Alta (`danger`); verificar que Baja y sin análisis no marcan

## 6. Pruebas e2e

- [x] 6.1 Incluir `urgency` en el JSON fijo del stub (`tests/stub/openai-stub.mjs`); verificar que la suite arranca y responde con el campo
- [x] 6.2 Extender `messaging.spec.ts` (test de insights reales) con aserciones de `urgency.level` y `urgency.reason` en el análisis automático y manual
- [x] 6.3 Añadir un test de que en `human_takeover` un mensaje del cliente recalcula insights sin respuesta del bot; verificar que pasa
- [x] 6.4 Ejecutar `pnpm test:e2e messaging` y verificar la suite en verde

## 7. Verificación y cierre

- [x] 7.1 Correr `vue-tsc --noEmit` y `build` del frontend más el typecheck del backend y verificar que pasan
- [x] 7.2 Verificar manualmente en navegador: urgencia desde el primer mensaje, refresco en takeover, indicador en la bandeja y composición con confirmación pendiente
- [x] 7.3 Actualizar `changelog.md` y `AGENTS.md` con la fecha y el bump semántico desde v0.4.25 a v0.4.26 y realizar el commit del cambio
