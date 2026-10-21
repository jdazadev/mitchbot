# Add WhatsApp Channel

## Why

La pasarela de canales (v0.5.0) ya recibe mensajes normalizados e idempotentes y entrega las respuestas por una cola con reintentos y circuit breaker, pero ningún canal externo está conectado. WhatsApp es el canal con más peso para los clientes de Mitchbot: hoy una conversación "de WhatsApp" solo existe en el simulador del chat público. Este cambio aporta el adaptador de WhatsApp Business (Cloud API de Meta) sobre la pasarela, para que un mensaje real llegue a la bandeja, el bot o el operador respondan y el cliente lo reciba en su teléfono.

## What Changes

- **Webhook de Meta** `GET|POST /api/webhooks/whatsapp`:
  - `GET` responde al reto de verificación (`hub.mode=subscribe` + `hub.verify_token` = `WHATSAPP_VERIFY_TOKEN`).
  - `POST` exige la firma `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo con `WHATSAPP_APP_SECRET`); sin secreto configurado o con firma inválida responde 401 y no procesa nada.
  - Los mensajes de texto (y las respuestas a botones y listas) entran por `enqueueInbound`; los tipos que Mitchbot aún no lee (imagen, audio, ubicación…) entran como un aviso de texto para que el operador sepa que el cliente envió algo.
- **Número por proyecto**: `project.config.whatsapp.phoneNumberId` asocia un número de WhatsApp a un proyecto (único entre proyectos; 409 si otro proyecto ya lo usa). Solo se aceptan mensajes si el canal WhatsApp está habilitado en el proyecto. Las credenciales (token y App Secret) siguen viniendo del entorno, nunca de la base de datos.
- **Cuenta del canal en la conversación**: la conversación guarda `channelAccount` (el número que recibió el mensaje) y las respuestas salen desde ese mismo número. La pasarela **solo entrega por cola a conversaciones con cuenta de canal**: las conversaciones del simulador (chat público con plataforma WhatsApp) siguen entregándose por socket y nunca llegan a Meta.
- **Continuidad**: el mensaje de un cliente continúa su conversación abierta del mismo canal también cuando está en `pending_human` (antes abría una conversación nueva tras una transferencia o un fallo de entrega).
- **Adaptador de salida**: `POST {WHATSAPP_API_URL}/{WHATSAPP_API_VERSION}/{phoneNumberId}/messages` con el token del entorno. Clasificación de errores de Meta: red, 5xx, 429 y límites de ritmo (`4`, `80007`, `130429`, `131048`, `131056`) son transitorios y respetan `Retry-After`; token inválido (`190`/401), ventana de 24 h vencida (`131047`), destinatario no válido y el resto de 4xx son permanentes, con un motivo legible.
- **Estados de entrega de Meta**: los webhooks de estado actualizan `delivery` por `externalId`: `delivered` y `read` se añaden a los estados (solo avanzan, nunca retroceden) y un `failed` asíncrono marca el mensaje como no entregado y la conversación como `pending_human`, igual que un fallo síncrono.
- **Interfaz**:
  - El hilo muestra **Entregado** y **Leído** además de Enviando / Enviado / No entregado.
  - Configuración → Canales: campo **Phone Number ID** bajo WhatsApp, la URL del webhook para copiarla en Meta y el estado de la conexión del servidor (si faltan credenciales en el entorno). Claves i18n es/en.
- **API**: `GET /api/project/channels/status` informa si el servidor tiene WhatsApp configurado (sin exponer secretos).
- **Entorno**: `WHATSAPP_APP_SECRET`, `WHATSAPP_API_URL` (por defecto `https://graph.facebook.com`) y `WHATSAPP_API_VERSION` (por defecto `v21.0`), además de los existentes `WHATSAPP_TOKEN` y `WHATSAPP_VERIFY_TOKEN`. El adaptador solo se registra si hay token.

## Non-goals

- Plantillas de mensaje (necesarias para escribir fuera de la ventana de 24 h): el fallo se muestra con su motivo y queda para un cambio posterior.
- Multimedia entrante y saliente (descarga de adjuntos, envío de imágenes).
- Credenciales por proyecto (un token de Meta por cliente): el despliegue usa una sola app de Meta.
- Instagram (`add-instagram-channel`).

## Capabilities

### New Capabilities

- `whatsapp-channel`: conexión de un número de WhatsApp Business a un proyecto, webhooks verificados y entrega por la Cloud API.

### Modified Capabilities

- `channel-gateway`: la entrega por cola exige cuenta de canal en la conversación; estados `delivered`/`read` y fallos asíncronos; continuidad en `pending_human`.

## Impact

- Backend: `src/channels/whatsapp/` (webhook, adaptador, estados), `routes/webhooks.routes.ts`, `config/env.ts`, `models/project.model.ts`, `models/conversation.model.ts`, `channels/outbound.ts`, `services/chat.service.ts`, `controllers/project.controller.ts`, `index.ts` (cuerpo crudo para la firma y registro del adaptador).
- Frontend: `DeliveryStatus.vue`, `Settings.vue`, `project.service.ts`, locales.
- Pruebas: unitarios del webhook, firma y clasificación de errores; integración del webhook contra MongoDB y Redis; E2E con un stub de la Graph API en el stub de pruebas.
