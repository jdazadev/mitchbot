## ADDED Requirements

### Requirement: Lectura acumulativa

Cuando un canal informe que el cliente leyó un mensaje, el sistema SHALL marcar como `read` ese mensaje y todos los mensajes enviados antes en la misma conversación cuyo estado sea `sent` o `delivered`, emitiendo `chat:message_updated` por cada uno.

#### Scenario: El cliente lee la última respuesta

- **WHEN** hay dos respuestas enviadas y el canal informa la lectura de la segunda
- **THEN** ambas pasan a `read`

#### Scenario: Mensajes posteriores sin leer

- **WHEN** el canal informa la lectura de un mensaje anterior al último enviado
- **THEN** el último sigue en su estado
