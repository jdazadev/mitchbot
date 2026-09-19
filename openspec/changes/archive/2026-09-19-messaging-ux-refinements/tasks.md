## 1. Respuesta del bot como mensaje completo

- [x] 1.1 Eliminar la emisión de fragmentos parciales (`onChunk`) en `generateBotResponse` de `apps/backend/src/services/chat.service.ts`, conservando el mensaje final con `isDone: true` y el placeholder que da el indicador de escritura.
- [x] 1.2 Eliminar la emisión de fragmentos parciales en `generateFinalToolResponse` y quitar el parámetro `onChunk` de ambas llamadas al servicio de IA. Verificar que la respuesta final sigue llegando completa por tiempo real.
- [x] 1.3 Hacer explícito en `Messaging.vue`, `TestChat.vue` y `useConversations.ts` que solo se aplica el mensaje final (ignorar `isDone: false`), verificando que el mensaje se renderiza completo y el indicador de escritura desaparece al llegar.
- [x] 1.4 Actualizar `tests/e2e/specs/realtime.spec.ts` para esperar un único mensaje final con `isDone: true` en lugar de varios fragmentos, y renombrar el caso.

## 2. Insights sin resumen

- [x] 2.1 En `apps/backend/src/services/insights.service.ts`: retirar `summary` del tipo `ConversationInsights`, del prompt (conservando la marca `INSIGHTS_JSON`), de la validación y del `$set` de persistencia. Verificar que el análisis sigue produciendo sentimiento y distribución sin fallar.
- [x] 2.2 Retirar `aiInsights.summary` de `apps/backend/src/models/conversation.model.ts` y verificar que el backend compila.
- [x] 2.3 Retirar `summary` del tipo en `apps/frontend/src/services/messaging.service.ts`, eliminar la tarjeta de resumen en `Messaging.vue` y quitar la clave `messaging.insights.summary` de `locales/es.json` y `en.json`. Verificar que el panel solo muestra sentimiento y distribución.
- [x] 2.4 Quitar `summary` de la respuesta determinista del stub (`tests/stub/openai-stub.mjs`) y reescribir las aserciones de `tests/e2e/specs/messaging.spec.ts` sobre el sentimiento (API y etiqueta visible). Verificar que el e2e de insights pasa.
- [x] 2.5 (Opcional) Limpiar `aiInsights.summary` de las conversaciones existentes con `$unset` al re-analizar, o mediante un script puntual en `apps/backend/src/scripts/`. Verificar que las conversaciones re-analizadas ya no contienen el campo.

## 3. Botón "Ver conversación" en clientes

- [x] 3.1 Añadir un filtro opcional por `contactId` (validado y acotado al proyecto) al listado de conversaciones en `messaging.controller.ts` y al método correspondiente de `messaging.service.ts`. Verificar con una petición que devuelve las conversaciones del contacto y ninguna de otro proyecto.
- [x] 3.2 Añadir en `apps/frontend/src/views/Clients.vue` un botón "Ver conversación" por fila que navegue a `/messaging?conversation=<id>`, visible solo cuando el cliente tiene conversación. Añadir los textos en `es.json`/`en.json`.
- [x] 3.3 Soportar la conversación preseleccionada en `Messaging.vue`: leer `route.query.conversation`, seleccionarla tras cargar la lista (prefiriendo la activa, luego la más reciente) y aplicar el fallback por defecto si no es válida. Verificar abriendo la conversación desde un cliente.
- [x] 3.4 Añadir cobertura e2e en el spec de clientes: desde una fila con conversación se abre la bandeja con esa conversación seleccionada; un cliente sin conversación no muestra la acción.

## 4. Verificación y documentación

- [x] 4.1 Ejecutar la suite e2e afectada (`pnpm test:e2e messaging`, `realtime`, `clients`) y confirmar que pasa en verde, junto con el typecheck del backend y frontend.
- [x] 4.2 Actualizar `AGENTS.md` (respuesta directa, insights solo sentimiento, acceso desde clientes), añadir la entrada en `changelog.md` y subir la versión semver.
