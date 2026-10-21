# Tareas

## 1. Backend

- [x] 1.1 `src/channels/meta/`: firma, `retryAfterMs`, enrutado por cuenta; WhatsApp migrado.
- [x] 1.2 Entorno: `INSTAGRAM_APP_SECRET`, `INSTAGRAM_API_URL`, `INSTAGRAM_API_VERSION`; `.env.example`.
- [x] 1.3 Proyecto: `config.instagram.accountId` con índice único, validación y 409; estado del servidor con `instagram`.
- [x] 1.4 `src/channels/instagram/`: parser, adaptador con clasificación de errores, perfil con caché y handler.
- [x] 1.5 Webhook `GET|POST /api/webhooks/instagram` con la fábrica común.
- [x] 1.6 `applyReadUpTo` en la pasarela.

## 2. Frontend

- [x] 2.1 `ChannelConnection.vue` para WhatsApp e Instagram en Configuración → Canales.
- [x] 2.2 i18n es/en con paridad.

## 3. Pruebas

- [x] 3.1 Unitarios: parser de Instagram, adaptador y errores, firma compartida.
- [x] 3.2 Integración: webhook de Instagram, enrutado, ecos, lectura acumulativa, cuenta única.
- [x] 3.3 E2E: mensaje real con nombre del perfil, respuesta entregada y leída, fallo fuera de ventana con reintento, configuración en la UI.

## 4. Cierre

- [x] 4.1 Changelog, AGENTS.md, README y versión 0.7.0; hoja de ruta visual.
- [x] 4.2 Validar, archivar y commit.
