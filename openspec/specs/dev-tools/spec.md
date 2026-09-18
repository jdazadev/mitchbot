# dev-tools Specification

## Purpose

Expone herramientas internas de diagnóstico —como la extracción de texto de archivos— en una ruta aislada, accesible solo por URL para usuarios autenticados y sin presencia en la navegación.

## Requirements

### Requirement: Ruta aislada de herramientas internas

El sistema SHALL exponer las herramientas internas de prueba en una ruta dedicada, accesible únicamente escribiendo su URL. La ruta SHALL requerir autenticación y SHALL NOT depender del rol `devadmin`.

#### Scenario: Acceso autenticado por URL

- **WHEN** un usuario autenticado navega directamente a la URL de herramientas internas
- **THEN** el sistema muestra el módulo de pruebas

#### Scenario: Acceso sin autenticación

- **WHEN** un usuario no autenticado navega a la URL de herramientas internas
- **THEN** el sistema lo redirige al inicio de sesión

### Requirement: Herramienta oculta de la navegación

Las herramientas internas SHALL NOT aparecer en el menú lateral ni en ningún listado de navegación principal, para cualquier rol.

#### Scenario: Sin entrada en el menú

- **WHEN** cualquier usuario autenticado visualiza la navegación principal
- **THEN** no se muestra ninguna entrada hacia las herramientas internas

### Requirement: Extracción de texto sin persistencia

La herramienta de extracción de texto SHALL procesar archivos y devolver el texto extraído SIN indexarlo ni almacenarlo en la base de conocimiento.

#### Scenario: Extracción de prueba

- **WHEN** un usuario autenticado sube un archivo a la herramienta de extracción
- **THEN** el sistema devuelve el texto extraído y sus metadatos
- **AND** no crea ninguna fuente de conocimiento ni vector asociado
