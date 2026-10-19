## 1. docker-compose.yml

- [x] 1.1 Quitar la clave `version: "3.8"` y verificar que `docker compose config` no emite el warning de `version is obsolete`.
- [x] 1.2 Eliminar los servicios `ollama` y `open-webui` y los volúmenes `ollama_data` y `open-webui_data`; verificar que `docker compose config --services` lista solo `mongodb`, `redis` y `qdrant`.
- [x] 1.3 Eliminar el servicio `nats`; verificar que `docker compose config --services` ya no lo lista.
- [x] 1.4 Anclar la imagen de MongoDB a `mongo:8` (el volumen local fue creado por 8.3; `mongo:6` no puede abrirlo por downgrade no soportado); verificar en `docker compose config` que la imagen es `mongo:8` (no `latest`).
- [x] 1.5 Agregar `healthcheck` a `mongodb` (`mongosh --quiet --eval "db.adminCommand('ping').ok"`); verificar que `docker compose ps` lo muestre `healthy`.
- [x] 1.6 Agregar `healthcheck` a `redis` (`redis-cli ping`); verificar que `docker compose ps` lo muestre `healthy`.
- [x] 1.7 Agregar `healthcheck` a `qdrant` con probe TCP por bash (`:> /dev/tcp/127.0.0.1/6333`, ya que la imagen no tiene `curl`/`wget`); verificar que `docker compose ps` lo muestre `healthy`.
- [x] 1.8 En `redis`, agregar `command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "noeviction"]` y el volumen `redis_data:/data`; verificar con `docker compose config` y con `docker exec redis redis-cli CONFIG GET appendonly` (debe responder `yes`).

## 2. Limpieza de código muerto NATS (backend)

- [x] 2.1 Eliminar `apps/backend/src/config/nats.ts`; verificar que el archivo no existe y que no queda ningún import de `./config/nats` (`grep -r "config/nats" apps/backend/src` vacío).
- [x] 2.2 En `apps/backend/src/index.ts`, quitar el import de `connectNats`, su entrada en `Promise.allSettled` y la fila `NATS` del reporte de infraestructura; verificar con `pnpm --filter @mitchbot/backend build`.
- [x] 2.3 Quitar `NATS_URL` de `apps/backend/src/config/env.ts`; verificar que `grep -rn "NATS_URL" apps/backend/src` no devuelve resultados.
- [x] 2.4 Quitar la dependencia `nats` de `apps/backend/package.json`, ejecutar `pnpm install` y verificar que `pnpm-lock.yaml` ya no contiene el paquete `nats` y que el build pasa.
- [x] 2.5 Quitar `NATS_URL` de `apps/backend/.env` y `apps/backend/.env.example`; verificar que `grep -rn "NATS_URL" apps/backend/.env apps/backend/.env.example` no devuelve resultados.

## 3. Limpieza de residuos Ollama

- [x] 3.1 Quitar `OLLAMA_URL` de `apps/backend/.env`; verificar que `grep -n "OLLAMA" apps/backend/.env` no devuelve resultados.
- [x] 3.2 Quitar la línea `OLLAMA_URL` de `playwright.config.ts`; verificar que `grep -n "OLLAMA" playwright.config.ts` no devuelve resultados.

## 4. Documentación y versión

- [x] 4.1 Actualizar `AGENTS.md`: lista de servicios Docker, tabla de stack (quitar NATS de Mensajería), bloque de variables de entorno (quitar `NATS_URL`/`OLLAMA_URL`) y comandos; bump de versión a **v0.3.2**. Verificar que no queden menciones operativas a ollama/open-webui/nats como servicios activos.
- [x] 4.2 Actualizar `changelog.md` con la entrada `[3.2.0]` (Added/Changed/Removed) siguiendo Keep a Changelog, incluyendo los comandos de limpieza operativa. Verificar que la entrada existe bajo la fecha actual.

## 5. Limpieza operativa y verificación end-to-end

- [x] 5.1 Ejecutar `pnpm --filter @mitchbot/backend build` y confirmar que compila sin errores tras todo el cleanup.
- [x] 5.2 Ejecutar `docker compose down`, eliminar el contenedor huérfano (`docker rm nats`), borrar los volúmenes `ollama_data`/`open-webui_data` y levantar con `docker compose up -d --remove-orphans`; verificar con `docker compose ps` que solo hay 3 servicios y todos `healthy`.
- [x] 5.3 Ejecutar `pnpm test:e2e` y confirmar que la suite pasa contra los servicios reales.
- [x] 5.4 Ejecutar `openspec validate "pulir-docker-compose" --strict` y confirmar que el change es válido.
- [x] 5.5 Realizar el commit del change siguiendo la convención del repo (AGENTS.md).
