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

El sistema SHALL resolver todos los modelos de IA exclusivamente desde variables de entorno: `OPENROUTER_LLM_MODEL` para el chat (requerido, sin valor por defecto), `OPENROUTER_EMBEDDING_MODEL` para embeddings, `OPENROUTER_OCR_MODEL` para OCR, `OPENROUTER_FILE_MODEL` para conversión de archivos (opcional) y `OPENROUTER_RERANKER_MODEL` para re-ranking (opcional). El sistema SHALL NOT resolver modelos desde el agente ni desde configuración almacenada en base de datos. Cuando falte el modelo de lenguaje, el sistema SHALL fallar con un mensaje que indique definir `OPENROUTER_LLM_MODEL` en el entorno.

#### Scenario: Modelo de agente seleccionado

- **WHEN** un agente tiene un modelo asignado distinto al de la variable de entorno
- **THEN** el sistema usa el modelo definido por `OPENROUTER_LLM_MODEL`
- **AND** el modelo del agente no afecta las respuestas

#### Scenario: Modelo de lenguaje definido por entorno

- **WHEN** la variable de entorno `OPENROUTER_LLM_MODEL` está definida y se genera una respuesta
- **THEN** el sistema usa ese modelo para las respuestas del chatbot

#### Scenario: Modelo de lenguaje no configurado

- **WHEN** la variable de entorno `OPENROUTER_LLM_MODEL` no está definida y se intenta responder
- **THEN** el sistema falla con un mensaje claro que indica definir `OPENROUTER_LLM_MODEL` en el entorno
- **AND** el mensaje no sugiere seleccionar un modelo en la interfaz

#### Scenario: Modelo de embeddings por defecto

- **WHEN** no se especifica un modelo de embeddings explícito
- **THEN** el sistema usa el valor de `OPENROUTER_EMBEDDING_MODEL` con su valor por defecto razonable

#### Scenario: Conversión de archivos sin modelo dedicado

- **WHEN** `OPENROUTER_FILE_MODEL` no está definida y se procesa un archivo CSV
- **THEN** el sistema indexa el contenido sin conversión por LLM
- **AND** la extracción no falla por ausencia del modelo de archivos

#### Scenario: Re-ranking con modelo de respaldo

- **WHEN** `OPENROUTER_RERANKER_MODEL` no está definida y el re-ranker está habilitado
- **THEN** el re-ranker usa el modelo de embeddings configurado en el entorno

### Requirement: Configuración de modelos a nivel de despliegue

El sistema SHALL tratar los modelos como configuración del despliegue, no del usuario ni del proyecto. El sistema SHALL NOT ofrecer selección de modelo por agente ni por proyecto, y SHALL ignorar los overrides de modelo almacenados en base de datos (`provider_configs.selectedModel`, `rag.ocr_openrouter_model`, `rag.reranker_model`). Los parámetros que no son modelos —escala, límites de páginas, tamaño de lote, timeout, habilitación de re-ranking, `top_k`/`final_k`, temperatura y `maxTokens`— SHALL mantenerse configurables.

#### Scenario: Override de modelo en base de datos ignorado

- **WHEN** existe un modelo seleccionado en base de datos distinto al configurado en el entorno
- **THEN** el sistema usa el modelo del entorno
- **AND** el valor almacenado no altera la respuesta

#### Scenario: Campos de modelo del agente ignorados

- **WHEN** un agente conserva un modelo asignado distinto al del entorno
- **THEN** las respuestas usan el modelo del entorno

#### Scenario: Parámetros que no son modelos siguen vigentes

- **WHEN** se ajusta un parámetro como `rag.reranker_top_k` o `rag.ocr_scale`
- **THEN** el sistema aplica ese valor en su comportamiento

### Requirement: Interfaz sin selección de modelos

El sistema SHALL NOT presentar selectores, buscadores ni listados para elegir modelos en el onboarding, la gestión de agentes ni la configuración. El sistema SHALL exponer los modelos resueltos del servidor (LLM, embeddings y OCR) en modo solo lectura.

#### Scenario: Onboarding sin selección de modelo

- **WHEN** un usuario completa el onboarding
- **THEN** no se muestra ningún control de selección de modelo
- **AND** el alta del proyecto y su agente no requiere elegir un modelo

#### Scenario: Alta y edición de agente sin modelo

- **WHEN** un usuario crea o edita un agente
- **THEN** la interfaz no solicita ni envía un modelo

#### Scenario: Modelos del servidor visibles en solo lectura

- **WHEN** un usuario abre la configuración
- **THEN** ve los modelos de chat, embeddings y OCR definidos por el entorno
- **AND** no puede modificarlos desde la interfaz

### Requirement: Degradación controlada ante fallo del proveedor

Si la invocación a OpenRouter falla para la búsqueda de contexto (RAG), el sistema SHALL continuar la generación sin contexto en lugar de abortar la respuesta. Si falla la generación principal, el sistema SHALL mostrar y registrar el error en el historial de mensajería.

#### Scenario: Fallo de RAG no aborta la respuesta

- **WHEN** la recuperación de contexto desde la base de conocimiento falla
- **THEN** el sistema genera la respuesta del chatbot sin contexto

#### Scenario: Fallo de generación visible

- **WHEN** la generación de la respuesta falla por error del proveedor
- **THEN** el sistema muestra un mensaje de error en el chat
- **AND** registra el error en el historial de mensajería
