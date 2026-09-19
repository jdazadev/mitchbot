## Purpose

Define las métricas del dashboard de un proyecto (conversaciones totales, activas y cerradas, volumen por período, distribución por canal y actividad reciente) como datos autenticados y acotados exclusivamente al proyecto activo del usuario.

## ADDED Requirements

### Requirement: Acceso autenticado a las métricas del dashboard

El sistema SHALL exigir autenticación para todas las consultas de métricas del dashboard y SHALL resolver el proyecto activo de la petición. El sistema SHALL NOT exponer métricas de forma pública ni calcularlas sin un proyecto resuelto.

#### Scenario: Consulta autenticada

- **WHEN** un usuario autenticado consulta las métricas del dashboard
- **THEN** el sistema responde con las métricas del proyecto resuelto para la petición

#### Scenario: Consulta sin autenticación

- **WHEN** una petición sin credenciales válidas consulta las métricas del dashboard
- **THEN** el sistema responde con error de autenticación
- **AND** no devuelve ninguna métrica

### Requirement: Aislamiento de las métricas por proyecto

Todas las métricas del dashboard —conversaciones totales, activas y cerradas, volumen por período, distribución por canal y actividad reciente— SHALL calcularse únicamente sobre los datos del proyecto resuelto. El sistema SHALL NOT mezclar datos de otros proyectos.

#### Scenario: Conteo total acotado al proyecto

- **WHEN** existen conversaciones en varios proyectos y el usuario consulta el total de conversaciones
- **THEN** el total corresponde solo a las conversaciones del proyecto activo

#### Scenario: Conteos por estado acotados al proyecto

- **WHEN** el usuario consulta conversaciones activas y cerradas
- **THEN** ambas cifras se calculan solo sobre las conversaciones del proyecto activo

#### Scenario: Volumen y distribución acotados al proyecto

- **WHEN** el usuario consulta el volumen por período y la distribución por canal
- **THEN** ambos se calculan solo con las conversaciones del proyecto activo

#### Scenario: Actividad reciente acotada al proyecto

- **WHEN** el usuario consulta la actividad reciente
- **THEN** solo se devuelven eventos del proyecto activo

### Requirement: Selección del rango temporal de las métricas

El sistema SHALL permitir acotar las métricas por un rango temporal expresado como número de días o como fechas de inicio y fin. Cuando no se indique rango, SHALL NOT aplicar recorte temporal. El aislamiento por proyecto SHALL mantenerse con cualquier rango.

#### Scenario: Rango por días

- **WHEN** el usuario selecciona los últimos 7, 30 o 90 días
- **THEN** las métricas, el volumen y la distribución se recalculan para ese rango
- **AND** siguen acotados al proyecto activo

#### Scenario: Sin rango

- **WHEN** no se indica rango temporal
- **THEN** el sistema calcula las métricas sin recorte de fechas

### Requirement: Actualización de las métricas al cambiar de proyecto

Las métricas del dashboard SHALL corresponder al proyecto activo en el momento de la consulta y SHALL reflejar el cambio cuando el usuario cambia de proyecto.

#### Scenario: Cambio de proyecto activo

- **WHEN** el usuario cambia su proyecto activo y abre el dashboard
- **THEN** las métricas mostradas corresponden al nuevo proyecto activo
