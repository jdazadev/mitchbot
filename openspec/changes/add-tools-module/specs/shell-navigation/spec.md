## MODIFIED Requirements

### Requirement: Nomenclatura de módulos

El sistema SHALL presentar los módulos como "Brain", "Clients" y "Tools" en el menú lateral y en los títulos de la barra superior, de forma consistente. La ruta del módulo de clientes SHALL ser `/clients` y la ruta anterior `/contacts` SHALL redirigir a ella. La ruta del módulo de herramientas SHALL ser `/tools`. El sistema SHALL NOT mostrar las etiquetas "Brain & RAG" ni "Contacts" en la interfaz.

#### Scenario: Etiquetas consistentes

- **WHEN** el usuario abre el menú lateral
- **THEN** ve los módulos "Brain", "Clients" y "Tools"
- **AND** no ve "Brain & RAG" ni "Contacts"

#### Scenario: Ruta renombrada con redirección

- **WHEN** el usuario navega a `/contacts`
- **THEN** el sistema lo redirige a `/clients` y muestra el módulo de clientes

#### Scenario: Título de página coherente

- **WHEN** el usuario abre el módulo de clientes
- **THEN** la barra superior muestra "Clients"

#### Scenario: Acceso al módulo de herramientas

- **WHEN** el usuario abre el módulo de herramientas
- **THEN** la barra superior muestra "Tools"
- **AND** el menú lateral marca "Tools" como el módulo activo
