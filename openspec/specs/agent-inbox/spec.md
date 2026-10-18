# agent-inbox Specification

## Purpose

Define la bandeja de conversaciones del agente: filtrado por canales habilitados, búsqueda, agrupación por fecha, toma de control manual, guardado del cliente como contacto, conteo de no leídos y un compositor con únicamente acciones funcionales.

## Requirements

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

El sistema SHALL mostrar en el menú lateral el total de mensajes no leídos del proyecto activo. El contador SHALL incrementarse únicamente con mensajes entrantes del cliente (`contact`); los mensajes del bot y del agente humano SHALL NOT incrementarlo. El contador mostrado SHALL provenir de un valor persistido por conversación, no de un número hardcodeado. Al abrir una conversación el sistema SHALL persistir su lectura (`unreadCount = 0`) de modo que el contador no reaparezca al recargar la página, y SHALL notificar la lectura al resto de sesiones del proyecto en tiempo real. Si llega un mensaje del cliente a una conversación actualmente abierta por el agente, el sistema SHALL marcarla como leída de inmediato, sin incrementar el badge.

#### Scenario: Total real

- **WHEN** el proyecto tiene conversaciones con mensajes de clientes no leídos
- **THEN** el badge muestra la suma real de no leídos

#### Scenario: Actualización en vivo

- **WHEN** llega un mensaje nuevo del cliente a una conversación no abierta
- **THEN** el badge se incrementa sin recargar

#### Scenario: Solo el cliente suma

- **WHEN** el bot o el agente humano envían un mensaje
- **THEN** el contador de no leídos de la conversación no aumenta

#### Scenario: Persistencia de la lectura

- **WHEN** el agente abre una conversación con mensajes no leídos y luego recarga la página
- **THEN** el contador de esa conversación permanece en cero
- **AND** el badge no vuelve a mostrarlos

#### Scenario: Mensaje entrante en conversación abierta

- **WHEN** el cliente envía un mensaje a la conversación que el agente tiene abierta
- **THEN** el sistema la marca como leída de inmediato
- **AND** el badge no se incrementa

#### Scenario: Sincronización entre sesiones

- **WHEN** una sesión del proyecto marca una conversación como leída
- **THEN** el resto de sesiones del mismo proyecto actualiza su badge sin recargar

#### Scenario: Sin no leídos

- **WHEN** no hay mensajes de clientes no leídos
- **THEN** el badge no se muestra

### Requirement: Compositor con acciones funcionales

El compositor de mensajes SHALL exponer únicamente acciones con comportamiento implementado. El sistema SHALL NOT mostrar controles decorativos sin función (chips de sugerencia, emoji, adjuntos, imagen, menú).

#### Scenario: Sin controles muertos

- **WHEN** el agente abre una conversación
- **THEN** no aparecen chips de sugerencia ni botones de emoji/adjuntos sin función

#### Scenario: Envío funcional

- **WHEN** el agente escribe y envía un mensaje
- **THEN** el mensaje se envía y aparece en la conversación

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

### Requirement: Selección inicial de conversación

Al entrar al módulo de conversaciones el sistema SHALL NOT seleccionar ninguna conversación de forma automática: SHALL mostrar el estado vacío del panel de conversación hasta que el agente elija una. El sistema SHALL seguir resolviendo el deep-link `?conversation=<id>` seleccionando la conversación solicitada cuando el identificador es válido y pertenece al proyecto.

#### Scenario: Sin selección por defecto

- **WHEN** el agente abre el módulo de conversaciones sin un identificador de conversación en la URL
- **THEN** no hay ninguna conversación seleccionada
- **AND** se muestra el estado vacío del panel de conversación

#### Scenario: Deep-link respetado

- **WHEN** el agente llega al módulo con `?conversation=<id>` apuntando a una conversación válida del proyecto
- **THEN** esa conversación queda seleccionada y sus mensajes visibles

#### Scenario: Deep-link inválido

- **WHEN** el identificador de la URL no corresponde a una conversación del proyecto
- **THEN** el sistema no selecciona nada y muestra el estado vacío
