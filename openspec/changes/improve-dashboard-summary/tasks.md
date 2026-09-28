# Tareas — Resumen funcional

## 1. Instrumentación de actividad (backend)

- [ ] 1.1 Ampliar el union `Activity['type']` en `apps/backend/src/models/activity.model.ts` con `conversation_created` y `tool_executed`, y verificar que compila (`pnpm --filter @mitchbot/backend exec tsc --noEmit`).
- [ ] 1.2 Invocar `analyticsService.trackActivity()` al crear una conversación (chat.service / public-chat), tipo `conversation_created`, con `catch` que no rompe el flujo; verificar manualmente que se inserta el documento en `activities`.
- [ ] 1.3 Invocar `trackActivity()` al cerrar una conversación por despedida, tipo `conversation_closed`; verificar inserción al cerrar una conversación.
- [ ] 1.4 Invocar `trackActivity()` en `ensureContactCreated`, tipo `new_contact`; verificar inserción al contestar el primer mensaje de un cliente.
- [ ] 1.5 Invocar `trackActivity()` tras ejecutar una herramienta en `handleToolCalls`, tipo `tool_executed`, incluyendo el nombre de la herramienta en `metadata`; verificar inserción al confirmar una ejecución.
- [ ] 1.6 Verificar que un fallo al registrar actividad no altera la respuesta del bot (revisión del flujo + log de error contenido).

## 2. Métricas de mensajería (backend)

- [ ] 2.1 Implementar en `analytics.service.ts` el cálculo de tasa de respuesta real y mediana de tiempo de primera respuesta con el enfoque de dos fases (ids de conversaciones del rango → agregación de `messages`) descrito en design D3; verificar con datos de prueba que el resultado no es un valor fijo.
- [ ] 2.2 Implementar `botCoverage` (`auto_pilot / total`) y `backlog { pendingHuman, unread }`; verificar los valores contra consultas directas a MongoDB.
- [ ] 2.3 Aplicar el `limit` configurable de conversaciones y el timeout del cálculo de mensajería; verificar que al superar el límite la métrica responde sin bloquear.

## 3. Resultados de negocio (backend)

- [ ] 3.1 Implementar `getOutcomes` con `leads` (contactos creados en el rango, excluyendo archivados), `appointments.byStatus` y `conversionRate`; verificar contra datos de prueba por rango.
- [ ] 3.2 Manejar el caso sin conversaciones para `conversionRate` (`0%`) y sin citas (objeto con estados en 0); verificar con un proyecto sin datos.

## 4. Automatización y volumen (backend)

- [ ] 4.1 Implementar `getAutomation` con la distribución agregada de sentimiento (positivos/neutrales/negativos + `analyzed`) y el top de herramientas con `count`/`successRate`; verificar que las conversaciones sin análisis se excluyen.
- [ ] 4.2 Extender `getVolume` con `bySender` (cliente/bot/humano por período), excluyendo mensajes `tool` y contenidos de herramienta; verificar que la suma de emisores coincide con el conteo de mensajes válidos.
- [ ] 4.3 Verificar estados vacíos: proyecto sin análisis → `analyzed: 0`; sin ejecuciones → lista vacía.

## 5. API (backend)

- [ ] 5.1 Extender `getStats` en `dashboard.controller.ts` para devolver las nuevas métricas de mensajería y backlog, manteniendo el aislamiento por proyecto y el rango (`parseRange`).
- [ ] 5.2 Añadir los handlers y rutas `GET /dashboard/outcomes` y `GET /dashboard/automation`; verificar que responden 401 sin token y 403 sin proyecto resuelto.
- [ ] 5.3 Verificar que todos los endpoints nuevos aceptan `days`/`from`/`to` y devuelven solo datos del proyecto activo (uso de dos proyectos en seed de prueba).

## 6. Frontend — servicio y datos

- [ ] 6.1 Extender `apps/frontend/src/services/dashboard.service.ts` con los tipos y llamadas de `stats`, `outcomes` y `automation`, y el nuevo campo `bySender` de `volume`; verificar que el tipado compila (`vue-tsc`).
- [ ] 6.2 Integrar las nuevas consultas en `Dashboard.vue` con `Promise.all`, manteniendo el refresco independiente del volumen por período y el manejo de error con Reintentar.

## 7. Frontend — UI del Resumen

- [ ] 7.1 Reorganizar el Resumen en las dos bandas ("Resultados" y "Salud del bot") más los paneles de sentimiento y herramientas, según design D5; verificar render con datos reales.
- [ ] 7.2 Implementar estados vacíos honestos en tiempo de primera respuesta, sentimiento y herramientas (nunca valores fijos); verificar con un proyecto sin datos.
- [ ] 7.3 Formatear números y fechas con el locale de la app (`useI18n`) en los bloques nuevos; verificar el cambio de formato al alternar es/en.

## 8. i18n

- [ ] 8.1 Añadir todas las claves nuevas `dashboard.*` a `es.json` y `en.json`; verificar paridad exacta de claves.
- [ ] 8.2 Verificar que no quedan literales ni claves sin traducir en los bloques nuevos (revisión de `Dashboard.vue`).

## 9. Verificación final

- [ ] 9.1 Ejecutar `pnpm --filter @mitchbot/frontend exec vue-tsc --noEmit` y el build, ambos en verde.
- [ ] 9.2 Ejecutar la suite e2e de dashboard/analytics (`pnpm test:e2e`) y verificar que el Resumen muestra datos reales y estados vacíos correctos.
- [ ] 9.3 Verificar en navegador (1440 y 390) que la nueva composición no rompe el layout ni el modo oscuro.
