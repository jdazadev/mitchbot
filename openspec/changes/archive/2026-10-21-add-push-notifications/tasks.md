# Tareas

## 1. Backend

- [x] 1.1 Entorno VAPID y `PUSH_ALLOWED_HOSTS`; script de claves.
- [x] 1.2 `push_subscriptions` con endpoint único; `user.pushPreferences`.
- [x] 1.3 `notifyProject` y migración de los emisores de `admin:notification`.
- [x] 1.4 Cola `push-notifications`: destinatarios, preferencias, usuarios conectados, bajas por 404/410.
- [x] 1.5 API `/api/push` y sala por usuario en el socket.

## 2. Frontend

- [x] 2.1 `sw.js` (mostrar y abrir) y `lib/push.ts`.
- [x] 2.2 `PushSettings.vue` en Mi Perfil; i18n es/en.

## 3. Pruebas

- [x] 3.1 Unitarios: endpoints permitidos, destinatarios por tipo y rol, contenido y enlace.
- [x] 3.2 Integración: envío, preferencias, usuario conectado, bajas.
- [x] 3.3 E2E: proveedor de push simulado con descifrado; prueba, evento real, preferencias, SSRF, UI de Mi Perfil.

## 4. Cierre

- [x] 4.1 Changelog, AGENTS.md, README, versión 0.12.0 y hoja de ruta.
- [x] 4.2 Validar, archivar y commit.
