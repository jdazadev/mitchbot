# Add WhatsApp Embedded Signup

## Why

Hoy WhatsApp funciona con un único token del entorno (`WHATSAPP_TOKEN`) y cada proyecto escribe a mano su Phone Number ID y su WABA. Eso solo sirve para números de la app de Meta del propio despliegue: un negocio que quiere usar su número tiene que hacer el alta en Meta por su cuenta y copiar identificadores. Para que conectar WhatsApp sea tan simple como pulsar un botón, Mitchbot debe usar el **registro integrado de Meta (Embedded Signup)** como Tech Provider.

## What Changes

- **Botón Conectar WhatsApp** en Configuración → Canales (solo administradores). Abre la ventana de Meta (SDK de Facebook, `FB.login` con `config_id` y `response_type: code`), donde el cliente inicia sesión, elige o crea su empresa y verifica su número. Si el número ya está en la app WhatsApp Business, Meta lanza la **coexistencia** y el cliente sigue usando la app.
- **Alta en el servidor** (`POST /api/project/whatsapp/signup`): intercambia el código por el token del negocio (`/oauth/access_token`), suscribe la app a la WABA (`/{waba}/subscribed_apps`), registra el número con un PIN de dos pasos (salvo en coexistencia) y lee el número visible y el nombre verificado.
- **Credenciales por proyecto**: el token se guarda **cifrado** (AES-256-GCM con `CREDENTIALS_KEY`) en la colección `channel_credentials`, fuera de `project.config`, para que nunca llegue al panel. El proyecto guarda `config.whatsapp.{phoneNumberId,wabaId}` y activa el canal, así el enrutado del webhook no cambia.
- **Envío por cuenta**: el adaptador de WhatsApp y las plantillas usan el token de la cuenta que atiende la conversación y, si no tiene, el `WHATSAPP_TOKEN` del entorno. Un token rechazado (190) marca la conexión como inválida y avisa al equipo para reconectar.
- **Desconectar** (`DELETE /api/project/whatsapp/signup`): quita la suscripción de la app, borra la credencial y limpia la cuenta del proyecto.
- **Estado**: `GET /api/project/channels/status` añade la conexión del proyecto (`mode`, `displayPhone`, `verifiedName`, `status`) y `GET /api/project/whatsapp/signup/config` da al panel el `appId` y el `configId`.
- La configuración manual (Phone Number ID y WABA) sigue disponible, plegada.

## Non-goals

- Instagram por registro integrado.
- Sincronizar el historial y los contactos de la app en coexistencia.
- Gestionar el método de pago de la WABA (lo añade el cliente en Meta).

## Capabilities

### New Capabilities

- `whatsapp-embedded-signup`: conexión de WhatsApp desde Mitchbot con credenciales por proyecto.

## Impact

- **Backend**: nuevos `utils/secret-box.ts`, `models/channel-credential.model.ts`, `channels/whatsapp/signup.ts`, `services/whatsapp-signup.service.ts`; modificados el adaptador y el registro de WhatsApp, `template.service.ts`, `project.controller.ts`, rutas y entorno (`META_APP_ID`, `WHATSAPP_SIGNUP_CONFIG_ID`, `CREDENTIALS_KEY`).
- **Frontend**: nuevos `lib/embedded-signup.ts` y `components/settings/WhatsAppSignup.vue`; modificados `Settings.vue`, `project.service.ts` y los locales.
- **Requisito externo**: el dueño del despliegue registra su app como Tech Provider en Meta y crea la configuración de Embedded Signup.
