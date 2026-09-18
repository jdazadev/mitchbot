## Context

Ver `proposal.md` — Why. Estado actual relevante:

- `docker-compose.yml` declara 6 servicios; `ollama` y `open-webui` quedaron sin uso tras el refactor a OpenRouter, y `nats` nunca tuvo consumidores (`getNatsConnection()` no se usa en ningún punto fuera de `config/nats.ts`).
- El backend arranca con `Promise.allSettled` e imprime una tabla de estado; NATS es opcional (`env.NATS_URL` `z.string().optional()`).
- `index.ts:26-38` incluye a NATS en el arranque y en el reporte. El paquete npm `nats@2.29.3` está marcado como deprecated en el lockfile.
- Ningún servicio tiene `healthcheck`; MongoDB usa `mongo:latest`; Redis no tiene volumen ni persistencia y BullMQ requiere `maxmemory-policy noeviction`.
- La imagen `qdrant/qdrant` trae `bash` pero **no** `curl` ni `wget` (verificado ejecutando la imagen local).
- La suite e2e (`tests/e2e/global-setup.ts`) solo espera `mongodb`, `redis` y `qdrant`; no verifica NATS ni Ollama, por lo que no depende de ellos.

## Goals / Non-Goals

**Goals:**

- Dejar el entorno local/Docker con solo los 3 servicios usados, anclados y observables (healthchecks).
- Redis durable para las colas BullMQ (`rag-upload`, `rag-reindex`).
- Eliminar todo el código/configuración/dependencia de NATS y los residuos de Ollama.
- Mantener intactos los contratos de conexión (`MONGODB_URI`, `REDIS_URL`, `QDRANT_URL`) y el comportamiento de la app.

**Non-Goals:**

- Contenerizar el backend/frontend (permanecen fuera de Compose).
- Configurar autenticación de Redis (`requirepass`), TLS o límites de memoria para producción real; se deja preparado a nivel de URL pero no se activa en dev.
- Reescribir el bloque de arranque de `index.ts` más allá de quitar NATS.
- Reintroducir NATS cuando llegue la fase de Integración Social (se hará en su propio change).

## Decisions

### 1. Eliminar (no archivar) Ollama, Open WebUI y NATS

Se borran del compose y, para NATS, también del código. **Alternativa:** mantenerlos con `profiles: ["debug"]`/`["social"]`. Se descarta porque conserva configuración muerta y la dep npm deprecated; el historial de git permite recuperarlos cuando exista un consumidor real. El backend ya tolera la ausencia de `NATS_URL`, así que no hay ruta de fallo.

### 2. NATS se limpia en compose + backend + dependencia

Alcance: borrar `src/config/nats.ts`, quitar import/llamada/fila en `src/index.ts`, quitar `NATS_URL` de `src/config/env.ts`, `.env` y `.env.example`, y quitar la dep `nats` de `package.json` (requiere `pnpm install`). **Alternativa:** dejar el código y solo quitar el contenedor. Se descarta: dejaría imports y una conexión que falla/loguea en cada arranque, y mantendría una DEPRECATED.

### 3. Anclar `mongo:8`

Se usa `mongo:8` (major fijo, recibe parches de la serie 8). **Contexto descubierto durante la implementación:** el volumen local `mongo_data` fue creado por `mongo:latest`, que hoy resuelve a **8.3** (`featureCompatibilityVersion: "8.3"`), y MongoDB **no soporta downgrade de major**: `mongo:6` falla al abrir esos datos con `UPGRADE PROBLEM`. Por eso se ancla a `mongo:8`, que comparte major con los datos existentes (sin pérdida) y sigue siendo una versión fija.

**Alternativas:** `mongo:6` (obligaría a borrar el volumen local → pérdida de datos de desarrollo), `mongo:6.0`/`mongo:8.0` (pin de parche más estricto) y `mongo:latest` (sin pin, divergente con el objetivo de versionado). Se elige `mongo:8`. `AGENTS.md` se corrige para documentar la versión 8 (no 6).

### 4. Redis para producción: AOF + volumen + `noeviction`

`command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "noeviction"]` y volumen `redis_data:/data`. **Alternativa:** persistencia RDB por defecto (snapshots) → puede perder jobs encolados entre snapshots; AOF con fsync por defecto (cada 1s) es más seguro para colas. `noeviction` ya es el default de Redis pero BullMQ lo exige explícitamente; hacerlo explícito protege ante imágenes/configs heredadas. La conexión `redis-bullmq.ts` ya soporta `password` desde `REDIS_URL`, así que `requirepass` en prod no requiere código (se difiere, ver Open Questions).

### 5. Healthchecks por imagen, sin añadir `depends_on`

- `mongodb`: `mongosh --quiet --eval "db.adminCommand('ping').ok"` (mongosh incluido en `mongo:6`).
- `redis`: `redis-cli ping`.
- `qdrant`: la imagen no tiene `curl`/`wget`; se usa `bash` con TCP a `/dev/tcp/127.0.0.1/6333` (verificado que bash existe; el puerto acepta conexiones y `GET /healthz` responde `200 OK`).

**Alternativa:** usar `curl`/`wget` (no disponibles en qdrant) o parsear HTTP con bash (más frágil). Se opta por el probe TCP por robustez y mantenibilidad. No se agregan `depends_on: condition: service_healthy` entre servicios porque no hay dependencias directas entre mongodb/redis/qdrant, y el backend (fuera de Compose) ya tolera arranques lentos con `Promise.allSettled`; los healthchecks quedan para `docker compose ps` y futuros consumidores.

### 6. Limpieza de volúmenes y contenedores huérfanos es manual y documentada

Compose no borra volúmenes al eliminar su declaración. **Alternativa:** `docker compose down -v` — descartada por destructiva (borraría también `mongo_data`/`qdrant_data`). Se documentan comandos específicos: `docker rm nats`, `docker volume rm <proj>_ollama_data <proj>_open-webui_data`, `docker compose up -d --remove-orphans`.

### 7. Bump a v3.2.0 (minor)

Elimina servicios y una variable de entorno documentados → minor según semver.

## Risks / Trade-offs

- [Contenedor `nats` huérfano tras `up -d`] → usar `docker compose up -d --remove-orphans` (documentado en changelog).
- [Volúmenes `ollama_data`/`open-webui_data` ocupando disco] → comandos de borrado manual documentados; no se automatiza para evitar pérdida de datos.
- [Healthcheck de Qdrant depende de `bash` en la imagen] → verificado en `qdrant/qdrant:latest`; si una futura imagen lo quitara, el healthcheck fallaría (no el servicio). Se documenta con alternativa `/healthz` vía HTTP.
- [Quitar la dep `nats` sin correr `pnpm install`] → el lockfile quedaría desincronizado; se incluye `pnpm install` como tarea.
- [AOF aumenta I/O de disco] → aceptable en dev/prod; se puede desactivar si molesta (sin impacto en la app).
- [Remover `OLLAMA_URL` de `playwright.config.ts`] → no afecta: ningún test la lee; la suite e2e no usa Ollama.

## Migration Plan

1. Aplicar cambios de compose y de código (ver `tasks.md`).
2. `pnpm install` para actualizar el lockfile sin `nats`.
3. `docker compose down`.
4. Eliminar huérfanos: `docker rm nats`; `docker volume rm mitchbot_v2_ollama_data mitchbot_v2_open-webui_data` (ajustar prefijo del proyecto si difiere).
5. `docker compose up -d --remove-orphans` y verificar `docker compose ps` con los 3 servicios `healthy`.
6. Verificación: `pnpm --filter @mitchbot/backend build` y `pnpm test:e2e`.
7. **Rollback:** `git revert` de los commits del change y recrear servicios con el compose anterior; los datos de `mongo_data`/`qdrant_data` no se tocan (los volúmenes de Ollama/Open WebUI no se necesitan para revertir).

## Open Questions

- `requirepass` para Redis en producción: se difiere. La conexión ya lo soporta vía `REDIS_URL` (`redis://:password@host:6339`), por lo que activarlo es solo compose + `.env`, sin cambios de código.
