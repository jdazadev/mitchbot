# Diseño: canal de Instagram

## Decisiones

### Reutilizar lo común de Meta

WhatsApp e Instagram firman igual (`X-Hub-Signature-256`), hacen el mismo reto de verificación y responden 429 con `Retry-After`. Esas piezas pasan a `src/channels/meta/`. Cada canal conserva su propio parser y su propia clasificación de errores, porque los códigos y la forma de los mensajes son distintos. El controlador de webhooks pasa a ser una fábrica (`metaWebhook({ verifyToken, appSecret, parse, handle })`).

### Cuenta = ID de la cuenta profesional

En los dos sabores de la API (Instagram Login y Facebook Login), `entry.id` y `recipient.id` identifican la cuenta de Instagram que recibe el mensaje, y el envío se hace a `/{id}/messages`. Guardar ese ID en el proyecto sirve para enrutar y para responder. `INSTAGRAM_API_URL` permite apuntar a `graph.facebook.com` si la app usa Facebook Login.

### Perfil del cliente en el handler

El webhook no trae el nombre del cliente. La consulta del perfil se hace antes de encolar, con un límite de 3 s y una caché en memoria por IGSID. Así, la conversación nace con nombre y no hay que reescribirla después. Si la consulta falla, el mensaje sigue su curso.

### Lectura acumulativa

Instagram envía `read.mid` del último mensaje visto. Leer ese mensaje implica haber visto los anteriores, así que `applyReadUpTo` marca como leídos todos los mensajes enviados de la conversación creados hasta ese momento. Emite un `chat:message_updated` por cada uno, y los estados nunca retroceden.

## Riesgos

- **Límite de la consulta de perfil**: si Meta limita las consultas de perfil, el nombre queda vacío. Es aceptable, porque no bloquea el mensaje.
- **Ventana de 24 h**: sin etiqueta `HUMAN_AGENT`, el operador no puede responder pasadas 24 horas. El fallo explica el motivo.
