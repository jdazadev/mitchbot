# whatsapp-embedded-signup Specification

## Purpose
TBD - created by archiving change add-whatsapp-embedded-signup. Update Purpose after archive.

## Requirements

### Requirement: Conexión desde Mitchbot

El sistema SHALL permitir a un administrador conectar el número de WhatsApp del proyecto mediante el registro integrado de Meta, sin copiar identificadores ni tokens. El servidor SHALL intercambiar el código por el token del negocio, suscribir la app a la WABA y registrar el número, salvo en coexistencia.

#### Scenario: Número nuevo conectado

- **WHEN** el administrador completa la ventana de Meta
- **THEN** Configuración muestra el número conectado y los mensajes que llegan a ese número entran en la bandeja del proyecto

#### Scenario: Número de la app WhatsApp Business

- **WHEN** Meta termina con el evento de coexistencia
- **THEN** el número se conecta sin registrarlo y el modo se muestra como Coexistencia

#### Scenario: Ventana cancelada

- **WHEN** el administrador cierra la ventana de Meta sin terminar
- **THEN** no cambia nada y no se muestra ningún error

#### Scenario: Número de otro proyecto

- **WHEN** el número ya está conectado a otro proyecto
- **THEN** la API responde 409 y no guarda nada

#### Scenario: Sin permisos

- **WHEN** un usuario que no es administrador intenta conectar o desconectar
- **THEN** la API responde 403 y el panel no muestra el botón

### Requirement: Credenciales por proyecto

El sistema SHALL guardar el token del negocio cifrado y fuera de la configuración del proyecto, SHALL usarlo para los envíos y las plantillas de esa cuenta y SHALL usar el token del entorno solo para las cuentas sin credencial propia.

#### Scenario: Envío con el token del proyecto

- **WHEN** el bot responde en una conversación de un número conectado
- **THEN** la Graph API recibe el token de ese proyecto

#### Scenario: El token nunca sale del servidor

- **WHEN** el panel lee el proyecto o el estado de los canales
- **THEN** la respuesta no contiene el token

#### Scenario: Token revocado

- **WHEN** Meta rechaza el token de una cuenta conectada (190)
- **THEN** la conexión pasa a inválida, el equipo recibe un aviso y Configuración ofrece reconectar

### Requirement: Desconexión

El sistema SHALL permitir desconectar el número: quitar la suscripción de la app, borrar la credencial y dejar el proyecto sin cuenta de WhatsApp.

#### Scenario: Número desconectado

- **WHEN** el administrador confirma Desconectar
- **THEN** Configuración vuelve a ofrecer Conectar WhatsApp y los webhooks de ese número dejan de entrar en el proyecto
