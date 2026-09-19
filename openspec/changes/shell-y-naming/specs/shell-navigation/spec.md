## Purpose

Define la navegación y los elementos del shell de la aplicación: la nomenclatura de los módulos, el selector de rango de fechas del panel de métricas y el centro de notificaciones.

## ADDED Requirements

### Requirement: Nomenclatura de módulos

El sistema SHALL presentar los módulos como "Brain" y "Clients" en el menú lateral y en los títulos de la barra superior, de forma consistente. La ruta del módulo de clientes SHALL ser `/clients` y la ruta anterior `/contacts` SHALL redirigir a ella. El sistema SHALL NOT mostrar las etiquetas "Brain & RAG" ni "Contacts" en la interfaz.

#### Scenario: Etiquetas consistentes

- **WHEN** el usuario abre el menú lateral
- **THEN** ve los módulos "Brain" y "Clients"
- **AND** no ve "Brain & RAG" ni "Contacts"

#### Scenario: Ruta renombrada con redirección

- **WHEN** el usuario navega a `/contacts`
- **THEN** el sistema lo redirige a `/clients` y muestra el módulo de clientes

#### Scenario: Título de página coherente

- **WHEN** el usuario abre el módulo de clientes
- **THEN** la barra superior muestra "Clients"

### Requirement: Rango de fechas del panel

El sistema SHALL ofrecer en el panel de métricas un control de rango de fechas con opciones de últimos 7, 30 y 90 días, con 30 días por defecto, que afecte tanto a las métricas como al volumen mostrado. El sistema SHALL ofrecer toggles de granularidad (diaria, semanal y mensual) con efecto real. El sistema SHALL NOT mostrar controles de fecha sin función.

#### Scenario: Cambio de rango

- **WHEN** el usuario selecciona últimos 7 días
- **THEN** las métricas y el volumen se recalculan para ese rango

#### Scenario: Rango por defecto

- **WHEN** el usuario abre el panel
- **THEN** el rango activo es de últimos 30 días

#### Scenario: Granularidad funcional

- **WHEN** el usuario cambia la granularidad a mensual
- **THEN** el volumen se muestra agregado por mes

### Requirement: Centro de notificaciones

El sistema SHALL ofrecer en la barra superior un panel de notificaciones que reciba los eventos de notificación administrativa, los liste y muestre un indicador únicamente cuando existan notificaciones no leídas. El usuario SHALL poder marcar las notificaciones como leídas. El alcance de las notificaciones SHALL ser la sesión activa.

#### Scenario: Notificación recibida

- **WHEN** llega una notificación administrativa
- **THEN** aparece en el panel
- **AND** se muestra el indicador de no leídas

#### Scenario: Sin notificaciones pendientes

- **WHEN** no hay notificaciones sin leer
- **THEN** el indicador no se muestra

#### Scenario: Marcar como leídas

- **WHEN** el usuario abre el panel y marca las notificaciones como leídas
- **THEN** el indicador desaparece

#### Scenario: Abrir el panel

- **WHEN** el usuario pulsa el icono de notificaciones
- **THEN** se abre el panel con el listado de notificaciones de la sesión
