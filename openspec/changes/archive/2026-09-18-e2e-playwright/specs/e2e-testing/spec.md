## Purpose

Define la infraestructura y la batería de pruebas end-to-end de la plataforma, garantizando ejecución repetible, aislamiento de datos, autenticación reutilizable y respuestas del bot deterministas sin costo de proveedor.

## ADDED Requirements

### Requirement: Ejecución reproducible de la suite

La suite de pruebas e2e SHALL ejecutarse de forma reproducible en local y en integración continua mediante Playwright, usando la URL base de la aplicación y reutilizando los servidores de desarrollo disponibles. La suite SHALL generar un reporte legible de resultados.

#### Scenario: Ejecución local

- **WHEN** un desarrollador ejecuta el comando de pruebas e2e
- **THEN** la suite corre contra la aplicación local
- **AND** produce un reporte de resultados con los casos aprobados y fallidos

#### Scenario: Falla detectable

- **WHEN** un flujo crítico deja de funcionar
- **THEN** al menos una prueba e2e falla señalando la regresión

### Requirement: Autenticación reutilizable

La suite SHALL autenticar una vez y reutilizar el estado de sesión entre pruebas, evitando repetir el inicio de sesión en cada caso.

#### Scenario: Sesión reutilizada

- **WHEN** una prueba requiere un usuario autenticado
- **THEN** usa un estado de sesión previamente establecido
- **AND** no vuelve a ejecutar el flujo de login

#### Scenario: Prueba de inicio de sesión

- **WHEN** una prueba valida el flujo de login
- **THEN** ejecuta el inicio de sesión real con credenciales de prueba

### Requirement: Aislamiento y datos de prueba

Cada prueba SHALL ser independiente y no depender del orden de ejecución ni de datos dejados por otra prueba. La suite SHALL contar con datos de prueba dedicados y limpieza o generación por caso.

#### Scenario: Independencia de pruebas

- **WHEN** una prueba se ejecuta de forma aislada o fuera de orden
- **THEN** pasa de la misma forma que en la ejecución completa

#### Scenario: Datos de prueba dedicados

- **WHEN** la suite necesita conversaciones, contactos o proyectos de prueba
- **THEN** los obtiene de un conjunto de datos dedicado a pruebas, sin usar datos de producción

### Requirement: Respuestas del bot deterministas

Las pruebas SHALL NOT invocar al proveedor de IA real. Las respuestas del bot en las pruebas SHALL ser deterministas y sin costo, permitiendo validar streaming y contenido de forma estable.

#### Scenario: Sin llamadas al proveedor real

- **WHEN** una prueba ejercita una respuesta del bot
- **THEN** el sistema de pruebas sustituye la respuesta del proveedor por una determinista

#### Scenario: Respuesta de bot verificable

- **WHEN** llega un mensaje del cliente que dispara respuesta del bot
- **THEN** la prueba puede verificar el contenido y el streaming de la respuest

### Requirement: Cobertura de los flujos críticos

La suite SHALL cubrir los módulos principales de la plataforma: autenticación, onboarding/setup, dashboard, mensajería, contactos, base de conocimiento, usuarios, configuración, agentes, perfil y chat público.

#### Scenario: Cobertura por módulo

- **WHEN** se revisa la suite
- **THEN** existe al menos una prueba por cada módulo principal

#### Scenario: Prueba de onboarding

- **WHEN** se ejecuta la prueba de onboarding
- **THEN** valida la creación del primer proyecto y su finalización en el dashboard

### Requirement: Validación de mensajería en tiempo real

La suite SHALL validar el envío y recepción de mensajes en tiempo real, incluyendo la transmisión incremental de la respuesta del bot y el flujo de confirmación de herramientas.

#### Scenario: Streaming de la respuesta

- **WHEN** el bot responde a un mensaje en la vista de mensajería
- **THEN** la prueba observa la respuesta aparecer de forma incremental

#### Scenario: Confirmación de herramienta

- **WHEN** el bot solicita confirmación para ejecutar una herramienta
- **THEN** la prueba puede confirmar o cancelar la acción y verificar el resultado

### Requirement: Validación del chat público

La suite SHALL validar el chat público accesible por slug de proyecto, incluyendo el inicio de conversación por un cliente.

#### Scenario: Inicio de conversación pública

- **WHEN** un cliente abre el chat público de un proyecto
- **THEN** puede iniciar una conversación
- **AND** el mensaje inicial llega a la bandeja del proyecto correspondiente
