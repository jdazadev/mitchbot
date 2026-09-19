## Why

La tarjeta "Conversaciones totales" del Dashboard muestra un número más alto de lo esperado porque las métricas se calculan sobre **toda la base de datos**, mezclando conversaciones de todos los proyectos. La causa es de tres capas: las rutas `/api/dashboard/*` no están autenticadas ni resuelven el proyecto por petición, el controlador nunca lee el proyecto activo y el servicio de analítica no filtra por `projectId`. Esto rompe el aislamiento multi-proyecto del resto de la aplicación y deja las métricas del dashboard accesibles sin token.

## What Changes

- Aplicar autenticación a las cuatro rutas del dashboard (`/stats`, `/volume`, `/channels`, `/activities`), de modo que resuelvan el proyecto activo por petición.
- Filtrar **todas** las métricas del dashboard por `projectId`: estadísticas, volumen, distribución por canal y actividad reciente.
- Enviar las cabeceras de autenticación y `X-Project-Id` desde el servicio de dashboard del frontend, igual que el resto de servicios.
- **BREAKING** (interno): los endpoints `/api/dashboard/*` dejan de ser públicos; requieren token válido. El contrato de respuesta no cambia.

## Capabilities

### New Capabilities

- `dashboard-analytics`: endpoints y métricas del dashboard (conversaciones totales/activas/cerradas, volumen, distribución por canal y actividad) autenticados y acotados al proyecto activo.

### Modified Capabilities

<!-- Ninguna capacidad existente cambia sus requisitos: el dashboard no estaba especificado. -->

## Impact

- `apps/backend/src/routes/dashboard.routes.ts`: middleware de autenticación por ruta.
- `apps/backend/src/controllers/dashboard.controller.ts`: pasar el proyecto resuelto al servicio.
- `apps/backend/src/services/analytics.service.ts`: filtro por `projectId` en `getStats`, `getVolume`, `getChannelDistribution` y `getRecentActivity`.
- `apps/frontend/src/services/dashboard.service.ts`: usar `authService.getHeaders()` en los cuatro métodos.
- `tests/e2e/specs/dashboard.spec.ts`: cobertura del aislamiento por proyecto y del acceso autenticado.
- Documentación: `AGENTS.md` y `changelog.md`.
