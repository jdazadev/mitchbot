# Mejorar el Resumen (Dashboard) con métricas funcionales

## Why

El Resumen responde solo "¿cuántas conversaciones hubo?" y arrastra dos instrumentos deshonestos: la tasa de respuesta es un valor fijo `98%` (`apps/backend/src/services/analytics.service.ts:43`) y el panel de Actividad reciente siempre está vacío porque `trackActivity()` nunca se invoca. El dueño del negocio no puede responder las dos preguntas que justifican mirar el tablero cada mañana: **¿el bot está funcionando?** y **¿me está trayendo negocio?** Toda la información necesaria ya está en la base de datos; falta agregarla y exponerla.

## What Changes

- **Métricas de negocio (sin dinero)**: leads capturados (contactos nuevos), citas agendadas por estado y tasa de conversación (leads/conversaciones).
- **Salud de la automatización**: cobertura del bot vs. takeover humano, distribución agregada de sentimiento y herramientas más ejecutadas con su tasa de éxito.
- **Honestidad y reparación**: reemplazar la tasa de respuesta inventada por métricas reales de mensajería (tasa de respuesta real y mediana de tiempo de primera respuesta), y mostrar el backlog accionable (conversaciones `pending_human` + no leídos).
- **Actividad reciente real**: instrumentar `trackActivity` en los eventos de escritura existentes (conversación creada/cerrada, contacto creado, herramienta ejecutada) para que el panel deje de estar vacío.
- **Volumen más informativo**: desglose del volumen de mensajes por emisor (cliente / bot / humano) sobre el volumen de conversaciones.
- **Fuera de alcance (para una tanda posterior)**: métricas de dinero (`orders.total`, ingresos, ticket medio) y métricas operativas avanzadas (heatmap de horarios, tiempo de primera respuesta por canal, cobertura RAG). Se explicitan como non-goals.

## Capabilities

### New Capabilities
<!-- Ninguna: las nuevas métricas extienden el comportamiento del dashboard existente. -->

### Modified Capabilities
- `dashboard-analytics`: se amplían las métricas del Resumen con resultados de negocio (leads, citas, conversión), salud de la automatización (cobertura del bot, sentimiento, herramientas), métricas reales de mensajería (tasa de respuesta, tiempo de primera respuesta, backlog), volumen por emisor y una actividad reciente poblada con eventos reales. Se elimina la tasa de respuesta fija.

## Impact

- **Backend**: `apps/backend/src/services/analytics.service.ts` (nuevas agregaciones sobre `contacts`, `appointments`, `tool_executions`, `messages` y campos de `conversations`) y `apps/backend/src/controllers/dashboard.controller.ts` + `apps/backend/src/routes/` (nuevos endpoints de lectura). Instrumentación de `analyticsService.trackActivity` en `chat.service` / creación de contacto / ejecución de herramientas.
- **Frontend**: `apps/frontend/src/views/Dashboard.vue`, `apps/frontend/src/services/dashboard.service.ts`, `apps/frontend/src/locales/es.json` y `en.json` (claves `dashboard.*`).
- **Specs**: `openspec/specs/dashboard-analytics/spec.md` (delta).
- **Sin cambios**: esquemas de base de datos (se agrega sobre campos ya existentes), autenticación y aislamiento por proyecto (se mantienen).
