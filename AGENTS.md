# 🤖 MitchBot v2 — Guía del Proyecto

> **SaaS de Chatbot con IA y RAG** — Plataforma multi-canal para automatizar conversaciones con inteligencia artificial y base de conocimiento.

---

## Reglas para el Agente de IA

- Cada vez que termines unos cambios, actualiza el `changelog.md` (usa la fecha actual) y este archivo `AGENTS.md`.
- También actualiza la versión dependiendo del tipo de cambio (semver).
- Cuando termines cualquier implementación, descríbelo siempre **en español**.
- Sigue la convención de commits y changelog de [Keep a Changelog](https://keepachangelog.com/).

**Versión actual del proyecto:** v1.17.0

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
├── docker-compose.yml    # Servicios: MongoDB, Redis, Qdrant, Ollama, NATS
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
| **Base de datos** | MongoDB 6 (principal), Redis (caché), Qdrant (vectorial) |
| **IA / LLM** | LangChain.js v1.x (`@langchain/core`, `@langchain/ollama`, `@langchain/openai`, `@langchain/google-genai`, `@langchain/qdrant`, `@langchain/textsplitters`) |
| **Proveedores IA** | Ollama (local), OpenRouter (multi-modelo), Google Gemini |
| **Embeddings** | Ollama (`nomic-embed-text`), OpenRouter |
| **Mensajería** | NATS (event bus), Socket.io (tiempo real) |
| **Auth** | JWT (jsonwebtoken), bcryptjs (12 rounds) |
| **Infraestructura** | Docker Compose, pnpm workspaces |

---

## Servicios Docker

```yaml
# docker-compose.yml
mongodb:    → puerto 27017  # Base de datos principal
redis:      → puerto 6379   # Caché y sesiones
qdrant:     → puerto 6333   # Base de datos vectorial (RAG)
ollama:     → puerto 11434  # Servidor de modelos LLM locales
open-webui: → puerto 3200   # Interfaz web para Ollama (debug)
nats:       → puerto 4222   # Message broker (futuro social gateway)
```

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
│   ├── ai-model.service.ts         # Gestión de modelos y proveedores
│   ├── contact.service.ts          # Lógica de contactos
│   ├── project.service.ts          # Lógica de proyectos
│   ├── project-context.service.ts  # Contexto activo del proyecto
│   ├── config.service.ts           # Configuración global
│   ├── analytics.service.ts        # Métricas y estadísticas
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
│   ├── DevAdminModels.vue          # Configuracion DevAdmin de modelos y proveedores
│   ├── DevAdminTests.vue           # Modulo de pruebas DevAdmin
│   ├── Agents.vue                  # Configuración de agentes IA
│   ├── Settings.vue                # Configuración global (proveedores, canales, etc.)
│   ├── Users.vue                   # Gestión de usuarios del sistema
│   ├── Profile.vue                 # Perfil del usuario autenticado
│   └── TestChat.vue                # Simulador de chat para pruebas
├── services/                       # Capa de servicios HTTP + WebSocket
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
- **Modos de operación**: `auto_pilot` (bot responde automáticamente) y `human_takeover` (agente humano toma control).
- **Streaming de respuestas**: Las respuestas del bot se transmiten token por token en tiempo real vía WebSockets.
- **Renderizado Markdown**: Los mensajes del bot soportan negritas e itálicas en tiempo real.

### 2. Módulo de Contactos

- Se puede editar, buscar, filtrar, ordenar y paginar contactos.
- El contacto es un perfil con todos los datos del cliente (nombre, email, teléfono, plataforma, tags, metadata).
- **No se puede crear un contacto manualmente** — Solo se crea automáticamente al contestar el primer mensaje del cliente.
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
- Proveedores soportados: `ollama` (Qwen2.5-VL), `mistral` (Mistral OCR) y `openrouter` (modelos de visión).
- Cadena de fallback: **Ollama → Mistral → OpenRouter → pdf-parse (legacy)**.
- Salida estructurada: `{ text, pages, method, confidence }`. `method` ∈ `ocr` | `ocr_vision` | `pdf-parse`.
- Configuración vía `configService`: `rag.ocr_provider`, `rag.ocr_ollama_model`, `rag.ocr_mistral_model`, `rag.ocr_openrouter_model`, `rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size`, `rag.ocr_timeout_ms`.
- Estadísticas por fuente: `extractionTimeMs`, `extractionConfidence`, `pagesProcessed`, `ocrProvider`, `ocrModel`.
- Configurable desde **DevAdmin → Providers → pestaña OCR** (guardado en `provider_configs`, tipo `ocr`).

### 3.3. Re-ranking (`services/reranker.service.ts`)

- Re-ranking local con embeddings de Ollama (`rag.reranker_model`, por defecto `nomic-embed-text`).
- Si el modelo no está disponible, usa una heurística (keyword + bigramas con prefijos) y, ante error, degrada a similarity-only.
- Desactivable con `rag.use_reranker = false`.
- Endpoint Qdrant configurado con HNSW `m:16`, `ef_construct:100`, `ef:64`, `on_disk` e índices `language`/`document_id`.

### 3.4. Reindexado en background

- Cola BullMQ `rag-reindex` (worker `queues/rag-reindex.worker.ts`) con progreso por fuente (stage `reindexing`).
- Rollback de vectores parciales si una fuente falla.
- Script: `pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`.

### 3.1. Modulo DevAdmin — Pruebas

- Solo visible para rol **devadmin**.
- Subitem **Extraer texto** para probar modelos tipo file con archivos.
- No indexa ni guarda en base de conocimiento (solo extraccion).

### 4. Módulo Configuración

- Opción para habilitar/deshabilitar el bot en WhatsApp, Instagram o Web.
- Opción para configurar el **mensaje de bienvenida**.
- Opción para configurar el **mensaje de despedida**.
- Opción para configurar la **personalidad del bot** (system prompt).
- Opción para habilitar/deshabilitar la creación automática de contactos.
- Configurar el agente asignado al proyecto.
- Configurar el proveedor de embeddings.
- Configurar el proveedor de LLM.

#### 4.1. Proveedores de Embeddings

- Opciones disponibles: **Ollama** y **OpenRouter**.
- Para Ollama: consulta la API local (`/api/tags`) para listar modelos.
- Para OpenRouter: consulta la API remota y filtra por modelos de embedding.
- El modelo de embedding seleccionado se guarda en la BD y se usa globalmente en el módulo RAG.

#### 4.2. Proveedores LLM

- Opciones disponibles: **Ollama**, **OpenRouter** y **Gemini**.
- Para Ollama: consulta la API local (`/api/tags`).
- Para OpenRouter: consulta `GET /api/v1/models`.
- Para Gemini: consulta `generativelanguage.googleapis.com/v1/models`.
- Las API keys se gestionan desde la BD (no en variables de entorno).
- Solo 1 proveedor activo por tipo (LLM o Embedding) a la vez.

#### 4.3. Agentes / Modelo de IA

- Se consultan los proveedores configurados y se listan los modelos disponibles dinámicamente.
- Al seleccionar modelo, se abre un **modal con buscador y filtros** mostrando información relevante (nombre, tamaño, contexto, pricing).
- El modelo seleccionado se guarda en la BD y se usa para las respuestas del chatbot.

### 4.5. Agent Tool Use (Function Calling)

Ver sección **9. Sistema de Herramientas (Tool Use)** más abajo.

### 4.6. Proveedores OCR

- Opciones disponibles: **Ollama**, **Mistral** y **OpenRouter** (tipo de proveedor `ocr`).
- Se configura desde DevAdmin con selector de proveedor, modelo y parámetros (`scale`, `maxPages`, `batchSize`, `timeout`).
- Botón de test: `POST /api/ai-models/providers/test-ocr`.
- Solo 1 proveedor OCR activo a la vez.

### 5. Módulo Usuarios del Sistema

- CRUD completo: crear, editar, buscar, filtrar, ordenar y paginar usuarios.
- Roles disponibles: **devadmin**, **admin**, **support** y **assistant**.
- **`devadmin` es interno** y no se crea ni se asigna via API.
- El usuario tiene un espacio para editar sus datos y configuraciones (vista Profile).
- El primer usuario registrado se convierte automáticamente en **admin**.

### 6. Módulo Login

- Inicio de sesión con correo y contraseña (JWT con expiración de 24h).
- Registro de nuevo usuario.
- Passwords hasheados con bcrypt (12 rounds).

### 7. Seguridad

- Autenticación vía JWT en cada request protegido.
- Middleware de autorización por roles (`devadmin`, `admin`, `support`, `assistant`).
- API keys de proveedores almacenadas en la BD (enmascaradas al consultar).
- Variables de entorno validadas con Zod al arrancar el servidor.

### 9. Sistema de Herramientas (Tool Use)

El agente puede ejecutar acciones ("tools") además de responder.

- **Registro** (`src/tools/`): cada herramienta implementa `Tool` con `name`, `description`, `parameters` (JSON Schema), `execute(params, context)` y `requiresConfirmation`.
- **Ejecutor** (`services/tool.service.ts`): esquemas OpenAI-compatible, detección de tool calls en texto libre (`{"tool","parameters"}`) y ejecución normalizada.
- **Integración LLM** (`ai.service.generateResponseStreamWithTools`): tool calling nativo (`bindTools`) para **OpenRouter** y **Gemini**; para **Ollama** se inyecta la descripción de herramientas en el system prompt y se detecta el JSON de invocación.
- **Flujo de chat** (`chat.service.handleToolCalls`): detecta tool calls → si requiere confirmación guarda en `tool_executions` y emite un mensaje `confirmation_request` → al confirmar ejecuta y genera la respuesta final con el resultado.
- **Confirmaciones** vía WebSocket `tool:confirm` (`confirm` / `cancel` / `modify`) y evento `tool:confirmed`. Interfaz en **Messaging** y **TestChat**.

Herramientas incluidas (zero-config): `create_appointment`, `create_order`, `get_product_info`, `get_business_hours`, `get_service_availability`, `transfer_to_human`, `send_notification`, `get_faq_answer`.

Config del negocio usada por las tools: `business.hours`, `business.services`, `business.timezone`, `business.slot_minutes`, `business.currency`.

Tipos de mensaje nuevos: `sender: 'tool'`, `contentType: 'tool_call' | 'tool_result' | 'confirmation_request'` y campo `toolData`.

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
│  (Factory / Router)          │  Instancia el modelo según config BD:
│                              │   • Ollama  → ChatOllama
│                              │   • OpenRouter → ChatOpenAI (baseURL custom)
│                              │   • Gemini → ChatGoogleGenerativeAI
└──────────────────────────────┘
```

- **Capa de Abstracción**: El chatbot no sabe qué modelo está usando. Solo envía una lista de mensajes a una función intermediaria.
- **El Enrutador** (`llm-provider.service.ts`): Recibe la petición y la configuración del usuario (Ollama, OpenRouter o Gemini) y devuelve el `BaseChatModel` instanciado.
- **Manejo de Errores**: Si el modelo falla, el chatbot envía un mensaje de error claro en el chat y registra el error en el historial. Timeout general de **60s** para evitar LLMs "zombie".
- **Streaming**: Las respuestas se transmiten token por token usando `generateResponseStream` con `.stream()`.
- **RAG integrado**: Antes de generar la respuesta, se busca contexto relevante en la base de conocimiento.

---

## Flujo de Autenticación y Onboarding

```
Usuario abre la app
    │
    ├── ¿Tiene token válido? 
    │   ├── NO → Redirige a /login
    │   └── SÍ → ¿Tiene proyecto configurado?
    │              ├── NO → Redirige a /setup (onboarding 3 pasos)
    │              │         1. Datos del Proyecto (nombre, descripción, foto)
    │              │         2. Configurar Agente IA (modelo, system prompt)
    │              │         3. Canales y Opciones → Crear todo → Dashboard
    │              └── SÍ → Dashboard ✅
```

### Flujo de Usuario Nuevo

1. Entra al login → se registra (automáticamente se le asigna el rol **admin**).
2. Inicia sesión → se verifica que no tiene proyecto.
3. Se redirige al **setup** → crea un proyecto con su agente IA.
4. Entra al **dashboard**.

---

## API Endpoints

| Módulo | Endpoints | Descripción |
|:-------|:----------|:------------|
| **Auth** | `POST /register`, `POST /login`, `GET /me`, `PUT /profile`, `PUT /password` | Autenticación y perfil |
| **Users** | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Gestión de usuarios |
| **Contacts** | `GET /`, `GET /:id`, `PUT /:id`, `PATCH /:id/archive`, `PATCH /:id/restore` | Gestión de contactos |
| **Conversations** | `GET /`, `GET /:id`, `GET /:id/messages`, `POST /:id/messages`, `PATCH /:id/mode`, `PATCH /:id/status` | Mensajería |
| **Brain** | `GET /sources`, `POST /upload`, `POST /text`, `DELETE /sources/:id`, `POST /search` | Base de conocimiento RAG |
| **Agents** | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Agentes IA |
| **AI Models** | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /providers/*`, `POST /providers/test-ocr`, `GET /ollama/models`, `GET /remote/*`, `GET /agent/models` | Modelos y proveedores (incluye test OCR) |
| **Config** | `GET /`, `PUT /` | Configuración global |
| **Project** | `GET /`, `GET /check`, `POST /`, `PUT /:id` | Gestión de proyecto |
| **Appointments** | `GET /`, `GET /:id`, `PATCH /:id/status` | Citas agendadas por el agente |
| **Orders** | `GET /`, `GET /:id`, `PATCH /:id/status` | Pedidos creados por el agente |
| **Dashboard** | `GET /stats`, `GET /volume`, `GET /channels`, `GET /activity` | Analytics |
| **Public Chat** | Rutas para chat público (clientes web) | Chat embebible |

> Todos los endpoints están bajo el prefijo `/api/<módulo>`.

---

## Modelos de Datos (MongoDB)

| Colección | Campos Clave | Notas |
|:----------|:-------------|:------|
| `users` | name, email, password (hash), role, status, avatar | Roles: devadmin, admin, support, assistant |
| `contacts` | name, phone, email, platform, status, tags, metadata | Soft delete (archivar) |
| `conversations` | contactId, platform, status, mode, clientInfo, unreadCount | Modos: auto_pilot, human_takeover |
| `messages` | conversationId, sender, content, contentType, isBot, toolData | Sender: contact, ai_agent, human_agent, tool. contentType: text, tool_call, tool_result, confirmation_request |
| `agents` | name, modelId, personality (role, traits, emojiUsage, language, responseLength, ragBehavior, fallbackMessage), config | 1 agente activo por proyecto |
| `ai_models` | name, value, provider, category, isActive | Seed automático al inicio |
| `provider_configs` | type (llm/embedding/file/image/audio/ocr), provider, apiKey, selectedModel, isActive | API keys enmascaradas al consultar |
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
- **Dashboard**: Token JWT enviado en `socket.handshake.auth.token`
- **Chat Público (`test-chat`)**: Slug del proyecto enviado en `socket.handshake.query.slug`
- **Rate Limiting**: 30 mensajes/min y 10 joins/min por usuario (Redis)
- **CORS**: Restringido a `FRONTEND_URL` en producción

### Eventos

| Evento | Dirección | Descripción |
|:-------|:----------|:------------|
| `chat:message` | Server → Client | Nuevo mensaje recibido |
| `chat:message_chunk` | Server → Client | Token de streaming (respuesta parcial) |
| `chat:send` | Client → Server | Enviar mensaje desde el dashboard |
| `chat:typing` | Bidireccional | Indicador de "escribiendo..." |
| `chat:status` | Server → Client | Cambio de estado de conversación |
| `chat:new_conversation` | Server → Client | Nueva conversación iniciada |
| `chat:message_updated` | Server → Client | Mensaje actualizado (estado de confirmación de tool) |
| `tool:confirm` | Client → Server | Confirmar / cancelar / modificar una ejecución de herramienta |
| `tool:confirmed` | Server → Client | Resultado de la confirmación de herramienta |
| `admin:notification` | Server → Client | Notificación de la tool `send_notification` |
| `join:room` | Client → Server | Unirse a room de conversación |
| `joined:room` | Server → Client | Confirmación de unión a room |
| `error` | Server → Client | Error de autenticación o autorización |

---

## Comandos de Desarrollo

```bash
# Levantar servicios Docker (MongoDB, Redis, Qdrant, Ollama, NATS)
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

## Variables de Entorno (Backend)

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mitchbot
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434
NATS_URL=nats://localhost:4222
JWT_SECRET=<tu-secreto>
FRONTEND_URL=http://localhost:5173
```

> ⚠️ Las API keys de los proveedores (OpenRouter, Gemini) se gestionan desde la BD, **no** desde variables de entorno.

---

## Pendientes / Roadmap

### Fase Actual — MVP Demo-Ready ✅
- [x] Chat web en tiempo real con streaming
- [x] Motor RAG (PDF, TXT, CSV)
- [x] Multi-proveedor LLM (Ollama, OpenRouter, Gemini)
- [x] Dashboard con métricas
- [x] Gestión de contactos, usuarios y agentes
- [x] Onboarding / Setup de proyecto
- [x] Capa de abstracción IA + Enrutador

### Fase Siguiente — Integración Social 🔜
- [ ] WhatsApp Business API (webhooks + NATS)
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
- [ ] Tests automatizados (unit + e2e)
