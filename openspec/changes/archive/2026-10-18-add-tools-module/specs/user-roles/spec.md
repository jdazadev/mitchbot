## MODIFIED Requirements

### Requirement: Conjunto de roles del sistema

El sistema SHALL reconocer únicamente los roles `admin`, `support`, `assistant` y `approver`. El sistema SHALL NOT reconocer, crear ni asignar el rol `devadmin`. El rol `approver` SHALL habilitar la aprobación de las operaciones sensibles de las herramientas del agente.

#### Scenario: Roles válidos

- **WHEN** se crea o actualiza un usuario con un rol
- **THEN** solo se aceptan `admin`, `support`, `assistant` o `approver`

#### Scenario: Rol aprobador aceptado

- **WHEN** se crea o actualiza un usuario con el rol `approver`
- **THEN** el sistema persiste el usuario con ese rol
- **AND** lo habilita para aprobar operaciones sensibles

#### Scenario: Rol devadmin rechazado

- **WHEN** se intenta crear o asignar el rol `devadmin` por API
- **THEN** el sistema responde con un error y no persiste el usuario

#### Scenario: Usuario legado con rol devadmin

- **WHEN** existe un usuario almacenado con rol `devadmin`
- **THEN** el sistema no le concede acceso a rutas ni capacidades exclusivas de ese rol
- **AND** su cuenta se normaliza o se desactiva durante la migración
