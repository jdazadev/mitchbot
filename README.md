# Mitchbot

**Atención al cliente con IA que conoce tu negocio y sabe cuándo pasarle la conversación a una persona.**

Mitchbot es un SaaS de chatbot multicanal. Reúne en un solo panel las conversaciones que llegan por WhatsApp, Instagram y la web. Las responde un agente de IA que consulta tu propia base de conocimiento (RAG) y ejecuta operaciones reales del negocio, como agendar citas, consultar inventario o registrar intenciones de pago. Un operador humano puede tomar el control en cualquier momento.

> Versión actual: **v0.4.31** · Historial completo en [`changelog.md`](changelog.md)

---

## Visión

Las pequeñas y medianas empresas reciben cada vez más mensajes de clientes por más canales, pero no tienen un equipo de soporte para responderlos todos. Los chatbots genéricos responden rápido, pero sin contexto: no conocen el menú, los horarios ni las políticas del negocio, y nunca saben cuándo dejar paso a una persona.

Mitchbot persigue que **un operador configure su negocio, suba lo que sabe y, desde un solo panel, deje que la IA atienda a sus clientes sin perder el control**:

- **La IA responde con el conocimiento del negocio**, no con texto genérico. Cada respuesta se apoya en los documentos que subió el propio negocio.
- **La IA actúa, no solo conversa.** Agenda, consulta y registra mediante herramientas con controles explícitos: el cliente confirma lo que se crea y un operador aprueba lo sensible.
- **La persona siempre puede intervenir.** El paso de piloto automático a control humano es inmediato, se confirma antes de hacerlo y se ve en tiempo real en todas las sesiones.
- **Los datos de cada negocio están aislados.** Cada proyecto tiene su agente, sus canales, su conocimiento y sus métricas, sin fugas entre proyectos.

### Para quién es

Operadores de conversación en PYMEs, equipos de soporte y ventas, y agencias que gestionan chatbots para sus clientes. Todos hacen el mismo trabajo: atender y automatizar las conversaciones de los clientes finales.

### Principios de producto

1. **El operador atiende conversaciones.** Primero la claridad y la velocidad de lectura; la identidad de marca se expresa en los detalles.
2. **Sistema de diseño tokenizado.** El color de cada proyecto es una variable, no un estilo fijo.
3. **Honestidad funcional.** En pantalla solo hay elementos con comportamiento real: ni métricas inventadas ni botones decorativos.
4. **Consistencia.** Un único lenguaje de componentes en todo el panel y en el chat público.

Más detalle en [`PRODUCT.md`](PRODUCT.md) y en el sistema de diseño **Aurora** ([`apps/frontend/DESIGN.md`](apps/frontend/DESIGN.md)).

---

## Qué hace hoy

| Módulo | Capacidades |
|:--|:--|
| **Conversaciones** | Bandeja en tiempo real con filtros por canal y búsqueda. Modos `auto_pilot` / `human_takeover`. No leídos sincronizados entre sesiones. Historial paginado. Modo enfoque. Sentimiento y urgencia analizados por IA en cada mensaje del cliente. |
| **Agente IA** | Personalidad configurable (rol, tono, longitud, idioma es/en). Memoria de los últimos 20 turnos. Saludo y despedida naturales. Respuesta completa sin fragmentos. Errores visibles en el chat. |
| **Memoria (RAG)** | Ingesta de PDF, TXT, CSV, imágenes y texto manual. OCR con modelos de visión, chunking semántico por secciones, embeddings en Qdrant, búsqueda re-rankeada y reindexado en segundo plano (BullMQ). |
| **Herramientas** | Catálogo por proyecto: Agenda, Conocimiento, Inventario y Pagos. Tres niveles de control (ninguno, confirmación del cliente, aprobación de operador). Rol `approver` y auditoría completa en `tool_executions`. |
| **Clientes** | Contactos creados al responder al cliente o guardados desde una conversación. Búsqueda, filtros, orden, paginación y archivado (nunca se borran). |
| **Panel** | Resultados (conversaciones, leads, citas, conversión), salud del bot (tasa y mediana de primera respuesta, cobertura, backlog), automatización y volumen por remitente, con rangos de 7/30/90 días. |
| **Plataforma** | Varios proyectos por usuario, roles (`admin`, `support`, `assistant`, `approver`), interfaz bilingüe es/en, tema claro/oscuro y chat público de prueba por proyecto. |

---

## Arquitectura

```
 Cliente (Web · WhatsApp* · Instagram*)          Operador (Dashboard Vue 3)
                │                                          │
                └──────────── Socket.io / REST ────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Backend Express + TS        │
                    │  chat.service (orquestador)  │
                    │   ├─ rag.service ──► Qdrant  │
                    │   ├─ tool.service (catálogo) │
                    │   └─ ai.service              │
                    │        └─ llm-provider ──► OpenRouter
                    └──────┬──────────────┬────────┘
                           │              │
                        MongoDB     Redis (caché, BullMQ, rate limit)

 * canales previstos en el roadmap
```

- **Capa de abstracción de IA.** El chat no sabe qué modelo usa: `llm-provider.service` es el único punto que instancia el modelo. OpenRouter es el proveedor único de LLM, embeddings y OCR, y los modelos se definen solo por variables de entorno.
- **Degradación controlada.** Si falla el RAG, el bot responde sin contexto. Si falla el modelo, el error se muestra en el chat y queda registrado.
- **Aislamiento por proyecto** en cada consulta, endpoint y sala de WebSocket (`project:<id>`).

Hay diagramas interactivos (arquitectura, secuencias, flujos de datos y ciclos de vida) en [`.archify/`](.archify/). Abre el HTML de la carpeta `review-N` más reciente de cada diagrama, por ejemplo [`architecture-sistema/review-2/sistema.html`](.archify/architecture-sistema-20261006-022446/review-2/sistema.html).

### Stack

| Capa | Tecnologías |
|:--|:--|
| Frontend | Vue 3 (`<script setup>`), TypeScript, Vite, Tailwind CSS 3, Pinia, Vue Router, vue-i18n, Phosphor Icons |
| Backend | Node.js, Express 4, TypeScript, Socket.io, Zod, JWT, Multer |
| IA | LangChain.js, OpenRouter |
| Datos | MongoDB 8, Redis (BullMQ), Qdrant |
| Calidad | Playwright (E2E con stub de IA determinista), OpenSpec |

### Estructura del monorepo

```
mitchbot_v2/
├── apps/
│   ├── backend/      # API REST + WebSocket
│   └── frontend/     # Dashboard SPA y chat público
├── tests/            # E2E (Playwright) y stub OpenAI-compatible
├── openspec/         # Especificaciones y cambios archivados
├── .archify/         # Diagramas del sistema
└── docker-compose.yml
```

---

## Puesta en marcha

**Requisitos:** Node.js 22 o superior, pnpm y Docker.

```bash
# 1. Servicios: MongoDB, Redis y Qdrant
docker compose up -d

# 2. Dependencias
pnpm install

# 3. Variables de entorno del backend
cp apps/backend/.env.example apps/backend/.env
#    Completa al menos JWT_SECRET, OPENROUTER_API_KEY y OPENROUTER_LLM_MODEL

# 4. Datos iniciales (usuario admin@mitchbot.io / admin123)
pnpm --filter @mitchbot/backend seed

# 5. Backend (:3000) y frontend (:5173)
pnpm dev
```

Variables principales:

| Variable | Uso |
|:--|:--|
| `OPENROUTER_API_KEY` | Credencial única de IA. Solo se lee del entorno; nunca se guarda en base de datos. |
| `OPENROUTER_LLM_MODEL` | Modelo de chat. **Obligatorio.** |
| `OPENROUTER_EMBEDDING_MODEL` | Modelo de embeddings. Si lo cambias, reindexa con `pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`. |
| `OPENROUTER_OCR_MODEL` | Modelo de visión para OCR. |
| `OPENROUTER_INSIGHTS_MODEL` | Opcional. Modelo de sentimiento y urgencia; por defecto usa el modelo de chat. |

La lista completa está en [`apps/backend/.env.example`](apps/backend/.env.example).

---

## Pruebas

La suite E2E de Playwright arranca un stub de IA (puerto 4010), el backend (3100) y el frontend (5174) contra la base de datos `mitchbot_e2e`. Nunca llama al proveedor real.

```bash
pnpm test:e2e              # suite completa
pnpm test:e2e messaging    # un módulo
pnpm test:e2e:ui           # modo interactivo
```

Requiere los servicios de Docker activos. Más detalles en [`tests/e2e/README.md`](tests/e2e/README.md).

---

## Estado y hoja de ruta

**MVP listo para demo ✅:** chat web en tiempo real, RAG, OpenRouter, panel de métricas, contactos, usuarios y agentes, onboarding, herramientas con aprobaciones y analítica de conversación.

**Siguiente fase: integración social 🔜**
- WhatsApp Business API e Instagram Messaging API
- Normalización de mensajes entre plataformas, rate limiting por canal, reintentos y failover

**Más adelante 💡**
- Widget embebible para webs de clientes
- Identidad de marca por proyecto guardada en el backend
- Exportación de conversaciones, integración con CRM y notificaciones push
- Tests unitarios (complementando la suite E2E)

---

## Contribuir

- Commits y changelog según [Keep a Changelog](https://keepachangelog.com/) y versionado semántico.
- Los cambios funcionales se proponen y siguen con **OpenSpec** (`openspec/changes/`).
- Las claves de traducción deben existir en `es.json` y `en.json`.
- La guía técnica detallada para desarrolladores y agentes de IA está en [`AGENTS.md`](AGENTS.md).

---

<sub>Proyecto privado · © Mitchbot</sub>
