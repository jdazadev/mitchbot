## 1. Modelo de datos

- [x] 1.1 Añadir `projectIds` y `activeProjectId` a `user.model.ts` y `projectId` a `agent.model.ts`; verificar compilación y que los tipos del frontend reflejan el nuevo shape de usuario.
- [x] 1.2 Escribir un script de migración que asigne el proyecto actual a los usuarios existentes y fije su `activeProjectId`, y que vincule los agentes existentes a su proyecto; verificar el resultado consultando los documentos migrados.

## 2. Resolución de proyecto por request (backend)

- [x] 2.1 Modificar `auth.middleware.ts` para resolver el proyecto desde `X-Project-Id` (validando pertenencia) o `activeProjectId`, adjuntando el `projectId` resuelto a la request; verificar con peticiones que un encabezado ajeno responde error de permisos.
- [x] 2.2 Ajustar `socket-auth.middleware.ts` y `websocket/*` para asociar la conexión al proyecto del usuario y entrar en salas por proyecto; verificar que un cliente no recibe eventos de otro proyecto.
- [x] 2.3 Eliminar de `project.service.ts` la restricción de proyecto único activo en `create` y ajustar `getActiveProject` a una variante por usuario; verificar creación de múltiples proyectos.

## 3. Onboarding y comprobación de proyecto

- [x] 3.1 Cambiar `GET /project/check` para responder según los proyectos del usuario autenticado y verificar con un usuario sin proyectos (false) y con proyectos (true).
- [x] 3.2 Actualizar el guard de `router/index.ts` y `project.service.ts` (frontend) para no depender del caché local como fuente de verdad; verificar que un usuario sin proyectos es enviado a `/setup` y uno con proyectos no.

## 4. Endpoints y controladores

- [x] 4.1 Exponer el listado de proyectos del usuario y el cambio de proyecto activo (endpoints + servicio), verificando que solo se listan proyectos propios y que el cambio persiste.
- [x] 4.2 Actualizar `project.controller.ts` para que la creación asocie al creador como miembro y proyecto activo; verificar el flujo de creación.
- [x] 4.3 Actualizar `users.controller.ts`/`user.service.ts` para aceptar `projectIds` al crear/editar usuarios (solo `admin`); verificar alta y edición con y sin proyectos.

## 5. Agente por proyecto

- [x] 5.1 Cambiar `getActiveAgent` a `getActiveAgent(projectId)` y propagar el `projectId` en `ai.service.ts` y `chat.service.ts`; verificar que el chat usa el agente del proyecto correcto.

## 6. Frontend

- [x] 6.1 Añadir un selector de proyecto en `Topbar.vue` con la lista de proyectos del usuario y opción de crear uno nuevo; verificar cambio de proyecto y refresco de vistas.
- [x] 6.2 Enviar `X-Project-Id` en las llamadas autenticadas (servicios HTTP) y gestionar el estado del proyecto activo; verificar que las vistas de mensajería/contactos/brain devuelven datos del proyecto seleccionado.
- [x] 6.3 Reasignar la conexión de socket al cambiar de proyecto; verificar que no llegan eventos del proyecto anterior.
- [x] 6.4 Ajustar `ProjectSetup.vue`, `Users.vue` (asignación de proyectos) y `Profile.vue` según corresponda; verificar alta de usuario con proyectos y onboarding del primer proyecto.

## 7. Verificación integral

- [x] 7.1 Probar aislamiento con dos proyectos y dos usuarios: datos, agente y eventos de tiempo real no se cruzan; verificar manualmente el flujo completo.
- [x] 7.2 Ejecutar la comprobación de tipos de backend y frontend y confirmar que pasan sin errores.

## 8. Cierre

- [x] 8.1 Actualizar `changelog.md` y `AGENTS.md` con el modelo multi-proyecto y subir la versión según semver (cambio mayor por BREAKING: 2.0.0).
