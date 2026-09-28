## Purpose

Define cómo el sistema separa la confirmación del cliente en la conversación de la aprobación de un operador autorizado, la cola de solicitudes pendientes y el panel donde se aprueban o rechazan las operaciones sensibles.

## ADDED Requirements

### Requirement: Capa de control por operación

El sistema SHALL asociar a cada operación una capa de control entre `ninguna`, `confirmacion_cliente` y `aprobacion_operador`. Las operaciones que solo leen o consultan SHALL usar `ninguna`; las operaciones que crean o editan registros del negocio SHALL usar `confirmacion_cliente`; las operaciones destructivas (`eliminar`) y el registro de intenciones de cobro SHALL usar `aprobacion_operador`. Una operación con capa `aprobacion_operador` SHALL NOT ejecutarse sin la aprobación de un operador autorizado.

#### Scenario: Operación de lectura sin fricción

- **WHEN** el agente invoca una operación de lectura
- **THEN** la operación se ejecuta sin confirmación ni aprobación

#### Scenario: Creación confirmada por el cliente

- **WHEN** el agente invoca una operación de creación con capa de confirmación del cliente
- **THEN** el sistema solicita la confirmación del cliente en la conversación
- **AND** la operación se ejecuta solo tras esa confirmación

#### Scenario: Eliminación sujeta a aprobación

- **WHEN** el agente invoca una operación de eliminación
- **THEN** el sistema no la ejecuta de inmediato
- **AND** queda pendiente de la aprobación de un operador autorizado

### Requirement: Rol autorizado para aprobar

El sistema SHALL restringir la aprobación de operaciones al rol `approver`. Un usuario con rol `admin` SHALL poder aprobar siempre, como respaldo cuando no exista ningún usuario con rol `approver` en el proyecto. Un usuario sin rol autorizado SHALL NOT poder aprobar ni rechazar solicitudes.

#### Scenario: Aprobación por rol aprobador

- **WHEN** un usuario con rol `approver` aprueba una solicitud pendiente
- **THEN** el sistema acepta la aprobación

#### Scenario: Administrador como respaldo

- **WHEN** no existe un usuario con rol `approver` en el proyecto y un `admin` aprueba la solicitud
- **THEN** el sistema acepta la aprobación

#### Scenario: Usuario no autorizado

- **WHEN** un usuario sin rol `approver` ni `admin` intenta aprobar una solicitud
- **THEN** el sistema rechaza la operación con un error de permisos

### Requirement: Cola de solicitudes pendientes

El sistema SHALL registrar cada solicitud que requiera aprobación con la operación, los datos propuestos, el binding y la conversación de origen, y SHALL listarla como pendiente hasta que sea aprobada o rechazada. Al aprobarse, el sistema SHALL ejecutar la operación; al rechazarse, SHALL NOT ejecutarla y SHALL informar la decisión.

#### Scenario: Solicitud en cola

- **WHEN** el agente invoca una operación que requiere aprobación
- **THEN** la solicitud aparece en la cola de pendientes con sus datos y su conversación de origen

#### Scenario: Aprobación ejecuta la operación

- **WHEN** un operador autorizado aprueba una solicitud pendiente
- **THEN** el sistema ejecuta la operación aprobada
- **AND** la solicitud deja de estar pendiente

#### Scenario: Rechazo cancela la operación

- **WHEN** un operador autorizado rechaza una solicitud pendiente
- **THEN** el sistema no ejecuta la operación
- **AND** la solicitud deja de estar pendiente

### Requirement: Aviso en tiempo real de solicitudes

El sistema SHALL notificar en tiempo real al proyecto cuando se registra una nueva solicitud pendiente de aprobación, de modo que el indicador de pendientes se actualice sin recargar la página.

#### Scenario: Nueva solicitud notificada

- **WHEN** se registra una solicitud que requiere aprobación
- **THEN** el proyecto recibe el aviso en tiempo real
- **AND** el indicador de pendientes se actualiza sin recargar

### Requirement: Registro del actor de la decisión

El sistema SHALL registrar qué usuario aprobó o rechazó cada solicitud y en qué momento, dejando constancia en el historial de la ejecución.

#### Scenario: Autor de la aprobación

- **WHEN** un operador autorizado resuelve una solicitud
- **THEN** el sistema conserva su identidad y la marca temporal de la decisión

### Requirement: Panel de aprobaciones

El sistema SHALL ofrecer un panel donde un usuario autorizado pueda listar las solicitudes pendientes y aprobarlas o rechazarlas, mostrando el indicador de pendientes únicamente cuando existan solicitudes sin resolver.

#### Scenario: Acceso al panel

- **WHEN** un usuario autorizado abre el panel de aprobaciones
- **THEN** ve las solicitudes pendientes con sus datos y su conversación de origen

#### Scenario: Indicador de pendientes

- **WHEN** no hay solicitudes pendientes
- **THEN** el indicador no se muestra

#### Scenario: Resolución desde el panel

- **WHEN** el usuario autorizado aprueba o rechaza una solicitud desde el panel
- **THEN** la solicitud sale de la lista de pendientes
- **AND** el indicador se actualiza
