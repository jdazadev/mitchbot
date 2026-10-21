# Add Instagram Channel

## Why

Con WhatsApp conectado (v0.6.0), Instagram es el último canal social de la hoja de ruta. Muchos negocios reciben sus consultas por mensajes directos de Instagram y hoy esas conversaciones solo existen en el simulador. La pasarela ya resuelve la entrada idempotente, la cola de salida, los reintentos y el estado de entrega: falta el adaptador de la Instagram Messaging API (Graph API de Meta).

## What Changes

- **Webhook de Instagram** `GET|POST /api/webhooks/instagram`, con el mismo contrato que WhatsApp:
  - El reto de verificación usa `INSTAGRAM_VERIFY_TOKEN`.
  - La firma `X-Hub-Signature-256` se calcula con `INSTAGRAM_APP_SECRET`. Sin secreto, o con una firma inválida, responde 401.
  - Acepta los eventos en `entry[].messaging[]` y en `entry[].changes[field=messages]`.
- **Mensajes entrantes**:
  - Texto, respuestas rápidas y postbacks (entra el título del botón).
  - Los adjuntos (imagen, vídeo, audio, archivo, publicación compartida, mención en una historia, reel) entran como un aviso de texto.
  - Se ignoran los ecos de nuestros propios envíos (`is_echo`), los mensajes borrados y las reacciones.
- **Cuenta por proyecto**: `project.config.instagram.accountId`, el ID de la cuenta profesional de Instagram. Es único entre proyectos (409 si otro ya lo usa) y solo cuenta si el canal Instagram está habilitado. El token y el App Secret vienen del entorno.
- **Nombre del cliente**: Instagram no lo incluye en el webhook. Se consulta el perfil (`name`, `username`) con un tiempo límite corto y una caché en memoria; si falla, la conversación entra igual, con el nombre por defecto.
- **Adaptador de salida**: `POST {INSTAGRAM_API_URL}/{INSTAGRAM_API_VERSION}/{accountId}/messages` con `recipient.id` y `message.text`, recortado a 1000 caracteres (el límite de Instagram).
  - **Errores transitorios** (se reintentan): red, 5xx, 429 y los límites de ritmo `4`, `17`, `32`, `613`, `80002` y `80006`.
  - **Errores permanentes**, cada uno con un motivo legible: token inválido (`190`), fuera de la ventana de mensajería (código `10`, subcódigos `2534022` y `2018278`), persona no disponible (`551`), permisos (`200`) y el resto de errores 4xx.
- **Leído**: un evento `read` marca como leídos el mensaje indicado y los enviados antes en la misma conversación. Instagram no informa `delivered`.
- **Código compartido entre canales de Meta** (`src/channels/meta/`): verificación de firma, espera de `Retry-After`, controlador de webhook y búsqueda del proyecto dueño de una cuenta.
- **Interfaz**: en Configuración → Canales, Instagram muestra el campo **ID de cuenta de Instagram**, la URL de su webhook y el estado del servidor. El bloque de WhatsApp y el de Instagram se convierten en un único componente `ChannelConnection.vue`.
- **API**: `GET /api/project/channels/status` incluye `instagram`.
- **Entorno**: se añaden `INSTAGRAM_APP_SECRET`, `INSTAGRAM_API_URL` (por defecto `https://graph.instagram.com`) e `INSTAGRAM_API_VERSION` (por defecto `v21.0`), junto a los ya existentes `INSTAGRAM_TOKEN` e `INSTAGRAM_VERIFY_TOKEN`.

## Non-goals

- Comentarios de publicaciones y menciones públicas: solo mensajes directos.
- Envío de multimedia, plantillas o etiquetas de mensaje (`HUMAN_AGENT`) para responder fuera de la ventana de 24 h.
- Varias cuentas con tokens distintos: el despliegue usa un solo token.

## Capabilities

### New Capabilities

- `instagram-channel`: conexión de una cuenta profesional de Instagram a un proyecto, webhooks verificados y entrega por la Messaging API.

### Modified Capabilities

- `channel-gateway`: confirmación de lectura acumulativa (un aviso de lectura cubre los mensajes anteriores de la conversación).

## Impact

- **Backend**:
  - Nuevos: `src/channels/meta/` y `src/channels/instagram/`.
  - Refactor de `src/channels/whatsapp/` para usar el código compartido.
  - Modificados: `controllers/webhooks.controller.ts`, `routes/webhooks.routes.ts`, `config/env.ts`, `config/database.ts`, `models/project.model.ts`, `controllers/project.controller.ts`, `services/project.service.ts` y `channels/outbound.ts`.
- **Frontend**: `components/settings/ChannelConnection.vue`, `Settings.vue`, `project.service.ts` y los locales.
- **Pruebas**:
  - Unitarios del parser, del adaptador y de la firma compartida.
  - Integración del webhook.
  - E2E contra la Graph API simulada del stub.
