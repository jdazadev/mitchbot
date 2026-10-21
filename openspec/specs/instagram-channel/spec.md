# instagram-channel Specification

## Purpose
Conectar la cuenta profesional de Instagram de cada proyecto: webhooks de Meta verificados por firma, mensajes directos enrutados por cuenta con el nombre del perfil, y entrega por la Messaging API con errores clasificados y confirmación de lectura.

## Requirements

### Requirement: Cuenta de Instagram por proyecto

El sistema SHALL permitir asociar a cada proyecto el ID de una cuenta profesional de Instagram, que SHALL pertenecer como máximo a un proyecto. Las credenciales de Meta SHALL provenir del entorno.

#### Scenario: Asociar la cuenta

- **WHEN** un administrador guarda el ID de la cuenta en Configuración → Canales
- **THEN** el proyecto lo conserva y la pantalla muestra la URL del webhook de Instagram

#### Scenario: Cuenta ya usada

- **WHEN** un proyecto intenta guardar un ID que ya usa otro proyecto
- **THEN** la API responde 409

### Requirement: Webhook de Instagram verificado

El sistema SHALL responder al reto de verificación solo con `INSTAGRAM_VERIFY_TOKEN` y SHALL procesar un webhook solo si su firma corresponde al cuerpo con `INSTAGRAM_APP_SECRET`.

#### Scenario: Firma inválida

- **WHEN** llega un webhook de Instagram sin firma o con firma incorrecta
- **THEN** la respuesta es 401 y no se registra ningún mensaje

#### Scenario: Verificación correcta

- **WHEN** Meta pide la verificación con el token correcto
- **THEN** la respuesta es 200 con el `hub.challenge`

### Requirement: Mensajes directos entrantes

El sistema SHALL convertir cada mensaje directo en un `InboundMessage` del proyecto dueño de la cuenta, con el IGSID del cliente como identificador, el `mid` como id externo, la cuenta receptora como cuenta del canal y, si se puede consultar, el nombre del perfil. SHALL ignorar los ecos de los mensajes enviados por la propia cuenta, los mensajes borrados y las reacciones.

#### Scenario: Mensaje de texto

- **WHEN** un cliente escribe por mensaje directo a la cuenta de un proyecto con Instagram habilitado
- **THEN** aparece en la bandeja una conversación de Instagram con el nombre de su perfil y su mensaje

#### Scenario: Eco del propio envío

- **WHEN** Instagram notifica un mensaje con `is_echo`
- **THEN** no se registra ningún mensaje del cliente

#### Scenario: Adjunto

- **WHEN** el cliente envía una imagen, un audio, una publicación compartida o menciona a la cuenta en una historia
- **THEN** entra un mensaje de texto que avisa de lo recibido

#### Scenario: Perfil no disponible

- **WHEN** la consulta del perfil falla o tarda demasiado
- **THEN** el mensaje entra igualmente sin nombre

### Requirement: Entrega por la Messaging API

El sistema SHALL enviar las respuestas como texto desde la cuenta de la conversación y SHALL clasificar los errores: red, 5xx, 429 y límites de ritmo como transitorios; token inválido, fuera de la ventana de mensajería, persona no disponible y el resto de errores de cliente como permanentes, con motivo legible.

#### Scenario: Envío aceptado

- **WHEN** Instagram acepta el mensaje
- **THEN** queda en `sent` con el `message_id` como id externo

#### Scenario: Fuera de la ventana de mensajería

- **WHEN** Instagram rechaza el envío por estar fuera de la ventana permitida
- **THEN** el mensaje queda en `failed` sin reintentos, con un motivo que explica la ventana de 24 horas

#### Scenario: Leído

- **WHEN** Instagram informa que el cliente leyó la respuesta
- **THEN** el hilo la muestra como Leído
