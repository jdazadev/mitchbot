## 1. Filtros, búsqueda y agrupación

- [x] 1.1 Cargar la configuración de canales del proyecto activo en `Messaging.vue` y generar los chips dinámicamente (solo habilitados + "Todos"); verificar que un canal deshabilitado no aparece.
- [x] 1.2 Implementar el filtrado real por plataforma y la búsqueda por nombre/último mensaje (`v-model`); verificar que filtrar y buscar reducen la lista y que vaciar restaura todo.
- [x] 1.3 Agrupar los mensajes por día con encabezados reales y eliminar el divider fijo "Today"; verificar con una conversación de varios días.

## 2. Toma de control manual

- [x] 2.1 Exponer `updateConversationMode(id, mode)` en `services/messaging.service.ts` contra `PUT /api/conversations/:id/mode`; verificar con `pnpm --filter @mitchbot/frontend build`.
- [x] 2.2 Conectar el botón "Take Over" y la reactivación del modo automático en `Messaging.vue`, actualizando el badge desde `chat:status`; verificar que el modo cambia sin recargar y que el bot no responde en `human_takeover`.
- [x] 2.3 Confirmar que `PUT /api/conversations/:id/mode` emite `chat:status` (base entregada por `chat-memory-and-flow`); verificar con una llamada autenticada.

## 3. Guardar cliente como contacto

- [x] 3.1 Refactorizar `ensureContactCreated()` para aceptar `{ force: true }` (ignora `autoCreateContact`) manteniendo la búsqueda idempotente por identificador + proyecto; verificar con `pnpm --filter @mitchbot/backend build`.
- [x] 3.2 Añadir `POST /api/conversations/:id/contact` en `messaging.routes.ts`/`messaging.controller.ts`; verificar que crea el contacto y que repetir la llamada no duplica.
- [x] 3.3 Añadir la acción "Guardar como contacto" en la conversación y actualizar el estado de contacto en la UI; verificar que funciona con `autoCreateContact` deshabilitado.

## 4. Conteo de no leídos

- [x] 4.1 Crear el composable `useConversations` (lista, no leídos, canal activo) con estado de módulo; verificar con `pnpm --filter @mitchbot/frontend build`.
- [x] 4.2 Consumir el composable en `Messaging.vue` y `Sidebar.vue` y eliminar el badge hardcodeado; verificar que el total refleja los no leídos reales.
- [x] 4.3 Actualizar el conteo en vivo con los eventos de socket (`chat:message`, `chat:new_conversation`); verificar el incremento sin recargar.

## 5. AI Insights

- [x] 5.1 Añadir `OPENROUTER_INSIGHTS_MODEL` (opcional) en `config/env.ts` y `apps/backend/.env.example`; verificar con `pnpm --filter @mitchbot/backend build`.
- [x] 5.2 Crear `services/insights.service.ts` que analice la conversación con el modelo dedicado (fallback al de chat) y valide `{ sentiment, sentimentScores, summary }`; verificar con una conversación de prueba.
- [x] 5.3 Ampliar `conversation.model.ts` con el campo opcional `summary` en `aiInsights` y ejecutar el análisis fire-and-forget tras cada respuesta del bot; verificar que un fallo no afecta la respuesta.
- [x] 5.4 Reemplazar el stub por `GET /:id/insights` (lectura) y `POST /:id/insights` (recálculo) y emitir el evento de socket; verificar que el botón "Analizar" devuelve insights actualizados.
- [x] 5.5 Conectar el panel de `Messaging.vue` a los datos reales (sentimiento, barras, resumen), actualización en vivo y estado vacío; verificar que no quedan valores estáticos.

## 6. Limpieza del compositor

- [x] 6.1 Eliminar chips de sugerencia, emoji, adjuntos, imagen, botón de filtro, menú de tres puntos, indicador "online" simulado y badge de confianza; verificar que el compositor solo expone acciones funcionales.
- [x] 6.2 Verificar que enviar un mensaje y tomar control siguen funcionando tras la limpieza.

## 7. Pruebas e2e

- [x] 7.1 Añadir/ajustar specs de filtros de canal, búsqueda, guardar contacto, toma de control e insights; ajustar el stub si requiere el modelo de insights.
- [x] 7.2 Ejecutar `pnpm test:e2e` y confirmar que la suite pasa.

## 8. Documentación y versión

- [x] 8.1 Actualizar `AGENTS.md` (módulo de mensajería: filtros, take over, guardar contacto, no leídos, insights y `OPENROUTER_INSIGHTS_MODEL`) y la tabla de variables de entorno.
- [x] 8.2 Registrar el cambio en `changelog.md` con la fecha actual y subir la versión de forma menor.

## 9. Verificación final

- [x] 9.1 Ejecutar `pnpm --filter @mitchbot/backend build`, `pnpm --filter @mitchbot/backend test` y `pnpm --filter @mitchbot/frontend build` y confirmar que pasan sin errores.
- [x] 9.2 Ejecutar `openspec validate messaging-ui-cleanup --strict` y confirmar que el change es válido.
- [x] 9.3 Realizar el commit del cambio implementado.
