## ADDED Requirements

### Requirement: Número de WhatsApp por proyecto

El sistema SHALL permitir asociar a cada proyecto un `phoneNumberId` de WhatsApp Business. Un número SHALL pertenecer como máximo a un proyecto. Las credenciales de Meta (token y App Secret) SHALL provenir del entorno y SHALL NOT guardarse en la base de datos.

#### Scenario: Asociar el número

- **WHEN** un administrador guarda un Phone Number ID en Configuración → Canales
- **THEN** el proyecto lo conserva y la pantalla muestra la URL del webhook que hay que configurar en Meta

#### Scenario: Número ya usado

- **WHEN** un proyecto intenta guardar un Phone Number ID que ya usa otro proyecto
- **THEN** la API responde 409 y el número no se guarda

#### Scenario: Servidor sin credenciales

- **WHEN** el entorno no define el token de WhatsApp
- **THEN** Configuración → Canales indica que el servidor no tiene WhatsApp conectado

### Requirement: Verificación y firma del webhook

El sistema SHALL responder al reto de verificación de Meta solo con el token de verificación configurado y SHALL procesar un webhook solo si su firma `X-Hub-Signature-256` corresponde al cuerpo recibido con el App Secret configurado.

#### Scenario: Verificación correcta

- **WHEN** Meta pide `GET /api/webhooks/whatsapp` con `hub.mode=subscribe` y el token correcto
- **THEN** la respuesta es 200 con el `hub.challenge`

#### Scenario: Token de verificación incorrecto

- **WHEN** la verificación llega con otro token
- **THEN** la respuesta es 403

#### Scenario: Firma inválida

- **WHEN** llega un webhook sin firma, con firma incorrecta o sin App Secret configurado
- **THEN** la respuesta es 401 y no se registra ningún mensaje

### Requirement: Mensajes entrantes de WhatsApp

El sistema SHALL convertir cada mensaje del webhook en un `InboundMessage` del proyecto dueño del número, con el teléfono del cliente como identificador, su nombre de perfil, el id del mensaje de Meta como id externo y el número receptor como cuenta del canal. El sistema SHALL ignorar los mensajes de números sin proyecto o de proyectos con el canal WhatsApp deshabilitado.

#### Scenario: Mensaje de texto

- **WHEN** un cliente escribe al número de un proyecto con WhatsApp habilitado
- **THEN** aparece en la bandeja una conversación de WhatsApp con su nombre y su mensaje
- **AND** si está en piloto automático, el bot responde y la respuesta se entrega al cliente

#### Scenario: Respuesta a un botón o lista

- **WHEN** el cliente pulsa un botón o elige una opción de lista
- **THEN** el título elegido entra como texto del mensaje

#### Scenario: Tipo no soportado

- **WHEN** el cliente envía una imagen, audio, documento, ubicación u otro tipo que Mitchbot no lee
- **THEN** entra un mensaje de texto que avisa del tipo recibido

#### Scenario: Canal deshabilitado

- **WHEN** llega un mensaje para un proyecto con WhatsApp deshabilitado o un número sin proyecto
- **THEN** el webhook responde 200 y no se crea ninguna conversación

### Requirement: Entrega por la Cloud API

El sistema SHALL enviar las respuestas como mensajes de texto desde la cuenta de la conversación y SHALL clasificar los errores de Meta: red, 5xx, 429 y límites de ritmo como transitorios (respetando `Retry-After`); token inválido, ventana de 24 h vencida, destinatario no válido y el resto de errores de cliente como permanentes, con un motivo legible para el operador.

#### Scenario: Envío aceptado

- **WHEN** Meta acepta el mensaje
- **THEN** el mensaje queda en `sent` con el `wamid` como id externo

#### Scenario: Ventana de 24 horas vencida

- **WHEN** Meta rechaza el envío con el código 131047
- **THEN** el mensaje queda en `failed` sin reintentos, con un motivo que explica que han pasado más de 24 horas desde el último mensaje del cliente

#### Scenario: Límite de ritmo

- **WHEN** Meta responde 429 o un código de límite de ritmo
- **THEN** la entrega se reintenta según la política de la pasarela
