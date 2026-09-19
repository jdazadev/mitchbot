# client-directory Specification

## Purpose

Define el directorio de clientes del proyecto y el acceso directo desde cada cliente a su conversación en la bandeja de mensajería, resolviendo la conversación del cliente en el servidor y abriéndola preseleccionada.

## Requirements

### Requirement: Acceso directo a la conversación del cliente

El directorio de clientes SHALL ofrecer, por cada cliente, una acción para abrir la mensajería con la conversación de ese cliente preseleccionada. La conversación SHALL resolverse en el servidor a partir del contacto y acotada al proyecto activo. Cuando el cliente tenga varias conversaciones, el sistema SHALL preferir la conversación activa y, en su defecto, la más reciente. Cuando el cliente no tenga ninguna conversación vinculada, la acción SHALL NOT estar disponible.

#### Scenario: Cliente con conversación activa

- **WHEN** el agente abre la conversación de un cliente que tiene una conversación activa
- **THEN** la bandeja se abre con esa conversación seleccionada

#### Scenario: Cliente con varias conversaciones

- **WHEN** el agente abre la conversación de un cliente cuyas conversaciones están todas cerradas
- **THEN** la bandeja se abre con la conversación más reciente de ese cliente

#### Scenario: Cliente sin conversación

- **WHEN** un cliente no tiene ninguna conversación vinculada
- **THEN** la acción de ver su conversación no está disponible

#### Scenario: Aislamiento por proyecto

- **WHEN** el agente abre la conversación de un cliente
- **THEN** solo se considera una conversación del proyecto activo

### Requirement: Preselección de la conversación en la bandeja

Al abrirse la bandeja con una conversación indicada, el sistema SHALL seleccionarla y cargar sus mensajes e insights. Si la conversación indicada no existe o no pertenece al proyecto activo, el sistema SHALL mostrar la bandeja con su comportamiento por defecto sin fallar.

#### Scenario: Conversación preseleccionada

- **WHEN** la bandeja se abre indicando una conversación válida
- **THEN** esa conversación queda seleccionada
- **AND** se cargan sus mensajes e insights

#### Scenario: Conversación no válida

- **WHEN** la bandeja se abre indicando una conversación inexistente o ajena al proyecto
- **THEN** la bandeja se muestra con su selección por defecto
- **AND** no se produce un error visible
