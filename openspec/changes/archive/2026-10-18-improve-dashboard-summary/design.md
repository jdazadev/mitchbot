# Diseño técnico — Resumen funcional

## Context

Ver `proposal.md` para la motivación. El punto de partida relevante para el diseño:

- El Resumen actual obtiene datos con cuatro llamadas en paralelo (`getStats`, `getChannelDistribution`, `getActivities`, `getVolume`) desde `apps/frontend/src/views/Dashboard.vue` hacia `apps/backend/src/services/analytics.service.ts`.
- Las colecciones `contacts`, `appointments`, `tool_executions` y `messages` ya existen y tienen `projectId` (salvo `messages`, que se vincula vía `conversationId`), pero el servicio de analytics solo consulta `conversations` y `activities`.
- `analyticsService.trackActivity()` existe y nunca se invoca, y el seed no puebla `activities`.
- La actividad reciente no tiene un enum de tipos que cubra "conversación creada" ni "herramienta ejecutada" (`activity.model.ts`).
- El frontend formatea números con `Intl.NumberFormat()` sin locale; v0.4.19 estableció usar el locale de la app.

## Goals / Non-Goals

**Goals:**

- Exponer métricas reales de negocio (leads, citas, conversión) y de automatización (cobertura del bot, sentimiento agregado, uso de herramientas) acotadas al proyecto y al rango.
- Reemplazar la tasa de respuesta fija por métricas reales de mensajería (tasa de respuesta y mediana de tiempo de primera respuesta) y mostrar el backlog accionable.
- Revivir la actividad reciente mediante instrumentación de eventos en los puntos de escritura existentes.
- Ampliar el volumen con desglose por emisor (cliente / bot / humano).

**Non-Goals:**

- Métricas de dinero (`orders.total`, ingresos, ticket medio).
- Heatmap de horarios/días pico, tiempo de primera respuesta por canal y cobertura RAG (requiere instrumentación adicional).
- Denormalizar campos en `conversations` o cambiar esquemas de MongoDB.
- Backfill de actividad histórica.

## Decisions

### D1. Endpoints de lectura por dominio, no un único `/dashboard/summary`

Se añaden endpoints granulares que siguen el patrón actual:

| Endpoint | Contenido | Fuente |
|---|---|---|
| `GET /dashboard/stats` (extendido) | total, active, closed, **responseRate real**, **firstResponseMs**, **botCoverage**, **backlog { pendingHuman, unread }** | `conversations`, `messages` |
| `GET /dashboard/outcomes` (nuevo) | **leads**, **appointments { total, byStatus }**, **conversionRate** | `contacts`, `appointments`, `conversations` |
| `GET /dashboard/automation` (nuevo) | **sentiment { positive, neutral, negative, analyzed }**, **tools [{ name, count, successRate }]** | `conversations.aiInsights`, `tool_executions` |
| `GET /dashboard/volume` (extendido) | volumen actual + **bySender { contact, bot, human }** por período | `messages` |
| `GET /dashboard/channels` | sin cambios | `conversations` |
| `GET /dashboard/activities` | sin cambios (ahora con datos) | `activities` |

Alternativas consideradas:

- **Un `GET /dashboard/summary` que agregue todo**: menos round-trips, pero acopla el refresco de todo (cambiar el período del volumen recargaría métricas no relacionadas) y hace cada bloque menos testeable de forma aislada. Se descarta.
- **Extender solo `/dashboard/stats` con todo**: un payload sobredimensionado y un único punto de fallo. Se descarta.

La respuesta se mantiene `Promise.all` en el frontend; los bloques que dependen del período (volumen) siguen refrescándose por separado.

### D2. Contrato de métricas (definiciones observables)

- **responseRate**: `conversacionesConRespuesta / conversacionesConMensajeEntrante` (0–100%). Una conversación "con respuesta" es la que tiene al menos un `messages.sender` en `ai_agent` o `human_agent` posterior al primer mensaje del cliente. Sin conversaciones → `0%`.
- **firstResponseMs**: mediana del intervalo `primerRespuesta - primerMensajeCliente` por conversación con respuesta. Sin conversaciones con respuesta → `null` (estado vacío en UI).
- **botCoverage**: `auto_pilot / total` (0–100%).
- **backlog.pendingHuman**: conteo de `conversations.status = pending_human`. **backlog.unread**: `$sum` de `unreadCount`.
- **leads**: conteo de `contacts` con `createdAt` en el rango (excluye archivados).
- **appointments.byStatus**: `$group` por `status` (`pending|confirmed|completed|cancelled`).
- **conversionRate**: `leads / conversacionesCreadasEnRango` (0–100%).
- **sentiment**: `$group` sobre `conversations.aiInsights.sentiment` del rango; `analyzed` = suma. Sin análisis → estado vacío.
- **tools**: `$group` sobre `tool_executions` del rango por `toolName` con `count` y `successRate = executed / total`; ordenado por `count` desc.
- **volume.bySender**: conteo de `messages` por período, agrupando `sender` en cliente (`contact`), bot (`ai_agent`) y humano (`human_agent`); se excluyen `tool` y los `contentType` de herramienta.

### D3. Cálculo de métricas de mensajería: dos fases, sin `$lookup`

La tasa/tiempo de respuesta requiere correlacionar conversaciones con sus mensajes. Se hace en dos consultas acotadas:

1. Obtener los `_id` de las conversaciones del proyecto dentro del rango (`find` con proyección `{_id:1}`).
2. Agregar `messages` con `$match: { conversationId: { $in: ids } }`, ordenado por `createdAt`, agrupando por conversación el primer mensaje de cliente y la primera respuesta posterior.

Alternativas consideradas:

- **`$lookup` conversations → messages**: un solo pipeline pero lookup no indexado y costoso por conversación. Se descarta.
- **Denormalizar `firstResponseAt` en `conversations` al escribir**: más eficiente en lectura, pero implica cambio de esquema y backfill. Se posterga (ver Open Questions).

Mitigación de escala: se aplica un `limit` configurable de conversaciones por rango (por defecto alto, p. ej. 5000) y un timeout; si se excede, la métrica se calcula sobre la ventana y se documenta la limitación.

### D4. Instrumentación de actividad en los puntos de escritura

Se invoca `analyticsService.trackActivity()` (fire-and-forget, con `catch` que no rompe el flujo) en:

- Creación de conversación (`chat.service` / `public-chat` al iniciar) → tipo `conversation_created`.
- Cierre por despedida (`chat.service`) → `conversation_closed`.
- Creación de contacto (`ensureContactCreated`) → `new_contact`.
- Ejecución de herramienta (`handleToolCalls` tras `execute`) → `tool_executed`.
- Takeover humano → `bot_handoff` (ya contemplado en el enum).

Se amplía el union de `Activity['type']` con `conversation_created` y `tool_executed`. MongoDB no requiere migración; es un cambio de tipos TypeScript en `activity.model.ts`.

### D5. Reorganización del Resumen en dos bandas + paneles

Se mantiene la estética Aurora existente (tarjetas `rounded-card bg-surface shadow-card`), reorganizada:

```
Banda "Resultados"   : Conversaciones | Leads | Citas | Conversión
Banda "Salud del bot": Tasa de respuesta | 1a respuesta | Cobertura bot | Backlog
Volumen (con desglose por emisor)
Canales            | Sentimiento agregado
Actividad reciente | Herramientas mas usadas
```

- Los nuevos bloques usan estado vacío honesto (`AEmptyState` / mensaje i18n) cuando no hay datos; nunca valores fijos.
- Los números y fechas se formatean con el locale de la app (`useI18n().locale`), no con `Intl.NumberFormat()` sin locale.
- Todos los textos nuevos van a `dashboard.*` en `es.json` y `en.json` (paridad de claves).

## Risks / Trade-offs

- **[Coste del cálculo de respuesta en proyectos grandes]** → dos fases con `$in` acotado por rango + `limit` + timeout; si aparece, denormalizar `firstResponseAt` (Open Question).
- **[Actividad solo registra eventos nuevos]** → el panel estará vacío hasta que ocurran eventos; aceptable y honesto. Backfill fuera de alcance.
- **[Citas/leads pueden ser 0 y parecer "roto"]** → los estados vacíos y el copy deben dejar claro que no hay datos, no que falló.
- **[Fronteras de fecha y zona horaria]** → se conserva el comportamiento actual del backend (`days` calculado en hora del servidor); no se introduce TZ por proyecto en esta tanda.
- **[Sentimiento excluye conversaciones sin análisis]** → puede bajar el denominador; se muestra `analyzed` para no sugerir cobertura total.
- **[Superficie de API creciente]** → endpoints separados y documentados; se prioriza claridad y testabilidad sobre minimizar round-trips.

## Migration Plan

1. Backend: extender `analytics.service`/`dashboard.controller` y añadir rutas; instrumentar `trackActivity`. Desplegar sin cambios de esquema.
2. Frontend: extender `dashboard.service.ts` y `Dashboard.vue`; añadir claves i18n.
3. Rollback: los endpoints nuevos son aditivos y el frontend tolera su ausencia mediante el manejo de error existente; revertir el frontend restaura el Resumen previo.

## Open Questions

- Umbral exacto del `limit` de conversaciones para el cálculo de tiempo de respuesta (a calibrar con datos reales; no cambia specs ni tareas).
- Si la denormalización de `firstResponseAt` será necesaria (se decide tras medir con datos reales).
