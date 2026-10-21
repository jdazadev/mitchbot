# Add WhatsApp Templates

## Why

WhatsApp solo permite mensajes libres durante las 24 horas siguientes al último mensaje del cliente. Pasado ese plazo, hoy la respuesta del operador falla como "No entregado" y no hay forma de retomar la conversación desde Mitchbot. La única vía que Meta permite son las **plantillas aprobadas**. Las plantillas se crean y aprueban en el Administrador de WhatsApp de Meta; Mitchbot tiene que listarlas, dejar que el operador elija una y rellene sus variables, y enviarla.

## What Changes

- **Cuenta de WhatsApp Business (WABA) por proyecto**: `project.config.whatsapp.wabaId`, con `WHATSAPP_WABA_ID` como valor por defecto del despliegue. Se configura en Configuración → Canales, junto al Phone Number ID.
- **Catálogo de plantillas**: `GET /api/project/whatsapp/templates` lista las plantillas **aprobadas** de la WABA del proyecto (`GET /{waba}/message_templates`, siguiendo la paginación). Las guarda en una caché en memoria durante 5 minutos (`?refresh=1` la ignora).
  - De cada plantilla se obtienen el nombre, el idioma, la categoría, el texto de cabecera y de cuerpo, el pie y las variables, tanto posicionales (`{{1}}`) como con nombre (`{{nombre}}`).
  - Las plantillas con cabecera multimedia o botones con URL variable se marcan como **no compatibles**, con el motivo.
- **Envío**: `POST /api/conversations/:id/template` `{ name, language, parameters: { header?: [...], body: [...] } }`.
  - **Validación**: la conversación tiene que ser de WhatsApp real (con cuenta del canal), la plantilla tiene que existir, estar aprobada y ser compatible, y las variables tienen que estar completas. En caso contrario responde 400, 404 o 409.
  - **Registro y entrega**: se guarda como mensaje del operador con `contentType: 'template'`, el texto ya rellenado (lo que verá el cliente) y `template { name, language, parameters }`. Sale por la cola de WhatsApp como mensaje `type: template`, con los mismos reintentos y estados de entrega.
- **Ventana de 24 h**: la conversación guarda `lastInboundAt` (el último mensaje del cliente). En las conversaciones de WhatsApp con la ventana cerrada, el hilo muestra un aviso y sustituye el compositor por el botón **Enviar plantilla**. El botón también está disponible con la ventana abierta y en los mensajes que fallaron por el código `131047`.
- **Selector de plantillas** (`TemplatePicker.vue`): búsqueda, idioma y categoría, vista previa en vivo con las variables rellenadas, campos por variable y avisos de las plantillas no compatibles.
- **Errores de plantilla de Meta**, todos permanentes con un motivo legible: `132000` (número de variables), `132001` (no existe en ese idioma), `132005` (texto demasiado largo), `132007` (política), `132012` (formato de variable), `132015` (pausada) y `132016` (deshabilitada).
- **El resto del sistema reconoce las plantillas**: el bot las ve en su memoria como mensajes del agente humano, la exportación y las métricas las cuentan como mensajes del operador, e `isCustomerFacing` las entrega.

## Non-goals

- Crear, editar o enviar plantillas a aprobación desde Mitchbot: eso se hace en Meta.
- Cabeceras multimedia, botones con URL variable y plantillas de autenticación (OTP).
- Envíos masivos o campañas.

## Capabilities

### New Capabilities

- `whatsapp-templates`: catálogo de plantillas aprobadas, envío con variables y ventana de 24 h visible.

## Impact

- **Backend**:
  - Nuevos: `channels/whatsapp/templates.ts` (catálogo, parser y render) y `services/template.service.ts`.
  - Modificados: el adaptador de WhatsApp, `outbound.ts`, `policy.ts`, `chat.service.ts`, los modelos de mensaje, conversación y proyecto, `project.controller.ts`, `messaging.controller.ts` y las rutas.
- **Frontend**:
  - Nuevo: `TemplatePicker.vue`.
  - Modificados: `Messaging.vue`, `ChannelConnection.vue` (campo adicional), `Settings.vue`, los servicios y los locales.
- **Pruebas**:
  - Unitarios del parser, el render y la ventana.
  - Integración del envío y la validación.
  - E2E contra el stub (catálogo, envío, ventana cerrada y fallo por variables).
