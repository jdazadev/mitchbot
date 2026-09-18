## Context

Ver `proposal.md - Why`. Suposiciones de proyecto único presentes hoy:

- `auth.middleware.ts` asigna `projectId` desde `projectService.getActiveProject()` (el primer proyecto con `status: 'active'`).
- `projectService.create` lanza error si ya existe un proyecto activo.
- `agentService.getActiveAgent()` no recibe `projectId` y devuelve el primer agente activo.
- `GET /project/check` responde `hasProject` según la existencia global de proyectos.
- El frontend guarda `mitchbot_project_setup` en `localStorage` como fuente de verdad para el onboarding.
- `socket-auth.middleware.ts` asocia las conexiones de dashboard al proyecto global.

Las colecciones `conversations`, `contacts`, `knowledge_sources` y `provider_configs` ya incluyen `projectId`; el agente y el middleware son el trabajo estructural principal.

## Goals / Non-Goals

**Goals:**

- Pertenencia usuario↔proyecto y proyecto activo por usuario.
- Resolución de proyecto por request con verificación de pertenencia.
- Onboarding, creación y cambio de proyecto por usuario.
- Aislamiento de datos, agente y eventos de tiempo real por proyecto.

**Non-Goals:**

- No se implementa control de acceso granular por rol dentro de un proyecto (todos los miembros ven los datos del proyecto).
- No se implementa facturación ni límites por plan.
- No se cambia el contrato del chat público, que ya se resuelve por `slug` de proyecto.

## Decisions

### D1: Pertenencia embebida en el documento de usuario

`users` incorpora `projectIds: ObjectId[]` y `activeProjectId?: ObjectId`. Alternativa considerada: colección `memberships` separada. Se descarta por ahora por simplicidad y porque el modelo de roles no requiere permisos por proyecto; migrar a `memberships` queda como evolución si se necesita RBAC por proyecto.

### D2: Resolución por header de proyecto, con fallback al activo

El frontend envía el proyecto deseado en un encabezado (`X-Project-Id`). El middleware valida que el usuario sea miembro; si no viene encabezado, usa `activeProjectId`. Alternativa considerada: rutas con `projectId` en la URL (`/p/:projectId/...`). Se descarta por el alcance del cambio en rutas y enlaces; el encabezado es menos invasivo y suficiente para el dashboard.

### D3: Agente por proyecto

`agents` incorpora `projectId` y `getActiveAgent(projectId)` resuelve el agente del proyecto. Alternativa considerada: un único agente compartido. Se descarta porque cada proyecto puede tener personalidad y modelo distintos.

### D4: Fuente de verdad del onboarding en el servidor

`GET /project/check` responde según los proyectos del usuario y se elimina `localStorage` como fuente de verdad. El guard consulta al servidor cuando no hay certeza. Alternativa considerada: mantener el caché local por usuario. Se descarta porque puede desincronizarse al asignar/cambiar proyectos.

### D5: Sesiones de tiempo real scoped por proyecto

La autenticación de socket resuelve el proyecto activo del usuario (o el indicado al conectar) y las salas se organizan por proyecto. Al cambiar de proyecto, el cliente sale de las salas previas y entra en las del nuevo. Alternativa considerada: filtrar eventos en el emisor. Se descarta porque no evita recibir el evento a nivel de transporte.

## Risks / Trade-offs

- **[Fuga de datos entre proyectos si alguna consulta omite `projectId`]** → Auditar todos los accesos a colecciones con `projectId` y centralizar la resolución de proyecto en el middleware; pruebas de aislamiento (ver change `e2e-playwright`).
- **[Migración de usuarios existentes sin pertenencia]** → Asignar el proyecto existente a los usuarios actuales durante la migración y fijar su `activeProjectId`.
- **[Consultas adicionales por request]** → El usuario ya se carga en el middleware; la validación de pertenencia se hace en memoria sobre el documento del usuario, sin consultas extra.
- **[Cambio de proyecto y estado del cliente desincronizado]** → El frontend invalida y recarga las vistas al cambiar de proyecto y reasigna las suscripciones de socket.
- **[Proyectos con `status` activo múltiple]** → La "actividad" pasa a depender de `activeProjectId` del usuario; se conserva `status` para habilitar/deshabilitar, sin la restricción de proyecto único.

## Migration Plan

1. Añadir `projectIds`/`activeProjectId` a usuarios y `projectId` a agentes.
2. Migrar: asignar el proyecto actual a todos los usuarios existentes y fijar su `activeProjectId`; vincular los agentes existentes a su proyecto.
3. Desplegar la resolución de proyecto por header y el nuevo onboarding.
4. Rollback: revertir al commit previo; los campos nuevos son aditivos y no rompen el código anterior.

## Open Questions

Ninguna.
