# Diseño: canal de WhatsApp

## Decisiones

### Una app de Meta por despliegue, un número por proyecto

El token de sistema y el App Secret pertenecen a la app de Meta del despliegue y viven en el entorno, como la clave de OpenRouter. Cada proyecto declara el `phoneNumberId` que atiende. El webhook enruta por `entry[].changes[].value.metadata.phone_number_id`. Un índice único parcial sobre `config.whatsapp.phoneNumberId` impide que dos proyectos reclamen el mismo número; el controlador traduce el conflicto a 409 con un mensaje claro.

### `channelAccount` decide si un mensaje sale por la cola

Antes, `dispatch` entregaba por cola cualquier conversación de una plataforma con adaptador externo. Con WhatsApp registrado, las conversaciones del simulador (chat público con `platform: WhatsApp`, sin número real) fallarían de forma permanente y pasarían a `pending_human`. Que la conversación recuerde la cuenta del canal que la recibió resuelve los dos problemas: el simulador queda fuera de la cola y la respuesta sale desde el número correcto aunque el proyecto cambie de número más tarde.

### Firma sobre el cuerpo crudo

`express.json({ verify })` guarda el `Buffer` original solo en las rutas `/api/webhooks/*`; la firma se compara con `timingSafeEqual`. Sin `WHATSAPP_APP_SECRET` el webhook rechaza todo: falla cerrado.

### Respuesta rápida a Meta

El webhook valida, enruta y encola (`enqueueInbound`) antes de responder 200; el bot corre en el worker de entrada. Los estados se aplican en la petición porque son una sola actualización indexada (`delivery.externalId`). Si algo falla se responde 500 y Meta reintenta: la idempotencia de la pasarela absorbe el reenvío.

### Estados monótonos

`queued < sent < delivered < read`. La actualización filtra por los estados inferiores, así un `delivered` que llega después de un `read` no lo pisa. `failed` reemplaza `sent`/`delivered` (Meta puede rechazar después de aceptar) y reutiliza `markFailed`.

## Riesgos

- **Carrera de estado temprano**: si Meta enviara el webhook `sent` antes de que guardemos el `externalId`, ese estado se pierde. Es inocuo: el mensaje ya está en `sent` y los estados siguientes llegan después.
- **Ventana de 24 h**: sin plantillas, una respuesta tardía del operador falla con el motivo explicado. Queda como trabajo futuro.
