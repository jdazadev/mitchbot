## ADDED Requirements

### Requirement: Entrega de la respuesta del bot como mensaje completo

El sistema SHALL entregar la respuesta del bot como un único mensaje completo, tanto en respuestas directas como en las posteriores a la ejecución de herramientas. Mientras el modelo genera la respuesta, el sistema SHALL mantener un indicador de escritura en lugar de texto parcial. El sistema SHALL NOT emitir fragmentos incrementales de la respuesta. El mensaje completo SHALL propagarse por el canal de tiempo real existente y quedar persistido antes de su emisión.

#### Scenario: Respuesta directa completa

- **WHEN** el bot genera una respuesta sin herramientas
- **THEN** el usuario ve un indicador de escritura durante la generación
- **AND** al finalizar recibe la respuesta completa en un solo mensaje

#### Scenario: Respuesta completa tras herramientas

- **WHEN** el bot ejecuta herramientas y luego genera la respuesta final
- **THEN** la respuesta final se entrega completa en un solo mensaje

#### Scenario: Sin fragmentos parciales

- **WHEN** el bot está generando una respuesta
- **THEN** el sistema no emite fragmentos de texto parciales al cliente

#### Scenario: Respuesta visible para dashboard y cliente

- **WHEN** el bot responde en una conversación
- **THEN** tanto el dashboard del agente como la vista pública del cliente reciben el mensaje completo

#### Scenario: Error mostrado como mensaje

- **WHEN** la generación falla
- **THEN** el error se muestra como un mensaje visible en la conversación
