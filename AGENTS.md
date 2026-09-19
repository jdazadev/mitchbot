# 🤖 MitchBot v2 — Guía del Proyecto

> **SaaS de Chatbot con IA y RAG** — Plataforma multi-canal para automatizar conversaciones con inteligencia artificial y base de conocimiento.

---

## Reglas para el Agente de IA

- Cada vez que termines unos cambios, actualiza el `changelog.md` (usa la fecha actual) y este archivo `AGENTS.md`.
- También actualiza la versión dependiendo del tipo de cambio (semver).
- **Al terminar de implementar un cambio de OpenSpec, realiza el commit correspondiente** (sin esperar a que se lo pidan).
- Cuando termines cualquier implementación, descríbelo siempre **en español**.
- Sigue la convención de commits y changelog de [Keep a Changelog](https://keepachangelog.com/).

**Versión actual del proyecto:** v3.6.0

---

## Arquitectura del Proyecto

### Estructura del Monorepo

```
mitchbot_v2/
├── apps/
│   ├── backend/          # API REST + WebSocket (Express + TypeScript)
│   └── frontend/         # Dashboard SPA (Vue 3 + TypeScript + Tailwind)
├── packages/
│   └── shared/           # Tipos y utilidades compartidas
├── docker-compose.yml    # Servicios: MongoDB, Redis, Qdrant
├── pnpm-workspace.yaml   # Configuración del monorepo pnpm
├── AGENTS.md             # Este archivo
└── changelog.md          # Historial de cambios detallado
```

### Stack Tecnológico

| Capa | Tecnologías |
|:-----|:------------|
| **Runtime** | Node.js, TypeScript, tsx (desarrollo) |
| **Backend** | Express 4, Socket.io, Multer, Zod v4, JWT |
| **Frontend** | Vue 3 (Composition API + `<script setup>`), Vite, Tailwind CSS 3, Pinia, Vue Router 4, Radix Vue, Lucide Icons |
| **Base de datos** | MongoDB 8 (principal), Redis (caché y colas BullMQ), Qdrant (vectorial) |
| **IA / LLM** | LangChain.js v1.x (`@langchain/core`, `@langchain/openai`, `@langchain/qdrant`, `@langchain/textsplitters`) |
| **Proveedores IA** | OpenRouter (único proveedor: LLM, embeddings y OCR) |
| **Embeddings** | OpenRouter (`openai/text-embedding-3-small` por defecto) |
| **Mensajería** | Socket.io (tiempo real) |
| **Auth** | JWT (jsonwebtoken), bcryptjs (12 rounds) |
| **Infraestructura** | Docker Compose, pnpm workspaces |

---

## Servicios Docker

```yaml
# docker-compose.yml
mongodb:    → puerto 27017  # Base de datos principal (mongo:8)
redis:      → puerto 6379   # Caché y colas BullMQ (AOF)
qdrant:     → puerto 6333   # Base de datos vectorial (RAG)
```

> Nativo: los 3 servicios tienen `healthcheck`. `ollama`, `open-webui` y `nats` se eliminaron (sin uso tras el refactor a OpenRouter). Se reintroducirá un message broker cuando llegue la fase de Integración Social.

---

## Estructura del Backend

```
apps/backend/src/
├── index.ts                        # Entry point + bootstrap del servidor
├── config/
│   ├── database.ts                 # Conexión MongoDB
│   ├── redis.ts                    # Conexión Redis
│   ├── qdrant.ts                   # Conexión Qdrant
│   └── env.ts                      # Variables de entorno (validadas con Zod)
├── controllers/
│   ├── agents.controller.ts        # CRUD de agentes IA
│   ├── ai-models.controller.ts     # Gestión de modelos y proveedores
│   ├── auth.controller.ts          # Login, registro, perfil
│   ├── brain.controller.ts         # Upload y gestión de fuentes RAG
│   ├── config.controller.ts        # Configuración global key-value
│   ├── contacts.controller.ts      # CRUD de contactos
│   ├── dashboard.controller.ts     # Analytics y estadísticas
│   ├── messaging.controller.ts     # Conversaciones y mensajes
│   ├── project.controller.ts       # Gestión de proyecto
│   ├── public-chat.controller.ts   # Chat público (clientes externos)
│   └── users.controller.ts         # CRUD de usuarios del sistema
├── services/
│   ├── ai.service.ts               # Orquestación de IA (abstracción)
│   ├── llm-provider.service.ts     # EL ENRUTADOR — Factory de modelos
│   ├── chat.service.ts             # Lógica de chat + auto-respuesta bot
│   ├── rag.service.ts              # Motor RAG (embeddings + búsqueda vectorial)
│   ├── agent.service.ts            # Gestión de agentes IA
│   ├── ai-model.service.ts         # Resolución de modelos y config de proveedor (OpenRouter)
│   ├── contact.service.ts          # Lógica de contactos
│   ├── project.service.ts          # Lógica de proyectos
│   ├── project-context.service.ts  # Contexto activo del proyecto
│   ├── config.service.ts           # Configuración global
│   ├── analytics.service.ts        # Métricas y estadísticas
│   ├── insights.service.ts         # Análisis de sentimiento/resumen (AI Insights)
│   ├── auth.service.ts             # Autenticación JWT + bcrypt
│   └── user.service.ts             # Gestión de usuarios
├── models/                         # Schemas MongoDB (10 colecciones)
├── routes/                         # Definición de rutas Express
├── middleware/                     # Auth, validación Zod, errores, upload
├── websocket/                      # Socket.io handlers
├── scripts/                        # Seed y utilidades
├── utils/                          # Logger, helpers
└── types/                          # Tipos TypeScript compartidos
```

### Estructura del Frontend

```
apps/frontend/src/
├── App.vue                         # Root component
├── main.ts                         # Entry point
├── style.css                       # Estilos globales + Tailwind
├── views/
│   ├── Login.vue                   # Autenticación
│   ├── ProjectSetup.vue            # Onboarding (3 pasos)
│   ├── Dashboard.vue               # Métricas y analytics
│   ├── Messaging.vue               # Centro de mensajería en tiempo real
│   ├── Contacts.vue                # Gestión de contactos
│   ├── Brain.vue                   # Base de conocimiento RAG
│   ├── DevTests.vue                # Herramientas internas de prueba (ruta /dev/tests)
│   ├── Agents.vue                  # Configuración de agentes IA
│   ├── Settings.vue                # Configuración global (proveedores, canales, etc.)
│   ├── Users.vue                   # Gestión de usuarios del sistema
│   ├── Profile.vue                 # Perfil del usuario autenticado
│   └── TestChat.vue                # Simulador de chat para pruebas
├── services/                       # Capa de servicios HTTP + WebSocket
├── composables/                    # Estado compartido (useConversations)
├── components/layout/              # Sidebar, Topbar, DashboardLayout
├── router/                         # Vue Router + navigation guards
└── lib/                            # Utilidades (cn, etc.)
```

---

## Lógica de Negocio

### 1. Módulo de Mensajería

- **No se puede iniciar una conversación manualmente** — La conversación la inicia el cliente (desde WhatsApp, Instagram o Web).
- Una vez creada la conversación, el agente humano puede enviar mensajes al cliente.
- Al contestar el **primer mensaje** del cliente, se crea automáticamente el contacto (si la opción está habilitada).
- Se guarda el historial completo de conversaciones y mensajes.
- Solo un usuario con rol **admin** puede eliminar chats.
- Si el bot/agente falla al responder un mensaje, se debe:
  - Mostrar el error como mensaje visible en el chat.
  - Registrar el error en el log/historial de mensajería.
- Existe la opción de ver el historial completo de mensajería desde el módulo.
- **Modos de operación**: `auto_pilot` (bot responde automáticamente) y `human_takeover` (agente humano toma control). El cambio de modo/estado se propaga en vivo por WebSocket (`chat:status`) y el dashboard y la vista del cliente lo reflejan sin recargar.
- **Memoria de conversación**: el LLM recibe el historial reciente (últimos 20 mensajes) al generar una respuesta (directa o tras ejecutar herramientas). Los turnos del cliente y del agente humano se representan como `HumanMessage` (el humano con prefijo `[Agente humano]`) y los del bot como `AIMessage`; se excluyen los mensajes internos de herramientas (`tool_call`, `tool_result`, `confirmation_request`) y los placeholders vacíos. Si la pausa respecto al mensaje anterior supera las 6 horas, se inserta un marcador en el historial para que el bot re-salude.
- **Saludo y despedida naturales**: no se anteponen textos enlatados; el saludo/despedida los decide el LLM a partir del historial. Sin historial de por medio el bot saluda al inicio; en una reanudación tras pausa larga re-saluda. "Gracias" y variantes ya **no** cierran la conversación. Al detectar una despedida real, el bot responde con naturalidad y, tras generarla, la conversación se marca como `closed` (se emite `chat:status`) — sin mensaje enlatado ni corte previo.
- **Streaming de respuestas**: Las respuestas del bot se transmiten token por token en tiempo real vía WebSockets.
- **Renderizado Markdown**: Los mensajes del bot soportan negritas e itálicas en tiempo real.
- **Filtros y búsqueda**: los chips de canal se generan desde `project.config.channels` (solo los habilitados + "Todos"); el filtrado por plataforma y la búsqueda por nombre/último mensaje son en cliente. Los mensajes se agrupan por día con encabezados reales.
- **Toma de control manual bidireccional**: "Take Over" pasa a `human_takeover` y "Auto-Pilot" devuelve a `auto_pilot` vía `PUT /api/conversations/:id/mode`; el badge se actualiza en vivo con `chat:status` y el bot no responde mientras dure el takeover.
- **Guardar como contacto**: acción explícita `POST /api/conversations/:id/contact` respaldada por `ensureContactCreated(id, { force: true })`; es idempotente y funciona aunque `autoCreateContact` esté deshabilitado.
- **No leídos reales**: el badge del sidebar suma los `unreadCount` del proyecto activo mediante el composable `useConversations` (estado de módulo compartido) y se incrementa en vivo con `chat:message` / `chat:new_conversation`.
- **Compositor honesto**: solo expone acciones funcionales (enviar, tomar control); se retiraron chips de sugerencia, emoji, adjuntos, menú y el indicador "online" simulado.
- **AI Insights**: análisis de sentimiento/resumen persistido en `conversation.aiInsights`. `GET /:id/insights` lee lo almacenado y `POST /:id/insights` recalcula; se emite `chat:insights`. El análisis automático corre fire-and-forget tras cada respuesta del bot (un fallo no afecta la respuesta). El modelo se resuelve desde `OPENROUTER_INSIGHTS_MODEL` con fallback a `OPENROUTER_LLM_MODEL`.

### 2. Módulo de Contactos

- Se puede editar, buscar, filtrar, ordenar y paginar contactos.
- El contacto es un perfil con todos los datos del cliente (nombre, email, teléfono, plataforma, tags, metadata).
- **No se puede crear un contacto arbitrario** — Se crea automáticamente al contestar el primer mensaje del cliente, o de forma explícita desde una conversación ("Guardar como contacto", idempotente).
- **No se puede eliminar un contacto** — Solo se puede archivar (soft delete) y restaurar.
- Búsqueda por nombre, email y teléfono.
- Filtros por plataforma (`WhatsApp`, `Instagram`, `Web`) y estado (`Active`, `New`, `Inactive`).

### 3. Módulo Cerebro/RAG

- El modelo de embeddings utilizado es el que está seleccionado en la configuración de proveedores.
- Se guarda el historial de fuentes de conocimiento procesadas.
- Se puede subir solo archivos **PDF**, **TXT**, **CSV** e **imágenes**.
- Se procesa el archivo: **OCR unificado** (ver 3.2) → **chunking semántico** → embeddings → indexación en Qdrant.
- Payload enriquecido en Qdrant: `document_id`, `chunk_id`, `text`, `category`, `tags`, `author`, `access_level`, `created_at`, `language`, `page_number`, `section_heading`.
- Indices de payload configurables desde BD (`rag.qdrant_payload_indexes`).
- Existe una opción para escribir texto manualmente y subirlo como fuente de conocimiento.
- **Timeout de 5s** en las consultas a Qdrant para evitar bloqueos.
- **Búsqueda re-rankeada**: recupera top 10 por similitud y re-rankea a top 3 (`rag.use_reranker`, `rag.reranker_top_k`, `rag.reranker_final_k`).
- **Context Truncation**: Máximo 2 documentos relevantes, truncados a 1000 caracteres, para optimizar TTFT.
- Si el RAG falla, el bot continúa sin contexto (graceful degradation).

#### 3.1. Chunking semántico (`utils/chunking.ts`)

- Divide por encabezados Markdown (h1-h3) y antepone `Document: {title} | Section: {heading}` a cada chunk.
- Las **tablas** se conservan como un único chunk (`is_table`).
- Tamaño de chunk: **800 tokens** (≈ 4 chars/token), overlap de **100 tokens**.
- Registra `page_number`, `section_heading` y `language` (`en`, `es`, `mixed`) en la metadata.
- La detección de idioma es heurística por stop words (sin llamadas externas).

### 3.2. Pipeline OCR unificado (`services/ocr.service.ts`)

- **Todos los PDFs** se convierten a imágenes (`pdf-to-img`, escala 2) y pasan por OCR.
- Proveedor único: `openrouter` (modelos de visión).
- Cadena de fallback: **OpenRouter → pdf-parse (legacy)**.
- Salida estructurada: `{ text, pages, method, confidence }`. `method` ∈ `ocr_vision` | `pdf-parse`.
- Configuración vía `configService`: `rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size`, `rag.ocr_timeout_ms`.
- Estadísticas por fuente: `extractionTimeMs`, `extractionConfidence`, `pagesProcessed`, `ocrProvider`, `ocrModel`.
- La credencial se toma de `OPENROUTER_API_KEY` y el modelo de `OPENROUTER_OCR_MODEL` (entorno); no hay override en BD.

### 3.3. Re-ranking (`services/reranker.service.ts`)

- Re-ranking con embeddings de OpenRouter (`OPENROUTER_RERANKER_MODEL`, con fallback a `OPENROUTER_EMBEDDING_MODEL`).
- Si no hay credencial o el modelo falla, usa una heurística (keyword + bigramas con prefijos) y, ante error, degrada a similarity-only.
- Desactivable con `rag.use_reranker = false`.
- Endpoint Qdrant configurado con HNSW `m:16`, `ef_construct:100`, `ef:64`, `on_disk` e índices `language`/`document_id`.

### 3.4. Reindexado en background

- Cola BullMQ `rag-reindex` (worker `queues/rag-reindex.worker.ts`) con progreso por fuente (stage `reindexing`).
- Rollback de vectores parciales si una fuente falla.
- Script: `pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`.

### 3.1. Herramientas internas — Pruebas

- Expuestas en la ruta aislada **`/dev/tests`**, accesible solo escribiendo la URL y sin entrada en el menú lateral.
- Requieren autenticación (no dependen del rol `devadmin`).
- Subitem **Extraer texto** para probar modelos tipo file con archivos.
- No indexa ni guarda en base de conocimiento (solo extraccion).

### 4. Módulo Configuración

- Opción para habilitar/deshabilitar el bot en WhatsApp, Instagram o Web.
- Opción para configurar el **mensaje de bienvenida**.
- Opción para configurar el **mensaje de despedida**.
- Opción para configurar la **personalidad del bot** (system prompt).
- Opción para habilitar/deshabilitar la creación automática de contactos.
- Configurar el agente asignado al proyecto.
- Los modelos de IA (chat, embeddings y OCR) ya no se configuran desde la interfaz: se muestran en modo solo lectura y provienen del entorno.

#### 4.1. Proveedores de Embeddings

- Proveedor único: **OpenRouter**.
- El modelo se define exclusivamente en `OPENROUTER_EMBEDDING_MODEL`; se ignoran `provider_configs.selectedModel`.
- La credencial proviene de `OPENROUTER_API_KEY` (entorno).
- ⚠️ Cambiar `OPENROUTER_EMBEDDING_MODEL` invalida los vectores existentes: hay que reindexar (`pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`).

#### 4.2. Proveedores LLM

- Proveedor único: **OpenRouter**.
- El modelo de chat se define exclusivamente en `OPENROUTER_LLM_MODEL` (requerido, sin valor por defecto); se ignora `agent.modelValue`.
- La API key proviene de `OPENROUTER_API_KEY` (entorno), **nunca de la base de datos**.
- Solo 1 proveedor activo (OpenRouter) por tipo.

#### 4.3. Agentes / Modelo de IA

- La interfaz **no ofrece selección de modelo**: ni en el onboarding, ni en Agentes, ni en Configuración.
- El modelo usado es el de `OPENROUTER_LLM_MODEL`; los campos `modelId`/`modelValue` del agente quedan ignorados en runtime.
- Configuración muestra una tarjeta de solo lectura con los modelos de chat, embeddings y OCR resueltos del servidor.

### 4.5. Agent Tool Use (Function Calling)

Ver sección **9. Sistema de Herramientas (Tool Use)** más abajo.

### 4.6. Proveedores OCR

- Proveedor único: **OpenRouter** (modelos de visión, tipo de proveedor `ocr`).
- El modelo se define en `OPENROUTER_OCR_MODEL`; los parámetros (`scale`, `maxPages`, `batchSize`, `timeout`) se configuran vía `configService` (`rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size`, `rag.ocr_timeout_ms`).
- La credencial proviene de `OPENROUTER_API_KEY` (entorno).

### 5. Módulo Usuarios del Sistema

- CRUD completo: crear, editar, buscar, filtrar, ordenar y paginar usuarios.
- Roles disponibles: **admin**, **support** y **assistant**.
- El usuario tiene un espacio para editar sus datos y configuraciones (vista Profile).
- El primer usuario registrado se convierte automáticamente en **admin**.

### 6. Módulo Login

- Inicio de sesión con correo y contraseña (JWT con expiración de 24h).
- **Esta app solo permite iniciar sesión**: el registro de usuarios ocurre en otro sitio (el endpoint `POST /auth/register` existe para el seed/e2e).
- Si el servidor rechaza la sesión (`401/403`, token inválido o cuenta desactivada), se limpia la sesión local y se redirige silenciosamente al **login**.
- Passwords hasheados con bcrypt (12 rounds).

### 7. Seguridad

- Autenticación vía JWT en cada request protegido.
- Middleware de autorización por roles (`admin`, `support`, `assistant`).
- API keys de proveedores **no** se almacenan en la BD: provienen de variables de entorno.
- Variables de entorno validadas con Zod al arrancar el servidor.

### 9. Sistema de Herramientas (Tool Use)

El agente puede ejecutar acciones ("tools") además de responder.

- **Registro** (`src/tools/`): cada herramienta implementa `Tool` con `name`, `description`, `parameters` (JSON Schema), `execute(params, context)` y `requiresConfirmation`.
- **Ejecutor** (`services/tool.service.ts`): esquemas OpenAI-compatible, detección de tool calls en texto libre (`{"tool","parameters"}`) y ejecución normalizada.
- **Integración LLM** (`ai.service.generateResponseStreamWithTools`): tool calling nativo (`bindTools`) para **OpenRouter**.
- **Flujo de chat** (`chat.service.handleToolCalls`): detecta tool calls → si requiere confirmación guarda en `tool_executions` y emite un mensaje `confirmation_request` → al confirmar ejecuta y genera la respuesta final con el resultado. La respuesta final recibe el historial de la conversación (los `tool_call`/`tool_result` quedan excluidos del prompt).
- **Confirmaciones** vía WebSocket `tool:confirm` (`confirm` / `cancel` / `modify`) y evento `tool:confirmed`. Interfaz en **Messaging** y **TestChat**.
- **Visibilidad por audiencia**: el dashboard (**Messaging**) muestra todas las tarjetas de herramientas; la vista del cliente (**TestChat**) oculta `tool_call`/`tool_result` y solo conserva `confirmation_request` con sus acciones. Ante el fallo de una herramienta el cliente recibe un mensaje genérico, nunca el detalle técnico.

Herramientas incluidas (zero-config): `create_appointment`, `create_order`, `get_product_info`, `get_business_hours`, `get_service_availability`, `transfer_to_human`, `send_notification`, `get_faq_answer`.

Config del negocio usada por las tools: `business.hours`, `business.services`, `business.timezone`, `business.slot_minutes`, `business.currency`.

Tipos de mensaje nuevos: `sender: 'tool'`, `contentType: 'tool_call' | 'tool_result' | 'confirmation_request'` y campo `toolData`.

### 10. Modelo Multi-Proyecto

Cada usuario pertenece a uno o más proyectos y tiene un proyecto activo.

- **Pertenencia**: `users.projectIds: ObjectId[]` y `users.activeProjectId: ObjectId`.
- **Resolución por request** (`middleware/auth.middleware.ts`): usa el header `X-Project-Id` (valida pertenencia; **403** si es ajeno) o, en su defecto, el `activeProjectId` del usuario. El `projectId` resuelto se adjunta a `req.projectId`.
- **Frontend**: `authService.getHeaders()` envía `X-Project-Id` con el proyecto activo; `Topbar.vue` permite cambiar de proyecto (`PUT /api/project/active`) y crear uno nuevo (navega a `/setup?mode=new`); al cambiar, se reconecta el socket.
- **Onboarding**: `GET /api/project/check` responde según los proyectos del usuario (no de la existencia global). El guard del router y la validación interna de `ProjectSetup.vue` consultan al servidor; ya no usan `localStorage` como fuente de verdad. Un `401/403` limpia la sesión y vuelve al login.
- **Creación de proyecto**: cualquier usuario autenticado puede crear (`POST /api/project`); el creador queda como miembro y su proyecto pasa a activo.
- **Agente por proyecto**: `agents.projectId` + `agentService.getActiveAgent(projectId)`. La conversación determina el proyecto y con él el agente.
- **Aislamiento**: conversaciones, contactos, fuentes RAG, agentes y configuración de proveedores se filtran por `projectId`. Los eventos de socket se emiten por room `project:<id>` (`emitToProject`).
- **Migración**: `pnpm --filter @mitchbot/backend tsx src/scripts/migrate-multi-project.ts` asigna el proyecto actual a usuarios/agentes existentes.

---

## Arquitectura de las Funciones del Chatbot

```
┌──────────────────┐
│   Cliente        │  Mensaje entrante (WebSocket/API)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  chat.service    │  Recibe el mensaje + busca contexto RAG
│  (Orquestador)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ai.service      │  Construye: SystemPrompt + Contexto RAG + Historial
│  (Abstracción)   │  ⚠️ NO sabe qué modelo usa
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  llm-provider.service        │  EL ENRUTADOR
│  (Factory / Router)          │  Proveedor único: OpenRouter
│                              │   • OpenRouter → ChatOpenAI (baseURL custom)
└──────────────────────────────┘
```

- **Capa de Abstracción**: El chatbot no sabe qué modelo está usando. Solo envía una lista de mensajes a una función intermediaria.
- **El Enrutador** (`llm-provider.service.ts`): Recibe la petición (proveedor fijo OpenRouter) y devuelve el `BaseChatModel` instanciado; rechaza cualquier otro proveedor.
- **Manejo de Errores**: Si el modelo falla, el chatbot envía un mensaje de error claro en el chat y registra el error en el historial. Timeout general de **60s** para evitar LLMs "zombie".
- **Streaming**: Las respuestas se transmiten token por token usando `generateResponseStream` con `.stream()`.
- **RAG integrado**: Antes de generar la respuesta, se busca contexto relevante en la base de conocimiento.

---

## Flujo de Autenticación y Onboarding

```
Usuario abre la app
    │
    ├── ¿Tiene token local válido?
    │   ├── NO → Redirige a /login
    │   └── SÍ → GET /project/check (fuente de verdad: el servidor)
    │              ├── 401/403 → limpia sesión → /login (silencioso)
    │              ├── NO tiene proyecto → Redirige a /setup (onboarding 3 pasos)
    │              │         1. Datos del Proyecto (nombre, descripción)
    │              │         2. Configurar Agente IA (rol, mensajes)
    │              │         3. Canales y Opciones → Crear todo → Dashboard
    │              └── SÍ tiene proyecto → Dashboard ✅
```

> El setup valida **internamente** al montarse: si el usuario ya tiene proyecto y no llega con `?mode=new`, redirige al dashboard. El botón "Crear nuevo proyecto" del Topbar usa `?mode=new` para abrir el wizard y permitir proyectos adicionales.

### Flujo de Usuario Nuevo

1. Se registra en **otro sitio** (fuera de esta app) o vía seed.
2. Inicia sesión → se verifica contra el servidor que no tiene proyecto.
3. Se redirige al **setup** → crea un proyecto con su agente IA.
4. Entra al **dashboard**.

---

## API Endpoints

| Módulo | Endpoints | Descripción |
|:-------|:----------|:------------|
| **Auth** | `POST /register`, `POST /login`, `GET /me`, `PUT /profile`, `PUT /password` | Autenticación y perfil |
| **Users** | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Gestión de usuarios |
| **Contacts** | `GET /`, `GET /:id`, `PUT /:id`, `PATCH /:id/archive`, `PATCH /:id/restore` | Gestión de contactos |
| **Conversations** | `GET /`, `GET /:id`, `GET /:id/messages`, `POST /:id/messages`, `PUT /:id/mode`, `PUT /:id/status`, `POST /:id/contact`, `GET /:id/insights`, `POST /:id/insights` | Mensajería, guardar contacto e insights |
| **Brain** | `GET /sources`, `POST /upload`, `POST /text`, `DELETE /sources/:id`, `POST /search` | Base de conocimiento RAG |
| **Agents** | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Agentes IA |
| **AI Models** | `GET /remote/openrouter`, `GET /providers/active/:type`, `GET /agent/models` | Listado de modelos (OpenRouter) y proveedor activo |
| **Config** | `GET /`, `PUT /` | Configuración global |
| **Project** | `GET /`, `GET /check`, `GET /list`, `PUT /active`, `POST /`, `PUT /` | Gestión de proyectos (multi-proyecto por usuario) |
| **Appointments** | `GET /`, `GET /:id`, `PATCH /:id/status` | Citas agendadas por el agente |
| **Orders** | `GET /`, `GET /:id`, `PATCH /:id/status` | Pedidos creados por el agente |
| **Dashboard** | `GET /stats`, `GET /volume`, `GET /channels`, `GET /activity` | Analytics |
| **Public Chat** | Rutas para chat público (clientes web) | Chat embebible |

> Todos los endpoints están bajo el prefijo `/api/<módulo>`.

---

## Modelos de Datos (MongoDB)

| Colección | Campos Clave | Notas |
|:----------|:-------------|:------|
| `users` | name, email, password (hash), role, status, avatar, projectIds, activeProjectId | Roles: admin, support, assistant. Pertenencia multi-proyecto |
| `contacts` | projectId, name, phone, email, platform, status, tags, metadata | Aislado por proyecto. Soft delete (archivar) |
| `conversations` | contactId, platform, status, mode, clientInfo, unreadCount, aiInsights | Modos: auto_pilot, human_takeover. `aiInsights`: sentiment, sentimentScores, summary |
| `messages` | conversationId, sender, content, contentType, isBot, toolData | Sender: contact, ai_agent, human_agent, tool. contentType: text, tool_call, tool_result, confirmation_request |
| `agents` | projectId, name, modelId, personality (role, traits, emojiUsage, language, responseLength, ragBehavior, fallbackMessage), config | 1 agente activo por proyecto |
| `ai_models` | name, value, provider, category, isActive | Catálogo de modelos (los disponibles se listan dinámicamente desde OpenRouter) |
| `provider_configs` | type (llm/embedding/file/image/audio/ocr), provider, selectedModel, isActive | Sin credenciales: la API key proviene del entorno. `selectedModel` ya no se usa para resolver llm/embedding/file/ocr |
| `projects` | name, agentId, config (channels, messages, options) | Solo 1 proyecto activo |
| `knowledge_sources` | name, type, size, status, vectorCount, filePath, extractionMethod, ocrProvider, extractionTimeMs | Status: Queued, Processing, Indexed, Failed |
| `appointments` | date, time, service, contactId, conversationId, status | Estados: pending, confirmed, completed, cancelled |
| `orders` | items, total, currency, contactId, conversationId, status | Estados: pending, confirmed, completed, cancelled |
| `tool_executions` | conversationId, toolName, params, result, status, messageId | Estados: pending_confirmation, executed, failed, cancelled |
| `config` | key, value | Key-value store dinámico |
| `activities` | type, description, createdAt | Log de eventos |

---

## WebSocket Events (Socket.io)

### 🔒 Seguridad WebSocket (v1.16.0)

Todas las conexiones WebSocket requieren autenticación JWT:
- **Dashboard**: Token JWT enviado en `socket.handshake.auth.token` y proyecto en `socket.handshake.auth.projectId` (validando pertenencia)
- **Chat Público (`test-chat`)**: Slug del proyecto enviado en `socket.handshake.query.slug`
- **Aislamiento por proyecto**: cada socket autenticado entra en la room `project:<id>`; `join:room` valida que la conversación pertenezca a su proyecto
- **Rate Limiting**: 30 mensajes/min y 10 joins/min por usuario (Redis)
- **CORS**: Restringido a `FRONTEND_URL` en producción

### Eventos

| Evento | Dirección | Descripción |
|:-------|:----------|:------------|
| `chat:message` | Server → Client | Nuevo mensaje recibido |
| `chat:message_chunk` | Server → Client | Token de streaming (respuesta parcial) |
| `chat:send` | Client → Server | Enviar mensaje desde el dashboard |
| `chat:typing` | Bidireccional | Indicador de "escribiendo..." |
| `chat:status` | Server → Client | Cambio de modo/estado de la conversación (lo consumen Messaging y TestChat sin recargar) |
| `chat:new_conversation` | Server → Client | Nueva conversación iniciada |
| `chat:message_updated` | Server → Client | Mensaje actualizado (estado de confirmación de tool) |
| `chat:insights` | Server → Client | Insights de la conversación recalculados (sentimiento/resumen) |
| `tool:confirm` | Client → Server | Confirmar / cancelar / modificar una ejecución de herramienta |
| `tool:confirmed` | Server → Client | Resultado de la confirmación de herramienta |
| `admin:notification` | Server → Client | Notificación de la tool `send_notification` |
| `join:room` | Client → Server | Unirse a room de conversación |
| `joined:room` | Server → Client | Confirmación de unión a room |
| `error` | Server → Client | Error de autenticación o autorización |

---

## Comandos de Desarrollo

```bash
# Levantar servicios Docker (MongoDB, Redis, Qdrant)
docker-compose up -d

# Instalar dependencias
pnpm install

# Backend (puerto 3000)
cd apps/backend && pnpm dev

# Frontend (puerto 5173)
cd apps/frontend && pnpm dev

# Seed de datos iniciales (usuario admin demo)
cd apps/backend && pnpm seed
# → admin@mitchbot.io / admin123
```

---

## Pruebas End-to-End (e2e)

Suite de Playwright en `tests/` que valida los flujos críticos contra un entorno aislado. **Requiere los servicios Docker** (`docker compose up -d`); Playwright arranca automáticamente el stub de IA (4010), el backend (3100) y el frontend (5174), y usa la base de datos `mitchbot_e2e`.

```bash
pnpm test:e2e            # suite completa
pnpm test:e2e messaging  # un módulo (filtra por nombre de archivo/título)
pnpm test:e2e:ui         # modo UI interactivo
pnpm test:e2e:headed     # navegador visible
pnpm test:e2e:ci         # corrida tipo CI (headless, workers=1, retries)
pnpm test:e2e:report     # ver el reporte HTML

pnpm stub:e2e            # levanta solo el stub de IA (puerto 4010)
pnpm seed:e2e            # siembra usuario/proyecto/agente/proveedores e2e
```

- **Estructura**: `tests/stub/openai-stub.mjs` (stub OpenAI-compatible) y `tests/e2e/` (setup de auth, fixtures, helpers y specs por módulo). Ver `tests/e2e/README.md`.
- **Autenticación reutilizable**: el project `setup` hace login una vez y persiste `storageState` (`tests/e2e/.auth/user.json`, ignorado por git). Los specs públicos (login, onboarding, chat público) corren sin sesión.
- **Determinismo del proveedor**: el backend apunta a `OPENROUTER_BASE_URL` = stub local, con `OPENROUTER_API_KEY` de prueba. El stub devuelve respuestas fijas, streaming SSE, tool calls (`create_appointment`) y embeddings deterministas. Las pruebas **no** invocan al proveedor real (`provider-guard.spec.ts` lo verifica).
- **Datos de prueba**: usuario `e2e@mitchbot.test` / `e2e12345`, proyecto `e2e-project`, agente `E2E Agent` (modelo `stub-model`). Cada prueba genera datos únicos y puede correr en paralelo.

---

## Variables de Entorno (Backend)

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mitchbot
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
JWT_SECRET=<tu-secreto>
FRONTEND_URL=http://localhost:5173
# Proveedor único de IA (OpenRouter)
OPENROUTER_API_KEY=<tu-api-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_LLM_MODEL=<modelo-de-chat-obligatorio>
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_OCR_MODEL=google/gemini-3.8-flash
OPENROUTER_FILE_MODEL=<opcional-conversion-csv>
OPENROUTER_RERANKER_MODEL=<opcional-fallback-embedding>
OPENROUTER_INSIGHTS_MODEL=<opcional-fallback-llm>
```

> ⚠️ `OPENROUTER_LLM_MODEL` es obligatorio (sin default): si falta, la generación falla con un mensaje que indica definirlo. `OPENROUTER_FILE_MODEL`, `OPENROUTER_RERANKER_MODEL` y `OPENROUTER_INSIGHTS_MODEL` son opcionales (el CSV se indexa crudo, el re-ranker usa el modelo de embeddings y los insights usan `OPENROUTER_LLM_MODEL`, respectivamente).
>
> ⚠️ Cambiar `OPENROUTER_EMBEDDING_MODEL` **invalida los vectores existentes** y requiere reindexar con `pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`.

> ⚠️ La API key de OpenRouter proviene **exclusivamente de variables de entorno** (`OPENROUTER_API_KEY`); nunca se almacena en la base de datos. Ver `apps/backend/.env.example`.

> ⚠️ El archivo `.env` real está excluido de control de versiones; solo se versiona `.env.example` con valores vacíos/placeholder.

---

## Pendientes / Roadmap

### Fase Actual — MVP Demo-Ready ✅
- [x] Chat web en tiempo real con streaming
- [x] Motor RAG (PDF, TXT, CSV)
- [x] Proveedor único OpenRouter (LLM, embeddings y OCR)
- [x] Dashboard con métricas
- [x] Gestión de contactos, usuarios y agentes
- [x] Onboarding / Setup de proyecto
- [x] Capa de abstracción IA + Enrutador

### Fase Siguiente — Integración Social 🔜
- [ ] WhatsApp Business API (webhooks + message broker)
- [ ] Instagram Messaging API
- [ ] Normalización de mensajes cross-platform
- [ ] Rate limiting por plataforma
- [ ] Sistema de retry y failover

### Mejoras Futuras 💡
- [ ] Chat widget embebible para sitios web de clientes
- [ ] Analytics avanzados (sentimiento, conversión, SLA)
- [ ] Multi-tenant / multi-proyecto
- [ ] Exportación de conversaciones
- [ ] Integración con CRM externos
- [ ] Notificaciones push
- [ ] Tests automatizados unitarios (la suite e2e ya está implementada)
