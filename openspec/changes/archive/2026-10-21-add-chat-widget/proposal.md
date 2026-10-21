# Add Chat Widget

## Why

Hoy el canal Web solo existe en la página de chat público de Mitchbot (`/test-chat/:slug`): para usarlo, el cliente final tiene que salir de la web del negocio. Lo que piden los negocios es un **widget**, un botón flotante que se pega con una línea de HTML en su propia web y abre el chat ahí mismo.

Al revisar el chat público para reutilizarlo aparecieron tres problemas de seguridad que el widget haría mucho más graves, porque estaría expuesto en cualquier web:

- **Datos de otros clientes**: un socket público entra en la sala del proyecto y recibe `chat:new_conversation` (con nombre, teléfono y correo de otros clientes), además de `admin:notification` y `chat:status`.
- **Conversaciones ajenas**: `join:room` no comprueba que la conversación sea de ese cliente, ni siquiera de ese proyecto. Los ids de MongoDB se pueden deducir a partir de uno conocido.
- **Escritura sin control**: `POST /public/test-chat/:slug/:id/messages` permite escribir en cualquier conversación del proyecto conociendo su id, y `tool:confirm` acepta confirmaciones de sockets que no están en esa conversación.

## What Changes

- **Token de acceso a la conversación** (`clientToken` = HMAC-SHA256 de su id con `JWT_SECRET`):
  - `POST /api/public/test-chat/:slug/start` lo devuelve.
  - Enviar mensajes (`clientToken` en el cuerpo o en la cabecera `X-Client-Token`) y unirse a la sala (`join:room` con `{ roomId, clientToken }`) lo exigen a los clientes públicos. Sin él responden 403 / `ACCESS_DENIED`.
- **Socket público aislado**:
  - No entra en la sala del proyecto, solo en las de sus conversaciones.
  - La conversación tiene que pertenecer al proyecto del slug.
  - `tool:confirm` exige estar en la sala de la conversación, para clientes y para operadores.
- **Widget** (`config.widget { enabled, allowedOrigins[], position: right | left, title?, greeting? }`):
  - `GET /widget.js`: cargador sin dependencias. Lee `data-mitchbot="<slug>"`, pinta un botón flotante con el color de marca y abre un `iframe` con el chat.
  - `GET /api/public/widget/:slug/config`: configuración pública (color, posición, título, idioma, saludo).
  - `GET /api/public/widget/:slug/frame`: página del chat, servida por el backend.
    - **Quién puede embeberla**: la cabecera `Content-Security-Policy: frame-ancestors` solo admite los dominios permitidos del proyecto, más el panel para la vista previa. Sin dominios permitidos, ninguna web externa puede embeber el widget.
    - **Cuándo no se sirve**: si el widget está desactivado o el canal Web deshabilitado, responde 404.
  - `GET /api/public/widget/:slug/conversations/:id/messages`: recupera el historial visible al volver a la página, con el `clientToken`.
- **Página del chat del widget** (HTML + JS vanilla servidos por el backend, sin dependencias de terceros salvo el cliente de Socket.io que sirve el propio servidor):
  - Saludo inicial, historial y respuestas en tiempo real con indicador de escritura.
  - Botones de confirmar o cancelar para las solicitudes de confirmación.
  - Conversación recordada en el navegador.
  - Idioma del agente (es/en), marca del proyecto y accesibilidad (región en vivo, foco y Escape para cerrar).
- **Configuración → Canales → Web**: un bloque para el widget con activación, dominios permitidos (uno por línea, validados como orígenes `https://…`), posición, título y saludo, el fragmento `<script>` para copiar y una vista previa.
- **Chat público (`TestChat.vue`)**: guarda el `clientToken` y lo envía al escribir y al unirse a la sala.

## Non-goals

- Formularios previos al chat (pedir nombre o correo antes de empezar).
- Adjuntos desde el widget.
- Personalización visual más allá del color, la posición, el título y el saludo.

## Capabilities

### New Capabilities

- `chat-widget`: widget embebible por proyecto con dominios permitidos, y acceso a las conversaciones públicas por token.

## Impact

- **Backend**:
  - Nuevos: `src/widget/` (token, configuración, página y cargador) y `controllers/widget.controller.ts`.
  - Modificados: `public-chat.controller.ts`, `websocket/socket.ts`, `project.controller.ts`, `models/project.model.ts`, `index.ts` y la copia de los recursos en el build.
- **Frontend**:
  - Nuevo: `components/settings/WidgetSettings.vue`.
  - Modificados: `Settings.vue`, `TestChat.vue`, `socket.service.ts`, `project.service.ts` y los locales.
- **Pruebas**:
  - Unitarios del token, los orígenes, la CSP y el fragmento.
  - Integración del acceso público.
  - E2E del widget en una página anfitriona real, de los dominios no permitidos y del aislamiento del socket público.
