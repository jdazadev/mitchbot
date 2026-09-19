## ADDED Requirements

### Requirement: Análisis sin resumen

El análisis de la conversación SHALL producir únicamente el sentimiento y su distribución. El sistema SHALL NOT calcular, almacenar ni devolver un resumen textual de la conversación.

#### Scenario: Resultado del análisis

- **WHEN** se analiza una conversación
- **THEN** el resultado contiene el sentimiento y su distribución
- **AND** no contiene ningún resumen

#### Scenario: Sin resumen persistido

- **WHEN** se consultan los insights almacenados de una conversación
- **THEN** no se devuelve un resumen

## MODIFIED Requirements

### Requirement: Panel de insights con datos reales

El sistema SHALL mostrar en la conversación el sentimiento y su distribución, provenientes del análisis real, y SHALL actualizarse en vivo. El sistema SHALL NOT mostrar un resumen en el panel de insights. Cuando no exista análisis, SHALL mostrar un estado vacío en lugar de valores fijos.

#### Scenario: Datos reales

- **WHEN** la conversación tiene insights calculados
- **THEN** el panel muestra el sentimiento y su distribución
- **AND** no muestra valores estáticos predefinidos

#### Scenario: Sin resumen

- **WHEN** el panel de insights muestra el análisis de una conversación
- **THEN** no se muestra ningún resumen textual

#### Scenario: Actualización en vivo

- **WHEN** se recalcula el análisis con la conversación abierta
- **THEN** el panel se actualiza sin recargar

#### Scenario: Estado vacío

- **WHEN** una conversación aún no tiene análisis
- **THEN** el panel indica que todavía no hay insights
