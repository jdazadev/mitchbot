## 1. Entorno y resolución del modelo de chat

- [x] 1.1 Añadir `OPENROUTER_LLM_MODEL` (requerido, sin default y opcional en Zod), `OPENROUTER_FILE_MODEL` y `OPENROUTER_RERANKER_MODEL` (opcionales) en `apps/backend/src/config/env.ts`; verificar con `pnpm --filter @mitchbot/backend build`.
- [x] 1.2 Cambiar `ai.service.resolveModelConfig()` para resolver el modelo desde `env.OPENROUTER_LLM_MODEL` e ignorar `agent.modelValue`, conservando temperatura y `maxTokens` del agente; verificar que sin la variable el error indica definir `OPENROUTER_LLM_MODEL` y que con la variable la respuesta se genera.
- [x] 1.3 Actualizar el mensaje de error de `llm-provider.service.createChatModel()` (ya no debe sugerir seleccionar un modelo en la interfaz) y verificar con `pnpm --filter @mitchbot/backend build`.

## 2. Overrides de modelo en base de datos

- [x] 2.1 Quitar el override `provider_configs.selectedModel` de `ai-model.service.getActiveEmbeddingConfig()` (conservar `dimensions` desde `rag.qdrant_vector_size`) y verificar que un `selectedModel` distinto en BD no altera el modelo usado.
- [x] 2.2 Hacer que `ai-model.service.getActiveFileConfig()` lea `env.OPENROUTER_FILE_MODEL` y devuelva `null` si no está definida; verificar que un CSV se indexa crudo sin la variable y convertido por LLM con ella.
- [x] 2.3 Quitar `rag.ocr_openrouter_model` de `ocr.service.resolveOcrConfig()`, conservando `rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size` y `rag.ocr_timeout_ms`; verificar la extracción de un PDF con la variable definida.
- [x] 2.4 Cambiar `reranker.service` para usar `env.OPENROUTER_RERANKER_MODEL` con fallback a `env.OPENROUTER_EMBEDDING_MODEL`, conservando `rag.use_reranker`, `rag.reranker_top_k` y `rag.reranker_final_k`; verificar el reordenamiento de resultados.
- [x] 2.5 Eliminar de `config.service` la clave `rag.reranker_model` y el comentario de `rag.ocr_openrouter_model`, y verificar con `pnpm --filter @mitchbot/backend build`.

## 3. Exposición de modelos en solo lectura

- [x] 3.1 Hacer que `GET /ai-models/providers/active/:type` devuelva el modelo resuelto del entorno para `llm`, `embedding` y `ocr`; verificar con una llamada autenticada que la respuesta refleja las variables de entorno y no el registro de BD.

## 4. Interfaz sin selección de modelos

- [x] 4.1 Eliminar de `views/ProjectSetup.vue` el bloque "Modelo IA", la carga de modelos, la preselección y el envío de `model`; verificar que el onboarding completa sin invocar a OpenRouter.
- [x] 4.2 Eliminar de `views/Agents.vue` el selector y buscador de modelos y la columna de modelo; verificar que crear y editar un agente funciona sin enviar modelo.
- [x] 4.3 Eliminar de `views/Settings.vue` el selector de modelo del formulario del agente y añadir una tarjeta de solo lectura con los modelos de chat, embeddings y OCR; verificar visualmente que no hay controles editables.
- [x] 4.4 Eliminar `getModelsForAgent()` y el tipo `AgentModelGroup` de `services/settings.service.ts`; verificar con `pnpm --filter @mitchbot/frontend build`.

## 5. Pruebas e2e

- [x] 5.1 Añadir `OPENROUTER_LLM_MODEL` (modelo del stub) y las opcionales necesarias en `playwright.config.ts`; verificar que el backend e2e arranca y responde.
- [x] 5.2 Eliminar de `tests/e2e/specs/onboarding.spec.ts` los pasos de selección de modelo y verificar que el spec pasa.
- [x] 5.3 Retirar de `seed-e2e.ts` las filas de `provider_configs` de modelos (llm/embedding/file/image) y verificar que la suite e2e sigue verde.
- [x] 5.4 Ejecutar la suite completa con `pnpm test:e2e` y confirmar que pasa.

## 6. Documentación y versión

- [x] 6.1 Documentar las nuevas variables en `apps/backend/.env.example` y verificar que todas las variables del entorno están listadas.
- [x] 6.2 Actualizar `AGENTS.md` (secciones 4.1/4.2/4.3, flujo de setup, tabla de variables de entorno) incluyendo el caveat de reindexado al cambiar el modelo de embeddings.
- [x] 6.3 Registrar el cambio en `changelog.md` con la fecha actual y subir la versión a `v3.4.0`.

## 7. Verificación final

- [x] 7.1 Ejecutar `pnpm --filter @mitchbot/backend build`, `pnpm --filter @mitchbot/backend test` y `pnpm --filter @mitchbot/frontend build` y confirmar que pasan sin errores.
- [x] 7.2 Ejecutar `openspec validate predefine-models-env --strict` y confirmar que el change es válido.
- [x] 7.3 Realizar el commit del cambio implementado.
