# Add Push Notifications

## Why

Las notificaciones del equipo (mensajes de la herramienta `send_notification`, aprobaciones pendientes, entregas fallidas, canal caído, esperas vencidas) solo llegan a quien tiene Mitchbot abierto: viven en el topbar mientras dura la sesión. Si el operador está en otra pestaña o con el ordenador bloqueado, un cliente puede quedarse esperando sin que nadie lo sepa. Las notificaciones push del navegador (Web Push) avisan aunque la app no esté abierta.

## What Changes

- **Un solo punto de salida**: `notifyProject(projectId, { kind, message, level, … })` sustituye las emisiones sueltas de `admin:notification`.
  - Emite el evento al panel, como hasta ahora, añadiendo `kind`.
  - Encola el push para los miembros del proyecto. Las aprobaciones (`approval`) solo van a `approver` y `admin`.
- **Tipos**: `team` (la herramienta `send_notification`), `approval`, `delivery` (entrega fallida), `channel` (canal pausado por el circuit breaker) y `sla` (espera vencida).
- **Web Push con VAPID** (`web-push`): claves en `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. Sin claves, el push queda desactivado y el panel lo indica. `pnpm --filter @mitchbot/backend vapid:generate` genera un par de claves.
- **Suscripciones** (`push_subscriptions`): una por navegador (`endpoint` único) y usuario.
  - **Proveedores permitidos**: el endpoint tiene que ser HTTPS de un proveedor de push conocido (FCM, Mozilla, Apple, Microsoft), más los de `PUSH_ALLOWED_HOSTS`. Así el servidor no hace peticiones a direcciones arbitrarias (SSRF).
  - **Bajas automáticas**: si el proveedor responde 404 o 410, la suscripción se borra.
- **Entrega**: cola BullMQ `push-notifications` con reintentos. No se envía push a quien tiene el panel abierto en ese momento, porque ya lo ve en el topbar; la prueba manual sí se envía siempre.
  - **Contenido**: título, texto, enlace a la conversación y una etiqueta por tipo, para no apilar avisos repetidos.
- **API** `/api/push`: `GET /config`, `GET /me` (preferencias y número de dispositivos), `POST /subscriptions`, `DELETE /subscriptions`, `PUT /preferences` y `POST /test`.
- **Preferencias por usuario** (`user.pushPreferences`): activar o desactivar cada tipo; todos activos por defecto.
- **Interfaz**:
  - Service worker `sw.js`: muestra la notificación y, al pulsarla, abre la conversación o enfoca una pestaña abierta.
  - Sección **Notificaciones push** en Mi Perfil:
    - El estado: no compatible, servidor sin claves, permiso bloqueado, desactivadas o activadas en este dispositivo.
    - Activar o desactivar en este dispositivo, enviar una prueba y elegir los tipos.
- i18n es/en.

## Non-goals

- Apps móviles nativas.
- Correo o SMS.
- Horario de silencio.

## Capabilities

### New Capabilities

- `push-notifications`: notificaciones del equipo por Web Push, con suscripción por dispositivo y preferencias por tipo.

## Impact

- **Backend**:
  - Nuevos: `services/notify.service.ts`, `services/push.service.ts`, `queues/push-notifications.ts`, `controllers/push.controller.ts`, `routes/push.routes.ts`, `models/push-subscription.model.ts` y `scripts/generate-vapid-keys.ts`.
  - Modificados: los emisores de notificaciones, `websocket/socket.ts` (sala por usuario), `config/env.ts`, `config/database.ts`, `models/user.model.ts` e `index.ts`.
- **Frontend**:
  - Nuevos: `public/sw.js`, `lib/push.ts`, `services/push.service.ts` y `components/profile/PushSettings.vue`.
  - Modificados: `Profile.vue` y los locales.
- **Pruebas**:
  - Unitarios del filtrado de endpoints, los destinatarios y el contenido.
  - Integración del envío, las bajas y las preferencias.
  - E2E con un proveedor de push simulado que descifra el mensaje.
