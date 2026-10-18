## Purpose

Define el catálogo de herramientas del agente como productos configurables (herramienta, operaciones, módulo interno e integraciones), la configuración por proyecto y el binding dinámico del subconjunto habilitado al modelo de lenguaje.

## ADDED Requirements

### Requirement: Catálogo de herramientas y operaciones

El sistema SHALL organizar las capacidades del agente en un catálogo de herramientas, cada una compuesta por un conjunto de operaciones canónicas (`leer`, `crear`, `editar`, `eliminar`) y por un binding activo que SHALL ser su módulo interno o, cuando exista, una integración externa. El catálogo base SHALL incluir las herramientas Agenda, Conocimiento, Inventario y Pagos. Cada operación SHALL exponerse al modelo como una función distinguible con su propio esquema de parámetros.

#### Scenario: Operaciones expuestas

- **WHEN** una herramienta tiene las operaciones `leer` y `crear` habilitadas
- **THEN** el modelo recibe dos funciones distinguibles de esa herramienta
- **AND** cada una declara sus parámetros de entrada

#### Scenario: Herramienta con todas las operaciones

- **WHEN** el catálogo define una herramienta con las cuatro operaciones canónicas
- **THEN** cada operación puede habilitarse de forma independiente

### Requirement: Módulo interno de cada herramienta

El sistema SHALL implementar un módulo interno propio para cada herramienta del catálogo base, de modo que la herramienta funcione sin integraciones externas. El módulo interno de Agenda SHALL gestionar el calendario de citas; el de Conocimiento SHALL consultar la base de conocimiento (RAG); el de Inventario SHALL gestionar los pedidos; y el de Pagos SHALL gestionar el registro de cobros.

#### Scenario: Herramienta operativa sin integración

- **WHEN** un proyecto no configura ninguna integración externa
- **THEN** las operaciones de la herramienta se ejecutan contra su módulo interno
- **AND** la herramienta funciona con normalidad

#### Scenario: Módulo interno de Conocimiento

- **WHEN** el cliente pregunta por información del negocio o de productos
- **THEN** la operación `leer` de Conocimiento responde desde la base de conocimiento del proyecto

### Requirement: Contrato de integraciones

El sistema SHALL definir un contrato por el que cada integración externa declara qué operaciones de una herramienta soporta. Una integración externa que no soporte una operación SHALL NOT ofrecerse como binding para esa operación. En este cambio el único binding implementado SHALL ser el módulo interno; las integraciones externas SHALL NOT ejecutarse todavía.

#### Scenario: Operación no soportada por la integración

- **WHEN** una integración declara no soportar la operación `editar` de una herramienta
- **THEN** el sistema no permite seleccionar esa integración para esa operación
- **AND** no la expone como binding válido

#### Scenario: Solo módulo interno disponible

- **WHEN** el usuario configura el binding de una operación en este cambio
- **THEN** únicamente puede elegir el módulo interno de la herramienta

### Requirement: Configuración de herramientas por proyecto

El sistema SHALL permitir configurar, por proyecto, qué herramientas y qué operaciones están habilitadas, y cuál es el binding activo de cada operación habilitada (matriz herramienta -> operación -> binding). Las restricciones SHALL poder aplicarse por binding, de forma que una operación pueda estar habilitada para el módulo interno y deshabilitada para una integración concreta. La configuración SHALL persistirse por proyecto y SHALL NOT compartirse entre proyectos.

#### Scenario: Herramienta deshabilitada

- **WHEN** un proyecto deshabilita una herramienta
- **THEN** ninguna de sus operaciones se ofrece al modelo en ese proyecto

#### Scenario: Operación deshabilitada

- **WHEN** un proyecto deshabilita una operación de una herramienta habilitada
- **THEN** esa operación deja de ofrecerse al modelo
- **AND** el resto de operaciones de la herramienta siguen disponibles

#### Scenario: Escritura solo en el módulo interno

- **WHEN** una operación está habilitada para el módulo interno y deshabilitada para una integración externa
- **THEN** el modelo puede invocarla con el binding interno
- **AND** no puede invocarla con esa integración

#### Scenario: Aislamiento entre proyectos

- **WHEN** un proyecto modifica su configuración de herramientas
- **THEN** la configuración de los demás proyectos no cambia

### Requirement: Binding dinámico al modelo

El sistema SHALL ofrecer al modelo de lenguaje únicamente las operaciones habilitadas del proyecto de la conversación, en lugar del catálogo completo global. La resolución SHALL ocurrir en el momento de generar la respuesta y SHALL respetar la configuración vigente del proyecto.

#### Scenario: Subconjunto por proyecto

- **WHEN** el proyecto tiene habilitadas únicamente las operaciones de Agenda
- **THEN** el modelo recibe solo esas operaciones
- **AND** no recibe las de herramientas deshabilitadas

#### Scenario: Cambio de configuración reflejado

- **WHEN** se habilita una operación nueva en el proyecto
- **THEN** la siguiente respuesta del agente ya cuenta con esa operación disponible

### Requirement: Herramientas de sistema siempre disponibles

El sistema SHALL tratar la transferencia a un asesor humano y el envío de notificaciones al equipo como herramientas de sistema. Las herramientas de sistema SHALL estar siempre disponibles para el agente y SHALL NOT ser deshabilitables ni configurables desde el catálogo de herramientas del proyecto.

#### Scenario: Escalación siempre disponible

- **WHEN** el cliente solicita hablar con una persona
- **THEN** el agente puede transferir la conversación a un asesor humano con independencia de la configuración del proyecto

#### Scenario: Notificación siempre disponible

- **WHEN** una operación requiere avisar al equipo del negocio
- **THEN** el agente puede enviar la notificación con independencia de la configuración del proyecto

### Requirement: Operaciones internas de Agenda

El sistema SHALL ofrecer las operaciones `leer`, `crear`, `editar` y `eliminar` sobre la herramienta Agenda. La operación `leer` SHALL incluir la consulta de horarios de atención y de disponibilidad para una fecha, absorbiendo esas capacidades. La operación `editar` SHALL permitir reprogramar una cita existente y la operación `eliminar` SHALL permitir cancelarla.

#### Scenario: Lectura de disponibilidad

- **WHEN** el cliente pregunta por horarios disponibles en una fecha
- **THEN** la operación `leer` de Agenda responde con la disponibilidad de esa fecha

#### Scenario: Reprogramación de una cita

- **WHEN** el cliente pide cambiar la fecha u hora de una cita existente
- **THEN** la operación `editar` de Agenda actualiza la cita indicada

#### Scenario: Cancelación de una cita

- **WHEN** el cliente pide cancelar una cita existente y la cancelación es aprobada
- **THEN** la operación `eliminar` de Agenda cancela la cita

### Requirement: Operaciones internas de Inventario

El sistema SHALL ofrecer las operaciones `leer`, `crear`, `editar` y `eliminar` sobre la herramienta Inventario. La operación `leer` SHALL consultar el estado de los pedidos del contacto; la operación `crear` SHALL registrar un pedido; las operaciones `editar` y `eliminar` SHALL modificar o cancelar un pedido existente.

#### Scenario: Consulta de pedido

- **WHEN** el cliente pregunta por el estado de su pedido
- **THEN** la operación `leer` de Inventario responde con el estado del pedido del contacto

#### Scenario: Registro de pedido

- **WHEN** el cliente confirma los artículos de un pedido
- **THEN** la operación `crear` de Inventario registra el pedido

#### Scenario: Cancelación de pedido

- **WHEN** se aprueba la cancelación de un pedido existente
- **THEN** la operación `eliminar` de Inventario cancela el pedido

### Requirement: Operaciones internas de Pagos

El sistema SHALL ofrecer las operaciones `leer` y `crear` sobre la herramienta Pagos. La operación `crear` SHALL registrar la intención de cobro indicando cómo pagará el cliente, sin ejecutar movimiento de dinero alguno, y SHALL quedar sujeta a la aprobación de un operador autorizado. La operación `leer` SHALL consultar el estado de los cobros del contacto.

#### Scenario: Registro de intención de cobro

- **WHEN** el cliente indica cómo realizará un pago
- **THEN** la operación `crear` de Pagos registra la intención con estado pendiente de aprobación
- **AND** no se ejecuta ningún movimiento de dinero

#### Scenario: Consulta de estado de cobro

- **WHEN** el cliente pregunta por el estado de su pago
- **THEN** la operación `leer` de Pagos responde con el estado del cobro del contacto
