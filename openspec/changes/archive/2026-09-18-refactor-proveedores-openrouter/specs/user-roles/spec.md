## Purpose

Define el conjunto de roles del sistema y las reglas de autorización asociadas, eliminando el rol interno `devadmin`.

## ADDED Requirements

### Requirement: Conjunto de roles del sistema

El sistema SHALL reconocer únicamente los roles `admin`, `support` y `assistant`. El sistema SHALL NOT reconocer, crear ni asignar el rol `devadmin`.

#### Scenario: Roles válidos

- **WHEN** se crea o actualiza un usuario con un rol
- **THEN** solo se aceptan `admin`, `support` o `assistant`

#### Scenario: Rol devadmin rechazado

- **WHEN** se intenta crear o asignar el rol `devadmin` por API
- **THEN** el sistema responde con un error y no persiste el usuario

#### Scenario: Usuario legado con rol devadmin

- **WHEN** existe un usuario almacenado con rol `devadmin`
- **THEN** el sistema no le concede acceso a rutas ni capacidades exclusivas de ese rol
- **AND** su cuenta se normaliza o se desactiva durante la migración

### Requirement: Autorización por rol en endpoints administrativos

Los endpoints administrativos SHALL restringirse por rol autorizado. La eliminación del rol `devadmin` SHALL NOT dejar endpoints sin control de autorización.

#### Scenario: Endpoint administrativo protegido

- **WHEN** un usuario sin rol autorizado invoca un endpoint administrativo
- **THEN** el sistema responde con error de permisos

#### Scenario: Administrador conserva acceso

- **WHEN** un usuario con rol `admin` invoca un endpoint administrativo vigente
- **THEN** el sistema permite la operación

### Requirement: Primer usuario administrador

El primer usuario registrado en el sistema SHALL obtener el rol `admin`.

#### Scenario: Registro inicial

- **WHEN** se registra el primer usuario de la plataforma
- **THEN** el sistema le asigna el rol `admin`
