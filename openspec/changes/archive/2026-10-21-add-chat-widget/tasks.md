# Tareas

## 1. Seguridad del chat público

- [x] 1.1 `clientToken` en el inicio; exigido al enviar y al unirse a la sala.
- [x] 1.2 Socket público sin sala de proyecto; conversación del mismo proyecto; `tool:confirm` solo desde la sala.
- [x] 1.3 `TestChat.vue` y helpers E2E con el token.

## 2. Widget

- [x] 2.1 `config.widget` con validación de orígenes.
- [x] 2.2 `/widget.js`, configuración pública, página con `frame-ancestors` e historial con token.
- [x] 2.3 Página del chat (vanilla JS) y cargador; recursos copiados en el build.

## 3. Frontend

- [x] 3.1 `WidgetSettings.vue` en Configuración → Canales (Web), con fragmento y vista previa.
- [x] 3.2 i18n es/en.

## 4. Pruebas

- [x] 4.1 Unitarios: token, orígenes, CSP, fragmento, nombre de la ventana de idioma.
- [x] 4.2 Integración: token exigido, aislamiento del socket público, historial.
- [x] 4.3 E2E: widget en una página anfitriona, conversación con el bot, recuperación al recargar, dominio no permitido, widget desactivado, aislamiento del socket.

## 5. Cierre

- [x] 5.1 Changelog, AGENTS.md, README, versión 0.10.0 y hoja de ruta.
- [x] 5.2 Validar, archivar y commit.
