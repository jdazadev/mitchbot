# tool-history Specification

## Purpose
Define el registro de cada uso de una herramienta del agente y la superficie donde el operador lo consulta, para auditar qué acciones se ejecutaron, con qué datos y con qué resultado.

## Requirements

### Requirement: Registro de cada uso de herramienta

El sistema SHALL registrar cada invocación de una operación con la herramienta, la operación, el binding utilizado, los parámetros propuestos, el resultado, el estado de control (ejecutada, pendiente de aprobación, aprobada, rechazada, fallida) y la conversación de origen. El registro SHALL conservarse por proyecto y SHALL NOT mezclarse entre proyectos.

#### Scenario: Ejecución registrada

- **WHEN** el agente ejecuta una operación
- **THEN** el sistema guarda un registro con la herramienta, la operación, el binding, los datos y el resultado

#### Scenario: Operación pendiente registrada

- **WHEN** una operación queda pendiente de aprobación
- **THEN** el registro refleja ese estado hasta su resolución

#### Scenario: Aislamiento por proyecto

- **WHEN** un proyecto consulta su historial
- **THEN** solo ve los registros de sus propias ejecuciones

### Requirement: Consulta del historial

El sistema SHALL ofrecer una vista de historial que liste los registros de uso con su herramienta, operación, binding, estado y fecha, y SHALL permitir filtrarlos por herramienta, operación, binding, estado y rango de fechas, mostrando los resultados paginados.

#### Scenario: Listado del historial

- **WHEN** el usuario abre el historial de herramientas
- **THEN** ve los registros de uso con su herramienta, operación, binding, estado y fecha

#### Scenario: Filtrado del historial

- **WHEN** el usuario filtra el historial por herramienta y estado
- **THEN** la lista muestra únicamente los registros que cumplen ambos criterios

#### Scenario: Historial vacío

- **WHEN** no existe ningún registro de uso
- **THEN** el sistema muestra un estado vacío en lugar de una tabla sin datos

### Requirement: Enlace a la conversación de origen

El sistema SHALL ofrecer, en cada registro del historial que provenga de una conversación, un enlace que abra esa conversación en el módulo de mensajería.

#### Scenario: Abrir conversación desde el historial

- **WHEN** el usuario accede al enlace de un registro vinculado a una conversación
- **THEN** el sistema abre el módulo de mensajería con esa conversación seleccionada

#### Scenario: Registro sin conversación

- **WHEN** un registro no proviene de una conversación
- **THEN** no se ofrece el enlace

### Requirement: Solicitudes pendientes visibles en el historial

El sistema SHALL mostrar en el historial las solicitudes pendientes de aprobación junto con las ejecuciones resueltas, indicando de forma distinguible su estado y permitiendo a un usuario autorizado resolverlas.

#### Scenario: Pendientes junto a resueltas

- **WHEN** existen solicitudes pendientes y ejecuciones resueltas
- **THEN** el historial lista ambas, distinguiendo el estado de cada una

#### Scenario: Resolución desde el historial

- **WHEN** un usuario autorizado aprueba o rechaza una solicitud desde el historial
- **THEN** el registro refleja la decisión y deja de figurar como pendiente
