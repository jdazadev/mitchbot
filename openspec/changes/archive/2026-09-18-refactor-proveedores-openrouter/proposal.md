## Why

La plataforma mantiene un sistema de proveedores multi-proveedor (Ollama, OpenRouter, Gemini, Mistral) con credenciales almacenadas y editables en base de datos, más un rol `devadmin` cuyo único propósito es administrar esas credenciales. Para una venta SaaS con un único backend compartido, esto añade superficie de configuración, riesgo de filtrar API keys en la BD y complejidad de UI. Se decide estandarizar en **OpenRouter como único proveedor** (LLM, embeddings y OCR) con credenciales en variables de entorno, eliminando el rol `devadmin`, su UI y moviendo el módulo de pruebas a una ruta aislada.

## What Changes

- **BREAKING**: El sistema SHALL usar exclusivamente OpenRouter para LLM, embeddings y OCR. Se eliminan las integraciones de Ollama, Gemini y Mistral del enrutador de IA y de las cadenas de fallback.
- Las credenciales de proveedor SHALL provenir de variables de entorno (p. ej. `OPENROUTER_API_KEY`) y SHALL NOT almacenarse en base de datos.
- **BREAKING**: Se elimina el rol `devadmin`. Los roles válidos pasan a ser `admin`, `support` y `assistant`.
- Se elimina la vista de configuración de proveedores (`DevAdminModels.vue`) y sus rutas/endpoints asociados.
- El módulo de pruebas (extracción de texto) se mueve a una ruta aislada, accesible solo por URL para usuarios autenticados y sin entrada en el menú lateral.
- El re-ranker de RAG deja de depender de embeddings locales de Ollama: se reimplementa con embeddings de OpenRouter o se desactiva por configuración.

## Capabilities

### New Capabilities

- `ai-providers`: Selección de proveedor único (OpenRouter), credenciales por variables de entorno y resolución de modelos para LLM, embeddings y OCR.
- `user-roles`: Conjunto de roles del sistema y autorización asociada, sin rol `devadmin`.
- `dev-tools`: Herramientas internas de diagnóstico/prueba expuestas en una ruta aislada y oculta de la navegación.

### Modified Capabilities

<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Backend**: `services/llm-provider.service.ts`, `services/reranker.service.ts`, `services/ocr.service.ts`, `services/ai-model.service.ts`, `services/ai.service.ts`, `services/rag.service.ts`, `config/env.ts`, `models/ai-model.model.ts`, `models/user.model.ts`, `controllers/ai-models.controller.ts`, `controllers/users.controller.ts`, `routes/ai-models.routes.ts`, `middleware/upload.middleware.ts`, `services/auth.service.ts`, `services/user.service.ts`, `services/config.service.ts`, `scripts/seed.ts`.
- **Frontend**: eliminación de `views/DevAdminModels.vue`; ajustes en `views/DevAdminTests.vue`, `views/Users.vue`, `views/Brain.vue`, `components/layout/Sidebar.vue`, `router/index.ts`, `services/settings.service.ts`, `services/auth.service.ts`, `services/user.service.ts`, `services/brain.service.ts`.
- **Datos**: `provider_configs` deja de almacenar `apiKey`; migración para eliminarla de documentos existentes. Eliminación del usuario `devadmin` sembrado.
- **Infraestructura**: el contenedor de Ollama deja de ser dependencia funcional del backend (puede permanecer para desarrollo). Se añade `OPENROUTER_API_KEY` (y modelos por defecto opcionales) a las variables de entorno.
