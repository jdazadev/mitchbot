# ai-providers Specification

## Purpose

Define el uso de OpenRouter como único proveedor de IA de la plataforma, con credenciales en variables de entorno y una resolución de modelos predecible para LLM, embeddings y OCR.

## Requirements

### Requirement: Proveedor único OpenRouter

El sistema SHALL usar exclusivamente OpenRouter como proveedor para generación de lenguaje (LLM), embeddings y OCR. El sistema SHALL NOT ofrecer ni ejecutar integraciones con otros proveedores de IA.

#### Scenario: Configuración de proveedor restringida

- **WHEN** un usuario administrador consulta las opciones de proveedor disponibles
- **THEN** solo se ofrece OpenRouter
- **AND** no existen opciones de Ollama, Gemini ni Mistral

#### Scenario: Intento de uso de otro proveedor rechazado

- **WHEN** llega una solicitud de configuración o ejecución con un proveedor distinto de OpenRouter
- **THEN** el sistema la rechaza con un error explícito de proveedor no soportado

### Requirement: Credenciales por variables de entorno

Las credenciales de proveedor SHALL provenir de variables de entorno. El sistema SHALL NOT almacenar ni exponer credenciales de proveedor en base de datos ni en respuestas de API.

#### Scenario: Ejecución con credencial presente

- **WHEN** la variable de entorno de la API key de OpenRouter está definida
- **THEN** el sistema puede invocar al proveedor sin leer credenciales de base de datos

#### Scenario: Credencial ausente

- **WHEN** la variable de entorno de la API key de OpenRouter no está definida y se intenta generar una respuesta
- **THEN** el sistema falla con un error claro que indica la credencial faltante
- **AND** el error no revela el contenido de ninguna credencial

#### Scenario: Credencial no persistida

- **WHEN** se inspeccionan los documentos de configuración de proveedores almacenados
- **THEN** ninguno contiene un campo de API key con valor

### Requirement: Resolución de modelos

El sistema SHALL resolver el modelo de lenguaje por agente y SHALL permitir configurar los modelos de embeddings y OCR con valores por defecto razonables. Cuando no exista un modelo seleccionado, el sistema SHALL fallar con un mensaje que indique cómo configurarlo.

#### Scenario: Modelo de agente seleccionado

- **WHEN** un agente tiene un modelo de OpenRouter seleccionado
- **THEN** el sistema usa ese modelo para las respuestas del chatbot

#### Scenario: Modelo de lenguaje no configurado

- **WHEN** un agente no tiene modelo seleccionado y se intenta responder
- **THEN** el sistema falla con un mensaje que indica seleccionar un modelo en la configuración del agente

#### Scenario: Modelo de embeddings por defecto

- **WHEN** no se especifica un modelo de embeddings explícito
- **THEN** el sistema usa un modelo de embeddings de OpenRouter por defecto

### Requirement: Degradación controlada ante fallo del proveedor

Si la invocación a OpenRouter falla para la búsqueda de contexto (RAG), el sistema SHALL continuar la generación sin contexto en lugar de abortar la respuesta. Si falla la generación principal, el sistema SHALL mostrar y registrar el error en el historial de mensajería.

#### Scenario: Fallo de RAG no aborta la respuesta

- **WHEN** la recuperación de contexto desde la base de conocimiento falla
- **THEN** el sistema genera la respuesta del chatbot sin contexto

#### Scenario: Fallo de generación visible

- **WHEN** la generación de la respuesta falla por error del proveedor
- **THEN** el sistema muestra un mensaje de error en el chat
- **AND** registra el error en el historial de mensajería
