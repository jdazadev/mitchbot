## 1. Backend: autenticación y proyecto por petición

- [x] 1.1 Aplicar el middleware `authenticate` a las cuatro rutas de `apps/backend/src/routes/dashboard.routes.ts` (`/stats`, `/volume`, `/channels`, `/activities`) y verificar que una petición sin token responde `401` y una con token resuelve `req.projectId`.
- [x] 1.2 Extender `analyticsService.getStats`, `getVolume`, `getChannelDistribution` y `getRecentActivity` para recibir `projectId` e incorporarlo a todos sus filtros (`countDocuments`, `$match`, `find`), combinándolo con el filtro de fecha existente. Verificar con una prueba manual que dos proyectos con datos distintos devuelven cifras distintas.
- [x] 1.3 Actualizar `apps/backend/src/controllers/dashboard.controller.ts` para pasar `req.projectId` a las cuatro llamadas del servicio. Verificar que el backend compila (`pnpm --filter @mitchbot/backend exec tsc --noEmit`).

## 2. Frontend: cabeceras de autenticación

- [x] 2.1 Usar `authService.getHeaders()` en los cuatro métodos de `apps/frontend/src/services/dashboard.service.ts`, siguiendo el patrón de `messaging.service.ts`. Verificar en el navegador que las peticiones a `/api/dashboard/*` incluyen `Authorization` y `X-Project-Id` y que el dashboard carga sin `401`.

## 3. Pruebas

- [x] 3.1 Ampliar `tests/e2e/specs/dashboard.spec.ts`: verificar que las métricas se calculan solo con el proyecto activo (crear datos en un segundo proyecto y comprobar que no alteran el total) y que una petición sin autenticación es rechazada.
- [x] 3.2 Ejecutar `pnpm test:e2e dashboard` y confirmar que la suite del dashboard pasa en verde.

## 4. Documentación

- [x] 4.1 Actualizar `AGENTS.md` (endpoints de dashboard autenticados y acotados al proyecto), añadir la entrada correspondiente en `changelog.md` y subir la versión semver.
