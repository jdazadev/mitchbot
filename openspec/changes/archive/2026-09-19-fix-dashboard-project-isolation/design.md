## Context

Ver `proposal.md` — Why. El dashboard es el único módulo que quedó fuera del aislamiento multi-proyecto. La resolución del proyecto por petición ya existe y la aplican las demás rutas: el middleware `authenticate` (`apps/backend/src/middleware/auth.middleware.ts`) valida el token, resuelve el proyecto desde el header `X-Project-Id` o el `activeProjectId` del usuario, y adjunta `req.projectId`. El frontend ya envía ese header a través de `authService.getHeaders()` en todos los servicios salvo el del dashboard.

## Goals / Non-Goals

**Goals:**

- Acotar las cuatro métricas del dashboard al proyecto activo.
- Cerrar el acceso público a `/api/dashboard/*` reutilizando el middleware de autenticación existente.
- Alinear el servicio de dashboard del frontend con el patrón del resto de servicios.

**Non-Goals:**

- No se corrigen los valores simulados del dashboard (tasa de respuesta `'98%'`, conversión de leads `"14.0%"`, cambio `"+12%"`).
- No se implementa el registro de actividad: la colección `activities` no recibe escrituras hoy, por lo que el feed sigue vacío. Solo se acota su lectura por proyecto.
- No se cambia el contrato de respuesta de los endpoints ni la semántica del rango temporal (7/30/90 días), que se conserva como está definida.

## Decisions

### D1. Autenticación en las rutas, no en el controlador

Aplicar `authenticate` por ruta en `dashboard.routes.ts`, igual que `messaging.routes.ts`. Es el punto donde el resto del backend resuelve `req.projectId`; sin él, el proyecto no existe para el controlador.

- Alternativa descartada: montar el middleware en `routes/index.ts` para `/dashboard`. Menos explícito y difícil de auditar; el patrón del proyecto es por ruta.

### D2. `projectId` como parámetro explícito del servicio de analítica

`getStats`, `getVolume`, `getChannelDistribution` y `getRecentActivity` reciben `projectId` y lo incorporan a sus filtros (`countDocuments`, `$match`). El controlador lo obtiene de `req.projectId`.

- Alternativa descartada: leer el proyecto dentro del servicio. Acopla la capa de datos al contexto HTTP y dificulta las pruebas.
- Tipo: `projectId` como `string`; la conversión a `ObjectId` se hace al construir el filtro (el modelo ya expone la colección con los documentos tipados).

### D3. Filtro de proyecto combinado con el rango temporal

Cada consulta combina `{ projectId }` con el filtro de fecha ya existente (`buildDateFilter`). El filtro de proyecto es obligatorio; el de fecha es opcional. Así el aislamiento se mantiene con cualquier rango.

### D4. Cabeceras de autenticación en el servicio de dashboard del frontend

`dashboard.service.ts` usa `authService.getHeaders()` en los cuatro métodos, como `messaging.service.ts` o `client.service.ts`. Esto envía `Authorization` y `X-Project-Id` y hace que al cambiar de proyecto las métricas se recalculen para el nuevo proyecto.

## Risks / Trade-offs

- [Romper el dashboard si el token o el proyecto no están disponibles al cargar] → El dashboard ya corre detrás del guard de autenticación; ante un `401/403` el manejador global limpia la sesión y redirige a login, comportamiento ya existente.
- [El e2e de dashboard falla al exigir autenticación] → El project `setup` persiste `storageState`, así que las llamadas ya viajan autenticadas; se añade cobertura explícita del caso sin token.
- [Conversaciones creadas antes del multi-proyecto sin `projectId`] → No aparecerán en ninguna métrica. Es el comportamiento correcto de aislamiento; el script de migración multi-proyecto ya asigna el proyecto a los datos existentes.
- [Actividad reciente siempre vacía] → Fuera de alcance por decisión (Non-Goals); se documenta para no confundirlo con un fallo del filtro.

## Migration Plan

1. Desplegar backend y frontend juntos: el frontend viejo llamaría a los endpoints ya autenticados sin cabeceras y obtendría `401`. No hay migración de datos.
2. Rollback: revertir el commit restaura el comportamiento público anterior.

## Open Questions

Ninguna.
