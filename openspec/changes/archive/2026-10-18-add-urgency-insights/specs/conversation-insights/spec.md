## MODIFIED Requirements

### Requirement: Análisis automático y manual

El sistema SHALL recalcular los insights de la conversación al recibir cada mensaje entrante del cliente, desde el primer mensaje y en cualquier modo de la conversación (`auto_pilot` o `human_takeover`), sin bloquear ni alterar la conversación, y SHALL ofrecer una acción manual para volver a analizar. El recálculo SHALL NOT depender de que el bot genere una respuesta. Los insights SHALL persistirse en la conversación.

#### Scenario: Análisis automático

- **WHEN** el cliente envía un mensaje
- **THEN** los insights de esa conversación se recalculan y se guardan
- **AND** el recálculo no depende de que el bot responda

#### Scenario: Análisis desde el primer mensaje

- **WHEN** el cliente envía el primer mensaje de una conversación nueva
- **THEN** la conversación queda con insights calculados

#### Scenario: Análisis durante la toma de control

- **WHEN** la conversación está en `human_takeover` y el cliente escribe
- **THEN** los insights se recalculan aunque el bot no responda

#### Scenario: Fallo silencioso

- **WHEN** el análisis falla
- **THEN** el flujo de la conversación no se ve afectado
- **AND** se conservan los insights anteriores

#### Scenario: Análisis manual

- **WHEN** el agente pulsa "Analizar"
- **THEN** se recalcula el análisis y se devuelven los insights actualizados

### Requirement: Análisis sin resumen

El análisis de la conversación SHALL producir únicamente el sentimiento, su distribución y la urgencia del cliente. El sistema SHALL NOT calcular, almacenar ni devolver un resumen textual de la conversación.

#### Scenario: Resultado del análisis

- **WHEN** se analiza una conversación
- **THEN** el resultado contiene el sentimiento, su distribución y la urgencia
- **AND** no contiene ningún resumen

#### Scenario: Sin resumen persistido

- **WHEN** se consultan los insights almacenados de una conversación
- **THEN** no se devuelve un resumen

### Requirement: Panel de insights con datos reales

El sistema SHALL mostrar en la conversación el sentimiento, su distribución y la urgencia, provenientes del análisis real, y SHALL actualizarse en vivo. El sistema SHALL NOT mostrar un resumen en el panel de insights. Cuando no exista análisis, SHALL mostrar un estado vacío en el panel de sentimiento en lugar de valores fijos.

#### Scenario: Datos reales

- **WHEN** la conversación tiene insights calculados
- **THEN** el panel muestra el sentimiento, su distribución y la urgencia
- **AND** no muestra valores estáticos predefinidos

#### Scenario: Sin resumen

- **WHEN** el panel de insights muestra el análisis de una conversación
- **THEN** no se muestra ningún resumen textual

#### Scenario: Actualización en vivo

- **WHEN** se recalcula el análisis con la conversación abierta
- **THEN** el panel se actualiza sin recargar

#### Scenario: Estado vacío

- **WHEN** una conversación aún no tiene análisis
- **THEN** el panel de sentimiento indica que todavía no hay insights

## ADDED Requirements

### Requirement: Urgencia evaluada por el análisis

El análisis SHALL evaluar, además del sentimiento, la urgencia del cliente en la misma ejecución, y SHALL producir un nivel (`low`, `medium` o `high`) y un motivo tipado (`none`, `deadline`, `incident`, `escalation` o `repetition`). El sistema SHALL validar y normalizar el resultado, SHALL persistir la urgencia junto al sentimiento y SHALL devolverla tanto al consultar los insights almacenados como en el recálculo manual.

#### Scenario: Urgencia en el resultado

- **WHEN** se analiza una conversación
- **THEN** el resultado incluye un nivel de urgencia y un motivo tipado

#### Scenario: Nivel y motivo validados

- **WHEN** el modelo devuelve un nivel o un motivo fuera del conjunto permitido
- **THEN** el resultado se normaliza a valores válidos, con motivo por defecto `none`

#### Scenario: Persistencia y consulta

- **WHEN** se consultan los insights almacenados de una conversación analizada
- **THEN** se devuelven el nivel de urgencia y su motivo junto al sentimiento

#### Scenario: Urgencia ausente en datos previos

- **WHEN** la conversación tiene insights anteriores que no incluyen urgencia
- **THEN** la consulta devuelve el sentimiento y no inventa una urgencia

### Requirement: Urgencia compuesta con señales operacionales

El panel de la conversación SHALL mostrar la urgencia en tres niveles con su motivo, tomando el nivel del análisis. Una acción pendiente de confirmación SHALL forzar al menos el nivel medio. Cuando no exista análisis, SHALL mostrar la estimación derivada de las señales visibles del panel. El sistema SHALL NOT presentar la estimación derivada como resultado del análisis.

#### Scenario: Nivel del análisis

- **WHEN** la conversación tiene urgencia analizada
- **THEN** el panel muestra ese nivel con su motivo

#### Scenario: Escalado por confirmación pendiente

- **WHEN** existe una confirmación de herramienta pendiente y el nivel analizado es bajo
- **THEN** el panel muestra al menos el nivel medio

#### Scenario: Respaldo sin análisis

- **WHEN** la conversación aún no tiene urgencia analizada
- **THEN** el panel muestra la estimación derivada de las señales visibles
- **AND** no la presenta como resultado del análisis
