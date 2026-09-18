## Why

Hoy el modelo de chat se elige durante el onboarding (y también en Agentes y Configuración) consultando OpenRouter en vivo, y queda guardado por agente en la base de datos. Eso obliga al usuario final a elegir un modelo (además de forma arbitraria: se pre-selecciona el primero de la lista), hace que el setup dependa de que el proveedor esté disponible y deja al operador del despliegue sin control sobre qué modelo consume su API key. La plataforma ya migró a proveedor único con credenciales en variables de entorno; falta el último paso: que los modelos también sean configuración de despliegue.

## What Changes

- Nuevas variables de entorno: `OPENROUTER_LLM_MODEL` (requerido, sin valor por defecto), `OPENROUTER_FILE_MODEL` (opcional, usado para convertir CSV a Markdown) y `OPENROUTER_RERANKER_MODEL` (opcional, con fallback al modelo de embeddings).
- **BREAKING**: el modelo de chat deja de resolverse desde el agente; se resuelve siempre desde `OPENROUTER_LLM_MODEL`. Los campos `modelId`/`modelValue` del agente quedan ignorados en runtime (sin cambios de esquema).
- Se eliminan los overrides de modelo almacenados en base de datos: `provider_configs.selectedModel` (embedding y file), `rag.ocr_openrouter_model` y `rag.reranker_model`.
- La interfaz deja de ofrecer selección de modelo: se elimina el bloque "Modelo IA" del onboarding, el selector/buscador de Agentes y el selector del formulario de Configuración.
- El onboarding deja de invocar a OpenRouter en vivo para listar modelos.
- Configuración muestra los modelos resueltos del servidor (LLM, embeddings, OCR) en modo solo lectura.
- Los parámetros que no son modelos se mantienen sin cambios: `rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size`, `rag.ocr_timeout_ms`, `rag.use_reranker`, `rag.reranker_top_k`, `rag.reranker_final_k`, temperatura y `maxTokens` del agente.
- Se documenta que cambiar `OPENROUTER_EMBEDDING_MODEL` en producción invalida los vectores existentes y requiere reindexar.

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `ai-providers`: la resolución de modelos pasa a ser exclusivamente por variables de entorno (LLM requerido; embeddings, OCR, file y re-ranker con defaults/fallbacks), se elimina la selección de modelo por agente y los overrides en base de datos, y la interfaz expone los modelos configurados en modo solo lectura.

## Impact

- **Backend**: `config/env.ts`, `services/ai.service.ts`, `services/llm-provider.service.ts`, `services/ai-model.service.ts`, `services/ocr.service.ts`, `services/reranker.service.ts`, `services/config.service.ts`, `controllers/ai-models.controller.ts`, `apps/backend/.env.example`.
- **Frontend**: `views/ProjectSetup.vue`, `views/Agents.vue`, `views/Settings.vue`, `services/settings.service.ts`.
- **Pruebas e2e**: `playwright.config.ts` (nueva variable de entorno del stub), `specs/onboarding.spec.ts` (elimina la selección de modelo), `seed-e2e.ts` (filas de proveedor de modelos ya inútiles).
- **Operación**: cambiar el modelo de embeddings exige reindexar (`src/scripts/reindex-rag.ts`).
- **Documentación**: `AGENTS.md` y `changelog.md` (bump de versión menor).
