## Why

Tras el refactor a OpenRouter (change `refactor-proveedores-openrouter`), `docker-compose.yml` sigue levantando Ollama y Open WebUI, que ya no se usan, y NATS, que nunca llegó a consumirse (solo `connectNats()` ceremonial). Además los servicios no tienen healthchecks, MongoDB no está anclado a versión y Redis no persiste las colas BullMQ. Esto desperdicia recursos, confunde el arranque local y deja la infraestructura sin garantías para producción.

## What Changes

- **docker-compose.yml**: eliminar los servicios `ollama`, `open-webui` y `nats`, y los volúmenes `ollama_data` y `open-webui_data`; quitar la clave `version` (obsoleta en Compose v2).
- Anclar MongoDB a `mongo:8` (hoy `mongo:latest`, que resuelve a 8.x; ver design.md, decisión 3).
- Agregar `healthcheck` a `mongodb`, `redis` y `qdrant`.
- **Redis para producción**: activar persistencia AOF (`--appendonly yes`), volumen `redis_data:/data` y `--maxmemory-policy noeviction` (requisito de BullMQ).
- **Limpieza de código muerto NATS**: eliminar `apps/backend/src/config/nats.ts`, su import y llamada en el bootstrap (`src/index.ts`), la fila NATS del reporte de infraestructura, la variable `NATS_URL` de `src/config/env.ts`, la dependencia npm `nats` y `NATS_URL` de `.env`/`.env.example`.
- **Limpieza de residuos Ollama**: eliminar `OLLAMA_URL` de `apps/backend/.env` y `playwright.config.ts`.
- Actualizar `AGENTS.md` y `changelog.md`; bump de versión a **v0.3.2**.

## Capabilities

### New Capabilities

<!-- Ninguna: cambio de infraestructura y limpieza de código muerto, sin cambios de comportamiento observable. El change declara skip_specs: true. -->

### Modified Capabilities

<!-- Ninguna: no cambia ningún requisito de comportamiento del sistema. -->

Sin cambios a nivel de spec: es infraestructura, tooling y eliminación de código muerto.

## Impact

- **Infraestructura**: `docker-compose.yml` (servicios, volúmenes, healthchecks, Redis, Mongo).
- **Backend**: `apps/backend/src/config/nats.ts` (eliminar), `src/index.ts`, `src/config/env.ts`, `package.json` (dep `nats`, además deprecated), `.env`, `.env.example`.
- **E2E**: `playwright.config.ts` (quita `OLLAMA_URL`). La suite e2e no verifica NATS/Ollama, por lo que no se afecta.
- **Docs**: `AGENTS.md`, `changelog.md`.
- **Operación (manual, documentada)**: eliminar el contenedor huérfano `nats` y los volúmenes `ollama_data`/`open-webui_data`; `docker compose up -d --remove-orphans`.
- **Sin cambios** de API, contratos ni comportamiento de usuario. `REDIS_URL`/`QDRANT_URL`/`MONGODB_URI` se mantienen.
