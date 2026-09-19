## Context

Ver `proposal.md` para la motivación. Estado relevante para el diseño:

- Los títulos de la barra superior se resuelven con un `switch` por `route.name` en `Topbar.vue`; no hay `meta.title`. El menú vive en `Sidebar.vue` con un array `navItems`.
- `/contacts` está registrado en `router/index.ts` apuntando a `views/Contacts.vue`; no hay ruta `/clients`.
- `GET /api/dashboard/volume` acepta `period: daily | weekly`; `getStats` no acepta rango. El widget "Last 30 Days" del Topbar es HTML estático y los toggles del Dashboard no tienen handler.
- `socket.service.ts` ya define helpers para el evento `admin:notification`; `Messaging.vue` solo lo registra en consola. No hay panel de notificaciones.
- El idioma del agente se define en `AgentPersonality['language'] = 'es' | 'en' | 'pt' | 'auto'`, se valida con `z.enum(['es','en','pt','auto'])` en `agents.controller.ts` y se traduce en `LANGUAGE_MAP` de `prompt-builder.service.ts`.

## Goals / Non-Goals

**Goals:**

- Nomenclatura clara y consistente sin tocar el contrato del backend.
- Controles de fecha con efecto real sobre las métricas.
- Un centro de notificaciones simple y honesto (alcance de sesión).
- Restringir el idioma del agente a los dos idiomas soportados.

**Non-Goals:**

- Renombrar la colección `contacts`, los endpoints `/api/contacts` ni los tipos internos que mapean esa API.
- Persistir historial de notificaciones en base de datos.
- Analítica avanzada (nuevas métricas, comparativas de periodo).

## Decisions

### D1. Renombre solo de presentación y de frontend

Etiquetas, títulos, ruta `/clients` (con redirección desde `/contacts`), renombre de archivos (`Contacts.vue` → `Clients.vue`, `contact.service.ts` → `client.service.ts`) y textos visibles. El backend, sus rutas y la colección permanecen iguales; el servicio frontend sigue llamando a `/api/contacts`.

- **Rationale**: cero cambios de contrato y cero migración de datos; el riesgo se limita a enlaces internos.
- **Alternativas**: renombrar también API y colección (contrato roto, migración y despliegue coordinado) — descartado.

### D2. Rango de fechas en el Dashboard, no en el Topbar

Se elimina el widget estático del Topbar y el control vive en el Dashboard, donde afecta a sus gráficos. `analytics.service`/`dashboard.controller` aceptan un rango (`from`/`to` o días) y `period` incluye mensual.

- **Rationale**: un control global en el Topbar sugeriría que afecta a toda la app, que no es el caso; el backend solo soporta hasta granularidad semanal.
- **Alternativas**: dejar el widget decorativo (sigue siendo UI muerta); mover toda la analítica a rangos arbitrarios (más alcance del necesario).

### D3. Centro de notificaciones en memoria de sesión

El Topbar escucha `admin:notification`, acumula las notificaciones en un arreglo reactivo local, muestra el indicador si hay no leídas y permite limpiarlas. Sin persistencia.

- **Rationale**: entrega valor real con esfuerzo mínimo y sin nueva colección; el alcance de sesión se documenta de forma explícita.
- **Alternativas**: persistir en base de datos con endpoints de lectura (nueva colección, paginación y estados) — fuera de alcance.

### D4. Idioma del agente: eliminar `pt`/`auto` y normalizar datos

Se reduce el tipo y la validación a `'es' | 'en'`, se eliminan las entradas de `pt`/`auto` de `LANGUAGE_MAP` y de las opciones de `Settings.vue`. Un script de normalización actualiza los agentes almacenados con `pt`/`auto` a `es` (además, el fallback existente de `LANGUAGE_MAP` sigue cubriendo valores inesperados).

- **Rationale**: evita opciones muertas y mantiene el tipo sincronizado con la UI y la validación.
- **Alternativas**: conservar los valores en el modelo (rompe la coherencia con la UI); normalizar de forma perezosa al guardar (deja datos viejos sin corregir).

## Risks / Trade-offs

- **Enlaces o pruebas que apunten a `/contacts`** → se añade redirección y se actualizan los e2e en el mismo change.
- **El renombre de archivos genera ruido en el diff** → acotado a frontend y sin cambios de contrato.
- **Notificaciones solo de sesión** → se documenta; no hay falsa expectativa de persistencia.
- **Agentes existentes con `pt`/`auto`** → script de normalización más fallback a español en el prompt.

## Migration Plan

1. Desplegar backend y frontend juntos (tipo de idioma y validación cambian; la UI deja de ofrecer `pt`/`auto`).
2. Ejecutar el script de normalización de agentes (`pt`/`auto` → `es`) antes o durante el despliegue.
3. Rollback: revertir el despliegue; los datos normalizados a español siguen siendo válidos.

## Open Questions

- Ninguna.
