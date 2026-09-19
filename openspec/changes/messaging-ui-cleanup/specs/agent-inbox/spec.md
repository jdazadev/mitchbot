## Purpose

Define la bandeja de conversaciones del agente: filtrado por canales habilitados, búsqueda, agrupación por fecha, toma de control manual, guardado del cliente como contacto, conteo de no leídos y un compositor con únicamente acciones funcionales.

## ADDED Requirements

### Requirement: Filtrado por canales habilitados

El sistema SHALL derivar los filtros de canal desde la configuración de canales del proyecto activo, mostrando únicamente los canales habilitados más una opción "Todos" (seleccionada por defecto). El sistema SHALL NOT mostrar canales deshabilitados ni canales fijos ajenos a la configuración. Seleccionar un canal SHALL filtrar la lista de conversaciones por su plataforma.

#### Scenario: Canales habilitados visibles

- **WHEN** el proyecto tiene habilitados WhatsApp y Web
- **THEN** los filtros muestran "Todos", WhatsApp y Web
- **AND** no se muestra Instagram

#### Scenario: Filtrado real

- **WHEN** el usuario selecciona un canal
- **THEN** la lista muestra solo conversaciones de esa plataforma

#### Scenario: Todos por defecto

- **WHEN** se abre la bandeja
- **THEN** el filtro activo es "Todos"
- **AND** se ven todas las conversaciones

### Requirement: Búsqueda de conversaciones

El sistema SHALL permitir buscar conversaciones por nombre del cliente y por contenido del último mensaje, sin distinguir mayúsculas de minúsculas. Con la búsqueda vacía SHALL mostrar todas las conversaciones.

#### Scenario: Coincidencia por nombre

- **WHEN** el usuario escribe parte del nombre de un cliente
- **THEN** la lista se reduce a las conversaciones coincidentes

#### Scenario: Búsqueda vacía

- **WHEN** el campo de búsqueda está vacío
- **THEN** se muestran todas las conversaciones

### Requirement: Agrupación por fecha

El sistema SHALL agrupar los mensajes de la conversación por día con encabezados de fecha reales. El sistema SHALL NOT mostrar un encabezado fijo "Today".

#### Scenario: Encabezados reales

- **WHEN** una conversación tiene mensajes de días distintos
- **THEN** se muestran separadores por día en orden cronológico

### Requirement: Toma de control manual bidireccional

El sistema SHALL permitir al agente tomar el control de la conversación (modo `human_takeover`) y devolverla al modo automático (`auto_pilot`), actualizando la interfaz sin recargar. Mientras el modo sea `human_takeover`, el bot SHALL NOT responder automáticamente.

#### Scenario: Tomar control

- **WHEN** el agente activa "Take Over"
- **THEN** la conversación pasa a `human_takeover`
- **AND** el indicador de modo automático se desactiva sin recargar

#### Scenario: Devolver a automático

- **WHEN** el agente reactiva el modo automático
- **THEN** la conversación vuelve a `auto_pilot`

#### Scenario: Bot en pausa

- **WHEN** la conversación está en `human_takeover` y llega un mensaje del cliente
- **THEN** el bot no responde automáticamente

### Requirement: Guardar cliente como contacto

El sistema SHALL ofrecer una acción explícita en la conversación para crear o vincular el contacto del cliente a partir de sus datos, incluso cuando la creación automática de contactos esté deshabilitada. La acción SHALL ser idempotente y SHALL quedar acotada al proyecto de la conversación.

#### Scenario: Creación explícita

- **WHEN** el agente guarda al cliente como contacto y este no existe
- **THEN** se crea el contacto
- **AND** la conversación queda vinculada al contacto

#### Scenario: Idempotencia

- **WHEN** el agente repite la acción y el contacto ya existe
- **THEN** no se crea un contacto duplicado

#### Scenario: Creación automática deshabilitada

- **WHEN** la creación automática de contactos está deshabilitada para el proyecto
- **THEN** la acción manual de guardar contacto sigue funcionando

### Requirement: Conteo de conversaciones no leídas

El sistema SHALL mostrar en el menú lateral el total de mensajes no leídos del proyecto activo y actualizarlo en vivo ante nuevos mensajes. El sistema SHALL NOT mostrar un número hardcodeado.

#### Scenario: Total real

- **WHEN** el proyecto tiene conversaciones con mensajes no leídos
- **THEN** el badge muestra la suma real de no leídos

#### Scenario: Actualización en vivo

- **WHEN** llega un mensaje nuevo
- **THEN** el badge se incrementa sin recargar

#### Scenario: Sin no leídos

- **WHEN** no hay mensajes no leídos
- **THEN** el badge no se muestra

### Requirement: Compositor con acciones funcionales

El compositor de mensajes SHALL exponer únicamente acciones con comportamiento implementado. El sistema SHALL NOT mostrar controles decorativos sin función (chips de sugerencia, emoji, adjuntos, imagen, menú).

#### Scenario: Sin controles muertos

- **WHEN** el agente abre una conversación
- **THEN** no aparecen chips de sugerencia ni botones de emoji/adjuntos sin función

#### Scenario: Envío funcional

- **WHEN** el agente escribe y envía un mensaje
- **THEN** el mensaje se envía y aparece en la conversación
