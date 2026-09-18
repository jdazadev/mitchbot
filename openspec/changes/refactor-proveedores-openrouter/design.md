## Context

Ver `proposal.md - Why`. Estado actual relevante:

- El enrutador `llm-provider.service.ts` conoce 3 proveedores LLM (ollama, openrouter, gemini) y 2 de embeddings (ollama, openrouter); `ocr.service` tiene una cadena de fallback Ollama → Mistral → OpenRouter → pdf-parse.
- Las credenciales viven en la colección `provider_configs` (campo `apiKey`) y se administran desde `DevAdminModels.vue` mediante endpoints restringidos a `devadmin`.
- El rol `devadmin` existe solo para esa administración (61 referencias en 19 archivos).
- La selección del modelo del agente vive en `Agents.vue` (`/ai-models/agent/models`) y NO en `DevAdminModels.vue`, por lo que se conserva.
- El re-ranker (`reranker.service.ts`) usa `OllamaEmbeddings` directamente y una comprobación de modelos locales de Ollama.

## Goals / Non-Goals

**Goals:**

- Un único proveedor (OpenRouter) para LLM, embeddings y OCR, con credenciales fuera de la base de datos.
- Eliminar el rol `devadmin`, su UI y los endpoints que solo existían para administrar credenciales.
- Reubicar el módulo de pruebas en una ruta aislada sin depender de roles.
- Mantener la selección de modelo del agente y la degradación de RAG ya existentes.

**Non-Goals:**

- No se rediseña el pipeline de RAG ni el chunking.
- No se implementa multi-tenant por proyecto (ver change `multi-proyecto-usuarios`).
- No se elimina el contenedor de Ollama de `docker-compose`; puede seguir disponible para desarrollo local aunque el backend ya no lo requiera.

## Decisions

### D1: OpenRouter como único proveedor, implementado por eliminación de ramas

Se eliminan las ramas `ollama` y `gemini` del enrutador y `mistral`/`ollama` de OCR, dejando OpenRouter como única ruta. Alternativa considerada: mantener las ramas tras un feature flag. Se descarta porque el objetivo es reducir superficie de configuración y riesgo; conservar código muerto contradice ese objetivo y el historial de git permite recuperarlo.

### D2: Credenciales vía `env.ts` (Zod) y poda de `provider_configs`

`OPENROUTER_API_KEY` se añade al esquema de entorno validado. Se elimina `apiKey` de `ProviderConfig` y de la lógica de guardado. La resolución de modelos queda así:

- **LLM**: por agente (`agent.modelValue`), elegido en `Agents.vue`; el proveedor es OpenRouter fijo.
- **Embeddings**: modelo por defecto de OpenRouter, ajustable por configuración (`rag.embedding_model`).
- **OCR**: se mantienen las claves de configuración `rag.ocr_*` ya existentes, apuntando a OpenRouter.

Alternativa considerada: mantener `provider_configs` con la API key cifrada. Se descarta: el usuario decidió explícitamente que las credenciales no deben vivir en la base de datos.

### D3: Re-ranker sobre embeddings de OpenRouter, desactivable

`reranker.service.ts` se reimplementa usando el cliente de embeddings de OpenRouter en lugar de `OllamaEmbeddings`. Se conserva la posibilidad de desactivarlo por configuración (`rag.use_reranker=false`) y su degradación a heurística/similitud ante error. Alternativa considerada: eliminar el re-ranker. Se descarta porque aporta calidad de recuperación y ya tiene degradación controlada; el costo es mayor latencia remota, mitigable desactivándolo.

### D4: Eliminación de `devadmin` con normalización de endpoints

Se quita `devadmin` del enum de roles y de toda autorización. Los endpoints que existían solo para administrar credenciales (`/providers/configs*`, `/providers/test*`, `/ollama/models`, `/remote/gemini`) se eliminan junto con `DevAdminModels.vue`. Se conserva `/remote/openrouter` y `/agent/models` para listar modelos (accesibles a `admin`). Alternativa considerada: reasignar esos endpoints a `admin`. Se descarta porque sin credenciales en BD y con un solo proveedor, la mayor parte de esa API queda sin propósito.

### D5: Ruta de herramientas internas aislada

`DevAdminTests.vue` se sirve en una ruta dedicada (`/dev/tests`) con `meta` que requiere autenticación, sin guard de rol y sin entrada en `Sidebar.vue`. Alternativa considerada: mantenerla bajo `/devadmin/tests`. Se descarta porque el rol `devadmin` desaparece y la ruta debe seguir siendo accesible por URL.

## Risks / Trade-offs

- **[Pérdida de capacidad offline/local que daba Ollama]** → El contenedor de Ollama permanece en `docker-compose` para desarrollo; en producción se asume dependencia de red y crédito de OpenRouter. Mitigación de costo: modelos por defecto económicos y re-ranker desactivable.
- **[Embeddings remotos aumentan latencia frente a locales]** → Re-ranker desactivable y embeddings en lote; se documentan los valores por defecto.
- **[Eliminar `devadmin` deja referencias colgantes (rutas, UI, guards)]** → Búsqueda exhaustiva de referencias y poda por capas (modelo → servicios → controladores → rutas → UI), con verificación de compilación de tipos y arranque del backend.
- **[Migración de datos: `apiKey` persistida en documentos existentes]** → Script de migración idempotente que elimina el campo y normaliza/desactiva el usuario `devadmin`; se ejecuta antes de desplegar el código nuevo.
- **[El módulo de pruebas sin guard de rol amplía su acceso]** → Requiere autenticación, no persiste datos y no indexa en la base de conocimiento.

## Migration Plan

1. Definir `OPENROUTER_API_KEY` (y modelos por defecto opcionales) en el entorno.
2. Ejecutar script de migración: `$unset` de `apiKey` en `provider_configs` y normalización/eliminación del usuario con rol `devadmin`.
3. Desplegar backend y frontend con el proveedor único y `devadmin` eliminado.
4. Rollback: revertir al commit inicial y restaurar los documentos de `provider_configs` desde respaldo previo a la migración (los `.js` obsoletos se eliminaron en el change `fix-ui-shadowing`).

## Open Questions

- ¿Sigue siendo necesaria la colección `ai_models` (semilla de modelos) o el listado dinámico de `/agent/models` la sustituye por completo? Se resolverá durante la implementación sin afectar specs ni enfoque.
