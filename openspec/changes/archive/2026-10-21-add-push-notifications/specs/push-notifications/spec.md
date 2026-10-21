## ADDED Requirements

### Requirement: Notificaciones del equipo por Web Push

Cada notificación del equipo (mensaje de `send_notification`, aprobación pendiente, entrega fallida, canal pausado, espera vencida) SHALL enviarse por Web Push a los dispositivos suscritos de los miembros activos del proyecto que la tengan activada y no tengan el panel abierto. Las aprobaciones pendientes SHALL enviarse solo a los roles `approver` y `admin`.

#### Scenario: Operador con el panel cerrado

- **WHEN** vence la espera de un cliente y un operador suscrito no tiene Mitchbot abierto
- **THEN** recibe una notificación push con el aviso y un enlace a la conversación

#### Scenario: Operador con el panel abierto

- **WHEN** ocurre una notificación y el operador tiene el panel abierto
- **THEN** la ve en el topbar y no recibe push

#### Scenario: Tipo desactivado

- **WHEN** el operador desactivó los mensajes del equipo
- **THEN** una notificación de `send_notification` no le llega por push

#### Scenario: Aprobación pendiente

- **WHEN** queda una operación pendiente de aprobación
- **THEN** solo los usuarios `approver` y `admin` del proyecto reciben el push

### Requirement: Suscripciones seguras

El sistema SHALL aceptar suscripciones solo con un endpoint HTTPS de un proveedor de push conocido o de `PUSH_ALLOWED_HOSTS`, con claves válidas. SHALL borrar la suscripción cuando el proveedor indique que ya no existe (404 o 410).

#### Scenario: Endpoint no permitido

- **WHEN** se intenta registrar una suscripción con un endpoint `http://169.254.169.254/`
- **THEN** la API responde 400 y no se guarda

#### Scenario: Suscripción caducada

- **WHEN** el proveedor responde 410 al enviar un push
- **THEN** la suscripción se elimina

### Requirement: Gestión en Mi Perfil

Mi Perfil SHALL mostrar el estado de las notificaciones push en el dispositivo y permitir activarlas, desactivarlas, enviar una prueba y elegir los tipos. Si el servidor no tiene claves VAPID o el navegador no admite push, SHALL indicarlo.

#### Scenario: Activar en este dispositivo

- **WHEN** el usuario activa las notificaciones y concede el permiso
- **THEN** el dispositivo queda suscrito y la prueba llega

#### Scenario: Servidor sin claves

- **WHEN** el entorno no define las claves VAPID
- **THEN** Mi Perfil indica que el servidor no tiene las notificaciones push configuradas
