# 🤖 MitchBot v2 — Guía del Proyecto

> **SaaS de Chatbot con IA y RAG** — Plataforma multi-canal para automatizar conversaciones con inteligencia artificial y base de conocimiento.

---

## Reglas para el Agente de IA

- Cada vez que termines unos cambios, actualiza el `changelog.md` (usa la fecha actual) y este archivo `AGENTS.md`.
- También actualiza la versión dependiendo del tipo de cambio (semver). **El proyecto está en pre-1.0 (`0.y.z`)**: las funcionalidades nuevas y los cambios incompatibles suben `y`, y las correcciones y la documentación suben `z`. No pases a `1.0.0` sin que lo pidan. La numeración v1–v4 anterior se renumeró a `0.1`–`0.4` (ver changelog `v0.4.31`).
- **Al terminar de implementar un cambio de OpenSpec, realiza el commit correspondiente** (sin esperar a que se lo pidan).
- **Al terminar cualquier tanda de Impeccable** (diseño, critique, audit, polish, etc.), **realiza el commit correspondiente sin esperar a que te lo pidan**.
- Cuando termines cualquier implementación, descríbelo siempre **en español**.
- **Cada desarrollo se prueba con tests unitarios y E2E**: añade unitarios para la lógica nueva (`apps/backend/tests/unit/` con `node:test`, `apps/frontend/tests/unit/` con Vitest) y cubre el flujo de usuario con Playwright. Antes de cerrar, `pnpm test:unit`, `pnpm test:integration` y `pnpm test:e2e` en verde.
- Sigue la convención de commits y changelog de [Keep a Changelog](https://keepachangelog.com/).

**Versión actual del proyecto:** v0.11.0

---

## Métricas de SLA y socket del panel fiable (v0.11.0)

Objetivos de servicio por proyecto, su medición y avisos, más el arreglo de los eventos en vivo tras iniciar sesión. OpenSpec `add-sla-metrics`; capability `sla-metrics`.

- **Cálculo puro** (`services/sla.ts`): `slaTargets` (por defecto 15 min, 24 h y avisos), `isReply`, `responseTurns`, `responseCompliance`, `resolutionCompliance`, `median`, `percentile` y `waitState` (`AT_RISK_RATIO` = 0,75). El frontend replica `waitState` en `lib/sla.ts`.
- **Espera** (`chat.service`):
  - `startWaiting` (con el mensaje del cliente, solo si no esperaba): fija `awaitingReplySince` con la hora del canal, programa el aviso y emite `chat:sla`.
  - `stopWaiting`: borra la espera y `slaBreachNotifiedAt`.
  - `deliverReply(message, target)` sustituye a las cuatro llamadas a `dispatch` (respuesta directa, final del bot, final tras herramientas y confirmación) y cierra la espera si el mensaje es visible para el cliente.
  - `closedAt` se fija en `markConversationClosed`, `handleAutoGoodbye` y `PUT /:id/status`; se borra al reabrir.
- **Avisos** (`queues/sla-alerts.ts`):
  - **Programación**: un trabajo diferido por espera, con `jobId` `sla_<conversación>_<inicio>`.
  - **Comprobación**: `processSlaAlert` reclama atómicamente la espera (la misma `awaitingReplySince`, abierta y sin aviso previo) y emite `admin:notification` con `kind: 'sla_breach'`.
  - **Arranque**: el worker se arranca en `index.ts`.
  - **En las pruebas**: las de integración que crean esperas deben llamar a `closeSlaAlertsQueue()` en su `after`, o el proceso no termina.
- **Endpoint**: `GET /api/dashboard/sla?days|from|to` devuelve `{ targets, range, response, resolution, now { breached, atRisk, conversations[] } }`, calculado en `services/sla.service.ts`.
- **Interfaz**: `components/dashboard/SlaPanel.vue` (con `DashboardMetricBand`), la marca `conversation-sla` (`data-state` = `breached` o `at_risk`) en la bandeja de `Messaging.vue` y el bloque `sla-settings` en Opciones. Opciones ya envía solo `options` y `sla`.
- **Socket del panel** (`services/socket.service.ts`):
  - **Registro de manejadores**: `on`/`off`/`emit`, con un registro global por evento que se engancha a cada socket nuevo.
  - **`ensure()`**: recrea el socket si no hay ninguno vivo o si cambió el token o el proyecto. Nunca se conecta al panel sin token.
  - **Sala**: `lastRoom` se vuelve a pedir en cada `connect`.
  - **Chat público**: `leavePublic()` lo cierra.
  - **Uso**: no accedas a `socketService.socket` para escuchar; usa `socketService.on`.
  - `useConversations` se registra una sola vez (`bound`).
- **Recuperación tras `joined:room`**: Conversaciones (`onJoinedRoom`) y el widget vuelven a pedir la última página y la fusionan (`mergeMessages` completa también las burbujas vacías).
- **Verificación**: unitarios backend **101/101** y frontend **66/66**; integración **79/79 (1 omitida)**; E2E **97/97** en tres corridas completas; paridad es/en **825/825**.

---

## Widget embebible y acceso al chat público (v0.10.0)

Chat de Mitchbot instalable en la web del negocio y endurecimiento del chat público. OpenSpec `add-chat-widget`; capability `chat-widget`.

- **Acceso por token** (`src/widget/access.ts`): `clientToken(conversationId)` es un HMAC-SHA256 con `JWT_SECRET`; `verifyClientToken` compara en tiempo constante.
  - El inicio público (`POST /public/test-chat/:slug/start`) lo devuelve. El envío (`clientToken` en el cuerpo o `X-Client-Token`), `join:room` (`{ roomId, clientToken }`) y el historial del widget lo exigen.
  - El panel sigue uniéndose con el id solo, porque está autenticado.
- **Socket público aislado** (`websocket/socket.ts`): los clientes públicos **no** entran en `project:<id>` ni en la sala del dashboard; solo en las salas de sus conversaciones, que deben ser del proyecto del slug. `tool:confirm` exige `socket.rooms.has(conversationId)`. **No emitas a la sala del proyecto nada que deba ver un cliente**: usa la sala de la conversación.
- **Widget** (`src/widget/`):
  - `config.ts`: `normalizeOrigin(s)` (`http(s)://host[:puerto]` o `https://*.dominio`), `isWidgetAvailable`, `frameAncestors` y `widgetSnippet`.
  - `frame.ts`: `renderFrame` (HTML con escapado y la configuración en `<script type="application/json">` con `<` escapado) y `contrastFor`.
  - `strings.ts`: textos es/en.
  - `public/loader.js`: cargador sin dependencias, con `data-mitchbot`, el botón `data-mitchbot-launcher` y el `iframe` `data-mitchbot-frame`. Cierra con `postMessage({ type: 'mitchbot:close' })`.
  - `public/frame.js` y `public/frame.css`: el chat en vanilla JS, con Socket.io servido por el propio backend (`/socket.io/socket.io.min.js`) y `localStorage` `mitchbot:widget:<slug>` para `{ conversationId, clientToken, clientIdentifier }`.
  - Controlador: `controllers/widget.controller.ts`. Rutas: `/widget.js`, `/widget/*` (estáticos) y `/api/public/widget/:slug/{config,frame,conversations/:id/messages}`.
  - **CSP de la página**: `frame-ancestors 'self' <FRONTEND_URL> <allowedOrigins>`, `script-src 'self'` y `style-src 'self' 'unsafe-inline'`.
- **Build**: `pnpm build` del backend copia `src/widget/public` a `dist/widget/public`, porque el controlador lo busca junto a `controllers/`.
- **Interfaz**: `components/settings/WidgetSettings.vue` (bajo la fila Web de Canales) y `lib/widget.ts` (`originLines`, `invalidOrigins`, `widgetSnippet`, `widgetFrameUrl`). `project.service` exporta `API_BASE`.
- **Hilo**: `mergeMessages` (`lib/delivery.ts`) fusiona el historial con lo que llega por socket durante la carga.
- **E2E**:
  - Las webs anfitrionas son servidores reales en `127.0.0.1` con puerto aleatorio. Una web servida con `page.route` en un dominio público no sirve: Chrome (Private/Local Network Access) le impide cargar `localhost`.
  - El dominio no permitido se detecta por el aviso de consola de `frame-ancestors`.
  - `ASwitch` es un `checkbox` (rol `checkbox`, no `switch`).
- **Verificación**: unitarios backend **94/94** y frontend **56/56**; integración **75/75 (1 omitida)**; E2E **93/93** en tres corridas completas; paridad es/en **798/798**.

---

## Plantillas de WhatsApp (v0.9.0)

Envío de plantillas aprobadas para retomar conversaciones fuera de la ventana de 24 h. OpenSpec `add-whatsapp-templates`; capability `whatsapp-templates`.

- **Núcleo puro** (`channels/whatsapp/templates.ts`):
  - `parseTemplate` (componentes, variables posicionales o con nombre con sus ejemplos, `supported`/`unsupportedReason`), `validateParameters`, `renderTemplate` y `templateMessage` (componentes de la Cloud API, con `parameter_name` si la plantilla es `NAMED`).
  - `fetchApprovedTemplates` sigue `paging.next` hasta 10 páginas y filtra `APPROVED`.
  - Los parámetros siempre van como arrays en el orden de `variables` de cada componente (`header`, `body`).
- **Servicio** (`services/template.service.ts`):
  - `list` resuelve la WABA (`config.whatsapp.wabaId` o, si no, `WHATSAPP_WABA_ID`) y guarda una caché de 5 minutos por WABA.
  - `send` valida la conversación (WhatsApp con `channelAccount`), la plantilla y las variables, y crea el mensaje con `chatService.sendMessage(..., { template })`.
  - Los errores son `TemplateError(status)`. `setTemplateClientForTests` permite inyectar un `fetch` falso en las pruebas.
- **Modelo**:
  - Mensaje: `contentType: 'template'`, `content` con el texto renderizado y `template { name, language, components }`. El adaptador de WhatsApp envía `type: template` cuando `OutboundMessage.template` existe.
  - Conversación: `lastInboundAt`, que se fija en `sendMessage` del cliente con `options.receivedAt` (la hora del canal) o con la hora actual si `receivedAt` es futura.
- **Interfaz**:
  - `lib/templates.ts`: `previewTemplate`, `isWindowClosed`, `emptyParameters` y `parametersComplete`.
  - `components/messaging/TemplatePicker.vue`, con los `data-template` de cada plantilla y `template-preview`.
  - En `Messaging.vue`:
    - `canSendTemplate`: WhatsApp con `channelAccount`.
    - `windowClosed`: reloj de 60 s; muestra el aviso `whatsapp-window-closed` en lugar del compositor.
    - El botón `open-templates` en el compositor.
    - La acción junto a las entregas fallidas por la ventana.
    - La etiqueta `template-label` en la burbuja.
  - `ChannelConnection` tiene un slot `extra` para el campo WABA.
- **E2E**:
  - El stub sirve `GET /meta/:v/:waba/message_templates` en dos páginas. Su catálogo fijo contiene `bienvenida`, `plantilla_pendiente` (PENDING), `promo_imagen` (cabecera de imagen), `recordatorio_cita` (NAMED, es_MX) y `seguimiento_pedido`.
  - Valida los envíos de plantilla: 132001 si no existe y 132000 si las variables no cuadran. Registra cada envío como `plantilla:<nombre>|v1|…`.
  - Para simular la ventana cerrada basta un webhook con un `timestamp` antiguo.
- **Verificación**: unitarios backend **87/87** y frontend **48/48**; integración **69/69 (1 omitida)**; E2E **86/86** en dos corridas completas; paridad es/en **778/778**.

---

## Exportación de conversaciones (v0.8.0)

Descarga de conversaciones a CSV y JSON. OpenSpec `add-conversation-export`; capability `conversation-export`.

- **Serialización pura** (`src/export/conversation-format.ts`):
  - `CSV_COLUMNS` (14 columnas), `csvCell`, `csvHeader` y `csvMessageRow`.
  - `jsonConversation` y `jsonMessage`.
  - `exportFileName` y `fileSlug`.
  - `parseFormat` y `parseRange`, que lanzan `InvalidExportError` → 400.
  - **Reglas del rango**: 30 días por defecto y 366 como máximo; un `to` en formato `YYYY-MM-DD` cubre el día completo.
  - **Reglas del CSV**: UTF-8 con BOM, CRLF, y un `'` delante de las celdas que empiezan por `= + - @ \t \r` (protección contra inyección de fórmulas). Por eso los teléfonos `+57…` salen como `'+57…`.
- **Servicio** (`services/conversation-export.service.ts`):
  - Recorre las conversaciones con un cursor (proyecto, `createdAt <= to`, `lastMessageAt >= from` o sin él, canal opcional) y, por cada una, los mensajes visibles: `contentType` `text` o `confirmation_request`, sin contenido vacío y dentro del rango.
  - Escribe con un `ExportWriter` que espera a `drain`; las conversaciones sin mensajes en el alcance se omiten.
  - `findConversation` acota al proyecto.
- **Endpoints**: `GET /api/conversations/export` y `GET /api/conversations/:id/export`, con `authorize('admin', 'support')`. Van declarados antes de `/:id` para que `export` no se interprete como id.
- **Respuesta**:
  - `Content-Disposition` (con `filename*`) se expone por CORS con `Access-Control-Expose-Headers`.
  - Un error con la descarga empezada corta la respuesta (`res.destroy()`), para no entregar un archivo incompleto que parezca válido.
  - Se registra la actividad `conversations_exported` con `metadata { userId, format, conversations, messages, scope, … }`.
- **Interfaz**:
  - `canExport` (rol `admin` o `support`) muestra el menú del hilo (`data-testid="export-conversation"`) y el botón de la bandeja (`export-conversations`), que abre `components/messaging/ExportDialog.vue`.
  - La descarga se hace con `fetch` autenticado y `downloadBlob` (`lib/download.ts`); el nombre del archivo sale de `fileNameFromDisposition`.
- **Verificación**: unitarios backend **78/78** y frontend **43/43**; integración **63/63 (1 omitida)**; E2E **81/81** en dos corridas completas; paridad es/en **752/752**.

---

## Canal de Instagram (v0.7.0)

Adaptador de la Instagram Messaging API sobre la pasarela, con el código común de Meta extraído de WhatsApp. OpenSpec `add-instagram-channel`; capability `instagram-channel`.

- **Común de Meta (`src/channels/meta/`)**:
  - `signature.ts`: `verifySignature` y `retryAfterMs`.
  - `routing.ts`: `projectForAccount(channel, account)` e `isAccountTaken(channel, account, exceptProjectId)`, sobre `config.whatsapp.phoneNumberId` y `config.instagram.accountId`.
  - `controllers/webhooks.controller.ts` es una fábrica `metaWebhook({ verifyToken, appSecret, parse, handle })` que da los `verify`/`receive` de cada canal. Un canal de Meta nuevo aporta su parser, su handler y su adaptador.
- **Módulo `src/channels/instagram/`**:
  - `webhook.ts`: `parseInstagramWebhook` (`messaging[]` y `changes[messages]`) y `describeInstagramError`.
  - `adapter.ts`: `createInstagramAdapter`, `classifyInstagramError` y `fetchInstagramName`.
  - `handler.ts`: enruta mensajes y lecturas, con la caché de nombres.
  - `index.ts`: `registerInstagram`, `instagramServerStatus` e `instagramApiOptions`.
- **Webhook**: `GET|POST /api/webhooks/instagram`, con `INSTAGRAM_VERIFY_TOKEN` e `INSTAGRAM_APP_SECRET` (distintos de los de WhatsApp).
- **Cuenta e identidad del cliente**: la cuenta es `entry.id`/`recipient.id` (ID de la cuenta profesional) y el cliente es su IGSID (`clientInfo.identifier`). Se descarta lo enviado por la propia cuenta (`sender.id === entry.id`), traiga o no `is_echo`.
- **Envío**: `POST {INSTAGRAM_API_URL}/{INSTAGRAM_API_VERSION}/{accountId}/messages` con `{ recipient: { id }, message: { text } }`, texto hasta 1000 caracteres y `externalId = message_id`.
- **Nombre**: `GET /{igsid}?fields=name,username` con 3 s de límite. La caché guarda hasta 5000 nombres; los fallos no se cachean y el mensaje entra sin nombre.
- **Lectura**: Instagram no informa `delivered`. `read.mid` llama a `applyReadUpTo` (en `outbound.ts`), que pasa a `read` los mensajes `sent`/`delivered` de la conversación creados hasta ese mensaje y emite un `chat:message_updated` por cada uno.
- **Interfaz**: `components/settings/ChannelConnection.vue` (cuenta, webhook y estado del servidor) sirve a los dos canales en Configuración → Canales. Las claves i18n son `settings.channels.<canal>.{serverReady, serverMissing, accountLabel, accountPlaceholder, accountHint, accountInvalid, webhookHint}`, más las comunes `settings.channels.{webhookLabel, copyWebhook}`.
- **E2E**: el stub acepta el envío de Instagram en la misma ruta `/meta/:version/:id/messages` (lo distingue por `recipient`) y sirve perfiles en `GET /meta/:version/:igsid` como `Cliente IG <últimos 5>`. `/__meta/fail` admite `subcode`. Los helpers comunes están en `tests/e2e/helpers/meta.ts`.
- **Hoja de ruta**: actualizada a v0.7 (`review-3`). El SVG se exporta sin abrir el visor con un script de Playwright que pulsa **Export diagram → SVG · Auto**; luego se traduce `Legend` → `Leyenda`.
- **Verificación**: unitarios backend **69/69** y frontend **34/34**; integración **58/58 (1 omitida)**; E2E **74/74** en dos corridas completas; paridad es/en **733/733**.

---

## Canal de WhatsApp (v0.6.0)

Adaptador de WhatsApp Business (Cloud API de Meta) sobre la pasarela de canales. OpenSpec `add-whatsapp-channel`; capability `whatsapp-channel`.

- **Módulo `src/channels/whatsapp/`**:
  - `webhook.ts`: funciones puras `verifySignature`, `parseWhatsAppWebhook` y `describeWhatsAppError`.
  - `adapter.ts`: `createWhatsAppAdapter` y `classifyWhatsAppError`.
  - `handler.ts`: enruta mensajes y estados.
  - `index.ts`: `registerWhatsApp` y `whatsAppServerStatus`.
- **Registro del adaptador**: se registra al arrancar solo si hay `WHATSAPP_TOKEN`.
- **Webhook** (`routes/webhooks.routes.ts`, `controllers/webhooks.controller.ts`):
  - `GET /api/webhooks/whatsapp` responde al reto de verificación con `WHATSAPP_VERIFY_TOKEN`.
  - `POST /api/webhooks/whatsapp` exige `X-Hub-Signature-256` sobre el cuerpo crudo: `index.ts` guarda `req.rawBody` solo en `/api/webhooks/*`. Sin `WHATSAPP_APP_SECRET`, o con una firma inválida, responde 401.
  - Las respuestas son 200 incluso para números sin proyecto (para que Meta no reintente) y 500 si falla el procesamiento (Meta reintenta y la idempotencia absorbe el duplicado).
- **Número por proyecto**:
  - Se guarda en `project.config.whatsapp.phoneNumberId`, con índice único parcial y 409 si otro proyecto ya tiene el número (`projectService.isWhatsAppNumberTaken`).
  - El webhook enruta por `metadata.phone_number_id` y solo si `config.channels.whatsapp` está activo.
  - El token y el App Secret son de la app de Meta del despliegue y viven en el entorno.
- **Cuenta del canal**: `conversation.channelAccount` guarda el número que recibió la conversación.
  - `dispatch` solo encola si el canal es externo **y** hay cuenta. Las conversaciones del simulador, sin cuenta, se entregan por socket aunque sean WhatsApp.
  - La respuesta sale desde esa cuenta (`OutboundMessage.account`).
- **Continuidad**: `createConversationFromClient` reutiliza la conversación abierta (`active` o `pending_human`) del mismo cliente, canal y proyecto.
- **Mensajes entrantes**: texto, `interactive` (botón o lista) y `button` entran como su título. Los tipos multimedia entran como `[El cliente envió … que Mitchbot aún no puede leer]`, más el pie de foto si lo trae. Las reacciones y los avisos de sistema se ignoran.
- **Errores de Meta**:
  - **Transitorios**: 429, 5xx, red y los códigos `4`, `80007`, `130429`, `131048`, `131056`, `1`, `2`, `131000` y `133004`.
  - **Permanentes**: 401/`190` (token), `131047` (ventana de 24 h), `131026`, `131030` (lista de prueba), `10`/`200` (permisos) y el resto de 4xx, con su detalle.
- **Estados de Meta**: `applyDeliveryStatus` (en `outbound.ts`) localiza el mensaje por `delivery.externalId`, que tiene índice.
  - Los estados siguen el orden `queued < sent < delivered < read`, sin retroceder (`statusesBefore` en `policy.ts`).
  - Un `failed` sobre `sent` o `delivered` llama a `markFailed`.
- **Interfaz**:
  - `DeliveryStatus` muestra Entregado y Leído con doble check; Leído va en tinta más fuerte, sin pastel.
  - Configuración → Canales: Phone Number ID, URL del webhook (`whatsAppWebhookUrl`) y estado del servidor (`GET /api/project/channels/status` → `{ whatsapp: { connected, missing[] } }`).
  - `lib/delivery.ts` (`latestDelivery`) resuelve el cruce entre la respuesta HTTP del reintento y el socket.
- **Membresía atómica**: `userService.joinProject` (`$addToSet` + proyecto activo) sustituye la lectura y reescritura de `projectIds` al crear un proyecto.
- **E2E**: el stub simula la Graph API en `/meta/:version/:phoneNumberId/messages`.
  - Rutas de control: `GET /__meta/messages?to=`, `POST /__meta/fail { to, code }` y `POST /__meta/recover { to }`.
  - El backend E2E usa `WHATSAPP_API_URL=<stub>/meta` y las credenciales de `E2E.whatsapp`.
  - `helpers/owner.ts` (`createProjectOwner`, `signIn`) da a cada prueba un usuario y un proyecto propios.
- **Verificación**: unitarios backend **54/54** y frontend **29/29**; integración **51/51 (1 omitida)**; E2E **69/69** en dos corridas completas; paridad es/en **726/726**.

---

## Pasarela de canales (v0.5.0)

Base común para WhatsApp e Instagram: entrada normalizada e idempotente, salida por cola con rate limiting, reintentos y circuit breaker, y estado de entrega visible. Cambio OpenSpec `add-channel-gateway`; capability `channel-gateway`.

- **Módulo `src/channels/`**: `types.ts` (`InboundMessage`, `OutboundMessage`, `ChannelAdapter`, `ChannelError transient|permanent`), `registry.ts` (adaptadores por plataforma; Web viene registrado y no es externo), `normalize.ts`, `policy.ts` (qué se entrega y `nextDelay`), `breaker.ts` (máquina de estados pura), `inbound.ts` y `outbound.ts` (colas y workers). Un canal nuevo es un adaptador: `registerAdapter({ platform, external: true, send })`.
- **Entrada**: `receive(inbound, target?)` es el único punto de entrada; el chat público lo usa de forma síncrona y los webhooks lo harán por la cola `channel-inbound` (`enqueueInbound`, concurrencia 1 para conservar el orden). Con `target.conversationId` escribe en esa conversación aunque esté cerrada (el chat Web).
- **Idempotencia**: `messages.external { platform, messageId }` con índice único parcial; un mensaje repetido no crea conversación, no suma no leídos ni dispara al bot.
- **Salida**: `dispatch(message, conversation)` encola en `channel-outbound-<canal>` las respuestas del bot y del operador y las `confirmation_request`, solo en canales externos. Nunca entrega `tool_call`, `tool_result` ni el aviso de error del bot. Web sigue entregando por socket, sin `delivery`.
- **Resiliencia**: limitador por canal (`CHANNEL_<CANAL>_RATE_MAX`/`_RATE_MS`), concurrencia 1 por canal (orden de entrega), 5 intentos con backoff exponencial (2 s → 60 s, respeta `retryAfterMs`), errores permanentes sin reintento. Circuit breaker en Redis: `CHANNEL_BREAKER_THRESHOLD` fallos transitorios seguidos lo abren durante `CHANNEL_BREAKER_COOLDOWN_MS`; mientras tanto los trabajos se retrasan sin gastar intentos.
- **Fallo definitivo**: `delivery.status = failed` con motivo, conversación a `pending_human`, `chat:status` y `admin:notification`. En el hilo, `DeliveryStatus.vue` muestra Enviando / Enviado / No entregado + **Reintentar** (`POST /api/conversations/:id/messages/:messageId/retry`, 409 si el mensaje no está en `failed`).
- **Aislamiento de colas**: `CHANNEL_QUEUE_PREFIX` (por defecto `bull`) separa colas y breaker cuando varios entornos comparten Redis; el E2E usa `e2e` y la integración `itest-<pid>`.
- **Retirado**: `POST /api/conversations/client/start` y `/client/:id/messages` (sin consumidores; eran una entrada que se saltaba el gateway).
- **Pruebas de integración sin coste**: `tests/integration/helpers/isolated-env.ts` se importa primero y apunta la IA a un puerto cerrado, así un mensaje entrante nunca llama a OpenRouter con la clave del `.env`.
- **Verificación**: unitarios backend **38/38** y frontend **22/22**; integración **40/40 (1 omitida)**, 10 de ellas del gateway contra Redis y BullMQ reales; E2E **62/62** en dos corridas completas; paridad es/en **715/715**.

---

## Identidad de marca por proyecto (v0.4.35)

- **Persistencia**: `PUT /api/project` guarda `config.brand { color, logo }` (color HEX validado con Zod; logo hasta 200 KB o `null` para quitarlo). El tipo `Project` del backend declara `config.brand`.
- **Actualización parcial**: `projectService.update` traduce `config` a rutas `$set` campo a campo (`toConfigSet`): cambiar solo el color conserva el logo, y actualizar una sección no pisa las demás.
- **Aplicación**: `useBrand().loadBrand` recuerda la sesión y el proyecto para los que cargó la marca; `App.vue` la vuelve a pedir en cada navegación, así que se aplica al iniciar sesión, al cerrarla y al entrar otro usuario sin recargar. Si el proyecto no se puede leer usa la de Aurora y reintenta en la siguiente navegación.
- **Quitar logo**: Configuración envía `logo: null` (raíz y `config.brand`); antes el logo raíz heredado volvía al recargar.
- **E2E en otro puerto**: los puertos de `tests/e2e/helpers/config.ts` derivan las URL (`E2E_FRONTEND_PORT`, `E2E_BACKEND_PORT`, `E2E_STUB_PORT`), y la comprobación de prerrequisitos falla con un mensaje claro si el puerto del frontend lo ocupa otra app.
- **Verificación**: unitarios backend **23/23** y frontend **18/18**; integración **30/30 (1 omitida)**; E2E **62/62** en dos corridas completas (`brand.spec.ts`: 6 pruebas de API y UI).

---

## Pruebas en tres niveles (v0.4.34)

- **Unitarios**: backend con `node:test` + tsx (`apps/backend/tests/unit/`: helpers y configuración de herramientas, chunking, prompt builder); frontend con Vitest + happy-dom (`apps/frontend/tests/unit/`: markdown, canales, derivados de marca, `authService.getProfile`). `vitest.config.ts` reutiliza `vite.config.ts` (alias `@`).
- **Scripts**: en la raíz `pnpm test` corre unitarios → integración → E2E; `pnpm test:unit` y `pnpm test:integration` por separado. En el backend, `test:unit` y `test:integration` (el antiguo `test` era solo integración).
- **E2E estable**: el límite de `join:room` sube de 10 a **60 por minuto y usuario**; con 10, un operador que recorría la bandeja dejaba de recibir mensajes en vivo sin aviso. `getProfile` conserva el proyecto activo de la pestaña mientras el usuario siga siendo miembro (antes, abrir Mi Perfil lo sustituía por el del servidor, que otra pestaña podía haber cambiado).
- **Suite depurada**: fuera `zz-debug-btn` y `zz-critique-shots` (sin aserciones); la auditoría de overflow y consola pasa a `layout-audit.spec.ts` con aserciones e incluye `/tools`. Corregidos dos tests con carreras (selector ambiguo de contraseña y enlaces del historial de herramientas leídos antes de cargar).
- **Verificación**: unitarios backend **20/20** y frontend **13/13**; integración **30/30 (1 omitida)**; E2E **57/57** en dos corridas completas seguidas; backend `tsc --noEmit` y frontend `build` en verde.

---

## Diagramas del sistema (v0.4.30)

- **Ubicación**: `.archify/<tipo>-<tema>-<fecha>/` con `candidate.json` (fuente editable) y **un solo HTML final**: en la subcarpeta `review-N` o, si no la hay, en la raíz de la carpeta. Los borradores superados se eliminaron en v0.4.32; al regenerar, borra la revisión anterior.
- **Contenido**: arquitectura del sistema; workflows de auth/onboarding y de control de herramientas; secuencias de mensaje→bot y de confirmación del cliente; dataflows de ingesta RAG y de analítica/insights; lifecycles de conversación, fuente de conocimiento y ejecución de herramienta.
- **Hoja de ruta (v0.4.31)**: `.archify/workflow-roadmap-20261019-175109/roadmap.html` (HTML final en la raíz de su carpeta). El README incrusta su exportación **SVG · Auto** en `docs/roadmap.svg`, con la leyenda traducida a mano a "Leyenda". **Al cerrar una etapa o cambiar el plan**, actualiza el `candidate.json` (el tipo de nodo marca el estado: `backend` = entregado, `messagebus` = siguiente, `cloud` = futuro, `security` = hito), vuelve a ejecutar `finalize`, exporta el SVG con `node .archify/export-svg.mjs .archify/workflow-roadmap-20261019-175109/roadmap.html docs/roadmap.svg --leyenda` (pulsa Export → SVG · Auto en Chromium y traduce la leyenda) y actualiza la sección "Estado y hoja de ruta" del README. El esquema de workflow admite como máximo 6 columnas (`col` 0–5). Última actualización: v0.11.0 (`review-7`).
- **Regenerar**: `node ~/.claude/skills/archify/bin/archify.mjs finalize <tipo> candidate.json <salida.html> --quality showcase --out-dir <carpeta>/review-N`. Un candidato modificado necesita un `--out-dir` nuevo. En el sandbox de Claude Code, antepón `NO_PROXY=localhost,127.0.0.1,::1`.
- **Límites**: los diagramas del sistema se redactaron cuando aún no había remoto, así que no fijan fuentes por commit. Ahora existe `origin` (`git@github.com:jdazadev/mitchbot.git`) y los nuevos diagramas pueden usar `meta.repository` + `--repo-root`. Si cambia el flujo, actualiza el `candidate.json` correspondiente.

---

## Accesibilidad y carga incremental (v0.4.29)

- **Formularios y opciones**: slug, color hexadecimal, controles de generación y contraseñas tienen etiquetas persistentes; las opciones de rol, idioma, longitud y RAG exponen `aria-pressed`.
- **Superficies móviles**: el contenido de los modales largos puede desplazarse; el drawer devuelve el foco al disparador al cerrarse y lo mueve al contenido al navegar.
- **Historial de conversación**: la vista carga 50 mensajes recientes y trae anteriores por cursor, preservando la posición de lectura. `GET /api/conversations/:id/messages?limit=&before=` devuelve `{ messages, hasMore }`; sin `limit` conserva la respuesta completa existente. MongoDB mantiene un índice por conversación, fecha e id.
- **Memoria del agente**: el historial de conversación consulta los últimos 21 mensajes elegibles en vez de recorrer todo el hilo para construir la ventana de 20 turnos.
- **Carga frontend**: el catálogo inglés se carga al seleccionarlo; los iconos Phosphor se aíslan en un chunk reutilizable. La entrada medida es 200,64 kB (66,99 kB gzip); el chunk de iconos es 305,72 kB (82,64 kB gzip).
- **Verificación**: builds backend/frontend; paridad es/en **709/709**; E2E focalizado de reintento y paginación **2/2**. Una corrida completa de Mensajería terminó **16/17** por timeout en insights; después MongoDB dejó de responder a E2E.

---

## Recuperación y feedback en Conversaciones (v0.4.28)

- **Errores de carga recuperables**: la bandeja y el hilo distinguen el fallo de un estado vacío y ofrecen reintento; las cargas sucesivas de mensajes descartan respuestas obsoletas al cambiar de conversación.
- **Decisiones de herramientas**: confirmar, cancelar o modificar muestra espera inmediata; la actualización del mensaje y el evento `tool:confirmed` comunican el resultado. Los errores del socket incluyen `executionId`; si la conexión falla o no llega respuesta en 15 segundos, aparece un reintento que no duplica una ejecución ya procesada.
- **Claridad y accesibilidad**: el reparto de sentimiento usa etiquetas es/en; el compositor y el editor JSON tienen etiquetas persistentes y las superficies de error anuncian estado y recuperación.
- **Verificación**: backend y frontend `build`; E2E de Mensajería **16/16**; paridad es/en **706/706**; detector Impeccable sin hallazgos.

---

## Resumen funcional (v0.4.27)

- **Resultados**: el Resumen incluye conversaciones, leads capturados (contactos no archivados), citas por estado y conversión `leads / conversaciones`.
- **Salud del bot**: `GET /api/dashboard/stats` calcula tasa real de respuesta, mediana de primera respuesta, cobertura `auto_pilot / total` y `backlog { pendingHuman, unread }`. La mediana excluye conversaciones sin respuesta.
- **Automatización**: `GET /api/dashboard/automation` devuelve la distribución de sentimiento analizado y las cinco herramientas más ejecutadas con recuento y éxito (`status: executed / total`).
- **Volumen**: `GET /api/dashboard/volume` conserva el conteo de conversaciones y añade `bySender { contact, bot, human }` por período; excluye mensajes y contenido interno de herramientas.
- **Actividad real**: se registran conversaciones creadas/cerradas, contactos creados y herramientas ejecutadas. El tracking es fire-and-forget y registra el error sin alterar el flujo del chat.
- **Rango y aislamiento**: `stats`, `outcomes`, `automation` y `volume` aceptan `days` o `from`/`to` y se limitan al proyecto resuelto por `authenticate`. Los nuevos endpoints son `GET /api/dashboard/outcomes` y `GET /api/dashboard/automation`.
- **Límite del análisis de respuesta**: `DASHBOARD_RESPONSE_CONVERSATION_LIMIT` (5000 por defecto) y `DASHBOARD_RESPONSE_TIMEOUT_MS` (5000 ms) configuran la ventana reciente y el límite de consulta en MongoDB.
- **Presentación**: Dashboard agrupa métricas bajo Resultados y Salud del bot, y añade paneles de sentimiento y herramientas. Los estados vacíos y números/fechas usan el locale activo.
- **Verificación**: backend `build`; frontend `vue-tsc --noEmit` + `build`; paridad es/en **698/698**; E2E **53/53**; layout y tema oscuro comprobados en Chromium a 1440/390.

---

## Urgencia analizada en Conversaciones (v0.4.26)

- **Análisis y persistencia**: AI Insights devuelve sentimiento y `urgency: { level, reason }` en una única llamada. `level` es `low | medium | high`; `reason` es `none | deadline | incident | escalation | repetition`. Un nivel inválido falla el análisis y un motivo inválido se normaliza a `none`. El campo es opcional en conversaciones anteriores.
- **Actualización automática**: el análisis se dispara al recibir cada mensaje del cliente, desde el primero y también en `human_takeover`; no depende de una respuesta del bot. Una cola de promesas serializa análisis por conversación.
- **Tiempo real**: `chat:insights` se emite a la room de conversación y al dashboard del proyecto, excluyendo la conversación abierta de la segunda entrega. La bandeja actualiza `aiInsights` y solo marca urgencias Media/Alta.
- **Presentación**: el panel usa el mayor nivel entre el análisis y una confirmación pendiente (mínimo Media); sin urgencia analizada conserva la heurística. Las etiquetas de motivos están en `messaging.urgency.motive.*` (es/en).
- **API**: `GET /api/conversations/:id/insights` devuelve urgencia solo si existe; el recálculo `POST` la incluye.
- **Verificación**: backend y frontend `build`; paridad es/en **668/668**; E2E de Mensajería **14/14**; prueba en Chromium visible para niveles, confirmación pendiente y actualización en vivo.

---

## Herramientas configurables y aprobaciones (v0.4.25)

El agente expone un catálogo por proyecto en la ruta **`/tools`**, con operaciones distinguibles para Agenda, Conocimiento, Inventario y Pagos.

- **Configuración y bindings**: `projects.config.tools` guarda la matriz módulo → operación → binding. El módulo interno es el único binding disponible; la validación rechaza cualquier integración no implementada. Los proyectos existentes conservan el set equivalente a las herramientas anteriores; los nuevos habilitan las operaciones internas.
- **Control**: las lecturas no requieren aprobación; crear/editar requiere confirmación del cliente; eliminar y `Pagos·crear` requieren aprobación de operador. El backend verifica el control antes de ejecutar; la aprobación reclama la solicitud atómicamente para impedir dobles ejecuciones.
- **Roles y auditoría**: el rol `approver` puede aprobar/rechazar, y `admin` funciona como respaldo. `tool_executions` registra operación, binding, estado, resultado, actor y fecha. La nueva colección `payments` almacena intenciones pendientes, nunca movimientos de dinero.
- **Herramientas de sistema**: `transfer_to_human` y `send_notification` se mantienen siempre disponibles y no se pueden apagar desde el catálogo.
- **Frontend/API**: `GET /api/tools`, `PUT /api/tools/config`, `GET /api/tool-executions`, `GET /api/tool-executions/pending` y endpoints de aprobar/rechazar. La interfaz incluye Catálogo, Aprobaciones e Historial, con enlaces a conversaciones.
- **Verificación**: backend `tsc --noEmit` + integración **30/30 (1 omitida)**; frontend `vue-tsc --noEmit` + `build`; paridad es/en; detector Impeccable **0 hallazgos**; e2e **48/48** (`--workers=1`); overflow comprobado a 1440/390.

---

## Modo enfoque en carriles de iconos (v0.4.24)

El modo enfoque de Conversaciones deja de "estrechar" las laterales y pasa a **colapsarlas a iconos**, dando casi todo el ancho al hilo.

- **Carriles de 74px**: con enfoque activo en escritorio la rejilla pasa a `lg:grid-cols-[74px_1fr_74px]` (sin selección, `[74px_1fr]`; sigue animando `grid-template-columns`).
- **Bandeja colapsada**: los controles son dos botones-icono — `MagnifyingGlass` que abre un **popover de búsqueda** (`ADropdown` con `role="dialog"`; filtra en vivo) y `Funnel` que abre la **lista de canales** (`role="listbox"` con marca del activo y punto lila en el disparador). La lista se queda en avatar + insignia de canal + no leídos (anillo) + punto mantequilla si el cliente no está guardado.
- **Ficha colapsada**: avatar, y tres bloques de solo lectura —**sentimiento** (tinte `danger`/`butter`/`lime` según el análisis; gris si no hay), **urgencia** (icono + medidor de 3 tramos) y **estado de contacto**— más el único control: **guardar contacto** con las iniciales del cliente y una insignia `Plus` (una vez creado pasa a un indicador `CheckCircle` lima). Los indicadores son `role="img"` + `aria-label`, nunca botones muertos.
- **Solo escritorio**: `focusCollapsed = isFocusMode && matchMedia('(min-width: 1024px)')`; en móvil el modo se ignora (las laterales ya se ocultan). El carril usa `overflow-visible` para que los popovers escapen del redondeo de la tarjeta; la bandeja sin enfoque conserva `overflow-hidden`.
- **i18n**: `messaging.inbox.search`, `messaging.inbox.filter`, `messaging.inbox.unread`; `messaging.focus.hint` reescrito. Icono `Funnel` reincorporado a `AIcon` (se retiró como muerto en v0.4.21).
- **Verificación**: `vue-tsc --noEmit` + `build` en verde; paridad es/en **571/571**; detector Impeccable sobre `src` en **0 hallazgos**; e2e **44/44**; medición en navegador a 1440 (carriles 74/74, popovers 256px fuera del carril, consola limpia) y a 390 (modo ignorado, sin overflow).

---

## Rail desnudo: sello desregistrado + eco (v0.4.23)

El rail deja de ser una tarjeta blanca flotante y se apoya en el lienzo, igual que el título de cada vista.

- **Sin fondo ni sombra**: `AuroraRail.vue` pierde `bg-surface shadow-card` (y `rounded-big`/`overflow-hidden`) en escritorio; el rail pasa a ser **navegación desnuda** sobre el papel, dejando ver la `aurora-haze`. El **drawer móvil** conserva `surface` + `shadow-card` (flota sobre el contenido y necesita leerse).
- **Item activo = Sello + Eco (variante C+G)**: el activo abandona el relleno de fila y se marca con
  - **sello**: cápsula `lilac-soft` con `inset: 3px -8px 3px -9px`, girada `-1.3deg`, corrida `-2px/-1px` y anillo lila interior de `1.5px` (`--lilac`);
  - **eco**: el label duplicado en `text-lilac`, corrido `+1px/+2px` por detrás (error de registro de imprenta).
  El icono Phosphor pasa a `fill` con tinta `lilac-ink`; el label, a tinta plena.
- **Hover honesto**: sobre lienzo transparente el `hover:bg-canvas` era invisible; ahora el ítem en reposo usa `hover:bg-sunken` (el activo no pinta hover: su señal es el sello).
- **Verificación**: `vue-tsc --noEmit` + `build` en verde; e2e **44/44** (incluida la auditoría de overflow y consola en 1440/390); medición en navegador de las propiedades computadas del sello y el eco (inset, anillo, color, offsets) y capturas en claro, oscuro y drawer móvil.

---

## Disciplina del sistema del frontend (v0.4.22)

Cierre de los 5 hallazgos del critique Impeccable (25/40): que las reglas de `DESIGN.md` se cumplan también en los bordes (onboarding, settings, modales).

- **El pastel vuelve a significar**: en `Dashboard.vue` las métricas agregadas (total, activos, tasa) dejan la rotación cielo/lila/lima y pasan a **tinta neutra** (`bg-sunken text-ink-2`); en `ProjectSetup.vue` el paso del agente usa **lima (bot)**, y proyecto y canales quedan neutros. El lila se conserva como **selección** (progreso, rol elegido).
- **Un solo set de iconos**: fuera los emoji. `Settings.vue` usa `SmileyMeh`/`Smiley`/`SmileyWink` y `Target`/`PaintBrush`; `ProjectSetup.vue` usa `FolderOpen`/`Robot`/`Broadcast`; el idioma se muestra como texto ("Español"/"English") sin banderas. Iconos nuevos registrados en `AIcon.vue`.
- **Selects nativos → `ADropdown`**: los `<select class="field appearance-none">` de los modales de **Clientes** (plataforma/estado) y **Usuarios** (rol/estado) y la creación de Usuarios se migran al primitivo (`role="listbox"`, trigger `field`, panel `w-full`). Se acabó el campo que parecía un input.
- **`ADropdown` operable por teclado**: al abrir enfoca el primer ítem (o el seleccionado/marcado), `ArrowUp/Down` y `Home/End` hacen roving focus sobre `[role="option"]`/`menuitem*`, `Tab` cierra y `Escape` devuelve el foco al **trigger**; los `dialog` (Notificaciones) conservan su foco propio. Se retira la prop `autoFocus` (el foco inicial es del componente).
- **Recuperación en Clientes**: el error de carga deja de ser texto plano; banner `role="alert"` con `clients.errors.load` + **Reintentar** que reejecuta `fetchContacts()` conservando filtros (paridad con Usuarios/Brain).
- **Guardado consistente en Configuración**: **Canales** y **Opciones** ganan el indicador **"Cambios sin guardar"** (`settings.unsaved`) y la barra pegajosa que ya tenía Agente; snapshots `savedChannelsJson`/`savedOptionsJson`.
- **Cierres menores**: pills con icono interno usan `:dot="false"` (fin al doble marcador); `TestChat` pasa a layout **responsive** (`flex-col` → `lg:flex-row`, `w-full` → `lg:w/1/3`); el rol de `Profile` se traduce con `users.roles.*`.
- **Verificación**: `vue-tsc --noEmit` + `build` en verde; paridad es/en **568/568**; detector Impeccable sobre `src` en **0 hallazgos**; e2e **44/44**; auditoría de overflow 1440/390 sin desborde.

---

## Limpieza de código muerto (v0.4.21)

Tanda de destilado sin cambios de comportamiento: se retira todo lo que no se estaba usando.

- **Backend**: dependencias `@langchain/textsplitters` y `cheerio` (0 importaciones); se elimina el tipo muerto `AppResponse` (`src/types/index.ts`). `pdf-parse` se conserva (fallback OCR vía `import()` dinámico).
- **`AIcon.vue`**: fuera el `LEGACY_MAP` de Material Symbols y **30 iconos Phosphor** sin uso, con sus imports; `AButton` usa `SpinnerGap` en vez del nombre heredado `progress_activity`.
- **`style.css`**: fuera las clases de componente muertas `.card`/`.btn*`/`.stamp` (ya migradas a los primitivos `A*`) y los tokens muertos `--display`, `--shadow`, `--shadow-lift`, `--r-bubble`, `--r-pill`, `--r-seal`.
- **i18n**: **68 claves muertas** por catálogo (namespace `agents.*` completo, `sidebar.*`, `app.*`, parte de `common.*`, `brain.stats.*`, etc.) y el duplicado `common.clear`.
- **Basura local**: `.DS_Store`, `spa.traineddata` (3.3 MB) y los reportes de Playwright.
- **Verificación**: `vue-tsc --noEmit` + `build` (frontend) y `tsc --noEmit` (backend) en verde; paridad es/en **567/567**.


---

## Shell consistente: modal de proyecto, idioma unificado y Memoria (v0.4.20)

- **Modal de creación de proyecto**: el ítem **"Crear nuevo proyecto"** del menú de proyectos del topbar abre un `AModal` (nombre + descripción) y crea el proyecto con agente y canales por defecto, sin navegar a `/setup`; al crear sincroniza el perfil, reconecta el socket y recarga. El disparador lleva `data-testid="project-selector"`.
- **`ADropdown`** (`components/ui/ADropdown.vue`): primitivo único de **cápsula + popover** (trigger por slot, `align`, cierre por clic fuera/Escape, foco inicial, roles `menu`/`listbox`/`dialog`, `wrapper-class`/`panel-class`). Unifica las cuatro implementaciones a mano del topbar (Proyectos · Idiomas · Notificaciones · Usuario) y los selectores de filtro/tamaño de página de **Clientes** y **Usuarios** (antes `<select>` nativos). Regla: un solo componente por objetivo.
- **Idioma**: botón **icon-only** (`Translate`) como el tema y las notificaciones, que abre un menú Español/Inglés con marca del activo (ya no un `<select>`).
- **Espaciado del lienzo**: el contenido de **todas** las vistas suma `--shell-pad` arriba (`DashboardLayout`), separando el topbar de la primera tarjeta.
- **Topbar en móvil sin desborde**: nombres de proyecto/usuario con `min-w-0` (truncan) y botones de icono con `shrink-0`; el clúster cabe en 390px.
- **Brain → Memoria** en español (inglés conserva "Brain"): rail, `topbar.brain` y `nav.brain`.
- **Tooltips** (`title`) en controles icon-only: toggle de navegación, notificaciones, paginación, cierres de modales, toggles de sección de Configuración y quitar palabra clave.
- **Spanglish es corregido**: `Memoria`, `Sin correo`/`Correo`, `Conversaciones activas`, `Buscar conversaciones…`, `Selecciona una conversación…`, `Mitchbot (IA)`, `responde desde el panel`, `Correo y contraseña son requeridos`.
- **Verificación**: `vue-tsc` + `build` en verde; paridad es/en **635/635**; detector Impeccable sobre lo tocado en **0 hallazgos**; e2e **41/41**; capturas en 1440/390 sin desborde.

---

## Shell afinado: reloj al topbar, título honesto y spanglish (v0.4.19)

- **Reloj del topbar**: sale del pie del rail y vive **anclado al clúster derecho**, pegado al botón de proyecto (`mx-auto` se retiró porque lo recentraba y se movía al cambiar de vista; visible desde `1360px`). Formato largo del idioma activo (`Tue, Sep 22, 2026 12:33 PM` / `mar, 22 sept 2026 12:33`) con `Intl`, `tabular-nums` y actualización cada 10s. Ya no queda una tarjeta de hora en el rail.
- **Configuración y Mi Perfil al menú del usuario**: el rail queda solo con marca + navegación (Panel · Conversaciones · Clientes · Brain · Usuarios); el dropdown del Usuario en el topbar gana **Configuración** y conserva **Mi Perfil** / **Cerrar sesión**.
- **Título de vista honesto**: el `page-title` deja de ser una cápsula blanca con sombra (parecía otro botón) y pasa a **texto plano** Bricolage 19px.
- **Spanglish**: fechas/horas de Conversaciones y de la bandeja usan el **locale de la app** (antes `[]` = navegador); Brain deja de mostrar `Unknown` y deriva el estado de sincronización de las fuentes (`brain.knowledge.noSources`); catálogo es corregido (`Registros` por "logs", `Copiar enlace`/`Enlace copiado` por "link", `Tokens máximos` por "Max tokens", `Palabras clave` por "Keywords", `barra lateral` por "sidebar", `chat de prueba` por "test chat", `Prueba` por "Test", `Reiniciar` por "Resetear"); `topbar.default` pasa de `BotMaster` a `Mitchbot`.
- **Modo claro por defecto**: `useTheme` y el script inline de `index.html` arrancan en claro si no hay preferencia guardada (ya no consultan `prefers-color-scheme`); el toggle sigue persistiendo en `localStorage`.
- **Verificación**: `vue-tsc` + `build` en verde; paridad es/en 622/622; detector Impeccable sobre lo tocado en 0 hallazgos.

---

## Tema oscuro y endurecimiento del critique (v0.4.18)

Cierre de la tanda completa de remediación del critique Impeccable (harden → audit → distill → colorize → polish).

- **Modo oscuro "Aurora de noche"**: tokens propios en `src/style.css` bajo `:root[data-theme="dark"]` que **recomponen** el mundo (papel púrpura cálido, tinta clara, pasteles profundos, sombras densas, `aurora-haze` tenue), no lo invierten. Toggle en `AuroraTopbar` (`data-testid="theme-toggle"`), persistencia `localStorage` (`mitchbot.theme`), arranque sin flash (script inline en `index.html`; claro por defecto desde v0.4.19). Nuevo `composables/useTheme.ts`; `useBrand` recalcula `--brand*`/`--focus` con el tema activo (`brandDerivatives(hsl, theme)`). Par de acción `--ink-solid`/`--ink-solid-contrast`.
- **Estados de error con recuperación**: Usuarios y Brain muestran error + **Reintentar** (el polling de Brain ya no se traga fallos); TestChat con banner inline, reintento, borrador conservado y anti doble-submit; el cambio de proyecto del topbar muestra su error.
- **Urgencia de 3 niveles**: el nivel **Alta** (rojo) se enciende con sentimiento negativo + último mensaje del cliente sin responder.
- **Accesibilidad**: `ASwitch` con `aria-label` (10 instancias), `scope="col"` en Brain/Usuarios, orden accesible en Usuarios, alternativa textual (`sr-only`) del gráfico de volumen y anuncio acotado (`role="status"`) en el chat público.
- **Usuarios** migrado al patrón de Clientes (búsqueda en vivo, orden, paginación con primera/última + page size); fechas/números con el locale de la app (Usuarios, Clientes, Brain).
- **Distill**: eliminados 11 componentes UI sin uso, variantes muertas de `AButton`/`APill` y tokens `--ok`/`--warn`.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; paridad es/en 621/621; detector Impeccable sobre `src/` en 0 hallazgos.

---

## Honestidad de datos y limpieza del Panel (v0.4.17)

Cierre de los minors baratos que el critique dejó abiertos.

- **Gráfico de volumen honesto**: fuera `preserveAspectRatio="none"` (los marcadores ya no se estiran en elipses); **eje Y real** con marcas 0/mitad/máximo del rango, tooltip nativo por punto (`fecha: recuento`) y `role="img"` con nombre.
- **Fuera el badge "En vivo"** sobre un valor no empujado por socket y la línea decorativa `Tráfico: 100%` del panel de canales.
- **Favicon de marca inline** en `index.html` (data-URI lila con "M") en lugar de `/vite.svg`; `useBrand` lo sigue reemplazando en runtime.
- **Reloj del rail** actualiza cada 10s (antes 30s → hasta 30s de minuto obsoleto).
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; detector en 0 hallazgos.

---

## Accesibilidad del "modo serio" (v0.4.16)

Cierre de los red flags de teclado y foco que el critique marcó alrededor de las acciones de alto riesgo.

- **Orden por teclado en Clientes**: las cabeceras ordenables pasan a `<th scope="col" :aria-sort>` con un `<button>` interno (antes eran `<th @click>` sin foco ni teclado → fallaba WCAG 2.1.1).
- **Popover de notificaciones**: al abrir recibe foco (`tabindex="-1"` + `nextTick`); Escape sigue cerrándolo.
- **Drawer del rail en móvil**: `role="dialog"` + `aria-modal`, foco al primer enlace al abrir, Tab atrapado dentro y Escape para cerrar.
- **Live region acotada en Conversaciones**: el hilo deja de ser `role="log"` global; un `role="status"` `sr-only` anuncia solo los mensajes entrantes del cliente (`messaging.a11y.incoming`), evitando re-anunciar bloques completos.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; paridad es/en 608/608; detector en 0 hallazgos.

---

## Brain como conocimiento, no como gestor de archivos (v0.4.15)

El critique señaló que el foso del producto (RAG) se presentaba como una tabla genérica con tres tarjetas de stat al pie.

- **Cabecera de conocimiento**: una sola tarjeta lidera con **vectores · fuentes · sincronización** y una **cobertura** (%) con barra segmentada por estado (lime=indexado, mantequilla=procesando, cielo=en cola, rojo=error) y su leyenda con recuentos reales.
- **Acciones de fila con etiqueta**: "Ver texto", "Logs" y "Eliminar" dejan de depender solo del `title` (visibles desde `xl`, `aria-label` siempre).
- Claves `brain.knowledge.*` y `brain.sources.label{Extracted,Logs,Delete}` (es/en).
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; paridad es/en 607/607; detector Impeccable sobre `src/` en 0 hallazgos.

---

## Modo serio en Conversaciones (v0.4.14)

Tomar el control era la acción más importante del producto y la menos confirmada: un click inmediato sin aviso ni acuse.

- **Confirmación en modal** (`AModal`) antes de abandonar el piloto automático y antes de devolvérselo al bot, con copy que nombra la acción y su consecuencia.
- **Botón de modo con semántica pastel**: "Tomar control" en **lila** (persona) y "Piloto automático" en neutro, según `DESIGN.md`.
- **Acuse honesto**: banner `role="status"` efímero (4s) en el hilo tras el cambio; la pill de la cabecera sigue siendo el estado de solo lectura.
- Claves `messaging.mode.{takeoverTitle,takeoverBody,takeoverConfirm,autoPilotTitle,autoPilotBody,autoPilotConfirm,takenOver,autoPilotRestored}` (es/en).
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; paridad es/en 600/600.

---

## Mensajería a prueba de fallos (v0.4.13)

El critique halló que las tres acciones de mayor riesgo de Conversaciones se tragaban el error en `console.error`, indistinguible del éxito para el operador.

- **Banner de error inline** en el hilo (`role="alert"`, descartable) para envío, cambio de modo, guardado de contacto y análisis de sentimiento; claves `messaging.errors.*` (es/en).
- **Borrador conservado**: si el envío falla, el texto vuelve al compositor.
- **Anti doble-submit**: estado `isSending` deshabilita el botón de enviar mientras hay un mensaje en vuelo.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; paridad es/en 592/592.

---

## Shell honesto: adiós a los instrumentos falsos del topbar (v0.4.12)

El critique Impeccable halló un **P0**: `TopbarContext.vue` renderizaba instrumentos de vista (rango/granularidad, contadores de Messaging, chips de canal, vectores de Brain, roles de Usuarios) con **datos inventados** (`12 activas`, `61 trozos`) y **sin handlers** —botones y chips que no hacían nada—, violando el Principio 3 de `PRODUCT.md` ("solo elementos con comportamiento real").

- **Eliminado** `apps/frontend/src/components/layout/TopbarContext.vue` y su uso/import en `AuroraTopbar.vue`. Los instrumentos reales ya viven dentro de cada vista (rango y granularidad en el Panel, filtros y page size en Clientes, stats en Brain, modo en Conversaciones); el topbar queda con **título + invariantes**, sin controles decorativos.
- **`DESIGN.md`**: la sección Layout deja de prometer instrumentos en el topbar; los controles pertenecen a la superficie que los posee.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde.

---

## Margen uniforme del shell (v0.4.11)

El contenedor `pl-[242px]` dejaba solo **4px** entre el rail y las tarjetas, frente a los **14px (3.5)** del resto del lienzo. Se tokeniza el shell en `style.css` y se unifica el respiro a `--shell-pad` (14px) en las cuatro direcciones:

- **Tokens**: `--shell-pad: 0.875rem` · `--rail-w: 14rem` (224px) · `--rail-offset: calc(var(--rail-w) + 2 * var(--shell-pad))` (252px).
- **`AuroraRail`**: usa `w-[var(--rail-w)]` e `inset-y-[var(--shell-pad)] left-[var(--shell-pad)]`.
- **`DashboardLayout` y `AuroraTopbar`**: pasan de `px-3.5 … md:pl-[242px]` a `px-[var(--shell-pad)] … md:pl-[var(--rail-offset)]` (topbar `pt/pb`, layout `pb`). Topbar y contenido comparten el token, así que ya no pueden desalinearse.
- **Resultado medido en navegador** (1440): rail `[14, 238]`, contenido a `252` → gutter **14px**; topbar a 14px del borde y separado 14px de las tarjetas; cápsulas y tarjetas comparten borde izquierdo (`Δ = 0`). A 390 el rail se oculta y el margen es 14px uniforme; sin overflow horizontal en 390/820/1440/3440.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; detector Impeccable (`--scope layout` y global) en 0 hallazgos.

---

## Modo enfoque en Conversaciones (v0.4.10)

Un toggle en la **cabecera del hilo** de Conversaciones (`Messaging.vue`) estrecha las tarjetas laterales para dar más ancho al hilo:

- **Rejilla adaptable**: normal `lg:grid-cols-[minmax(320px,30%)_1fr_300px]` → enfoque `lg:grid-cols-[minmax(248px,22%)_1fr_240px]` (sin selección, la bandeja pasa a `minmax(248px,22%)`). Transición de `grid-template-columns` de 300ms, cubierta por el `prefers-reduced-motion` global.
- **Control honesto**: cápsula con `aria-pressed` e icono Phosphor (`ArrowsOutSimple` al entrar, `ArrowsInSimple` al salir) y `title` que describe el efecto; visible solo en `lg+` (en móvil las laterales ya se ocultan), con etiqueta a partir de `xl`.
- **Persistencia**: `localStorage` (`mitchbot.messaging.focus`).
- **i18n**: `messaging.focus.toggle` / `messaging.focus.hint` (es/en). Iconos nuevos en `AIcon.vue`.
- **Corrección**: la fila de **Urgencia** del panel de detalle desbordaba 36px con el panel estrecho; ahora usa `flex-wrap` + `min-w-0` y el motivo cae a una segunda línea.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; detector Impeccable en 0 hallazgos; medición real en navegador a 1024/1180/1280/1440 (el hilo gana ancho en todos los casos) y a 390 (el control no se muestra).

---

## Cierre del critique Impeccable (v0.4.9)

Tras el critique (`/impeccable critique`, 24/40) sobre Aurora se implementaron los 8 arreglos priorizados:

- **Panel honesto**: se eliminan los **deltas inventados** (`+12%`, `+1.2%`, `+0.5%`) y la tarjeta **"Conversión de leads"** con valor fijo; se retira la affordance muerta "Ver todo" de Actividad. El `error` capturado ahora se muestra con botón **Reintentar** y las métricas muestran **skeleton** mientras cargan (nunca ceros falsos).
- **Semántica de canal unificada** (`src/lib/channels.ts`): un único `CHANNEL_META` (WhatsApp=lima, Instagram=lila, Web=cielo) con helpers `channelMeta/channelTone/channelFill/channelInk/channelIcon`, consumido por Panel, Conversaciones y Clientes. Elimina la contradicción Panel vs resto.
- **Conversaciones en móvil**: bandeja **o** hilo (con botón de regreso), Detalles solo en `lg+`; el grid multi-columna queda para escritorio.
- **Confirmaciones y diálogos del mundo**: borrado de fuentes en Brain con `AModal`; "Modificar" herramienta en Conversaciones y TestChat con editor JSON en `AModal`; errores de Clientes en banner inline. Ya no hay `alert()`/`window.prompt`.
- **Configuración → Agente IA por tareas**: 6 subsecciones plegables (Identidad, Voz y tono, Conocimiento, Generación, Mensajes, Instrucciones) con `aria-expanded`/`aria-controls` y **guardado pegajoso** con estado **sucio** (`isAgentDirty`).
- **Copy/i18n**: Login traducido (`login.headline.*`, `login.badges.*`, `login.accountsNote`); estados legibles (`messaging.details.status.*`, `brain.status.*`); sin títulos duplicados en Users/Configuración/DevTests (el título vive en el topbar).
- **Foco visible**: selects de Clientes y selector de idioma del topbar con anillo `focus-visible`; `AuroraTopbar` recibe `navOpen` para `aria-expanded` real; el rail usa el locale de la app.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; detector Impeccable sobre `src/` en **0 hallazgos**; paridad `es.json`/`en.json`.

---

## Layout de contenido centrado (v0.4.8)

La estructura del dashboard no tenía ancho máximo: en pantallas ultrawide el contenido se estiraba de borde a borde (tarjetas/gráficos enormes, tablas con columnas separadísimas) y en Configuración el formulario quedaba pegado a la izquierda. Se implementa la norma de `DESIGN.md` (contenido a **1400px centrado**):

- **`DashboardLayout`**: el `<main>` envuelve el slot en `mx-auto w-full max-w-[1400px]`. Aplica a **todas las vistas actuales y futuras** (Panel, Conversaciones, Clientes, Brain, Usuarios, Configuración, Mi Perfil, DevTests).
- **`AuroraTopbar`**: la fila de cápsulas se envuelve en el mismo contenedor (`max-w-[1400px]`) para que título, instrumentos e invariantes queden alineados con el contenido.
- **Configuración**: la columna (título, banners, tabs y paneles) se centra en `max-w-3xl`; se retiran los `max-w-*` internos para que todo comparta el mismo ancho. Los tabs se estrechan o envuelven al añadir items.
- **Panel**: la rejilla de métricas pasa a `repeat(auto-fit, minmax(240px, 1fr))`: al añadir métricas se agregan columnas (o se estrechan) en vez de fijarse en cuatro.
- **Verificación**: capturas en 3440/1440/820/390; `vue-tsc --noEmit` y `build` en verde; detector Impeccable sobre los archivos tocados en 0 hallazgos.

---

## Endurecimiento de accesibilidad (v0.4.7)

Tras la auditoría Impeccable (`audit`) sobre Aurora se cerraron los hallazgos P1/P2 de mayor valor:

- **Foco visible**: tokens `--focus` / `--focus-halo` (tono de marca con contraste ≥3:1); `useBrand` deriva `--brand*` con *clamping* real (`brandDerivatives`) y el foco global, `.field` y los inputs con `outline-none` (anillo `focus-visible` / `focus-within`) ya no quedan invisibles. `--brand-h` estático = 270 y `--brand-ink` = `#4a2470`.
- **Móvil**: el topbar tiene una cápsula de menú (<768px) que abre el rail como drawer flotante + backdrop; el rail emite `navigate` para cerrarse.
- **Diálogos**: `AModal.vue` (role=dialog, aria-modal, focus trap, Escape, foco inicial y restauración) reemplaza los overlays manuales de Usuarios, Clientes y Brain. Overlays con token `--overlay`.
- **Teclado/a11y**: menús del topbar con `aria-haspopup`/`aria-expanded` + `role` + Escape; `ATabs` con `tabindex` móvil y flechas; `role="log"`/`aria-live` en Conversaciones y chat público; `aria-label` en botones-icono y paginación; skip-link; `prefers-reduced-motion`.
- **Seguridad**: `lib/markdown.ts` escapa el HTML antes de aplicar el formato (fin del XSS almacenado en `renderMarkdown`); el detalle de actividad del Panel ya no usa `v-html`.
- **i18n**: el rail y los nuevos controles usan claves (`nav.*`, `nav.primary`, `common.clear/firstPage/lastPage`, `a11y.skipToContent`).
- **Limpieza**: retirados tokens Tailwind muertos (shadcn, `blue`, `darkMode`, `--radius`, keyframes de acordeón) y dependencias sin uso (`class-variance-authority`, `clsx`, `lucide-vue-next`, `radix-vue`, `tailwind-merge`, `tailwindcss-animate`). La rampa tipográfica real queda declarada en `DESIGN.md`.
- **Verificación**: `vue-tsc --noEmit` y `build` en verde; detector Impeccable sobre `src/` en 0 hallazgos.

---

## Sistema de Diseño (v0.4.6 "Aurora")

- **Mundo adoptado**: **«Aurora»** (antes mock, ahora sistema implementado). Reemplaza a «App Cálida» (v0.4.0, congelado). Norte: *"El Estudio Optimista"* — lienzo de papel cálido `#F7F3EF` con niebla de pasteles en los bordes (`aurora-haze`), tinta negra `#0B0B0C`, tipografía display enorme y una **familia pastel que significa algo**: lila=persona/selección · lima=bot/éxito · cielo=Web · mantequilla=espera.
- **Tokens** (`apps/frontend/src/style.css` + `tailwind.config.js`): `--canvas/surface/sunken/line/ink-1/2/3`, los cuatro pasteles con `-ink`/`-soft`, radios `--r-card 20px` / `--r-big 28px` / `--r-field 16px` / `--r-bubble 20px`, sombras difusas de dos capas (`--shadow-card`, `--shadow-pop`) y utilidades Tailwind `canvas`, `surface`, `sunken`, `line`, `ink`, `sky/lime/lilac/butter`, `rounded-card/big/field`, `font-display/body`, `shadow-card/pop`.
- **Tipografía**: **Bricolage Grotesque** (display; ejes `opsz`/`wdth`/`wght`) + **Hanken Grotesk** (cuerpo, cifras tabulares). Ya no se usa Nunito ni la webfont de Material Symbols.
- **Iconografía**: **Phosphor** (`@phosphor-icons/vue`) envuelto en `src/components/ui/AIcon.vue` (6 pesos, `fill` para el nav activo, mapa de nombres Material heredados). El set es intercambiable desde `AIcon`.
- **Componentes base** (`apps/frontend/src/components/ui/`): `AIcon`, `AButton`, `APill`, `AAvatar`, `ASwitch`, `ATabs`, `ADropdown`, `AModal`, `AEmptyState`, `ABubble`.
- **Shell** (`apps/frontend/src/components/layout/`): `AuroraRail` (rail flotante con marca centrada sin subtítulo y nav con iconos Phosphor) + `AuroraTopbar`, compuestos dentro de `DashboardLayout`. El **topbar es una fila de cápsulas flotantes** (sin fondo/borde/blur): izquierda = título de página en **texto plano** (Bricolage 19px, ya no cápsula) + **reloj centrado** en el hueco (visible desde 1360px), derecha = invariantes (Proyectos · Idiomas · Tema · Notificaciones · **Usuario**, cuyo dropdown reúne **Configuración / Mi Perfil / Cerrar sesión**). Por debajo de 768px el rail se abre como **drawer** desde una cápsula de menú del topbar.
- **Acento de marca** (`useBrand.ts`): default `#E2C6FF` (lila). `--brand*` es **identidad y selección** (item activo, avatar, punto de proyecto, foco), **no** primario de acción — el primario es siempre **tinta negra**.
- **Documentación normativa**: `apps/frontend/DESIGN.md` + `apps/frontend/.impeccable/design.json` (re-documentados para Aurora). Diseñar contra los tokens `--brand*`, nunca contra un hue fijo.
- **Estado de migración**: el shell Aurora, los componentes base y **todas las vistas del dashboard están migrados** (cero clases `warm-*` en el código). Vistas reales en Aurora: Panel, Conversaciones (con tarjeta de **Sentimiento** y bloque de **Urgencia**), Clientes, Brain, Usuarios, Configuración, Mi Perfil, Login, Setup, TestChat y DevTests. El **Resumen (Dashboard) se conserva tal cual** (datos reales) para refinarlo en una tanda posterior. La marca por proyecto se persiste en `project.config.brand` (ver v0.4.35).
- **Urgencia en Conversaciones**: bloque de UI con placeholder (no toca backend); claves en `messaging.urgency.*` (es/en).
- **Prototipo fiel**: `apps/frontend/.impeccable/mocks/aurora/` (12 vistas con las etiquetas reales del producto, datos marcados como sintéticos; servible con `python3 -m http.server` en esa carpeta).

---

## Documentación de diseño histórica (v0.4.3)

- El mundo "App Cálida" quedó documentado en DESIGN.md desde su adopción (v0.4.0) hasta su reemplazo por Aurora (v0.4.6). Sus clases `warm-*` ya **no existen** en el código (migración completa en v0.4.6).

---

## Rediseño total (v0.4.2 "Mesa de Exposición") — Estado

- **Dirección decidida**: reemplazo completo del mundo visual por la fusión **"Mesa de Exposición"** — topología de tablero de despacho (circuitos de conversación con lámpara: verde=bot, magenta=humano, hueco=cerrado; llave "TOMAR CONTROL") + materialidad de imprenta (papel #F1EDE6/#FBF9F3, tinta #1C1E22, carga por hatching, magenta #C13A7C único acento de acción, regla tachada al cerrar, cruz 90° para conflictos). Tipografía: Barlow Condensed (etiquetas), IBM Plex Mono (datos tabulares), Spline Sans (cuerpo).
- **Prototipo de exploración** (12 vistas): se eliminó del repositorio en v0.4.32 y sigue disponible en el historial de git.
- **Ronda 4 de exploración (v0.4.5)**: dos mundos nuevos con prototipo completo de 12 vistas cada uno — **«Aurora»** (`mocks/aurora/`, del pastel optimista de *orivo.webflow.io*: suelo cálido, tinta negra, tipografía enorme, pasteles con papel semántico) y **«Bóveda»** (del cool premium de *per-ment.webflow.io*: blanco frío, azul noche + violeta único, rejilla fina, nav en cápsula flotante, serif itálica). En v0.4.32 se eliminaron Bóveda y el comparador de mundos (están en el historial de git); solo se conserva `mocks/aurora/`, el prototipo del sistema adoptado.
- Contrato de dirección en `apps/frontend/.impeccable/surfaces/…` (brief de Messaging). La identidad de marca por proyecto se persiste en `project.config.brand` (cerrado en v0.4.35).
- El resto del sistema actual "App Cálida" (v0.4.0) queda congelado: no mezclar estilos nuevos con los mapeos `warm-*` existentes hasta la migración completa.

---

## Sistema de Diseño (v0.4.0 "App Cálida")

- **Tokens** (`apps/frontend/src/style.css`): paleta CSS con suelo cálido (`--ground` `#fbf7f2`), tinta parda (`--ink-1 #2e2a26`), hairlines cálidas y componentes base (`.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.field`, `.stamp`). Tipografía Nunito, radios por rol (`--r-card`, `--r-bubble`, `--r-seal`) y sombras difusas.
- **Identidad de marca por proyecto** (`apps/frontend/src/composables/useBrand.ts`): nombre, color y logo se configuran en **Configuración → Identidad** y persisten en `project.config.brand` (validado con Zod en `project.controller.ts`, logo hasta 200 KB). `useBrand` inyecta las variables `--brand-*` en `:root` (HSL + variantes `hover`/`deep`/`soft`/`softer`/`ink`), calcula `--brand-contrast` según luminancia y teñe el favicon con canvas. Se carga el config del proyecto al iniciar la app, así que cambiar el color re-tematiza la app completa en vivo.
- **Migración gradual de vistas**: las clases `blue-*` de Tailwind se mapean al acento de marca y las utilidades `warm-*` exponían los tokens (`tailwind.config.js`, hoy retirados). En v0.4.6 todas las vistas migraron a Aurora y las clases `warm-*` ya no existen.

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
├── README.md             # Visión, capacidades y puesta en marcha (cara pública; mantener versión y roadmap al día)
├── LICENSE.md            # Functional Source License 1.1 (FSL-1.1-ALv2); pasa a Apache 2.0 a los 2 años
├── AGENTS.md             # Este archivo
└── changelog.md          # Historial de cambios detallado
```

### Stack Tecnológico

| Capa | Tecnologías |
|:-----|:------------|
| **Runtime** | Node.js, TypeScript, tsx (desarrollo) |
| **Backend** | Express 4, Socket.io, Multer, Zod v4, JWT |
| **Frontend** | Vue 3 (Composition API + `<script setup>`), Vite, Tailwind CSS 3, Pinia, Vue Router 4, Phosphor Icons, vue-i18n |
| **Base de datos** | MongoDB 8 (principal), Redis (caché y colas BullMQ), Qdrant (vectorial) |
| **IA / LLM** | LangChain.js v1.x (`@langchain/core`, `@langchain/openai`, `@langchain/qdrant`) |
| **Proveedores IA** | OpenRouter (único proveedor: LLM, embeddings y OCR) |
| **Embeddings** | OpenRouter (`openai/text-embedding-3-small` por defecto) |
| **Mensajería** | Socket.io (tiempo real), BullMQ sobre Redis (pasarela de canales) |
| **Auth** | JWT (jsonwebtoken), bcryptjs (12 rounds) |
| **Infraestructura** | Docker Compose, pnpm workspaces |
| **Pruebas** | `node:test` + tsx (backend), Vitest + happy-dom + Vue Test Utils (frontend), Playwright (E2E) |

---

## Servicios Docker

```yaml
# docker-compose.yml
mongodb:    → puerto 27017  # Base de datos principal (mongo:8)
redis:      → puerto 6379   # Caché y colas BullMQ (AOF)
qdrant:     → puerto 6333   # Base de datos vectorial (RAG)
```

> Nativo: los 3 servicios tienen `healthcheck`. `ollama`, `open-webui` y `nats` se eliminaron (sin uso tras el refactor a OpenRouter). La pasarela de canales (v0.5.0) usa BullMQ sobre el Redis existente como broker, sin servicios nuevos.

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
│   ├── webhooks.controller.ts      # Webhooks de canales de Meta (WhatsApp, Instagram)
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
│   ├── insights.service.ts         # Análisis de sentimiento y distribución (AI Insights)
│   ├── auth.service.ts             # Autenticación JWT + bcrypt
│   └── user.service.ts             # Gestión de usuarios
├── models/                         # Schemas MongoDB (10 colecciones)
├── routes/                         # Definición de rutas Express
├── middleware/                     # Auth, validación Zod, errores, upload
├── channels/                       # Pasarela de canales: adaptadores, entrada, salida, breaker
│   ├── meta/                       # Común de Meta: firma, Retry-After, proyecto por cuenta
│   ├── whatsapp/                   # Cloud API: parser del webhook, adaptador y enrutado
│   └── instagram/                  # Messaging API: parser, adaptador, perfil y enrutado
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
├── i18n.ts                         # Instancia vue-i18n (es por defecto, persistencia)
├── locales/                        # Catálogos de traducción (es.json, en.json)
├── style.css                       # Estilos globales + Tailwind
├── views/
│   ├── Login.vue                   # Autenticación
│   ├── ProjectSetup.vue            # Onboarding (3 pasos)
│   ├── Dashboard.vue               # Métricas y analytics
│   ├── Messaging.vue               # Centro de mensajería en tiempo real
│   ├── Clients.vue                 # Gestión de clientes (contactos)
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
- **Respuesta como mensaje completo**: el bot **no emite fragmentos parciales** (`isDone: false`); mientras el modelo genera se mantiene un placeholder vacío que da el indicador de escritura y, al finalizar, la respuesta completa llega en un único mensaje final (`isDone: true`) tanto en respuestas directas como tras ejecutar herramientas. El frontend (`Messaging.vue`, `TestChat.vue`, `useConversations`) aplica únicamente el mensaje final.
- **Renderizado Markdown**: Los mensajes del bot soportan negritas e itálicas.
- **Filtros y búsqueda**: los chips de canal se generan desde `project.config.channels` (solo los habilitados + "Todos"); el filtrado por plataforma y la búsqueda por nombre/último mensaje son en cliente. Los mensajes se agrupan por día con encabezados reales.
- **Toma de control manual bidireccional**: "Take Over" pasa a `human_takeover` y "Auto-Pilot" devuelve a `auto_pilot` vía `PUT /api/conversations/:id/mode`; el badge se actualiza en vivo con `chat:status` y el bot no responde mientras dure el takeover.
- **Guardar como contacto**: acción explícita `POST /api/conversations/:id/contact` respaldada por `ensureContactCreated(id, { force: true })`; es idempotente y funciona aunque `autoCreateContact` esté deshabilitado.
- **No leídos reales**: el badge del sidebar suma los `unreadCount` del proyecto activo mediante el composable `useConversations` (estado de módulo compartido). Solo los mensajes entrantes del cliente (`contact`) incrementan el contador; los del bot y del agente humano **no** suman. Al abrir una conversación se persiste la lectura vía `PUT /api/conversations/:id/read` (`unreadCount = 0`) y se emite `chat:read` a la room del proyecto para sincronizar el resto de sesiones; un mensaje entrante en la conversación abierta se re-marca como leída de inmediato (estilo WhatsApp), sin que el badge suba. La actualización en vivo del sidebar llega por `chat:message` (también entregado a la room exclusiva del dashboard `project:<id>:dashboard`) y `chat:new_conversation`. Una conversación nueva creada por el cliente nace con 1 no leído.
- **Sin selección por defecto**: al entrar a Messaging **no** se autoselecciona ninguna conversación; se muestra el estado vacío hasta que el agente elija una. El deep-link `?conversation=<id>` sigue resolviendo la conversación solicitada (botón "Ver conversación" de Clients).
- **Compositor honesto**: solo expone acciones funcionales (enviar, tomar control); se retiraron chips de sugerencia, emoji, adjuntos, menú y el indicador "online" simulado.
- **Modo enfoque**: toggle en la cabecera del hilo que estrecha la bandeja y el detalle del cliente para dar ancho al hilo (solo `lg+`, persistido en `localStorage`). Ver v0.4.10.
- **AI Insights**: análisis de **sentimiento y su distribución** (sin resumen) persistido en `conversation.aiInsights`. `GET /:id/insights` devuelve solo sentimiento y `sentimentScores` (aunque existan resúmenes antiguos en la BD) y `POST /:id/insights` recalcula (el `$set` limpia `aiInsights.summary` con `$unset`); se emite `chat:insights`. El análisis automático corre fire-and-forget tras cada respuesta del bot (un fallo no afecta la respuesta). El modelo se resuelve desde `OPENROUTER_INSIGHTS_MODEL` con fallback a `OPENROUTER_LLM_MODEL`.

### 2. Módulo de Clientes (Contactos)

- En la interfaz el módulo se llama **"Clients"** (ruta `/clients`, con redirección desde `/contacts`). El backend, la API (`/api/contacts`), la colección `contacts` y los tipos internos conservan su nombre: el renombre es solo de presentación y de frontend.
- Se puede editar, buscar, filtrar, ordenar y paginar clientes.
- El cliente/contacto es un perfil con todos los datos (nombre, email, teléfono, plataforma, tags, metadata).
- **No se puede crear un contacto arbitrario** — Se crea automáticamente al contestar el primer mensaje del cliente, o de forma explícita desde una conversación ("Guardar como contacto", idempotente).
- **No se puede eliminar un contacto** — Solo se puede archivar (soft delete) y restaurar.
- **Ver conversación**: cada fila con conversación ofrece un botón que abre la bandeja con esa conversación preseleccionada (`/messaging?conversation=<id>`). La conversación se resuelve en el servidor por `contactId` (`GET /api/conversations?contactId=<id>`, validado y acotado al proyecto), prefiriendo la activa y, en su defecto, la más reciente. Si el cliente no tiene conversación vinculada, la acción no se ofrece.
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
- **Idioma del agente limitado a español e inglés**: el tipo `AgentPersonality['language']`, el `z.enum` de `agents.controller.ts` y `LANGUAGE_MAP` de `prompt-builder.service.ts` solo aceptan `'es' | 'en'`; no se ofrecen Portugués ni "Detectar". Los agentes con valores obsoletos se normalizan a español con `pnpm --filter @mitchbot/backend exec tsx src/scripts/normalize-agent-language.ts` (el fallback del prompt también cae a español).

### 4.5. Agent Tool Use (Function Calling)

Ver sección **9. Sistema de Herramientas (Tool Use)** más abajo.

### 4.6. Proveedores OCR

- Proveedor único: **OpenRouter** (modelos de visión, tipo de proveedor `ocr`).
- El modelo se define en `OPENROUTER_OCR_MODEL`; los parámetros (`scale`, `maxPages`, `batchSize`, `timeout`) se configuran vía `configService` (`rag.ocr_scale`, `rag.ocr_max_pages`, `rag.ocr_batch_size`, `rag.ocr_timeout_ms`).
- La credencial proviene de `OPENROUTER_API_KEY` (entorno).

### 5. Módulo Usuarios del Sistema

- CRUD completo: crear, editar, buscar, filtrar, ordenar y paginar usuarios.
- Roles disponibles: **admin**, **support**, **assistant** y **approver**. `approver` resuelve solicitudes sensibles de herramientas.
- El usuario tiene un espacio para editar sus datos y configuraciones (vista Profile).
- El primer usuario registrado se convierte automáticamente en **admin**.

### 6. Módulo Login

- Inicio de sesión con correo y contraseña (JWT con expiración de 24h).
- **Esta app solo permite iniciar sesión**: el registro de usuarios ocurre en otro sitio (el endpoint `POST /auth/register` existe para el seed/e2e).
- Si el servidor rechaza la sesión (`401/403`, token inválido o cuenta desactivada), se limpia la sesión local y se redirige silenciosamente al **login**.
- Passwords hasheados con bcrypt (12 rounds).

### 7. Seguridad

- Autenticación vía JWT en cada request protegido.
- Middleware de autorización por roles (`admin`, `support`, `assistant`, `approver`).
- API keys de proveedores **no** se almacenan en la BD: provienen de variables de entorno.
- Variables de entorno validadas con Zod al arrancar el servidor.

### 9. Sistema de Herramientas (Tool Use)

El agente ejecuta operaciones del catálogo según la configuración del proyecto.

- **Catálogo** (`src/tools/modules/`): Agenda, Conocimiento, Inventario y Pagos ofrecen operaciones canónicas por separado, cada una con esquema propio, binding interno y control (`ninguna`, `confirmacion_cliente`, `aprobacion_operador`).
- **Configuración**: `projects.config.tools` contiene la matriz módulo → operación → binding. Los proyectos antiguos sin esa matriz usan los valores equivalentes al catálogo previo; los nuevos habilitan las operaciones internas. `transfer_to_human` y `send_notification` son herramientas de sistema siempre disponibles.
- **Binding dinámico** (`services/tool.service.ts`, `services/ai.service.ts`): el modelo recibe las operaciones activas del proyecto asociado a la conversación. El binding interno es el único implementado; Zod rechaza otras integraciones.
- **Control cliente**: crear/editar emite `confirmation_request` y el cliente confirma, cancela o modifica vía WebSocket `tool:confirm` (`confirm` / `cancel` / `modify`).
- **Control operador**: eliminar y `Pagos·crear` quedan en estado `pending_approval`; solo `approver` o `admin` pueden aprobar/rechazar. La solicitud se reclama atómicamente antes de ejecutarse y notifica al proyecto con `admin:notification`.
- **Persistencia**: `tool_executions` conserva herramienta, operación, binding, parámetros, resultado, estado y actor/fecha de decisión. `payments` almacena intenciones pendientes, no procesa dinero.
- **Superficie de operador**: `/tools` reúne Catálogo, Aprobaciones e Historial. El historial se filtra por herramienta, operación, binding, estado y fechas, y enlaza a la conversación de origen.
- **Contexto del modelo**: los mensajes internos `tool_call`/`tool_result` quedan fuera del historial enviado al LLM; el chat público no muestra esos detalles internos.

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

### 11. Shell y navegación

- **Nomenclatura de módulos**: el rail y los títulos del Topbar muestran **"Brain"**, **"Clients"** y **"Tools"**. La ruta de clientes es `/clients` y `/contacts` redirige a ella; herramientas vive en `/tools`.
- **Rango de fechas del panel**: el widget estático "Last 30 Days" del Topbar se eliminó. El Dashboard ofrece un control real de últimos 7/30/90 días (30 por defecto) que recalcula métricas, canales y volumen; los toggles Diaria/Semanal/Mensual cambian la granularidad del volumen. El backend (`analytics.service`/`dashboard.controller`) acepta `days` o `from`/`to` y `period = daily | weekly | monthly`. Todas las rutas del dashboard exigen autenticación y acotan las métricas (`stats`, `outcomes`, `automation`, `volume`, `channels`, `activities`) al proyecto resuelto (`req.projectId`).
- **Centro de notificaciones**: el Topbar escucha `admin:notification` (emitido por la tool `send_notification`), acumula las notificaciones en estado local, muestra el indicador solo si hay no leídas y permite marcarlas como leídas o limpiarlas. El alcance es la sesión activa (sin persistencia en base de datos).

### 12. Internacionalización (i18n)

- **Librería**: `vue-i18n` en modo Composition API (`legacy: false`), registrada en `main.ts` y configurada en `i18n.ts`.
- **Catálogos**: `src/locales/es.json` y `src/locales/en.json`, con claves por dominio (`common.*`, `nav.*`, `topbar.*`, `dashboard.*`, `messaging.*`, `clients.*`, `brain.*`, `settings.*`, `users.*`, `agents.*`, `profile.*`, `devTests.*`, `login.*`, `setup.*`, `publicChat.*`). **Español por defecto** y fallback a español; ambos catálogos deben tener las mismas claves.
- **Uso**: `import { useI18n } from 'vue-i18n'; const { t } = useI18n();` en `<script setup>`, y `{{ t('clave') }}` / `:placeholder="t('clave')"` en plantillas. Las etiquetas de arrays estáticos se resuelven en `computed(() => [...])` para que reaccionen al cambio de idioma.
- **Selector de idioma**: en el `Topbar` (`data-testid="language-selector"`); aplica el idioma en vivo sin recargar, lo persiste en `localStorage` (`mitchbot.locale`) y actualiza el atributo `lang` del documento.
- **Chat público (TestChat)**: usa su catálogo propio (`publicChat.*`) y un composer **aislado** cuyo idioma proviene de la personalidad del agente del proyecto (`GET /api/public/test-chat/:slug/config`, sin autenticación); es independiente del idioma elegido en el dashboard.
- **Fuera de alcance**: los mensajes de error del backend permanecen en español (requerirían códigos de error en la API).

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
- **Generación con streaming interna**: el modelo se consume con `.stream()` (`generateResponseStreamWithTools`), pero el bot **no** propaga los fragmentos al cliente: emite la respuesta completa en un único mensaje final.
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
| **Conversations** | `GET /export` y `GET /:id/export` (CSV/JSON, solo admin y support), `POST /:id/template` (plantilla de WhatsApp), `GET /` (filtro opcional `?contactId=`), `GET /:id`, `GET /:id/messages` (paginación opcional `?limit=&before=`), `POST /:id/messages`, `POST /:id/messages/:messageId/retry`, `PUT /:id/mode`, `PUT /:id/status`, `PUT /:id/read`, `POST /:id/contact`, `GET /:id/insights`, `POST /:id/insights` | Mensajería, historial paginado, resolver conversación por contacto, marcar leída, guardar contacto e insights |
| **Brain** | `GET /sources`, `POST /upload`, `POST /text`, `DELETE /sources/:id`, `POST /search` | Base de conocimiento RAG |
| **Agents** | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Agentes IA |
| **AI Models** | `GET /remote/openrouter`, `GET /providers/active/:type`, `GET /agent/models` | Listado de modelos (OpenRouter) y proveedor activo |
| **Config** | `GET /`, `PUT /` | Configuración global |
| **Project** | `GET /`, `GET /check`, `GET /list`, `PUT /active`, `POST /`, `PUT /`, `GET /channels/status`, `GET /whatsapp/templates` | Gestión de proyectos (multi-proyecto por usuario); `PUT` responde 409 si el número de WhatsApp o la cuenta de Instagram ya son de otro proyecto |
| **Appointments** | `GET /`, `GET /:id`, `PATCH /:id/status` | Citas agendadas por el agente |
| **Orders** | `GET /`, `GET /:id`, `PATCH /:id/status` | Pedidos creados por el agente |
| **Tools** | `GET /`, `PUT /config` | Catálogo de operaciones y configuración por proyecto |
| **Tool Executions** | `GET /`, `GET /pending`, `POST /:id/approve`, `POST /:id/reject` | Historial, solicitudes pendientes y resolución por rol |
| **Dashboard** | `GET /stats`, `GET /outcomes`, `GET /automation`, `GET /volume`, `GET /channels`, `GET /activities`, `GET /sla` | Analytics autenticada y acotada al proyecto activo (`X-Project-Id`/`activeProjectId`) |
| **Webhooks** | `GET /whatsapp`, `POST /whatsapp`, `GET /instagram`, `POST /instagram` | Verificación y webhooks de WhatsApp Cloud API e Instagram Messaging API (públicos, autenticados por firma) |
| **Public Chat** | `GET /public/test-chat/:slug/config`, `POST /public/test-chat/:slug/start` (devuelve `clientToken`), `POST /public/test-chat/:slug/:id/messages` (exige `clientToken`) | Chat público (clientes web); `config` expone el idioma del agente (sin auth) |
| **Widget** | `GET /widget.js`, `GET /public/widget/:slug/config`, `GET /public/widget/:slug/frame`, `GET /public/widget/:slug/conversations/:id/messages` | Widget embebible: cargador, configuración pública, página con `frame-ancestors` e historial con token |

> Todos los endpoints están bajo el prefijo `/api/<módulo>`.

---

## Modelos de Datos (MongoDB)

| Colección | Campos Clave | Notas |
|:----------|:-------------|:------|
| `users` | name, email, password (hash), role, status, avatar, projectIds, activeProjectId | Roles: admin, support, assistant, approver. Pertenencia multi-proyecto |
| `contacts` | projectId, name, phone, email, platform, status, tags, metadata | Aislado por proyecto. Soft delete (archivar) |
| `conversations` | contactId, platform, status, mode, clientInfo, channelAccount, lastInboundAt, awaitingReplySince, slaBreachNotifiedAt, closedAt, unreadCount, aiInsights | Modos: auto_pilot, human_takeover. `aiInsights`: sentiment, sentimentScores |
| `messages` | conversationId, sender, content, contentType, isBot, toolData | Sender: contact, ai_agent, human_agent, tool. contentType: text, tool_call, tool_result, confirmation_request |
| `agents` | projectId, name, modelId, personality (role, traits, emojiUsage, language, responseLength, ragBehavior, fallbackMessage), config | 1 agente activo por proyecto |
| `ai_models` | name, value, provider, category, isActive | Catálogo de modelos (los disponibles se listan dinámicamente desde OpenRouter) |
| `provider_configs` | type (llm/embedding/file/image/audio/ocr), provider, selectedModel, isActive | Sin credenciales: la API key proviene del entorno. `selectedModel` ya no se usa para resolver llm/embedding/file/ocr |
| `projects` | name, agentId, config (channels, messages, options, tools, brand, whatsapp.{phoneNumberId,wabaId}, instagram.accountId, widget) | Configuración de herramientas aislada por proyecto |
| `knowledge_sources` | name, type, size, status, vectorCount, filePath, extractionMethod, ocrProvider, extractionTimeMs | Status: Queued, Processing, Indexed, Failed |
| `appointments` | date, time, service, contactId, conversationId, status | Estados: pending, confirmed, completed, cancelled |
| `orders` | items, total, currency, contactId, conversationId, status | Estados: pending, confirmed, completed, cancelled |
| `tool_executions` | projectId, conversationId, toolId, operation, binding, params, result, status, decisionBy, decisionAt | Historial y aprobación, aislados por proyecto |
| `payments` | projectId, conversationId, contactId, amount, currency, method, status | Intenciones de cobro; nunca mueve dinero |
| `config` | key, value | Key-value store dinámico |
| `activities` | projectId, type, title, detail, metadata, createdAt | Log de eventos; `conversations_exported` audita las exportaciones |

---

## WebSocket Events (Socket.io)

### 🔒 Seguridad WebSocket (v0.1.35)

Todas las conexiones WebSocket requieren autenticación JWT:
- **Dashboard**: Token JWT enviado en `socket.handshake.auth.token` y proyecto en `socket.handshake.auth.projectId` (validando pertenencia)
- **Chat Público (`test-chat` y widget)**: Slug del proyecto enviado en `socket.handshake.query.slug`; solo entra en las salas de sus conversaciones, con `join:room { roomId, clientToken }`
- **Aislamiento por proyecto**: cada socket autenticado entra en la room `project:<id>`; los del dashboard también entran en `project:<id>:dashboard` (excluye clientes públicos) para sincronizar el sidebar con mensajes de conversaciones no abiertas; `join:room` valida que la conversación pertenezca a su proyecto
- **Rate Limiting**: 30 mensajes/min y 60 joins/min por usuario (Redis)
- **CORS**: Restringido a `FRONTEND_URL` en producción

### Eventos

| Evento | Dirección | Descripción |
|:-------|:----------|:------------|
| `chat:message` | Server → Client | Nuevo mensaje recibido |
| `chat:message_chunk` | Server → Client | Mensaje final del bot (`isDone: true`); ya no se emiten fragmentos parciales |
| `chat:send` | Client → Server | Enviar mensaje desde el dashboard |
| `chat:typing` | Bidireccional | Indicador de "escribiendo..." |
| `chat:status` | Server → Client | Cambio de modo/estado de la conversación (lo consumen Messaging y TestChat sin recargar) |
| `chat:new_conversation` | Server → Client | Nueva conversación iniciada |
| `chat:message_updated` | Server → Client | Mensaje actualizado: `status` de la confirmación de tool, o `delivery` (entrega en canal externo: `queued`, `sent`, `delivered`, `read`, `failed`); nunca ambos |
| `chat:insights` | Server → Client | Insights de la conversación recalculados (sentimiento y su distribución) |
| `chat:sla` | Server → Client | Espera del cliente abierta (`awaitingReplySince`) o cerrada (`null`); solo al dashboard |
| `chat:read` | Server → Client | Una sesión del proyecto marcó una conversación como leída; el resto actualiza su badge |
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

## Pruebas unitarias e integración

```bash
pnpm test                # unitarios → integración → E2E
pnpm test:unit           # backend (node:test) + frontend (Vitest)
pnpm test:integration    # backend contra MongoDB/Redis/Qdrant reales
```

- **Unitarios**: sin servicios externos. Backend en `apps/backend/tests/unit/*.test.ts`; frontend en `apps/frontend/tests/unit/*.test.ts` (happy-dom, alias `@`).
- **Integración**: `apps/backend/tests/integration/*.test.ts`; usan el `MONGODB_URI` del `.env` y limpian lo que crean.

## Pruebas End-to-End (e2e)

Suite de Playwright en `tests/` que valida los flujos críticos contra un entorno aislado. **Requiere los servicios Docker** (`docker compose up -d`); Playwright arranca automáticamente el stub de IA y de la Graph API de WhatsApp (4010), el backend (3100) y el frontend (5174), y usa la base de datos `mitchbot_e2e`. Si otra app ocupa alguno de esos puertos, la comprobación de prerrequisitos lo indica: cámbialos con `E2E_STUB_PORT`, `E2E_BACKEND_PORT` y `E2E_FRONTEND_PORT` (por ejemplo, `E2E_BACKEND_PORT=3110 E2E_FRONTEND_PORT=5185 E2E_STUB_PORT=4020 pnpm test:e2e`).

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
DASHBOARD_RESPONSE_CONVERSATION_LIMIT=5000
DASHBOARD_RESPONSE_TIMEOUT_MS=5000
# Pasarela de canales (opcionales)
CHANNEL_QUEUE_PREFIX=bull
CHANNEL_WHATSAPP_RATE_MAX=20
CHANNEL_WHATSAPP_RATE_MS=1000
CHANNEL_INSTAGRAM_RATE_MAX=10
CHANNEL_INSTAGRAM_RATE_MS=1000
CHANNEL_BREAKER_THRESHOLD=5
CHANNEL_BREAKER_COOLDOWN_MS=60000
# WhatsApp Cloud API (opcionales; el Phone Number ID se guarda por proyecto)
WHATSAPP_TOKEN=<token-de-sistema>
WHATSAPP_VERIFY_TOKEN=<token-de-verificación-del-webhook>
WHATSAPP_APP_SECRET=<app-secret-de-meta>
WHATSAPP_WABA_ID=<waba-por-defecto-para-plantillas>
WHATSAPP_API_URL=https://graph.facebook.com
WHATSAPP_API_VERSION=v21.0
# Instagram Messaging API (opcionales; el ID de la cuenta se guarda por proyecto)
INSTAGRAM_TOKEN=<token-de-la-cuenta>
INSTAGRAM_VERIFY_TOKEN=<token-de-verificación-del-webhook>
INSTAGRAM_APP_SECRET=<app-secret-de-meta>
INSTAGRAM_API_URL=https://graph.instagram.com
INSTAGRAM_API_VERSION=v21.0
```

> ⚠️ `OPENROUTER_LLM_MODEL` es obligatorio (sin default): si falta, la generación falla con un mensaje que indica definirlo. `OPENROUTER_FILE_MODEL`, `OPENROUTER_RERANKER_MODEL` y `OPENROUTER_INSIGHTS_MODEL` son opcionales (el CSV se indexa crudo, el re-ranker usa el modelo de embeddings y los insights usan `OPENROUTER_LLM_MODEL`, respectivamente).
>
> `DASHBOARD_RESPONSE_CONVERSATION_LIMIT` y `DASHBOARD_RESPONSE_TIMEOUT_MS` son límites positivos para el cálculo de respuesta del Dashboard; sus valores por defecto son 5000 conversaciones y 5000 ms.
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

### Entregado después del MVP ✅
- [x] Multi-proyecto con aislamiento de datos (v0.2)
- [x] Analytics de sentimiento, urgencia, conversión y salud del bot (v0.4.26–v0.4.27)
- [x] Infraestructura de tests unitarios en backend y frontend (v0.4.34)
- [x] Identidad de marca por proyecto persistida y aplicada al iniciar sesión (v0.4.35)

### Integración Social (v0.5–v0.7) ✅
- [x] Normalización de mensajes cross-platform + message broker (BullMQ sobre Redis) (v0.5.0)
- [x] Rate limiting por plataforma, sistema de retry y failover operativo (circuit breaker) (v0.5.0)
- [x] WhatsApp Business API con webhooks firmados, número por proyecto y estados de entrega y lectura (v0.6.0)
- [x] Instagram Messaging API con nombre del perfil y lectura acumulativa (v0.7.0)

### Entregado tras la integración social ✅
- [x] Exportación de conversaciones a CSV y JSON con permisos y auditoría (v0.8.0)
- [x] Plantillas de WhatsApp para escribir fuera de la ventana de 24 h (v0.9.0)
- [x] Chat widget embebible con dominios autorizados y acceso por token al chat público (v0.10.0)
- [x] Métricas de SLA con avisos de esperas vencidas (v0.11.0)

### Siguiente — v0.12 🔜
- [ ] Notificaciones push

### Hacia la v1.0 💡
- [ ] Integración con CRM externos
