## Why

La plataforma asume un único proyecto global: el middleware de autenticación adjunta siempre el proyecto activo del sistema, el agente activo se resuelve sin `projectId`, la comprobación de proyecto pregunta si existe "algún" proyecto (por lo que un segundo usuario nunca ve el onboarding) y los usuarios no tienen pertenencia a proyectos. Esto impide ofrecer la plataforma como SaaS multi-proyecto y causa comportamiento incorrecto con más de un usuario. Se necesita que cada usuario tenga uno o más proyectos, pueda cambiar entre ellos y que todo el backend resuelva el proyecto correcto por request.

## What Changes

- **BREAKING**: Los usuarios SHALL tener pertenencia a uno o más proyectos (`projectIds`) y un proyecto activo (`activeProjectId`).
- **BREAKING**: El middleware de autenticación SHALL resolver el proyecto desde el usuario y la petición (con verificación de pertenencia), en lugar de usar un proyecto global único.
- La comprobación de proyecto SHALL referirse a los proyectos del usuario; el onboarding SHALL activarse solo cuando el usuario no tiene proyectos.
- Cualquier usuario autenticado SHALL poder crear proyectos; el creador queda como miembro y el proyecto pasa a ser su activo.
- Los administradores SHALL poder asignar uno o más proyectos al crear o editar usuarios.
- Habrá un selector de proyecto en la barra superior para cambiar el proyecto activo.
- El agente SHALL resolverse por proyecto; la mensajería, contactos, base de conocimiento y configuraciones SHALL quedar aislados por proyecto.
- Las conexiones WebSocket del dashboard SHALL quedar asociadas al proyecto activo.
- **BREAKING**: Se elimina la dependencia del caché local de "proyecto configurado" como fuente de verdad (pasa a validarse contra el servidor por usuario).

## Capabilities

### New Capabilities

- `multi-project`: Pertenencia de usuarios a proyectos, resolución de contexto de proyecto por request, cambio y creación de proyectos, y aislamiento de datos y agentes por proyecto.

### Modified Capabilities

<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Backend**: `middleware/auth.middleware.ts`, `middleware/socket-auth.middleware.ts`, `websocket/*`, `services/project.service.ts`, `services/project-context.service.ts`, `services/agent.service.ts`, `services/ai.service.ts`, `services/user.service.ts`, `services/config.service.ts`, `controllers/project.controller.ts`, `controllers/users.controller.ts`, `controllers/auth.controller.ts`, `models/user.model.ts`, `models/agent.model.ts`, `models/project.model.ts`, `routes/project.routes.ts`, `routes/users.routes.ts`.
- **Frontend**: nuevo selector de proyecto en `components/layout/Topbar.vue`; ajustes en `router/index.ts` (onboarding), `views/ProjectSetup.vue`, `views/Users.vue`, `views/Settings.vue`, `views/Profile.vue`, `services/project.service.ts`, `services/socket.service.ts`, `store`/estado de proyecto activo.
- **Datos**: migración para poblar `projectIds`/`activeProjectId` de usuarios existentes con el proyecto actual; `agents` incorpora `projectId`; `projects` puede pasar a múltiples activos (uno por usuario).
- **Infraestructura**: sin nuevas dependencias externas; cambia el contrato de resolución de proyecto (header de proyecto).
