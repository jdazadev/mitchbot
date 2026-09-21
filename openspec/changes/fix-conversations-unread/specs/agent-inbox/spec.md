## MODIFIED Requirements

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

## ADDED Requirements

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
