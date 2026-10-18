## 1. Modelo de herramientas y operaciones

- [x] 1.1 Ampliar los tipos del sistema de herramientas (herramienta, operación canónica, binding y capa de control) y verificar con `pnpm --filter @mitchbot/backend exec tsc --noEmit`
- [x] 1.2 Reorganizar `apps/backend/src/tools/` en módulos por herramienta con sus operaciones (Agenda, Conocimiento, Inventario, Pagos) y verificar que el registro expone cada operación como función distinguible
- [x] 1.3 Separar `transfer_to_human` y `send_notification` como herramientas de sistema y verificar que siguen disponibles con independencia de la configuración del proyecto
- [x] 1.4 Definir el contrato de binding (cada binding declara las operaciones que soporta) con el módulo interno como única implementación, verificado por tipos
- [x] 1.5 Retirar del registro las herramientas antiguas absorbidas (`get_business_hours`, `get_service_availability`, `get_product_info`, `get_faq_answer`) y verificar que el catálogo compila sin referencias muertas

## 2. Módulos internos

- [x] 2.1 Implementar `Agenda·leer` absorbiendo horarios de atención y disponibilidad, y verificar la consulta de disponibilidad para una fecha
- [x] 2.2 Implementar `Agenda·crear`, `Agenda·editar` (reagendar) y `Agenda·eliminar` (cancelar) contra `appointments` y verificar cada operación
- [x] 2.3 Implementar `Conocimiento·leer` unificando las búsquedas RAG y verificar una consulta de producto y una de pregunta frecuente
- [x] 2.4 Implementar `Inventario·leer` (estado de pedidos del contacto), `crear`, `editar` y `eliminar` contra `orders` y verificar cada operación
- [x] 2.5 Crear la colección `payments` e implementar `Pagos·leer` y `Pagos·crear` (intención de cobro sin movimiento de dinero) y verificar el registro en estado pendiente

## 3. Configuración por proyecto y binding dinámico

- [x] 3.1 Modelar la configuración de herramientas en `projects.config.tools` (matriz herramienta -> operación -> binding) con validación Zod y verificar que una entrada inválida se rechaza
- [x] 3.2 Implementar la lectura y actualización de la configuración por proyecto y verificar con un request autenticado y aislado por `projectId`
- [x] 3.3 Resolver el subconjunto de operaciones habilitadas por proyecto en `tool.service` y usarlo en el `bindTools()` de `ai.service`, verificando que un proyecto con operaciones deshabilitadas no las recibe
- [x] 3.4 Aplicar las restricciones por binding (operación habilitada en el módulo interno y deshabilitada en una integración) y verificar que la integración no se ofrece como binding
- [x] 3.5 Definir los valores por defecto (proyectos existentes conservan el set equivalente; proyectos nuevos habilitan las operaciones internas) y verificar que un proyecto existente mantiene su comportamiento

## 4. Aprobaciones y rol

- [x] 4.1 Añadir el rol `approver` al modelo de usuarios, la validación y la autorización, y verificar que crear o asignar el rol persiste y que un rol inválido se rechaza
- [x] 4.2 Extender `tool_executions` con operación, binding, estado `pending_approval`, actor de la decisión y marcas temporales, y verificar la persistencia de cada campo
- [x] 4.3 Implementar la capa de control por operación (leer = ninguna, crear/editar = confirmación del cliente, eliminar y `Pagos·crear` = aprobación del operador) y verificar que una operación de eliminación no se ejecuta sin aprobación
- [x] 4.4 Implementar el flujo de aprobación y rechazo con ejecución diferida, verificando que aprobar ejecuta la operación y rechazar no la ejecuta
- [x] 4.5 Restringir la aprobación al rol `approver` con respaldo de `admin` y verificar que un usuario no autorizado recibe error de permisos
- [x] 4.6 Emitir el aviso en tiempo real de nuevas solicitudes pendientes reutilizando `admin:notification` y verificar la actualización del indicador sin recargar

## 5. API REST

- [x] 5.1 Implementar `GET /api/tools` (catálogo y configuración efectiva del proyecto) y verificar la respuesta autenticada
- [x] 5.2 Implementar `PUT /api/tools/config` y verificar que persiste la matriz herramienta -> operación -> binding
- [x] 5.3 Implementar `GET /api/tool-executions` con filtros (herramienta, operación, binding, estado, rango de fechas) y paginación, y verificar el filtrado y el aislamiento por proyecto
- [x] 5.4 Implementar `GET /api/tool-executions/pending` y `POST /api/tool-executions/:id/approve|reject` y verificar los tres casos (aprobado, rechazado, no autorizado)

## 6. Módulo Tools en el frontend

- [x] 6.1 Añadir la ruta `/tools`, el item "Tools" en `AuroraRail` y el título "Tools" en el topbar, y verificar la navegación y el estado activo
- [x] 6.2 Construir la pestaña Catálogo (tarjetas por herramienta y detalle con operaciones, binding y toggles) y verificar que un cambio de configuración se refleja en el proyecto
- [x] 6.3 Construir la pestaña Aprobaciones (cola de pendientes, indicador y acciones aprobar/rechazar) y verificar que una solicitud resuelta sale de la lista
- [x] 6.4 Construir la pestaña Historial (listado, filtros, paginación y enlace a la conversación) y verificar el deep-link a Messaging
- [x] 6.5 Usar los primitivos `A*` (incluidos `ADropdown`, `ASwitch`, `AModal`, `AIcon`), estados vacíos y recuperación ante error con reintento, y verificar en claro/oscuro y 1440/390 sin desborde

## 7. i18n, accesibilidad y verificación

- [x] 7.1 Añadir las claves `tools.*` y `users.roles.approver` (es/en) y verificar la paridad de claves
- [x] 7.2 Aplicar accesibilidad (roles, `aria-label`, foco visible, navegación por teclado en tabs y paneles) y verificar con teclado
- [x] 7.3 Escribir las pruebas e2e de configuración, binding dinámico, aprobación por rol e historial y verificar que pasan
- [x] 7.4 Ejecutar la verificación final (`vue-tsc --noEmit`, `build`, `tsc --noEmit` del backend, detector Impeccable y `pnpm test:e2e`) y confirmar todo en verde
- [x] 7.5 Actualizar `changelog.md` y `AGENTS.md` y subir la versión según semver, verificando la coherencia del número de versión
