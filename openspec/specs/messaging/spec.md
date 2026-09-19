# messaging Specification

## Purpose

Define el comportamiento conversacional del chatbot —memoria, saludo y despedida naturales—, la propagación en vivo del modo/estado de la conversación y qué mensajes internos se muestran a cada audiencia (agente vs. cliente final).

## Requirements

### Requirement: Memoria de conversación

El sistema SHALL proporcionar al modelo de lenguaje el historial reciente de la conversación al generar una respuesta del bot, tanto en respuestas directas como en las posteriores a la ejecución de herramientas. El historial SHALL acotarse a los últimos 20 mensajes, SHALL representar los mensajes del cliente y del agente humano como turnos de usuario y los del bot como turnos del asistente, y SHALL excluir los mensajes internos de herramientas (`tool_call`, `tool_result`, `confirmation_request`). El comportamiento del bot —incluido si ya saludó— SHALL derivarse de ese historial.

#### Scenario: Respuesta con contexto

- **WHEN** el cliente envía un mensaje en una conversación con historial previo
- **THEN** el bot responde considerando los mensajes anteriores
- **AND** no repite un saludo que ya emitió

#### Scenario: Historial acotado

- **WHEN** la conversación supera los 20 mensajes
- **THEN** el prompt incluye solo los últimos 20
- **AND** la generación no falla por longitud del historial

#### Scenario: Mensajes internos excluidos

- **WHEN** el historial contiene mensajes de herramientas (`tool_call`, `tool_result`, `confirmation_request`)
- **THEN** esos mensajes no se incluyen en el prompt del modelo

#### Scenario: Intervención humana representada

- **WHEN** un agente humano envió mensajes en la conversación
- **THEN** el bot los considera como parte del contexto conversacional

### Requirement: Saludo y despedida naturales

El sistema SHALL delegar el saludo y la despedida al modelo de lenguaje, sin anteponer textos enlatados a la respuesta generada. El bot SHALL saludar únicamente al inicio de la conversación o cuando esta se retome tras una pausa superior a 6 horas, y SHALL despedirse solo cuando el cliente se despida. Las palabras clave de despedida SHALL NOT incluir "gracias" ni sus variantes. Al detectar una despedida, el sistema SHALL NOT enviar un mensaje enlatado ni interrumpir la generación: el bot responde con naturalidad y después la conversación SHALL marcarse como cerrada.

#### Scenario: Saludo único al inicio

- **WHEN** el cliente envía el primer mensaje de la conversación
- **THEN** el bot saluda una sola vez
- **AND** el mensaje no contiene dos saludos superpuestos

#### Scenario: Sin re-saludo a mitad de conversación

- **WHEN** el cliente saluda en un mensaje intermedio
- **THEN** el bot continúa la conversación sin reiniciar el saludo de bienvenida

#### Scenario: Re-saludo tras pausa larga

- **WHEN** transcurren más de 6 horas desde el último mensaje y el cliente escribe de nuevo
- **THEN** el bot saluda de nuevo de forma natural

#### Scenario: Agradecimiento no cierra la conversación

- **WHEN** el cliente agradece ("gracias") a mitad de la conversación
- **THEN** la conversación permanece abierta
- **AND** el bot responde al mensaje

#### Scenario: Despedida natural y cierre

- **WHEN** el cliente se despide
- **THEN** el bot responde con una despedida natural
- **AND** la conversación queda cerrada
- **AND** no se envía un mensaje de despedida enlatado

### Requirement: Propagación en vivo del estado de conversación

El sistema SHALL notificar en vivo los cambios de modo y estado de una conversación (por ejemplo, la transferencia a un asesor humano) y las interfaces conectadas —el dashboard de mensajería y la vista pública del cliente— SHALL reflejarlos sin necesidad de recargar. Mientras el modo sea `human_takeover`, un mensaje entrante del cliente SHALL NOT disparar una respuesta automática del bot.

#### Scenario: Transferencia reflejada en el dashboard

- **WHEN** el bot transfiere la conversación a un asesor humano
- **THEN** el modo cambia a `human_takeover` y el estado a pendiente de humano
- **AND** el dashboard deja de mostrar el modo automático sin recargar

#### Scenario: Vista del cliente informada

- **WHEN** cambia el modo o estado de la conversación
- **THEN** la vista pública del cliente recibe la notificación del cambio

#### Scenario: Bot en pausa durante toma de control

- **WHEN** la conversación está en `human_takeover` y el cliente escribe
- **THEN** el bot no genera respuesta automática

### Requirement: Visibilidad de mensajes internos según audiencia

El sistema SHALL NOT mostrar al cliente final los mensajes internos de herramientas (`tool_call` y `tool_result`). El dashboard del agente SHALL continuar mostrándolos. Los mensajes de solicitud de confirmación (`confirmation_request`) y sus acciones SHALL permanecer visibles para el cliente, por formar parte del flujo de confirmación de acciones. Ante el fallo de una herramienta, el cliente SHALL NOT recibir el detalle técnico del error.

#### Scenario: Resultado de herramienta oculto al cliente

- **WHEN** una herramienta se ejecuta durante una conversación
- **THEN** el cliente final no ve la tarjeta de llamada ni de resultado de la herramienta
- **AND** el dashboard del agente sí la muestra

#### Scenario: Confirmación visible para el cliente

- **WHEN** una acción requiere confirmación del usuario
- **THEN** el cliente ve la solicitud de confirmación con sus acciones

#### Scenario: Error interno no expuesto

- **WHEN** una herramienta falla
- **THEN** el cliente no ve el mensaje técnico de error de la herramienta
