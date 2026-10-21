# chat-widget Specification

## Purpose
Llevar el chat de Mitchbot a la web del negocio con un widget embebible que solo se muestra en los dominios autorizados, y proteger las conversaciones públicas con un token de acceso y un socket aislado del resto del proyecto.

## Requirements

### Requirement: Acceso a conversaciones públicas por token

El sistema SHALL entregar un token de acceso al iniciar una conversación pública y SHALL exigirlo para escribir en ella, para leer su historial y para unirse a su sala de tiempo real. Un cliente público SHALL NOT recibir eventos de la sala del proyecto ni de conversaciones ajenas.

#### Scenario: Mensaje sin token

- **WHEN** alguien envía un mensaje público a una conversación sin su token o con uno de otra conversación
- **THEN** la respuesta es 403 y no se registra el mensaje

#### Scenario: Unirse a una conversación ajena

- **WHEN** un socket público pide unirse a una conversación de la que no tiene el token, o de otro proyecto
- **THEN** recibe `ACCESS_DENIED` y no recibe sus mensajes

#### Scenario: Eventos del proyecto

- **WHEN** empieza una conversación nueva en el proyecto
- **THEN** los sockets públicos de otros clientes no reciben `chat:new_conversation`

#### Scenario: Confirmación desde fuera de la conversación

- **WHEN** un socket que no está en la sala de una conversación envía `tool:confirm` para una de sus herramientas
- **THEN** la confirmación se rechaza

### Requirement: Widget embebible

El sistema SHALL ofrecer por proyecto un widget de chat que se instala con un `<script>` y abre el chat en un `iframe` servido por el backend. El widget SHALL usar el canal Web, la marca del proyecto y el idioma del agente.

#### Scenario: Conversación desde la web del negocio

- **WHEN** un visitante abre el widget en una web con el dominio permitido y escribe un mensaje
- **THEN** aparece una conversación Web en la bandeja y la respuesta del bot llega al widget en tiempo real

#### Scenario: Volver a la página

- **WHEN** el visitante recarga la página y vuelve a abrir el widget
- **THEN** ve el historial de su conversación y puede seguirla

#### Scenario: Confirmación de una herramienta

- **WHEN** el bot pide confirmar una acción
- **THEN** el widget muestra los botones Confirmar y Cancelar y la decisión llega al servidor

### Requirement: Dominios permitidos

El widget SHALL poder embeberse solo en los orígenes permitidos del proyecto (y en el panel, para la vista previa), aplicándolo con la cabecera `frame-ancestors`. Sin orígenes permitidos SHALL NOT poder embeberse en ninguna web externa. Los orígenes SHALL validarse como `http(s)://host[:puerto]`, sin ruta.

#### Scenario: Dominio no permitido

- **WHEN** una web que no está en la lista intenta abrir el widget
- **THEN** el navegador bloquea el `iframe`

#### Scenario: Origen inválido

- **WHEN** un administrador guarda `ejemplo.com/tienda` como dominio permitido
- **THEN** la API responde 400 y explica el formato esperado

#### Scenario: Widget desactivado

- **WHEN** el widget está desactivado o el canal Web deshabilitado
- **THEN** la página del widget responde 404 y el cargador no muestra el botón

### Requirement: Configuración del widget

Configuración → Canales SHALL permitir activar el widget, gestionar los dominios permitidos, elegir la posición, el título y el saludo, copiar el fragmento de instalación y ver una vista previa.

#### Scenario: Instalar el widget

- **WHEN** un administrador activa el widget, añade su dominio y copia el fragmento
- **THEN** el fragmento contiene la URL del cargador y el slug del proyecto, y la vista previa muestra el chat con la marca del proyecto
