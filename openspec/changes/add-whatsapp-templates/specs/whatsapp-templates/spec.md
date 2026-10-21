## ADDED Requirements

### Requirement: Catálogo de plantillas aprobadas

El sistema SHALL listar las plantillas aprobadas de la cuenta de WhatsApp Business del proyecto, con su nombre, idioma, categoría, textos y variables, y SHALL marcar como no compatibles las que usan cabecera multimedia o botones con URL variable. La WABA SHALL venir de la configuración del proyecto o, en su defecto, de `WHATSAPP_WABA_ID`.

#### Scenario: Plantillas del proyecto

- **WHEN** un operador abre el selector de plantillas
- **THEN** ve solo las plantillas aprobadas, con su vista previa y sus variables

#### Scenario: Plantilla no compatible

- **WHEN** una plantilla tiene una cabecera de imagen
- **THEN** aparece marcada como no compatible y no se puede enviar

#### Scenario: Sin WABA configurada

- **WHEN** el proyecto no tiene WABA y el entorno tampoco
- **THEN** la API responde 409 y el selector explica cómo configurarla

### Requirement: Envío de plantillas

El sistema SHALL enviar una plantilla aprobada y compatible a una conversación de WhatsApp con cuenta de canal, con todas sus variables rellenas, como mensaje del operador con el texto renderizado. La entrega SHALL usar la cola de WhatsApp y SHALL reflejar los estados de entrega.

#### Scenario: Plantilla enviada

- **WHEN** el operador elige una plantilla, rellena sus variables y la envía
- **THEN** el hilo muestra el texto renderizado y su estado de entrega avanza a Enviado

#### Scenario: Variables incompletas

- **WHEN** falta alguna variable de la plantilla
- **THEN** la API responde 400 y no se crea ningún mensaje

#### Scenario: Conversación que no es de WhatsApp

- **WHEN** se intenta enviar una plantilla a una conversación Web o del simulador
- **THEN** la API responde 409

#### Scenario: Meta rechaza la plantilla

- **WHEN** Meta responde con un error de plantilla, por ejemplo el `132000` (número de variables incorrecto)
- **THEN** el mensaje queda como no entregado, sin reintentos y con un motivo legible

### Requirement: Ventana de 24 horas visible

El sistema SHALL registrar la fecha del último mensaje del cliente en la conversación. En una conversación de WhatsApp en la que hayan pasado más de 24 horas desde ese mensaje, el hilo SHALL indicarlo y SHALL ofrecer el envío de plantilla en lugar del mensaje libre.

#### Scenario: Ventana cerrada

- **WHEN** el operador abre una conversación de WhatsApp cuyo último mensaje del cliente tiene más de 24 horas
- **THEN** el hilo muestra el aviso de la ventana cerrada y el botón Enviar plantilla en lugar del compositor

#### Scenario: Ventana abierta

- **WHEN** el cliente escribió hace menos de 24 horas
- **THEN** el compositor está disponible y la plantilla es una opción adicional

#### Scenario: Fallo por la ventana

- **WHEN** un mensaje falla con el motivo de la ventana de 24 horas
- **THEN** junto al fallo aparece la acción Enviar plantilla
