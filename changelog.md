# Changelog — MitchBot v2

Todas las actualizaciones notables del proyecto están documentadas aquí.  
Formato basado en [Keep a Changelog](https://keepachangelog.com/) con versionado semántico.

---

## v3.9.0 — 2026-09-19

> 💬 **El bot responde de una vez, los insights dejan de resumir y desde cada cliente se abre su conversación**

---

### ✨ Añadido
- **Ver conversación desde Clients**: cada fila con conversación ofrece una acción que abre la bandeja con esa conversación preseleccionada (`/messaging?conversation=<id>`). La conversación se resuelve en el servidor por `contactId` (`GET /api/conversations?contactId=<id>`, validado y acotado al proyecto), prefiriendo la activa y, en su defecto, la más reciente. Si el cliente no tiene conversación vinculada, la acción no se muestra.
- **Preselección en la bandeja**: `Messaging.vue` lee `route.query.conversation`, selecciona esa conversación (cargándola del servidor si no está entre las del listado) y aplica el fallback por defecto si no es válida, sin error visible.

### 🔄 Cambios
- **Respuesta del bot como mensaje completo**: se deja de emitir fragmentos parciales (`isDone: false`) en la respuesta directa y en la posterior a herramientas. El placeholder vacío sostiene el indicador de escritura y la respuesta llega completa en un único mensaje final (`isDone: true`); `Messaging.vue`, `TestChat.vue` y `useConversations` aplican únicamente el mensaje final.
- **AI Insights sin resumen**: el análisis produce únicamente sentimiento y su distribución. El resumen se retira del prompt, del tipo, de la validación, de la persistencia, del modelo de datos, de la tarjeta del panel y de los catálogos `es.json`/`en.json`. `GET /:id/insights` devuelve solo sentimiento y `sentimentScores` (aunque existan resúmenes antiguos) y el recálculo limpia `aiInsights.summary` con `$unset`.

### 🧪 Pruebas
- `realtime.spec.ts` ahora espera un único mensaje final con `isDone: true` y verifica que no hay fragmentos parciales.
- `messaging.spec.ts` valida el sentimiento por API y su etiqueta visible, y que no se devuelve resumen; el stub e2e deja de producir `summary`.
- `contacts.spec.ts` cubre abrir la conversación desde una fila y que un cliente sin conversación no muestra la acción (fixture de contacto sin conversación en el seed e2e).

### 📚 Documentación
- `AGENTS.md` (respuesta como mensaje completo, insights solo sentimiento, acceso a la conversación desde Clients, contrato de `chat:message_chunk`, filtro `?contactId=`) y `changelog.md` actualizados. Versión del proyecto a **v3.9.0**.

---

## v3.8.1 — 2026-09-19

> 🔒 **El Dashboard deja de mezclar datos de todos los proyectos: métricas autenticadas y acotadas al proyecto activo**

---

### 🔒 Seguridad
- **Endpoints del dashboard autenticados**: `GET /api/dashboard/stats|volume|channels|activities` ahora exigen token JWT (middleware `authenticate`) y resuelven el proyecto por petición (`X-Project-Id` o `activeProjectId`); sin credenciales responden `401`.

### 🐛 Corregido
- **Aislamiento por proyecto en las métricas**: `analyticsService.getStats`, `getVolume`, `getChannelDistribution` y `getRecentActivity` reciben `projectId` y lo incorporan a todos sus filtros (`countDocuments`, `$match`, `find`), combinándolo con el rango de fechas. La tarjeta "Conversaciones totales" ya no mezcla datos de otros proyectos.
- **Servicio de dashboard del frontend**: los cuatro métodos de `dashboard.service.ts` envían `Authorization` y `X-Project-Id` vía `authService.getHeaders()`, por lo que al cambiar de proyecto las métricas se recalculan para el nuevo proyecto.

### 🧪 Pruebas
- Spec e2e del dashboard ampliado: crea dos proyectos dedicados, genera tráfico en uno y comprueba que las métricas del otro no se alteran; además verifica que una petición sin autenticación es rechazada (`401`). Suite `pnpm test:e2e dashboard` en verde (4/4).

### 📚 Documentación
- `AGENTS.md` (endpoints del dashboard autenticados y acotados al proyecto) y `changelog.md` actualizados. Versión del proyecto a **v3.8.1**.

---

## v3.8.0 — 2026-09-19

> 🌐 **La interfaz deja de mezclar idiomas: i18n con español por defecto e inglés, selector en vivo y chat público con idioma propio**

---

### ✨ Añadido
- **Internacionalización (vue-i18n)**: catálogos `locales/es.json` y `locales/en.json` con claves por dominio, español por defecto y fallback a español. El plugin se registra en `main.ts` en modo Composition API.
- **Selector de idioma en el Topbar**: aplica el idioma en vivo a todo el dashboard sin recargar y persiste la preferencia en `localStorage` (`mitchbot.locale`); el atributo `lang` del documento refleja el idioma activo.
- **Chat público con idioma propio**: `TestChat.vue` usa un composer aislado y claves `publicChat.*`, y toma el idioma de la personalidad del agente del proyecto (nuevo endpoint público `GET /api/public/test-chat/:slug/config`); el idioma del dashboard no lo altera.
- **Spec e2e de idioma** (`i18n.spec.ts`) y caso de independencia del chat público respecto a la preferencia del dashboard.

### 🔄 Cambios
- **Todos los textos visibles del dashboard externalizados** a los catálogos: shell (`Sidebar`, `Topbar`), `Dashboard`, `Messaging`, `Clients`, `Brain`, `Settings`, `Users`, `Agents`, `Profile`, `DevTests`, `Login` y `ProjectSetup`. El shell pasa de inglés a español por defecto; se elimina el "spanglish".
- **`data-testid`** añadidos al título de página, la navegación del sidebar, las métricas y los controles de rango/granularidad del Dashboard para estabilizar los e2e.

### 🧪 Pruebas
- Specs e2e alineados al español por defecto y estabilizados con `data-testid`; nuevo `i18n.spec.ts` (español por defecto, cambio a inglés, `lang` y persistencia) y verificación de que el chat público conserva el idioma del agente.

### 📚 Documentación
- `AGENTS.md` (frontend: vue-i18n, catálogos es/en, selector en Topbar, idioma del chat público) y `changelog.md` actualizados. Versión del proyecto a **v3.8.0**.

---

## v3.7.0 — 2026-09-19

> 🧭 **La navegación deja de mezclar nombres, los controles de fecha por fin filtran de verdad y el centro de notificaciones deja de estar muerto**

---

### ✨ Añadido
- **Rango de fechas real en el Dashboard**: control de últimos 7/30/90 días (30 por defecto) que recalcula métricas, canales y volumen; los toggles Diaria/Semanal/Mensual cambian la granularidad del volumen y el gráfico se dibuja con los datos del rango.
- **Centro de notificaciones en el Topbar**: escucha `admin:notification` (emitido por la tool `send_notification`), acumula las notificaciones en estado local, muestra el indicador solo si hay no leídas y permite marcarlas como leídas o limpiarlas (alcance de sesión).
- **Backend de analítica ampliado**: `analytics.service`/`dashboard.controller` aceptan `days` o `from`/`to` y `period = daily | weekly | monthly`; `getStats`, `getVolume` y `getChannelDistribution` filtran por rango.
- **Script de normalización** `normalize-agent-language.ts`: migra los agentes con idioma `pt`, `auto` o ausente a español.

### 🔄 Cambios
- **Nomenclatura de módulos**: el sidebar y el Topbar muestran **"Brain"** (antes "Brain & RAG") y **"Clients"** (antes "Contacts"); la ruta pasa a `/clients` con redirección desde `/contacts`. Se renombran `views/Contacts.vue` → `views/Clients.vue` y `services/contact.service.ts` → `client.service.ts`; la API `/api/contacts`, la colección y los tipos internos no cambian.
- **Textos visibles del módulo de clientes** ("contacto" → "cliente") en búsqueda, tabla, modales y mensajes de error.
- **Se elimina el widget estático "Last 30 Days"** del Topbar (era UI muerta).
- **Idioma del agente restringido a `'es' | 'en'`**: se ajustan el tipo `AgentPersonality['language']` (frontend y backend), el `z.enum` de `agents.controller.ts` y `LANGUAGE_MAP` de `prompt-builder.service.ts`; se eliminan Portugués y "Detectar" de `Settings.vue`. Un idioma distinto de español/inglés se rechaza con error de validación y los valores obsoletos degradan a español.

### 🧪 Pruebas
- **e2e**: redirección `/contacts` → `/clients`, spec de clientes actualizado, cobertura de rango/granularidad en el Dashboard, nuevo spec del centro de notificaciones y verificación de que solo se ofrecen Español/Inglés y que el backend rechaza un idioma inválido.
- **Stub de IA** ampliado con el disparador `NOTIFICAR` → tool `send_notification`.
- Suite e2e completa en verde (32/32) y pruebas de integración del backend en verde (25/25).

### 📚 Documentación
- `AGENTS.md` (nueva sección "Shell y navegación", módulo de clientes, idioma del agente es/en y estructura del frontend) actualizado. Versión del proyecto a **v3.7.0**.

---

## v3.6.0 — 2026-09-19

> 🧹 **La bandeja de mensajería deja de aparentar: cada control funciona o desaparece, y llegan los AI Insights reales**

---

### ✨ Añadido
- **Filtros por canales habilitados**: los chips de canal se generan desde `project.config.channels` (solo los habilitados + "Todos") y filtran la lista por plataforma; un canal deshabilitado no aparece.
- **Búsqueda de conversaciones** por nombre del cliente y contenido del último mensaje (sin distinguir mayúsculas); vaciar restaura la lista.
- **Agrupación de mensajes por día** con encabezados reales ("Hoy", "Ayer", fecha), en orden cronológico.
- **Toma de control manual bidireccional**: `PUT /api/conversations/:id/mode` expuesto en `messagingService.updateConversationMode`; "Take Over" ↔ "Auto-Pilot" actualiza el badge sin recargar y el bot no responde en `human_takeover`.
- **Guardar cliente como contacto**: `POST /api/conversations/:id/contact` respaldado por `ensureContactCreated(id, { force: true })`; idempotente y funcional aunque `autoCreateContact` esté deshabilitado.
- **Conteo de no leídos real** en el sidebar mediante el composable `useConversations` (estado de módulo compartido), con incremento en vivo por `chat:message` y `chat:new_conversation`.
- **AI Insights reales**: nuevo `services/insights.service.ts` que analiza la conversación con `OPENROUTER_INSIGHTS_MODEL` (fallback a `OPENROUTER_LLM_MODEL`), valida `{ sentiment, sentimentScores, summary }`, lo persiste en `conversation.aiInsights` y lo emite por `chat:insights`. `GET /:id/insights` lee lo almacenado y `POST /:id/insights` recalcula; el panel del dashboard muestra sentimiento, distribución y resumen, con estado vacío y actualización en vivo.
- **Análisis automático fire-and-forget** tras cada respuesta del bot (fallo silencioso que no afecta la respuesta).

### 🔄 Cambios
- **Compositor honesto**: se eliminan chips de sugerencia, emoji, adjuntos, imagen, botón de filtro, menú de tres puntos, indicador "online" simulado y badge de confianza; solo quedan las acciones funcionales (enviar y tomar control).
- **`ensureContactCreated()`** acepta `{ force }` y devuelve el contacto con su estado de creación, manteniendo la búsqueda idempotente por identificador + proyecto.
- **Evento de socket `chat:insights`** para la actualización en vivo de los insights.

### 🐛 Corregido
- **Respuestas fuera de orden en Contactos**: `fetchContacts()` ignora respuestas obsoletas cuando varios filtros disparan fetches seguidos (la concurrencia extra introducida por el fetch del sidebar lo exponía).

### 🧪 Pruebas
- Nuevos specs en `messaging.spec.ts`: filtros de canal + búsqueda, guardar contacto idempotente con auto-creación deshabilitada, toma de control bidireccional (con bot en pausa) e insights automáticos/manuales.
- Stub de IA ampliado con respuesta JSON determinista para el análisis de insights (`INSIGHTS_JSON`); seed e2e con un segundo proyecto `e2e-nocontact` sin auto-creación de contactos y canales con Instagram deshabilitado.
- Suite e2e completa en verde (28/28) y pruebas de integración del backend en verde (25/25).

### 📚 Documentación
- `AGENTS.md` (sección 1 de mensajería, estructura backend/frontend, tabla de endpoints, modelo `conversations`, evento `chat:insights` y variables de entorno con `OPENROUTER_INSIGHTS_MODEL`) actualizado. Versión del proyecto a **v3.6.0**.

---

## v3.5.0 — 2026-09-18

> 🧠 **El chatbot ahora recuerda la conversación, saluda y se despide con naturalidad, y el estado de la conversación se refleja en vivo**

---

### ✨ Añadido
- **Memoria de conversación**: la generación de respuestas (directas y tras ejecutar herramientas) recibe el historial reciente (últimos 20 mensajes) como turnos de usuario/asistente. Se excluyen los mensajes internos de herramientas (`tool_call`, `tool_result`, `confirmation_request`) y los placeholders vacíos; el agente humano se representa con el prefijo `[Agente humano]`.
- **Re-saludo tras pausa larga**: si el hueco respecto al mensaje anterior supera las 6 horas, se inserta un marcador en el historial para que el bot retome con un saludo.
- **Propagación en vivo de `chat:status`**: `Messaging.vue` y `TestChat.vue` consumen el evento y actualizan modo/estado/tag sin recargar; `PUT /api/conversations/:id/mode` ahora también emite `chat:status`.
- **Badge "Human Takeover"** en el dashboard cuando la conversación está en control humano.

### 🔄 Cambios
- **Saludo natural**: se elimina el texto enlatado de bienvenida y su maquinaria (`shouldSendWelcome`, `hasGreeting`, `hasQuestionIntent`, `lastWelcomeAt`); el system prompt indica saludar solo al inicio o tras una pausa larga.
- **Despedida no destructiva**: al detectar una despedida, el bot responde con naturalidad y, después de generarla, la conversación se marca como `closed` (sin mensaje enlatado ni corte previo); si la generación falla, no se cierra.
- **"Gracias" y variantes ya no cierran la conversación**: se retiran de las keywords de despedida (defaults del backend, setup, configuración y seed e2e).
- **Visibilidad por audiencia**: en la vista del cliente (`TestChat.vue`) ya no se renderizan las tarjetas `tool_call`/`tool_result`; las `confirmation_request` conservan sus acciones. El dashboard sigue mostrándolas.

### 🧪 Pruebas
- Nuevo spec `chat-memory-and-flow.spec.ts`: memoria del historial, "gracias" no cierra y transferencia reflejada en vivo.
- Stub de IA ampliado: disparador de memoria (`RECUERDA`) y de transferencia (`TRANSFERIR`); seed e2e idempotente para el `config` del agente.
- Escenario en `public-chat.spec.ts`: el cliente ve la confirmación pero no la tarjeta interna de la herramienta.
- Suite e2e completa en verde (24/24).

### 📚 Documentación
- `AGENTS.md` (secciones 1 y 9 y tabla de eventos WebSocket) actualizado. Versión del proyecto a **v3.5.0**.

---

## v3.4.0 — 2026-09-18

> 🧠 **Los modelos de IA pasan a ser configuración de despliegue: se resuelven desde variables de entorno y desaparece la selección de modelo en la interfaz**

---

### 🔄 Cambios
- **Modelos resueltos desde el entorno**: el chat usa siempre `OPENROUTER_LLM_MODEL` (requerido, sin default); embeddings `OPENROUTER_EMBEDDING_MODEL`; OCR `OPENROUTER_OCR_MODEL`; conversión de archivos `OPENROUTER_FILE_MODEL` (opcional, CSV crudo si falta) y re-ranking `OPENROUTER_RERANKER_MODEL` (opcional, fallback al modelo de embeddings).
- **Onboarding sin invocar a OpenRouter**: el bloque "Modelo IA" del setup se elimina; el alta del proyecto ya no requiere elegir modelo.
- **Interfaz sin selectores de modelo**: se quitan el selector/buscador de Agentes y el selector del formulario de Configuración; Configuración muestra una tarjeta de solo lectura con los modelos de chat, embeddings y OCR.
- **Endpoint de solo lectura**: `GET /ai-models/providers/active/:type` devuelve el modelo resuelto del entorno (llm, embedding, file, ocr).

### 🗑️ Eliminado
- **Overrides de modelo en base de datos**: `provider_configs.selectedModel` (embedding y file), `rag.ocr_openrouter_model` y `rag.reranker_model` dejan de tener efecto. Los campos `modelId`/`modelValue` del agente quedan ignorados en runtime.
- **Frontend**: `getModelsForAgent()` y el tipo `AgentModelGroup` de `settings.service.ts`; envío de `model`/`modelValue` en setup, agentes y configuración.
- **Pruebas**: filas de `provider_configs` de modelos en `seed-e2e.ts` y pasos de selección de modelo en `onboarding.spec.ts`.

### 📚 Documentación
- `apps/backend/.env.example` y `AGENTS.md` actualizados (secciones 4.1/4.2/4.3, pipeline OCR, re-ranking, flujo de setup y tabla de variables) incluyendo el caveat de reindexado al cambiar `OPENROUTER_EMBEDDING_MODEL`. Versión del proyecto a **v3.4.0**.

### 🧪 Pruebas
- Suite e2e completa en verde (20/20) con `OPENROUTER_LLM_MODEL` apuntando al stub.

---

## v3.3.0 — 2026-09-18

> 🔐 **Validación del setup: la primera vez lleva al wizard, la sesión inválida vuelve al login y el login queda limpio**

---

### 🔄 Cambios
- **Validación interna del setup**: `ProjectSetup.vue` consulta al servidor si el usuario ya tiene proyecto al montarse. Si ya lo tiene y no pidió crear uno nuevo, redirige al dashboard (la validación ya no depende solo del guard de navegación).
- **Creación de proyectos múltiples preservada**: el botón "Crear nuevo proyecto" del `Topbar` navega a `/setup?mode=new`, que omite la validación interna y abre el wizard.
- **Login sin credenciales demo**: se elimina el bloque con `admin@mitchbot.io` / `admin123` de `Login.vue`. El registro de usuarios no forma parte de esta app.

### 🐛 Corregido
- **Sesión "zombie" (token local válido pero rechazado por el servidor)**: `checkProject()` ahora distingue `401/403` (`SessionInvalidError`) de "sin proyecto". El guard y el setup limpian la sesión y redirigen silenciosamente al login, en vez de enviar al usuario al wizard con errores de "Cuenta desactivada".

### 📚 Documentación
- `AGENTS.md` actualizado (flujo de onboarding, módulo Login y versión a **v3.3.0**).

### 🧪 Pruebas
- Nuevo spec e2e `setup-validation.spec.ts`: usuario con proyecto entra a `/setup` → dashboard; el botón del Topbar abre el wizard con `?mode=new`; sesión inválida → login.

---

## v3.2.0 — 2026-09-18

> 🧹 **Pulido de `docker-compose`: solo los servicios en uso, MongoDB anclado, healthchecks y Redis durable (AOF)**

---

### 🔄 Cambios
- **`docker-compose.yml` reducido a los servicios en uso**: se quitan `ollama`, `open-webui` y `nats`, junto con los volúmenes `ollama_data` y `open-webui_data`, y la clave `version` (obsoleta en Compose v2). Quedan `mongodb`, `redis` y `qdrant`.
- **MongoDB anclado a `mongo:8`** (antes `mongo:latest`). Se mantiene el major 8 porque MongoDB no soporta downgrade: un volumen creado por 8.x no puede abrirse con 6.x.
- **Healthchecks** en `mongodb` (`mongosh` ping), `redis` (`redis-cli ping`) y `qdrant` (probe TCP por bash, ya que la imagen no incluye `curl`/`wget`).
- **Redis listo para producción**: persistencia AOF (`--appendonly yes`), volumen `redis_data:/data` y `--maxmemory-policy noeviction` (requisito de BullMQ).

### 🗑️ Eliminado
- **Código muerto de NATS**: `apps/backend/src/config/nats.ts`, su import y llamada en el bootstrap (`src/index.ts`), la fila NATS del reporte de infraestructura y `NATS_URL` de `src/config/env.ts`, `.env` y `.env.example`.
- **Dependencia npm `nats`** (además marcada como deprecated por el proveedor).
- **Residuos de Ollama**: `OLLAMA_URL` de `apps/backend/.env` y `playwright.config.ts`.

### 📚 Documentación
- `AGENTS.md` actualizado (servicios Docker, stack, variables de entorno y comandos) y versión del proyecto a **v3.2.0**.

### 🧰 Limpieza operativa (una sola vez)
```bash
docker compose down
docker rm nats                                                   # contenedor huérfano (si existía)
docker volume rm mitchbot_v2_ollama_data mitchbot_v2_open-webui_data
docker compose up -d --remove-orphans
```

---

## v3.1.0 — 2026-09-18

> 🧪 **Suite de pruebas end-to-end con Playwright: entorno aislado, autenticación reutilizable y proveedor de IA determinista (stub)**

---

### ✨ Nuevas funcionalidades
- **Suite e2e (Playwright)**: cubre autenticación, onboarding, dashboard, mensajería, contactos, base de conocimiento (RAG), usuarios, configuración/agentes, perfil, chat público y tiempo real (streaming + confirmación/cancelación de herramientas).
- **Autenticación reutilizable**: *setup project* que hace login una sola vez y persiste `storageState` para el resto de las pruebas; los specs públicos corren sin sesión.
- **Entorno e2e aislado**: backend en el puerto 3100, frontend en 5174, base de datos MongoDB `mitchbot_e2e` y puertos dedicados, sin interferir con el entorno de desarrollo (3000/5173).
- **Stub local de IA compatible con la API de OpenAI** (`tests/stub/openai-stub.mjs`): respuesta de texto determinista, streaming SSE, tool calls (`create_appointment`) y embeddings deterministas (768 dims). Se activa vía `OPENROUTER_BASE_URL`.
- **Seed e2e dedicado** (`apps/backend/src/scripts/seed-e2e.ts`): usuario, proyecto, agente y proveedores de prueba idempotentes y no destructivos; además limpia los contadores de rate limiting WebSocket entre corridas.
- **Chequeo de prerrequisitos**: la suite falla con un mensaje claro si faltan los servicios Docker o los servidores.
- **Prueba de guardia** (`provider-guard.spec.ts`): verifica que el backend apunta al stub y no genera tráfico al proveedor real.
- **Scripts npm**: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:ci`, `test:e2e:report`, `stub:e2e`, `seed:e2e`.

### 🔄 Cambios
- `fetchOpenRouterModels` usa `OPENROUTER_BASE_URL` (permite apuntar al stub en pruebas); por defecto sigue usando el endpoint real.
- `GET /ai-models/agent/models` y `GET /ai-models/remote/openrouter` ya no exigen `projectId` (el proveedor es global), habilitando la selección de modelo en el onboarding.
- Rutas `contacts` y `agents` aplican `authenticate` (faltaba tras el modelo multi-proyecto) y el servicio de contactos del frontend envía `Authorization` + `X-Project-Id`.

### 📚 Documentación
- `tests/e2e/README.md` con prerrequisitos, comandos y estructura de la suite.
- `AGENTS.md` documenta la sección de pruebas e2e.

---

## v3.0.0 — 2026-09-18

> 🔒 **Proveedor único OpenRouter: credenciales fuera de la base de datos y eliminación del rol `devadmin`**

---

### ⚠️ Breaking changes
- **Proveedor único OpenRouter**: el sistema usa exclusivamente OpenRouter para LLM, embeddings y OCR. Se eliminan las integraciones de **Ollama**, **Google Gemini** y **Mistral** del enrutador de IA y de las cadenas de fallback. Cualquier intento de usar otro proveedor se rechaza con un error explícito.
- **Credenciales fuera de la base de datos**: las API keys provienen exclusivamente de variables de entorno. `provider_configs` deja de almacenar `apiKey` (migración incluida). Ninguna respuesta de API devuelve credenciales.
- **Se elimina el rol `devadmin`**: los roles válidos pasan a ser `admin`, `support` y `assistant`. Los usuarios existentes con rol `devadmin` se normalizan a `assistant`/`Inactive` durante la migración.
- **Endpoints eliminados**: `/ai-models/ollama/models`, `/ai-models/remote/gemini`, `/ai-models/remote/openrouter/embeddings`, `/ai-models/providers/configs*`, `/ai-models/providers/config` y `/ai-models/providers/test*`. El CRUD de `ai_models` restringido a `devadmin` también se elimina. Se conservan `/ai-models/remote/openrouter` y `/ai-models/agent/models`.
- **Se elimina la vista de proveedores** (`DevAdminModels.vue`) y su ruta `/devadmin/models`.

### ✨ Nuevas funcionalidades
- **Variables de entorno del proveedor**: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_EMBEDDING_MODEL` y `OPENROUTER_OCR_MODEL` (con valores por defecto razonables).
- **Herramientas internas aisladas**: el módulo de pruebas se sirve en la ruta `/dev/tests` (solo accesible por URL, autenticada, sin entrada en el menú lateral). Los endpoints asociados pasan a `/api/brain/dev/extract` y `/api/brain/dev/pdf-to-images`.

### 🔄 Cambios
- `llm-provider.service.ts` queda reducido a la rama de OpenRouter para chat y embeddings; `ai.service.resolveModelConfig` resuelve el modelo por agente y toma la credencial del entorno.
- `ocr.service.ts` se simplifica a OpenRouter como único proveedor, conservando el fallback legacy `pdf-parse`.
- `reranker.service.ts` re-rankea con embeddings de OpenRouter (configurable con `rag.reranker_model`), desactivable con `rag.use_reranker=false` y con degradación a heurística/similarity-only.
- Los embeddings usan un modelo por defecto de OpenRouter, sobreescribible desde configuración. La dimensión del vector se alinea con `rag.qdrant_vector_size` (768) para reutilizar las colecciones Qdrant existentes.
- Modelo OCR por defecto actualizado a `google/gemini-3.8-flash` (el anterior `google/gemini-2.0-flash-001` ya no existe en OpenRouter).
- El arranque del backend ya no comprueba la conexión con Ollama.
- Nueva migración `scripts/migrate-openrouter.ts`: elimina `apiKey` de `provider_configs` y normaliza/desactiva usuarios `devadmin`.
- El `seed` de modelos locales de Ollama se elimina; los modelos se listan dinámicamente desde OpenRouter.
- `AGENTS.md` y `apps/backend/.env.example` documentan el proveedor único y las variables de entorno.

---

## v2.0.0 — 2026-09-18

> 🏢 **Modelo multi-proyecto: pertenencia usuario↔proyecto, resolución de contexto por request y aislamiento total**

---

### ⚠️ Breaking changes
- **Los usuarios pertenecen a proyectos**: cada usuario tiene `projectIds` (lista de proyectos) y `activeProjectId` (proyecto activo). Un usuario solo accede a sus proyectos.
- **Resolución de proyecto por request**: el middleware de autenticación resuelve el proyecto desde el header `X-Project-Id` (validando pertenencia) o, en su defecto, desde el `activeProjectId` del usuario. **Desaparece el proyecto global único.**
- **Se elimina el caché local `mitchbot_project_setup` como fuente de verdad** del onboarding: el guard consulta al servidor (`GET /project/check`) según los proyectos del usuario.

### ✨ Nuevas funcionalidades
- **Multi-proyecto por usuario**: cualquier usuario autenticado puede crear proyectos; el creador queda como miembro y el proyecto pasa a ser su activo (`POST /api/project`).
- **Selector de proyecto en la barra superior** (`Topbar.vue`) con listado de proyectos del usuario y opción de crear uno nuevo; al cambiar, se reasigna el socket y se recargan las vistas.
- **Endpoints nuevos**: `GET /api/project/list` (proyectos del usuario) y `PUT /api/project/active` (cambio de proyecto activo persistido).
- **Asignación de proyectos por administradores**: `POST/PUT /api/users` aceptan `projectIds`; UI de selección múltiple en `Users.vue`.
- **Agente por proyecto**: `agents.projectId` y `getActiveAgent(projectId)`; el bot usa el agente del proyecto de la conversación.
- **Aislamiento de contactos**: `contacts.projectId` (nuevo), filtrado por proyecto en listado, detalle, edición, archivado y restauración, y en la auto-creación de contactos.
- **Sesiones de tiempo real por proyecto**: el socket se autentica con el proyecto activo (o el indicado al conectar), entra en room `project:<id>` y valida pertenencia al unirse a conversaciones.
- **Script de migración** `scripts/migrate-multi-project.ts`: asigna el proyecto actual a usuarios existentes, fija su `activeProjectId` y vincula los agentes existentes a su proyecto.

### 🔄 Cambios
- `auth.middleware.ts` adjunta el `projectId` resuelto y responde **403** ante un header de proyecto ajeno.
- `project.service.ts`: se elimina la restricción de proyecto único activo; `getActiveProject(user)` pasa a ser por usuario y se añade `getUserProjects()`.
- Los eventos de tiempo real `chat:new_conversation` y `admin:notification` se emiten **solo al proyecto** (`emitToProject`), no globalmente.
- `socket.service.ts` (frontend) envía el proyecto en el handshake y expone `reconnect(projectId)`; se corrige la lectura del token (`mitchbot_token`).
- `Profile.vue` muestra los proyectos del usuario y el activo.

### 🧪 Tests
- Nuevo test de integración `tests/integration/multi-project-isolation.test.ts`: resolución por header/activo, denegación de proyecto ajeno (403) y aislamiento de proyectos por usuario.

---

## v1.17.1 — 2026-09-18

> 🐛 **Fix: resolución de módulos del frontend (artefactos compilados obsoletos)**

---

### 🐛 Fixes & Optimizations

#### Frontend
- **Eliminados 56 artefactos compilados obsoletos** (`.js`, `.vue.js` y `.js.map`) dentro de `apps/frontend/src/` que eclipsaban a los fuentes `.ts`/`.vue` en la resolución de Vite (prioridad `.js` sobre `.ts` en imports sin extensión). Esto provocaba `TypeError: socketService.onMessageUpdated is not a function` en `/messaging` y el spinner "Cargando conversaciones..." permanente.
- **Carga resiliente de la bandeja** (`Messaging.vue`): la carga de conversaciones se ejecuta antes e independientemente de la inicialización del socket; los errores de socket se registran sin bloquear los datos ni dejar `isLoadingChats` en `true`.
- **Prevención de recurrencia**: `noEmit: true` en `apps/frontend/tsconfig.json` para que la comprobación de tipos no emita `.js` junto a los fuentes, y reglas en `.gitignore` para no rastrear artefactos `.js`/`.js.map` dentro de `apps/frontend/src/`.

### ⚠️ Breaking changes
- Ninguno.

---

## v1.17.0 — 2026-09-17

> 🤖 **Agent Tool Use, OCR unificado y RAG multilingüe**

---

### ✨ Nuevas funcionalidades

#### Backend — Agent Tool Use (Function Calling)
- **Sistema de herramientas** (`src/tools/`) con 8 herramientas zero-config: `create_appointment`, `create_order`, `get_product_info`, `get_business_hours`, `get_service_availability`, `transfer_to_human`, `send_notification`, `get_faq_answer`.
- **Ejecutor** (`services/tool.service.ts`): esquemas OpenAI-compatible, detección de tool calls en texto libre y ejecución normalizada.
- **Tool calling nativo** (`bindTools`) para OpenRouter y Gemini; para Ollama se inyectan las herramientas en el system prompt y se detecta el JSON de invocación.
- **Flujo de confirmación**: colección `tool_executions`, mensajes `confirmation_request`/`tool_result` (`sender: 'tool'`), evento WebSocket `tool:confirm` (`confirm`/`cancel`/`modify`) y regeneración de la respuesta final con el resultado.
- **Nuevas colecciones** `appointments` y `orders` con servicios y endpoints REST (`/api/appointments`, `/api/orders`).

#### Backend — Pipeline OCR unificado
- **`services/ocr.service.ts`** convierte **todos** los PDFs a imágenes (`pdf-to-img`, escala 2) y aplica OCR.
- Proveedores: **Ollama (Qwen2.5-VL) → Mistral OCR → OpenRouter → pdf-parse** (fallback legacy).
- Salida estructurada `{ text, pages, method, confidence }` con batching de páginas (batch 4) y timeouts.
- Estadísticas por fuente: `extractionTimeMs`, `extractionConfidence`, `pagesProcessed`, `ocrProvider`, `ocrModel`.
- Nuevo tipo de proveedor **`ocr`** y endpoint `POST /api/ai-models/providers/test-ocr`.

#### Backend — RAG multilingüe
- **Chunking semántico** (`utils/chunking.ts`): encabezados Markdown, tablas atómicas, prefijo `Document | Section`, 800/100 tokens, `page_number` y detección de idioma (`en`/`es`/`mixed`).
- **Re-ranking** (`services/reranker.service.ts`): top 10 → top 3 con embeddings locales de Ollama y fallback heurístico (falla rápido si el modelo no está disponible).
- **Qdrant tuning**: HNSW `m:16`, `ef_construct:100`, `ef:64`, `on_disk` e índices de payload `language`/`document_id`.
- **Reindexado en background** con cola BullMQ `rag-reindex`, progreso por fuente y rollback de vectores parciales.

#### Frontend
- **UI de confirmación de herramientas** en **Messaging** y **TestChat** (botones Confirmar / Cancelar / Modificar).
- **Renderizado de mensajes de herramienta** (`tool_result`, `confirmation_request`) con estado y tarjetas.
- **Nueva pestaña OCR** en DevAdmin → Proveedores (proveedor, modelo, parámetros y test de conexión).

### 🔄 Cambios
- **Extracción de archivos**: los PDFs ya no usan texto embebido; pasan siempre por OCR. `extractTextOnly` (DevAdmin) usa el mismo pipeline.
- **Búsqueda RAG**: recupera top 10 y re-rankea a top 3 (configurable vía `rag.use_reranker`).
- **Mensajes**: `sender` ahora incluye `tool`; `contentType` incluye `tool_call`, `tool_result` y `confirmation_request`; nuevo campo `toolData`.

### 🛠️ Migración
- **No requiere migración de datos.** Las colecciones nuevas se crean on-demand.
- Para aplicar el nuevo chunking a fuentes existentes: `pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`.
- OCR local recomendado: `ollama pull qwen2.5-vl`; re-ranking local: `ollama pull nomic-embed-text`.
- Config OCR: `rag.ocr_*`. Config del negocio para las tools: `business.hours`, `business.services`, `business.timezone`, `business.slot_minutes`, `business.currency`.

### ⚠️ Breaking changes
- Ninguno. Si no hay herramientas ni modelos configurados, el chat sigue funcionando igual (degradación graceful).

---

## v1.16.1 — 2026-09-17

> 🐛 **Fix: carga de variables de entorno en scripts**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Ruta de `.env` corregida en scripts** — Los scripts `seed`, `cleanup-project`, `purge-qdrant` y `reindex-rag` cargaban `apps/backend/.env` con un path relativo que fallaba al ejecutarse desde `apps/backend` (resolvía a `apps/backend/apps/backend/.env`), dejando `dotenv` con los valores por defecto. Ahora resuelven el `.env` relativo al propio archivo vía `__dirname`, por lo que funcionan desde cualquier directorio de trabajo.

---

## v1.16.0 — 2026-06-13

> 🔒 **WebSocket Security Hardening**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Autenticación JWT para Socket.io** — Todas las conexiones WebSocket requieren token JWT válido.
- **Autorización de Rooms** — Los usuarios solo pueden unirse a conversaciones de su proyecto asignado.
- **Rate Limiting** — Límite de 30 mensajes/minuto y 10 joins/minuto por usuario (usando Redis).
- **CORS Restrictivo** — En producción, solo orígenes permitidos en `FRONTEND_URL`. Desarrollo mantiene `*`.
- **Middleware de seguridad** — Nuevo `socket-auth.middleware.ts` con validación completa.

#### Frontend
- **Socket con autenticación** — El `socketService` envía automáticamente el token JWT en el handshake.
- **Soporte para chat público** — El `TestChat` envía el slug del proyecto en la conexión pública.
- **Manejo de errores** — Los componentes `Messaging` y `TestChat` manejan errores de WebSocket.

### 🛡️ Seguridad
- **Protección contra acceso no autorizado** — Conexiones sin token son rechazadas inmediatamente.
- **Validación de proyecto** — Los usuarios no pueden acceder a conversaciones de otros proyectos.
- **Rate limiting por IP** — Prevención de abuso vía Redis.

### 📝 Documentación
- **AGENTS.md actualizado** — Documentación de la arquitectura de seguridad WebSocket.

---

## v1.15.0 — 2026-04-08

> 🧪 **Extraccion PDF completa por imagenes**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Config global de extraccion PDF** — Nuevos parametros para controlar escala, limites, batch y timeouts con soporte de 0 = sin limites.
- **Extraccion por pagina configurable** — PDFs se procesan por imagen con batch configurable y logs de conteo.
- **Salida completa** — Se elimina el recorte fijo de 50k y se respeta el limite configurable (o sin limite).

#### Frontend
- **Parametros PDF en DevAdmin** — Controles de extraccion agregados en Proveedores > Image para aplicar a DevAdmin y RAG.

---

## v1.14.2 — 2026-04-08

> 🧪 **DevAdmin: PDF a imagenes con preview**

---

### ✨ Nuevas funcionalidades

#### Backend
- **DevAdmin PDF preview** — Nuevo endpoint para convertir PDFs a imagenes y devolverlas en base64.
- **Calidad configurada** — Se ajusta la escala de conversion segun un ajuste DevAdmin independiente.

#### Frontend
- **Pestaña PDF a imagenes** — Se agrega tab en Pruebas para subir PDF y mostrar preview por pagina.
- **Selector de calidad** — Se agrega un selector simple de calidad en Proveedores > Image (config independiente).

### 🐛 Fixes & Optimizations

#### Frontend
- **Config separada** — La configuracion de calidad se separa del proveedor y tiene guardado propio.

### 🐛 Fixes & Optimizations

#### Frontend
- **Servicio Brain DevAdmin** — Se sincroniza el servicio para incluir la conversion PDF a imagenes.

---

## v1.14.1 — 2026-04-08

### 🐛 Fixes & Optimizations

#### Frontend
- **Servicio Brain DevAdmin** — Se sincroniza el servicio para incluir la conversion PDF a imagenes.

---

## v1.14.0 — 2026-04-08

> 🧠 **RAG: Extraccion por imagenes en PDFs**

---

### ✨ Nuevas funcionalidades

#### Backend
- **PDF → imagenes** — Los PDFs ahora se convierten a PNG y se extraen con el modelo image (temperatura 0).
- **CSV via modelo file** — El CSV se formatea via modelo tipo file antes del chunking.
- **Vision provider fijo** — Se evita el formato Gemini cuando el proveedor es otro, mejorando la compatibilidad con OpenRouter/Ollama.
- **Validacion de modelo image** — Se corta temprano si el modelo no parece soportar vision y se registra el motivo.
- **Mejor cobertura** — Mayor escala al renderizar PDF, mayor maxTokens y solicitud de detalle alto.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Extraccion consistente** — Se unifica la ruta de extraccion para PDFs con modelo image por pagina.

---

## v1.13.2 — 2026-04-01

> 🧠 **RAG: Document inputs dinamicos**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Inputs dinamicos** — PDFs se envian como `input_file` y imagenes como `input_image` (con fallback), segun modelo.
- **Imagenes en ingesta** — La cola RAG acepta imagenes y las procesa como fuente.

#### Frontend
- **Subida de imagenes** — El modulo Brain permite subir imagenes y muestra tipo IMAGE.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Trazabilidad de extraccion** — Se registra el metodo de extraccion (parser, raw, csv, llm_file, llm_vision) por fuente.

---

## v1.13.0 — 2026-04-01

> 🧠 **RAG: Extraccion multimodal para PDFs e imagenes**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Extraccion vision** — PDFs escaneados e imagenes se procesan con modelo multimodal (OpenRouter) antes del embedding.
- **Imagenes en ingesta** — La cola RAG acepta imagenes y las procesa como fuente.

#### Frontend
- **Subida de imagenes** — El modulo Brain permite subir imagenes y muestra tipo IMAGE.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Trazabilidad de extraccion** — Se registra el metodo de extraccion (parser, raw, csv, llm_file, llm_vision) por fuente.

---

## v1.12.0 — 2026-03-25

> 🧪 **DevAdmin: Modulo de pruebas y extraccion sin indexar**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Extraccion directa** — Nuevo endpoint DevAdmin para extraer texto sin guardar ni indexar en Qdrant.
- **Soporte de imagenes** — El extractor acepta archivos de imagen en el flujo de pruebas.

#### Frontend
- **Modulo Pruebas** — Nueva vista DevAdmin con subitem “Extraer texto” estilo chat para validar modelos file.

---

## v1.11.3 — 2026-03-21

> 🧹 **RAG: Eliminacion garantizada en Qdrant**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Delete hard** — Eliminar fuente ahora falla si Qdrant no borra, evitando inconsistencias.
- **Log de borrado** — Se registra confirmacion de eliminacion en Qdrant.

#### Frontend
- **Delete UX** — Mensajes claros al eliminar fuente.

---

## v1.11.2 — 2026-03-21

> 🧠 **RAG: Texto extraido y prompt estricto**

---

### 🐛 Fixes & Optimizations

#### Backend
- **LLM estricto** — Se obliga a devolver Markdown o NO_TEXT_FOUND para evitar alucinaciones.

#### Frontend
- **Texto extraido** — Boton ahora consulta endpoint y maneja errores en UI.

---

## v1.11.1 — 2026-03-21

> 🧠 **RAG: Extraccion Markdown via LLM**

---

### 🐛 Fixes & Optimizations

#### Backend
- **OCR removido** — La extraccion vuelve a ser solo LLM y se guarda Markdown extraido.

#### Frontend
- **Ver texto extraido** — Nueva accion para ver el Markdown extraido por documento.

---

## v1.11.0 — 2026-03-21

> 🧠 **RAG: OCR local para PDFs escaneados**

---

### ✨ Nuevas funcionalidades

#### Backend
- **OCR local** — Si el parser y el modelo file no extraen texto, se usa OCR local para PDFs imagen.
- **Logs de OCR** — Se agrega log de inicio y fin de OCR en la fuente.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Deteccion PDF** — Se detecta si el PDF es imagen o texto antes de ejecutar OCR.

## v1.10.3 — 2026-03-21

> 🐛 **RAG: Worker estable + progreso real**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Worker** — Ajustes de lock y uso de sourceId en el worker para actualizar progreso y logs.

#### Frontend
- **Logs vivos** — Polling refresca logs cuando estan abiertos.

---

## v1.10.2 — 2026-03-21

> 🐛 **RAG: Colecciones por modelo de embeddings**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Coleccion por modelo** — Se separa la coleccion Qdrant por modelo de embeddings activo para evitar error de dimensiones.

---

## v1.10.1 — 2026-03-21

> 🐛 **RAG: Cola BullMQ estable**

---

### 🐛 Fixes & Optimizations

#### Backend
- **BullMQ Redis** — Se usa configuracion dedicada compatible con BullMQ para evitar jobs atascados.

---

## v1.10.0 — 2026-03-21

> ⚙️ **RAG: Subida en background con progreso y logs**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Cola BullMQ** — Subida de archivos ahora se procesa en background con Redis.
- **Estados y progreso** — `status`, `stage`, `progress`, timestamps y logs por fuente.
- **Endpoints** — Nuevos endpoints para estado y logs por fuente.

#### Frontend
- **UX de progreso** — Barra de avance, etapa actual y logs inline por fuente.

---

### 🐛 Fixes & Optimizations

#### Backend
- **BullMQ** — Redis config ahora setea `maxRetriesPerRequest: null` para evitar error de worker.

## v1.9.4 — 2026-03-21

> 🐛 **RAG: Mejor uso de base64 en PDF**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Extractor file** — Siempre envia PDF en base64 al modelo tipo file (con data URI) y evita perder texto extraido por parser.

---

## v1.9.3 — 2026-03-21

> 🧹 **RAG: Rollback en uploads fallidos**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Rollback automatico** — Si falla la subida o el procesamiento, se eliminan los vectores en Qdrant y el documento en Mongo.

---

## v1.9.2 — 2026-03-21

> 🐛 **RAG: Mejor extraccion para PDFs sin texto**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Extractor file** — Si un PDF no tiene texto seleccionable, se envia base64 truncado al modelo tipo file para intentar extraer contenido.

---

## v1.9.1 — 2026-03-21

> 🧩 **RAG: Bloqueo de uploads sin modelo file**

---

### 🐛 Fixes & Optimizations

#### Frontend
- **Subida de archivos** — Se deshabilita el flujo de archivos cuando no hay proveedor tipo file activo y se muestra aviso con link a DevAdmin.

---

## v1.9.0 — 2026-03-21

> 🧠 **RAG: Extraccion LLM + payload con indices dinamicos**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Extractor LLM tipo file** — PDF y CSV ahora pasan por el modelo tipo `file` antes del chunking; TXT se procesa directo.
- **Payload enriquecido** — Se agregan `document_id`, `chunk_id`, `text`, `category`, `tags`, `author`, `access_level`, `created_at` y metadatos de proyecto en Qdrant.
- **Indices dinamicos** — Config `rag.qdrant_payload_indexes` en `app_config` para crear indices de payload en Qdrant.
- **Reindex actualizado** — El script de reindexado preserva y reinyecta metadata completa.

---

## v1.8.1 — 2026-03-20

> 🧹 **UX: Simplificación de pestaña LLM**

---

### 🐛 Fixes & Optimizations

#### Frontend
- **DevAdmin LLM** — Se elimina la sección “Modelo IA del agente” para evitar duplicidad con el selector de proveedor/modelo.
- **Estado vacío** — Se oculta el badge de activo cuando no hay proveedor/modelo configurado y se muestra aviso para seleccionar proveedor.

---

## v1.8.0 — 2026-03-20

> 🧩 **UX: Flujo unificado de proveedores y modelos**

---

### ✨ Nuevas funcionalidades

#### Frontend
- **Formato unificado** — Todos los tipos de proveedor ahora siguen el mismo flujo: seleccionar proveedor → abrir modal → filtrar modelo.
- **Modal de modelos** — Selección de modelos con buscador para Ollama, OpenRouter y Gemini en LLM, Embeddings, File, Image y Audio.

---

## v1.7.0 — 2026-03-19

> 🛡️ **Refactor: Modo DevAdmin y Proveedores Avanzados**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Rol `devadmin`** — Nuevo rol interno de superadmin para gestionar proveedores/modelos. No se puede crear ni asignar via API.
- **Proveedores extendidos** — `provider_configs` ahora soporta tipos `file`, `image` y `audio` ademas de `llm` y `embedding`.
- **Seguridad en rutas** — Las rutas de `ai-models` y proveedores quedan restringidas a `devadmin`.

#### Frontend
- **Vista DevAdmin** — Nueva pantalla para administrar proveedores y modelos por tipo (LLM, Embedding, File, Image, Audio).
- **Settings simplificado** — Se removieron pestañas de proveedores; la personalizacion del bot permanece.
- **UI de usuarios** — Visualizacion de rol `devadmin` como interno.
- **Modelo IA** — Seleccion del modelo del agente movida a DevAdmin.
- **RAG** — Mensaje de configuracion apunta a DevAdmin cuando falta embeddings.

---

## v1.6.5 — 2026-03-18

> 🧹 **Herramientas: Limpieza y reindex de RAG**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Scripts de mantenimiento** — Se agregan scripts para purgar Qdrant, reindexar RAG y limpiar un proyecto activo.
- **Reindex controlado** — Reindex del proyecto activo borrando su colección y reconstruyendo vectores.
- **Limpieza total** — Script para limpiar datos del proyecto activo y su colección en Qdrant.

---

## v1.6.0 — 2026-03-17

> 🧠 **Feature: Sistema de Personalidad Dinámica para el Chatbot**

---

### 💥 Breaking Changes

- **`systemPrompt` reemplazado por `personality`**: El campo `systemPrompt` (string libre) fue reemplazado por un objeto estructurado `personality` en el modelo de Agente. Los agentes existentes necesitan recrearse o actualizar su documento en la BD.

### ✨ Nuevas funcionalidades

#### Backend
- **`prompt-builder.service.ts`** — Nuevo servicio que genera dinámicamente el system prompt a partir de la configuración de personalidad del agente.
- **Modelo `AgentPersonality`** — Objeto tipado con: `role`, `traits` (máx. 3), `emojiUsage`, `language`, `responseLength`, `ragBehavior`, `fallbackMessage`, `additionalInstructions`.
- **`getDefaultPersonality()`** — Función que provee valores por defecto para nuevos agentes.
- **`agent.model.ts`** — Schema actualizado: `systemPrompt: string` → `personality: AgentPersonality`.
- **`chat.service.ts`** — Usa `buildSystemPrompt(personality)` en vez de pasar el string directamente.
- **`agent.service.ts`** — Create/update manejan el objeto `personality` con merge de defaults.
- **`agents.controller.ts`** — Schemas Zod actualizados con validación del objeto `personality`.
- **`project.service.ts` / `project.controller.ts`** — Aceptan `personality` en la creación de proyectos.

#### Frontend
- **`settings.service.ts`** — Interfaz `AgentPersonality` y `AgentData` actualizados.
- **`Settings.vue` / Tab Agente IA rediseñado** — Interfaz visual con:
  - Selector de **Rol** (Asistente, Profesor, Vendedor, Soporte, Atención al Cliente)
  - Selector de **Rasgos** (chips con máximo 3 seleccionables)
  - Selector de **Emojis** (Bajo, Medio, Alto)
  - Selector de **Idioma** (Español, Inglés, Portugués, Auto-detectar)
  - Selector de **Longitud de respuesta** (Corta, Media, Detallada)
  - Selector de **Comportamiento RAG** (Solo documentos, Híbrido, General)
  - Slider de **Creatividad/Temperatura** con etiquetas y advertencia
  - Área de **Instrucciones adicionales** (texto libre opcional)
- **`ProjectSetup.vue`** — Onboarding actualizado con selector de Rol visual (en vez de textarea de system prompt).
- **`Agents.vue`** — Eliminadas referencias a `systemPrompt` en modales de crear/editar.

### 🗑️ Eliminado
- Campo `systemPrompt` del modelo Agent y de todas las interfaces frontend.
- Personality `systemPrompt` del config service default.

---

## v1.5.13 — 2026-03-16

> 📝 **Documentación: Reescritura completa de AGENTS.md**

---

### 📝 Documentación

- **AGENTS.md reescrito desde cero**: Se actualizó el archivo de guía del proyecto para reflejar con precisión el estado actual de la arquitectura.
  - Estructura detallada del monorepo con árbol de archivos del backend y frontend.
  - Stack tecnológico actualizado con todas las dependencias reales (`@langchain/core` v1.x, Zod v4, Radix Vue, Lucide Icons, etc.).
  - Servicios Docker documentados con puertos y propósito.
  - Lógica de negocio completa de los 7 módulos (Mensajería, Contactos, Cerebro/RAG, Configuración, Usuarios, Login, Seguridad).
  - Arquitectura del chatbot con diagrama ASCII del flujo: `chat.service → ai.service → llm-provider.service`.
  - Flujo de autenticación y onboarding con diagrama de decisión.
  - Tabla completa de API endpoints (11 módulos).
  - Modelos de datos MongoDB (11 colecciones con campos clave).
  - Eventos WebSocket documentados (7 eventos).
  - Comandos de desarrollo y variables de entorno.
  - Roadmap actualizado con checkboxes de estado.

---

## v1.5.12 — 2026-03-13

> 🧪 **Test chat sin sidebar**

---

### 🐛 Fixes & Optimizations

- **Test Chat**: el layout sin sidebar aplica tambien en el bundle JS del router.

---

## v1.5.0 — 2026-03-11

---

## v1.4.1 — 2026-03-11

#### Streaming de Respuestas (WebSockets)
- **Generación en Tiempo Real**: Se reemplazó la espera bloqueante por una emisión continua de tokens (`generateResponseStream` usando `.stream()`).
- **Typing Indicator Instantáneo**: Ahora, cuando el bot comienza a pensar, se emite un mensaje vacío ("...") de inmediato antes incluso de que RAG cargue, dándole al cliente la sensación de respuesta instantánea.
- **Frontend Streaming UI**: Tanto el simulador del cliente (`TestChat.vue`) como el panel de administración (`Messaging.vue`) actualizan el contenido de los mensajes letra por letra al recibir el evento `chat:message_chunk`.
- **Renderizado Markdown Básico**: Los chats ahora procesan negritas e itálicas que la IA produce naturalmente en tiempo real.

### 🐛 Fixes & Optimizations

- **Fail-fast en OpenRouter**: Se deshabilitaron los reintentos automáticos e infinitos (`maxRetries: 0`) en la librería `@langchain/openai`. Esto impedía que los modelos gratuitos (saturados) o con errores (429) se quedaran bloqueados por minutos, devolviendo una respuesta de timeout predecible en su lugar.
- **Limitación de RAG (Context Truncation)**: Se acotó el historial de base de conocimientos inyectado a los 2 documentos más relevantes y truncados a un máximo de 1000 caracteres. Esto reduce drásticamente el Time-To-First-Token (TTFT) para consultas de IA.
- **Timeouts preventivos en Vector Store**: Se añadió un `timeout` seguro de 5 segundos en `rag.service.ts` a la hora de consultar `QdrantVectorStore`. Si los embeddings fallan o tardan de más, el bot continuará y responderá para nunca dejar al usuario esperando colgado.



## v1.4.0 — 2026-03-11

> 🧠 **Feature/Fix: Capa de Abstracción AI, Enrutador e Integración nativa de OpenRouter**

---

### 💥 Breaking Changes

- **AI Model Instantiation**: El servicio `@langchain/openai` requería un formato específico (`configuration: { apiKey, baseURL }`) para inicializar el cliente de OpenRouter, el cual era ignorado en el formato anterior (causando "Missing credentials" silenciados en la invocación).
- **Abstracción del Chatbot (`ai.service.ts`)**: El Chatbot ya no sabe internamente qué tipo de IA está usando. Simplemente envía `SystemPrompt + Context + Mensajes` y espera la respuesta en cadena.
- **El Enrutador (`llm-provider.service.ts`)**: Concentra todo el desacoplamiento de modelos, inicializando dinámicamente clientes de Ollama, OpenRouter o Gemini según base de datos y retornando una abstracción `BaseChatModel`.

### ✨ New Features

- **Manejo Sensato de Errores de LLMs**: Ahora, cuando falla un proveedor externo o interno, el bot envía al chat un mensaje de sistema claro y fácil de entender (ej: "Error de OpenRouter: Missing Credentials. Revisa Settings") para el usuario en vez de quedarse callado sin responder la petición inicial por web-socket. Se introdujo también un timeout general de 60s preventivo para LLMs que se queden en estado "zombie".

---
## v1.3.0 — 2026-03-10

> 🔄 **Refactor: Proveedores `local` → `ollama` + Modal de selección de modelos**

---

### 💥 Breaking Changes

- **Proveedor "local" renombrado a "ollama"**: Todas las referencias a `local` como proveedor ahora usan `ollama`. La configuración existente debe actualizarse.

### ✨ Nuevas funcionalidades

#### Backend
- **`GET /api/ai-models/ollama/models`**: Nuevo endpoint que lista modelos directamente desde la API de Ollama (`/api/tags`)
- **Validación de modelos Ollama**: Antes de invocar un modelo, se verifica que exista en Ollama. Si no, se envía un error descriptivo al chat.
- **`testOllamaConnection()`**: Nuevo método que verifica conectividad con Ollama y reporta cantidad de modelos
- **Timeout de 60s**: Las invocaciones al LLM ahora tienen timeout para evitar cuelgues infinitos
- **Error messages en chat**: Si el bot falla al responder, envía un mensaje de error visible en la conversación

#### Frontend
- **Modal de selección de modelos**: En la pestaña "Agente IA", los modelos se seleccionan mediante un modal con buscador y filtros
- **Vista previa de Ollama**: En "Proveedor LLM", al seleccionar Ollama se muestran los modelos disponibles con tamaño y parámetros
- **Proveedor Embeddings**: Ahora lista modelos de Ollama en vez de archivos .gguf

### 🗑️ Eliminado
- Lectura de archivos `.gguf` (carpetas `assets/llm/` y `assets/embedding/`) — ya no se usan
- Endpoints `GET /local/llm` y `GET /local/embeddings` reemplazados por `GET /ollama/models`
- Interfaz `LocalAssetInfo` eliminada del frontend y backend

---

## v1.2.1 — 2026-03-10

> 🐛 **Bugfixes: Test conexión, flujo local, OpenRouter y auto-respuesta del bot**

---

### 🐛 Fixes

#### Test de Conexión
- **Test local** ahora verifica que Ollama esté corriendo (`/api/tags`) en vez de intentar invocar un modelo
- **Test result** muestra un mensaje descriptivo (ej: "Ollama conectado. 3 modelo(s) disponibles")
- **Test online** envía un mensaje corto al modelo para verificar la API key

#### Proveedor Local (Ollama)
- **Ya no requiere tener archivos .gguf** para guardar proveedor local — solo activar "Local" es suficiente
- **Archivos .gguf son opcionales** — se muestra info explicando que los modelos se cargan desde Ollama
- **Modelos del agente** ahora consulta `GET /api/tags` de Ollama para listar modelos descargados + archivos .gguf locales

#### Proveedor OpenRouter
- **Los modelos aparecen correctamente** en el selector del agente después de guardar la API key
- **Resultados limitados a 200 modelos** para evitar responses enormes
- **Buscador de modelos** — se agrega campo de búsqueda cuando hay más de 10 modelos para filtrar rápidamente

#### Agente — Guardado de Modelo
- **`modelValue` ahora se acepta** en los schemas Zod de create y update agent (antes se descartaba)
- **Agent service actualizado** para guardar `modelValue` directamente sin requerir lookup en `ai_models` collection
- **Soporte para modelos remotos** — IDs como `openai/gpt-4` o `gemini-2.0-flash` se guardan directamente

#### Chat — Auto-respuesta del Bot
- **Bot ahora usa el system prompt del agente activo** en vez de un prompt hardcodeado en inglés
- **Fallback a prompt por defecto** si el agente no tiene system prompt configurado
- **RAG graceful degradation** — si la búsqueda RAG falla (ej: colección no existe), el bot continua sin contexto en vez de crashear
- **`agentService` importado estáticamente** en chat.service.ts para resolver error TS2307

---

## v1.2.0 — 2026-03-10

> 🔄 **Refactorización del flujo de proveedores: LLM + Embeddings separados, APIs dinámicas**

---

### 🔄 Refactored (Breaking Changes)

#### Flujo de Proveedores Rediseñado

- **Proveedores separados por tipo** — Ahora hay configuraciones independientes para LLM y Embeddings
  - **LLM**: `local` | `openrouter` | `gemini`
  - **Embedding**: `local` | `openrouter`
- **Solo 1 proveedor activo por tipo** — Al seleccionar un proveedor, se desactivan los demás del mismo tipo
- **Eliminados proveedores OpenAI y Claude** como opciones directas (accesibles vía OpenRouter)
- **Eliminado `@langchain/anthropic`** — Ya no es dependencia directa
- **Eliminadas variables de entorno de API keys** — `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` ya no están en `env.ts` (se gestionan desde la BD)

#### Modelo `ProviderConfig` Actualizado

- Nuevo campo `type: 'llm' | 'embedding'` — Identifica el tipo de proveedor
- Nuevo campo `selectedModel` — Modelo seleccionado (para local y embeddings)
- Nuevo campo `selectedModelName` — Nombre legible del modelo

### ✨ New

#### Lectura de Assets Mejorada

- **Carpetas + .gguf** — Ahora `readLocalAssets()` detecta tanto carpetas como archivos `.gguf`
- Ambas rutas: `src/assets/llm/` y `src/assets/embedding/`

#### APIs Remotas Dinámicas

- **`GET /api/ai-models/remote/openrouter`** — Consulta la API de OpenRouter (`GET /api/v1/models`) para listar modelos LLM en tiempo real
- **`GET /api/ai-models/remote/openrouter/embeddings`** — Consulta OpenRouter filtrando por "embedd" para modelos de embedding
- **`GET /api/ai-models/remote/gemini`** — Consulta `generativelanguage.googleapis.com/v1/models` para listar modelos Gemini

#### Endpoint de Modelos para Agente

- **`GET /api/ai-models/agent/models`** — Consulta el proveedor LLM activo y devuelve los modelos disponibles
  - Si local: devuelve el modelo seleccionado al configurar
  - Si openrouter/gemini: consulta la API remota con la API key guardada

#### Provider Config por Tipo

- **`GET /api/ai-models/providers/active/:type`** — Obtiene el proveedor activo para `llm` o `embedding`
- **`GET /api/ai-models/providers/configs/:type`** — Lista configs por tipo
- **`DELETE /api/ai-models/providers/config/:type/:provider`** — Elimina config por tipo+proveedor

#### Frontend — Pestañas Separadas

- **Pestaña "Proveedor LLM"** — Selector visual de proveedor (local/openrouter/gemini)
  - Local: muestra carpetas y archivos .gguf para selección inmediata del modelo
  - OpenRouter/Gemini: input de API Key (modelo se selecciona en el agente)
  - Test de conexión integrado
- **Pestaña "Proveedor Embeddings"** — Selector (local/openrouter)
  - Local: muestra archivos .gguf para selección inmediata
  - OpenRouter: API Key + botón "Cargar Modelos" + selector de modelo embedding
- **Pestaña "Agente IA"** — Modelo se carga dinámicamente desde `getModelsForAgent()`
  - Si no hay proveedor, muestra aviso amigable
  - Usa `<optgroup>` para agrupar por proveedor

#### RAG Service — Embeddings Dinámicos

- Ya no crea embeddings estáticos al inicio — resuelve la config del proveedor de embeddings activo en cada operación
- Función `resolveEmbeddingsConfig()` busca el proveedor de embedding activo en BD

---

## v1.1.0 — 2026-02-28

> 🔧 **Refactorización de librerías deprecadas + Soporte multi-proveedor LLM**

---

### 🔄 Refactored (Breaking Changes)

#### Migración de LangChain (eliminación de imports deprecados)

- **`ChatOllama`** — Migrado de `@langchain/community/chat_models/ollama` → `@langchain/ollama`
- **`OllamaEmbeddings`** — Migrado de `@langchain/community/embeddings/ollama` → `@langchain/ollama`
- **`QdrantVectorStore`** — Migrado de `@langchain/community/vectorstores/qdrant` → `@langchain/qdrant`
- **`RecursiveCharacterTextSplitter`** — Migrado de `langchain/text_splitter` → `@langchain/textsplitters`
- **`@langchain/core`** — Actualizado de `v0.3.x` → `v1.1.x` para compatibilidad con los nuevos paquetes
- **`@langchain/community`** — Eliminado completamente como dependencia directa
- **`langchain` (base)** — Ya no es necesario, se eliminó del proyecto
- **`@types/bcryptjs`** y **`@types/uuid`** — Eliminados (los paquetes ya incluyen sus propios tipos)

#### Compatibilidad Zod v4

- **`validation.middleware.ts`** — Reemplazado `AnyZodObject` (eliminado en Zod v4) por `z.ZodType<any>`
- **`error.middleware.ts`** — Actualizado `.errors` → `.issues` para compatibilidad con Zod v4

### ✨ New

#### Carpeta Assets (LLM + Embeddings)

- **`src/assets/llm/`** — Carpeta para almacenar modelos LLM locales (.gguf, .bin, .safetensors, .pt, .onnx)
- **`src/assets/embedding/`** — Carpeta para almacenar modelos de embeddings locales
- **`.gitignore`** — Configurado para ignorar archivos de modelo pero mantener `.gitkeep`
- **Endpoint `GET /api/ai-models/local/llm`** — Lee y lista los archivos de modelo en `assets/llm/`
- **Endpoint `GET /api/ai-models/local/embeddings`** — Lee y lista los archivos de embedding en `assets/embedding/`

#### Servicio Multi-Proveedor LLM (`llm-provider.service.ts`)

- **Nuevo servicio central** — Crea instancias de `ChatModel` dinámicamente según el proveedor configurado
- **Proveedores soportados:**
  - 🦙 **Ollama** (Local) — Sin API key, usa URL del servidor Ollama
  - 🤖 **OpenAI** — GPT-4o, GPT-4o Mini, GPT-4 Turbo
  - ✨ **Google Gemini** — Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
  - 🧠 **Anthropic Claude** — Claude Sonnet 4, Claude 3.5 Haiku, Claude 3 Opus
  - 🔀 **OpenRouter** — Acceso a cientos de modelos via una sola API
- **Paquetes NPM instalados:**
  - `@langchain/ollama` — ChatOllama + OllamaEmbeddings modernos
  - `@langchain/qdrant` — QdrantVectorStore moderno
  - `@langchain/textsplitters` — RecursiveCharacterTextSplitter moderno
  - `@langchain/openai` — ChatOpenAI (OpenAI + OpenRouter)
  - `@langchain/google-genai` — ChatGoogleGenerativeAI (Gemini)
  - `@langchain/anthropic` — ChatAnthropic (Claude)

#### API de Proveedores (Backend)

- **`GET /api/ai-models/providers/list`** — Lista proveedores disponibles con estado de configuración
- **`GET /api/ai-models/providers/configs`** — Obtiene configs guardadas (API keys enmascaradas)
- **`POST /api/ai-models/providers/config`** — Guarda API key de un proveedor
- **`DELETE /api/ai-models/providers/config/:provider`** — Elimina API key de un proveedor
- **`POST /api/ai-models/providers/test`** — Prueba la conexión con un proveedor
- **Modelo `ProviderConfig`** — Nueva colección MongoDB `provider_configs` para almacenar API keys por proveedor

#### Resolución Dinámica de Modelo (`ai.service.ts`)

- **Refactorizado completamente** — Ya no tiene modelo hardcodeado
- **`resolveModelConfig()`** — Busca el agente activo, obtiene su modelo y proveedor, y crea el ChatModel correcto dinámicamente
- **Fallback inteligente** — Si no encuentra configuración, usa Ollama con `llama3.2:3b`

#### Frontend — Pestaña Proveedores

- **Nueva pestaña** "Proveedores" en `Settings.vue` — Gestión completa de API keys
  - Input de API key con toggle mostrar/ocultar
  - Botón "Guardar" para persistir la key
  - Botón "Test" para probar la conexión
  - Botón "Eliminar" para quitar la key
  - Indicadores de estado: "Configurado", "Local"
  - Listado de modelos disponibles por proveedor
- **Selector de modelo agrupado** — En `Settings.vue`, `Agents.vue` y `ProjectSetup.vue`, los modelos ahora se muestran agrupados por proveedor con optgroups
- **Agents.vue** — Vista completamente funcional con create, edit, delete, y badges de proveedor
- **settings.service.ts** — Nuevos tipos y métodos para: `getProviders()`, `getProviderConfigs()`, `saveProviderConfig()`, `deleteProviderConfig()`, `testProviderConnection()`, `getLocalModels()`, `getLocalEmbeddings()`

#### Configuración

- **`config/env.ts`** — Nuevas variables de entorno opcionales: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`

---

## v1.0.1 — 2026-02-28

### ✨ New

- **`.gitignore` configurado** — Archivo `.gitignore` completo para el monorepo, cubriendo `node_modules`, builds, archivos `.env`, IDEs, archivos del SO, uploads de usuario, y archivos temporales.

---

## v1.0.0 — 2026-02-28

> 🚀 **Release inicial del MVP completo** — Backend + Frontend + Infraestructura Docker

---

### ✨ New

#### Infraestructura & Monorepo

- **Monorepo con pnpm Workspaces** — Estructura organizada con `apps/backend`, `apps/frontend` y `packages/shared`, gestionada con pnpm workspaces.
- **Docker Compose para servicios** — Orquestación de MongoDB, Redis, Qdrant, Ollama y NATS con un solo comando (`docker-compose up`). Incluye persistencia de volúmenes para datos y modelos.
- **Variables de entorno validadas con Zod** — Configuración centralizada en `config/env.ts` con validación estricta de todas las variables de entorno al iniciar el servidor.

#### Backend — API REST (Express + TypeScript)

- **Servidor Express con TypeScript** — Backend completo sobre Express 4 con TypeScript estricto, estructura modular en capas (controllers → services → models).
- **Sistema de autenticación JWT** — Registro, login y verificación de token con expiración de 24 horas. El primer usuario registrado se convierte automáticamente en admin. Passwords hasheados con bcrypt (12 rounds).
- **Middleware de autenticación y autorización** — `authenticate` valida JWT en cada request protegido. `authorize('admin', 'support')` permite control de acceso por roles.
- **Gestión de usuarios** — CRUD completo de usuarios con roles (`admin`, `support`, `assistant`), estados (`Active`, `Inactive`), búsqueda, paginación, ordenamiento, y cambio de contraseña. Nunca se expone el hash de password en respuestas.
- **Gestión de contactos** — CRUD completo con búsqueda por nombre/email/teléfono, filtros por plataforma, estado y tags, paginación, ordenamiento, soft delete (archivar/restaurar), y creación automática de contactos al responder el primer mensaje.
- **Sistema de conversaciones en tiempo real** — Conversaciones multi-plataforma (WhatsApp, Instagram, Web) con modos `auto_pilot` y `human_takeover`, estados (active, closed, pending_human), conteo de mensajes no leídos, y datos temporales del cliente (`clientInfo`) antes de crear el contacto.
- **Chat Service con lógica de negocio** — Envío de mensajes por `contact`, `ai_agent` y `human_agent`. Creación automática del contacto cuando un agente humano responde por primera vez. Generación automática de respuestas del bot en modo auto_pilot usando RAG + IA.
- **Motor RAG (Retrieval-Augmented Generation)** — Procesamiento de archivos PDF, TXT y CSV. Text splitting con `RecursiveCharacterTextSplitter` (1000 chars, 200 overlap). Embeddings con `nomic-embed-text` vía Ollama. Indexación vectorial en Qdrant con `QdrantVectorStore`. Búsqueda semántica por similaridad. También acepta texto escrito manualmente como fuente de conocimiento.
- **Servicio de IA con Ollama** — Integración con `ChatOllama` de LangChain para generar respuestas y analizar sentimiento. Soporte para system prompts personalizables y contexto RAG inyectado automáticamente.
- **Gestión de modelos IA** — CRUD de modelos IA con seed automático al inicio (Llama 3.2, Qwen 2.5 Coder, CodeLlama). Filtro por modelos activos/inactivos. Prevención de duplicados por `value`.
- **Gestión de agentes** — CRUD de agentes IA con referencia a modelos, system prompts, mensajes de bienvenida/despedida, configuración de temperatura y max tokens, habilitación por canal, y estado activo/inactivo.
- **Sistema de proyectos** — Creación de proyecto con agente asociado automáticamente. Solo se permite un proyecto activo. Configuración de canales, mensajes y opciones del bot.
- **Configuración dinámica** — Sistema key-value en MongoDB para configuraciones globales (canales, mensajes, personalidad, opciones). Merge con valores por defecto si no existen en la BD. Soporte para upsert individual y masivo (`setAll`).
- **Dashboard Analytics** — Estadísticas de conversaciones (total, activas, cerradas, tasa de respuesta), volumen por período, distribución por canal, y actividad reciente.
- **WebSocket (Socket.io)** — Comunicación en tiempo real para mensajes de chat y notificaciones de nuevas conversaciones. Soporte para rooms por conversación (`join:room`).
- **Upload de archivos** — Middleware Multer para subida de archivos con almacenamiento en `uploads/`.
- **Middleware de validación y errores** — Validación de requests y manejo global de errores con responses estandarizadas.
- **Script de seed** — Script `pnpm seed` que limpia toda la base de datos y crea un usuario admin demo (`admin@mitchbot.io` / `admin123`).

#### Frontend — Dashboard (Vue 3 + TypeScript + Tailwind CSS)

- **App Vue 3 con Composition API** — Frontend con `<script setup>` y TypeScript en todo el código. Build con Vite. Routing con Vue Router.
- **Layout System** — `DashboardLayout` con `Sidebar` colapsable y `Topbar`. Vistas sin layout para Login y ProjectSetup.
- **Pantalla de Login** — Autenticación con JWT, almacenamiento de sesión en localStorage, redirección automática si ya está autenticado.
- **Project Setup (Onboarding)** — Flujo de configuración inicial del proyecto y agente IA. Si no existe un proyecto, el usuario es redirigido al setup antes de acceder al dashboard.
- **Dashboard principal** — Vista con métricas de conversaciones, gráficos de volumen y distribución por canal, y actividad reciente.
- **Messaging (Centro de mensajes)** — Vista completa de mensajería en tiempo real con lista de conversaciones, panel de chat, envío de mensajes como agente humano, y conexión WebSocket para actualizaciones en vivo.
- **Contactos** — Gestión completa de contactos con búsqueda, filtros, paginación, y acciones de editar/archivar/restaurar.
- **Brain (Base de conocimiento)** — Interfaz para subir documentos (PDF, TXT, CSV) y texto manual a la base de conocimiento RAG. Lista de fuentes indexadas con estado (Processing, Indexed, Failed).
- **Agents** — Gestión de agentes IA con selección de modelo, configuración de prompts, temperatura y tokens, y canales habilitados. Los modelos se cargan dinámicamente desde el backend.
- **Settings** — Configuración global del proyecto: canales habilitados, mensajes de bienvenida/despedida, y opciones. Datos cargados y guardados desde/hacia la base de datos.
- **Profile** — Vista de perfil del usuario autenticado (separada de Settings) con edición de nombre, email y contraseña.
- **Users** — Gestión de usuarios del sistema con CRUD completo conectado al backend: crear, editar, cambiar roles, activar/desactivar usuarios.
- **Test Chat** — Vista de pruebas para simular conversaciones y probar la respuesta del bot.
- **Services Layer** — Capa de servicios en el frontend (`auth`, `brain`, `contact`, `dashboard`, `messaging`, `project`, `settings`, `socket`, `user`) que abstrae todas las llamadas HTTP y WebSocket al backend.
- **Navigation Guard** — Protección de rutas: verificación de autenticación, verificación de proyecto configurado, y redirección automática según el estado del usuario.

#### API Endpoints

| Módulo | Endpoints | Descripción |
|:-------|:----------|:------------|
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password` | Autenticación y perfil |
| **Users** | `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id` | Gestión de usuarios |
| **Contacts** | `GET /api/contacts`, `GET /api/contacts/:id`, `PUT /api/contacts/:id`, `PATCH /api/contacts/:id/archive`, `PATCH /api/contacts/:id/restore` | Gestión de contactos |
| **Conversations** | `GET /api/conversations`, `GET /api/conversations/:id`, `GET /api/conversations/:id/messages`, `POST /api/conversations/:id/messages`, `PATCH /api/conversations/:id/mode`, `PATCH /api/conversations/:id/status` | Mensajería |
| **Brain** | `GET /api/brain/sources`, `POST /api/brain/upload`, `POST /api/brain/text`, `DELETE /api/brain/sources/:id`, `POST /api/brain/search` | Base de conocimiento RAG |
| **Agents** | `GET /api/agents`, `POST /api/agents`, `PUT /api/agents/:id`, `DELETE /api/agents/:id` | Agentes IA |
| **AI Models** | `GET /api/ai-models`, `POST /api/ai-models`, `PUT /api/ai-models/:id`, `DELETE /api/ai-models/:id` | Modelos de IA |
| **Config** | `GET /api/config`, `PUT /api/config` | Configuración global |
| **Project** | `GET /api/project`, `GET /api/project/check`, `POST /api/project`, `PUT /api/project/:id` | Gestión de proyecto |
| **Dashboard** | `GET /api/dashboard/stats`, `GET /api/dashboard/volume`, `GET /api/dashboard/channels`, `GET /api/dashboard/activity` | Analytics |

#### Modelos de Datos (MongoDB)

| Colección | Campos Clave |
|:----------|:-------------|
| `users` | name, email, password (hash), role, status, avatar |
| `contacts` | name, phone, email, platform, status, tags, metadata |
| `conversations` | contactId, platform, status, mode, clientInfo, unreadCount |
| `messages` | conversationId, sender, content, contentType, isBot |
| `agents` | name, modelId, systemPrompt, config |
| `ai_models` | name, value, provider, category, isActive |
| `projects` | name, agentId, config (channels, messages, options) |
| `knowledge_sources` | name, type, size, status, vectorCount, filePath |
| `config` | key, value (key-value store dinámico) |
| `activities` | type, description, createdAt |

#### Stack Tecnológico

| Capa | Tecnologías |
|:-----|:------------|
| **Runtime** | TypeScript, tsx (desarrollo) |
| **Backend** | Express 4, Socket.io, Multer, Zod |
| **Frontend** | Vue 3, Vite, Tailwind CSS 3, Pinia, Vue Router 4 |
| **Base de datos** | MongoDB 6 (principal), Redis (cache), Qdrant (vectorial) |
| **IA** | Ollama, LangChain.js, nomic-embed-text (embeddings) |
| **Mensajería** | NATS (event bus), Socket.io (tiempo real) |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Infraestructura** | Docker Compose, pnpm workspaces |

---
