# conversation-insights Specification

## Purpose

Define el análisis aproximado del sentimiento de una conversación que el sistema calcula automáticamente y a demanda, y que el agente ve en el panel de la conversación.

## Requirements

### Requirement: Modelo de análisis configurable por entorno

El sistema SHALL usar un modelo dedicado para el análisis definido por la variable de entorno `OPENROUTER_INSIGHTS_MODEL`. Cuando la variable no esté definida, SHALL usar el modelo de chat configurado. La credencial SHALL provenir del entorno y SHALL NOT almacenarse en base de datos.

#### Scenario: Modelo dedicado

- **WHEN** `OPENROUTER_INSIGHTS_MODEL` está definida y se analiza una conversación
- **THEN** el análisis usa ese modelo

#### Scenario: Modelo de respaldo

- **WHEN** `OPENROUTER_INSIGHTS_MODEL` no está definida
- **THEN** el análisis usa el modelo de chat configurado

### Requirement: Análisis automático y manual

El sistema SHALL recalcular los insights de la conversación tras cada respuesta del bot, sin bloquear ni alterar la respuesta, y SHALL ofrecer una acción manual para volver a analizar. Los insights SHALL persistirse en la conversación.

#### Scenario: Análisis automático

- **WHEN** el bot emite una respuesta en una conversación
- **THEN** los insights de esa conversación se recalculan y se guardan

#### Scenario: Fallo silencioso

- **WHEN** el análisis falla
- **THEN** la respuesta del bot y el flujo de la conversación no se ven afectados

#### Scenario: Análisis manual

- **WHEN** el agente pulsa "Analizar"
- **THEN** se recalcula el análisis y se devuelven los insights actualizados

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

### Requirement: Análisis sin resumen

El análisis de la conversación SHALL producir únicamente el sentimiento y su distribución. El sistema SHALL NOT calcular, almacenar ni devolver un resumen textual de la conversación.

#### Scenario: Resultado del análisis

- **WHEN** se analiza una conversación
- **THEN** el resultado contiene el sentimiento y su distribución
- **AND** no contiene ningún resumen

#### Scenario: Sin resumen persistido

- **WHEN** se consultan los insights almacenados de una conversación
- **THEN** no se devuelve un resumen
