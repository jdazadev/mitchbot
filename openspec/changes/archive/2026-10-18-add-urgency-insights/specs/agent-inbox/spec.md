## ADDED Requirements

### Requirement: Indicador de urgencia en la bandeja

La bandeja SHALL mostrar en cada conversación con urgencia analizada Media o Alta un indicador de su urgencia. El sistema SHALL NOT marcar las conversaciones de urgencia Baja ni las que aún no tienen análisis. El indicador SHALL actualizarse en vivo cuando cambie la urgencia de una conversación listada.

#### Scenario: Indicador por conversación

- **WHEN** una conversación de la bandeja tiene urgencia Media o Alta
- **THEN** su fila muestra el indicador correspondiente

#### Scenario: Sin ruido

- **WHEN** una conversación tiene urgencia Baja o no tiene análisis
- **THEN** su fila no muestra indicador

#### Scenario: Actualización en vivo

- **WHEN** se recalcula la urgencia de una conversación listada
- **THEN** el indicador de esa fila se actualiza sin recargar
