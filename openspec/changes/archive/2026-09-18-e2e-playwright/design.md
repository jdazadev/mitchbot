## Context

Ver `proposal.md - Why`. Estado actual: `@playwright/test@1.63` instalado en la raíz con Chromium, Firefox y WebKit descargados, `playwright.config.ts` con valores por defecto (sin `baseURL`, `webServer` comentado) y un único spec de ejemplo apuntando a `playwright.dev`. La base de datos está vacía, por lo que se requieren fixtures.

Restricción técnica clave: el backend llama al proveedor de IA del lado servidor. Playwright solo puede interceptar peticiones originadas en el navegador, por lo que `page.route` NO puede sustituir la llamada backend→OpenRouter. El mock debe resolverse en la frontera del proveedor (stub local) y/o interceptando las llamadas del navegador al backend cuando la prueba sea puramente de UI.

Dependencia de orden: la batería se escribe contra la UI final de los changes 1–3.

## Goals / Non-Goals

**Goals:**

- Suite e2e reproducible, determinista y sin costo, que cubra los flujos críticos.
- Autenticación y datos de prueba reutilizables y aislados.
- Validación de tiempo real (streaming y confirmación de herramientas).

**Non-Goals:**

- No se reemplazan las pruebas unitarias/integración futuras; la suite es e2e de caja negra sobre la UI.
- No se prueba el rendimiento ni la carga.
- No se cubren integraciones sociales (WhatsApp/Instagram) aún no implementadas.

## Decisions

### D1: Runner y matriz de navegadores

Se usa Playwright con **Chromium como navegador por defecto** para toda la batería, y se mantiene Firefox/WebKit para un subconjunto de humo opcional. Alternativa considerada: ejecutar los 3 navegadores para todo. Se descarta por tiempo de ejecución; la regresión que motivó este trabajo era de resolución de módulos, independiente del navegador.

### D2: Determinismo del LLM mediante base URL configurable + stub local

Se hace configurable la base URL del proveedor (`OPENROUTER_BASE_URL`) y en el entorno e2e se apunta a un **stub local compatible con la API de OpenAI** que devuelve respuestas fijas (incluyendo streaming). Esto mantiene el pipeline real del backend (RAG, streaming, herramientas) sin llamadas externas ni costo. Para pruebas puramente de UI, se permite además interceptar con `page.route` las llamadas del navegador al backend. Alternativa considerada: modo mock dentro del backend. Se descarta como mecanismo principal porque el stub en la frontera del proveedor ejercita más código real; el enfoque de mock por Playwright se reserva para casos de UI. Un test de humo opcional contra el proveedor real queda fuera de la suite por defecto.

### D3: Autenticación por estado de almacenamiento

Un *setup project* de Playwright autentica una vez con un usuario e2e dedicado y persiste el `storageState`, reutilizado por las pruebas. Alternativa considerada: login en cada prueba. Se descarta por lentitud y ruido.

### D4: Datos de prueba dedicados y aislados

Un proyecto y usuario e2e dedicados se preparan antes de la suite. Cada prueba genera sus datos con identificadores únicos (marca de tiempo/UUID) para no colisionar y poder ejecutarse en paralelo. Alternativa considerada: reiniciar la base de datos por corrida. Se descarta por destructivo y lento; el aislamiento se logra por datos únicos.

### D5: Organización por módulo y utilidades compartidas

Los specs se organizan por módulo (auth, setup, dashboard, messaging, contacts, brain, users, settings, agents, profile, public-chat) con fixtures y utilidades compartidas. `webServer` con `reuseExistingServer` evita levantar servidores si ya están corriendo. Alternativa considerada: un único archivo monolítico. Se descarta por mantenibilidad.

## Risks / Trade-offs

- **[El stub difiere del proveedor real y oculta regresiones de integración]** → El stub imita el contrato OpenAI-compatible mínimo; se documenta y se deja un test de humo opcional contra el proveedor real fuera de la corrida por defecto.
- **[Flakiness en tiempo real (WebSocket/streaming)]** → Usar aserciones *web-first* y `expect.poll` en lugar de esperas fijas.
- **[Colisión de datos entre pruebas paralelas]** → Identificadores únicos por prueba y limpieza best-effort.
- **[La suite queda obsoleta si cambia la UI de los changes 1–3]** → Implementarla al final y referenciar elementos por rol/etiqueta (no por clases ni posiciones).
- **[Dependencia de servicios Docker (Mongo/Redis/Qdrant)]** → Documentar como prerrequisito y detectar su ausencia con un fallo claro.

## Migration Plan

No aplica migración de datos. Se documentan los comandos de ejecución y los prerrequisitos (servicios Docker, servidores de la app y stub del proveedor) y se integra un comando para CI.

## Open Questions

Ninguna.
