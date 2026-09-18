# multi-project Specification

## Purpose

Permite que cada usuario pertenezca a uno o más proyectos, cambie entre ellos y que todo el backend resuelva y aísle los datos según el proyecto activo por petición.

## Requirements

### Requirement: Pertenencia de usuarios a proyectos

Cada usuario SHALL tener una lista de proyectos a los que pertenece (`projectIds`) y un proyecto activo (`activeProjectId`). Un usuario SHALL acceder únicamente a los proyectos a los que pertenece.

#### Scenario: Usuario con proyectos asignados

- **WHEN** un administrador asigna uno o más proyectos a un usuario
- **THEN** el usuario puede ver y operar esos proyectos
- **AND** no puede ver ni operar proyectos a los que no pertenece

#### Scenario: Acceso a proyecto ajeno denegado

- **WHEN** un usuario solicita contexto de un proyecto del que no es miembro
- **THEN** el sistema deniega el acceso con error de permisos

### Requirement: Resolución de proyecto por petición

El backend SHALL determinar el proyecto de cada petición a partir del proyecto activo del usuario y/o de una indicación explícita de proyecto en la petición, verificando siempre la pertenencia. El sistema SHALL NOT usar un proyecto global único como contexto.

#### Scenario: Petición con proyecto indicado

- **WHEN** una petición autenticada incluye la indicación de un proyecto del que el usuario es miembro
- **THEN** la petición se resuelve en el contexto de ese proyecto

#### Scenario: Petición sin proyecto indicado

- **WHEN** una petición autenticada no incluye proyecto
- **THEN** se usa el proyecto activo del usuario

#### Scenario: Proyecto no válido o ajeno

- **WHEN** la petición indica un proyecto inexistente o del que el usuario no es miembro
- **THEN** el sistema responde con error y no ejecuta la operación

### Requirement: Onboarding por usuario

La comprobación de proyecto SHALL referirse a los proyectos del usuario autenticado, no a la existencia global de proyectos. El onboarding de creación de proyecto SHALL mostrarse únicamente cuando el usuario no tiene proyectos.

#### Scenario: Usuario sin proyectos

- **WHEN** un usuario autenticado no tiene proyectos
- **THEN** el sistema lo dirige al alta de su primer proyecto

#### Scenario: Nuevo usuario con proyecto existente en el sistema

- **WHEN** un usuario nuevo inicia sesión y ya tiene proyectos asignados
- **THEN** el sistema le permite operar sin mostrar el onboarding

### Requirement: Creación y cambio de proyecto

Cualquier usuario autenticado SHALL poder crear proyectos. El creador SHALL quedar como miembro y su proyecto activo. El usuario SHALL poder cambiar su proyecto activo entre los proyectos a los que pertenece.

#### Scenario: Creación de proyecto

- **WHEN** un usuario autenticado crea un proyecto
- **THEN** el proyecto se crea con el usuario como miembro
- **AND** pasa a ser su proyecto activo

#### Scenario: Cambio de proyecto activo

- **WHEN** un usuario con varios proyectos selecciona otro proyecto activo
- **THEN** el sistema persiste la selección
- **AND** las vistas pasan a mostrar los datos de ese proyecto

### Requirement: Asignación de proyectos por administradores

Un administrador SHALL poder asignar uno o más proyectos al crear o editar un usuario.

#### Scenario: Alta de usuario con proyectos

- **WHEN** un administrador crea un usuario indicando uno o más proyectos
- **THEN** el usuario queda como miembro de esos proyectos

#### Scenario: Edición de proyectos de un usuario

- **WHEN** un administrador modifica los proyectos de un usuario
- **THEN** la pertenencia del usuario se actualiza en consecuencia

### Requirement: Aislamiento de datos y agente por proyecto

La mensajería, los contactos, la base de conocimiento, los agentes y las configuraciones SHALL quedar aislados por proyecto. Cada proyecto SHALL tener su propio agente activo.

#### Scenario: Datos acotados al proyecto activo

- **WHEN** un usuario lista conversaciones, contactos o fuentes estando en un proyecto
- **THEN** solo se devuelven los datos de ese proyecto

#### Scenario: Agente del proyecto

- **WHEN** el bot responde en un proyecto
- **THEN** usa el agente configurado para ese proyecto

### Requirement: Sesiones en tiempo real por proyecto

Las conexiones de tiempo real del dashboard SHALL quedar asociadas al proyecto activo del usuario, de modo que no reciban eventos de otros proyectos.

#### Scenario: Eventos solo del proyecto activo

- **WHEN** un cliente de dashboard está conectado en un proyecto
- **THEN** recibe eventos de mensajería únicamente de ese proyecto

#### Scenario: Cambio de proyecto y reconexión de eventos

- **WHEN** el usuario cambia su proyecto activo
- **THEN** sus suscripciones de tiempo real se reasignan al nuevo proyecto
