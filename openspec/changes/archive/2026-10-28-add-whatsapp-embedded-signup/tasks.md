# Tareas

## 1. Backend

- [x] 1.1 Entorno (`META_APP_ID`, `WHATSAPP_SIGNUP_CONFIG_ID`, `CREDENTIALS_KEY`) y `utils/secret-box.ts`.
- [x] 1.2 Colección `channel_credentials` con índices.
- [x] 1.3 `channels/whatsapp/signup.ts`: intercambio, suscripción, registro, datos del número.
- [x] 1.4 `whatsapp-signup.service.ts`: conectar, desconectar, token por cuenta, conexión inválida.
- [x] 1.5 Adaptador y plantillas con token por cuenta.
- [x] 1.6 Endpoints de configuración, alta, baja y estado.

## 2. Frontend

- [x] 2.1 `lib/embedded-signup.ts`: SDK, evento de Meta, `FB.login`.
- [x] 2.2 `WhatsAppSignup.vue` en Canales; configuración manual plegada; i18n es/en.

## 3. Pruebas

- [x] 3.1 Unitarios: cifrado, flujo de Meta, validación, token por cuenta, evento del SDK.
- [x] 3.2 Integración: alta, 409, baja, token oculto, 403, envío con el token del proyecto.
- [x] 3.3 Stub de Meta y E2E del flujo completo.

## 4. Cierre

- [x] 4.1 Changelog, AGENTS.md, README, hoja de ruta, versión 0.13.0 y commit.
