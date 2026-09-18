## Context

Ver `proposal.md` para la motivación. El estado relevante para el diseño:

- El chat resuelve el modelo en `ai.service.resolveModelConfig()` a partir de `agent.modelValue` (BD, por agente/proyecto).
- `ai-model.service.getActiveEmbeddingConfig()` y `getActiveFileConfig()` sobreescriben el modelo de entorno con `provider_configs.selectedModel`.
- `ocr.service.resolveOcrConfig()` sobreescribe `OPENROUTER_OCR_MODEL` con `rag.ocr_openrouter_model`; `reranker.service` sobreescribe el modelo de embeddings con `rag.reranker_model`.
- `OPENROUTER_EMBEDDING_MODEL` y `OPENROUTER_OCR_MODEL` ya existen como variables de entorno (con default); no existe una variable para el LLM de chat.
- El modelo "file" (temperatura 0) solo se usa para convertir CSV a Markdown; PDFs e imágenes pasan por OCR.
- Se eligió alcance de limpieza **mínimo**: no se eliminan colecciones, esquemas ni endpoints existentes.

## Goals / Non-Goals

**Goals:**

- Fuente única de verdad de modelos en variables de entorno, con el modelo de chat requerido.
- Eliminar toda selección de modelo en la interfaz y todo override de modelo en base de datos.
- Exponer los modelos resueltos en modo solo lectura.
- Preservar el comportamiento de los parámetros que no son modelos y de los fallbacks opcionales (CSV crudo, re-ranker heurístico).

**Non-Goals:**

- Eliminar la colección `ai_models`, los campos `modelId`/`modelValue` del agente, la lógica de resolución en `agent.service` ni los endpoints `GET /agent/models` y `GET /remote/openrouter` (deuda técnica consciente, candidata a un change futuro).
- Eliminar la pasada de embeddings del re-ranker (redundante cuando usa el mismo modelo que el índice); se documenta como candidata futura.
- Migrar o limpiar datos de agentes existentes (los campos quedan ignorados).
- Automatizar el reindexado al cambiar el modelo de embeddings.

## Decisions

### D1. Limpieza mínima en backend

Solo se invierte la resolución en runtime; no se toca el esquema ni la colección `ai_models`.

- **Rationale**: diff pequeño y de riesgo casi nulo; los campos ignorados no afectan la ejecución.
- **Alternativas**: eliminación profunda (campos, colección, endpoints, modal) — descartada por alcance; queda registrada como deuda.

### D2. `OPENROUTER_LLM_MODEL` requerido sin default, validado en runtime

Se añade la variable sin valor por defecto; el error se lanza al resolver la configuración del modelo (no al arrancar el servidor).

- **Rationale**: consistente con el tratamiento de `OPENROUTER_API_KEY` (opcional en el esquema, con error en uso); el backend siempre arranca y el mensaje indica exactamente qué definir.
- **Alternativas**: requerido en el esquema Zod (falla el arranque) — descartado para no romper entornos que no invocan IA (frontend-only, pruebas parciales).

### D3. `OPENROUTER_FILE_MODEL` opcional con fallback a CSV crudo

Si no está definida, el CSV se indexa sin conversión por LLM (comportamiento actual cuando no había `provider_configs` de tipo file).

- **Rationale**: preserva el comportamiento exacto, incluida la opcionalidad y el costo.
- **Alternativas**: reusar `OPENROUTER_LLM_MODEL` — descartada porque forzaría la conversión por LLM de todo CSV (cambio de costo y de método de extracción).

### D4. `OPENROUTER_RERANKER_MODEL` opcional con fallback al modelo de embeddings

Es la misma forma que D3. Conserva la única utilidad real del config (`rag.reranker_model`): usar un modelo distinto en la segunda pasada.

- **Rationale**: consistencia con D3 y costo cero para quien no la defina.
- **Alternativas**: usar siempre `OPENROUTER_EMBEDDING_MODEL` — descartada porque elimina la posibilidad de un segundo modelo (efecto ensemble).

### D5. Eliminación de overrides de modelo en base de datos

- `getActiveEmbeddingConfig()`: usa solo `OPENROUTER_EMBEDDING_MODEL` (mantiene `dimensions` desde `rag.qdrant_vector_size`).
- `resolveOcrConfig()`: usa solo `OPENROUTER_OCR_MODEL`; se conservan `rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size`, `rag.ocr_timeout_ms`.
- `rerankerService`: usa `OPENROUTER_RERANKER_MODEL` o el modelo de embeddings; se conservan `rag.use_reranker`, `rag.reranker_top_k`, `rag.reranker_final_k`.
- `getActiveFileConfig()`: lee `OPENROUTER_FILE_MODEL`.
- Se eliminan de `config.service` la clave `rag.reranker_model` y el comentario de `rag.ocr_openrouter_model` (no tienen default propio y quedan sin efecto).

### D6. Exposición de solo lectura

`GET /ai-models/providers/active/:type` devuelve el modelo resuelto del entorno para `llm`, `embedding`, `ocr` (con indicación de origen "entorno") en lugar del registro de base de datos. La interfaz de Configuración muestra una tarjeta de solo lectura con esos modelos.

### D7. Eliminación de la selección de modelos en la interfaz

- `ProjectSetup.vue`: se elimina el bloque "Modelo IA", la carga de modelos y la preselección; el onboarding deja de llamar a OpenRouter.
- `Agents.vue`: se elimina el selector/buscador y la columna de modelo.
- `Settings.vue`: se elimina el selector del formulario del agente.
- `settings.service.ts`: se eliminan `getModelsForAgent()` y el tipo `AgentModelGroup` (sin consumidores). El endpoint backend `GET /agent/models` se conserva (D1).

### D8. Ajustes de pruebas

- `playwright.config.ts`: `OPENROUTER_LLM_MODEL` = modelo del stub (`stub-model`), y las opcionales si algún spec las requiere.
- `specs/onboarding.spec.ts`: se eliminan los pasos de selección de modelo.
- `seed-e2e.ts`: se retiran las filas de `provider_configs` de modelos (llm/embedding/file/image), ya sin efecto; verificar que la suite siga verde.

## Risks / Trade-offs

- **Cambiar `OPENROUTER_EMBEDDING_MODEL` invalida los vectores existentes** → documentarlo en `AGENTS.md` y `changelog.md`; mitigación operativa con `src/scripts/reindex-rag.ts`.
- **Un modelo inválido ya no se detecta en el onboarding** → el fallo aparece en la primera respuesta con un error del proveedor; aceptable al ser configuración del operador.
- **Queda código muerto** (`ai_models`, campos del agente, endpoints, `GET /agent/models`) → deuda técnica consciente por la decisión de limpieza mínima; candidata a change futuro.
- **La pasada de embeddings del re-ranker con el mismo modelo es casi redundante** → se mantiene el comportamiento; se documenta como candidata a reducción de entropía futura.
- **Pruebas e2e dependientes del modelo** → actualizar `onboarding.spec.ts`, `playwright.config.ts` y `seed-e2e.ts` en el mismo change.

## Migration Plan

1. Definir `OPENROUTER_LLM_MODEL` en los entornos (y opcionalmente `OPENROUTER_FILE_MODEL`, `OPENROUTER_RERANKER_MODEL`) antes de desplegar.
2. Desplegar backend y frontend juntos (el frontend deja de enviar modelo; el backend deja de leerlo).
3. No hay migración de datos: los agentes existentes conservan campos ignorados.
4. Rollback: revertir el despliegue; al ser configuración de entorno no hay estado que deshacer. Si se cambió el modelo de embeddings, reindexar para volver al modelo anterior.
