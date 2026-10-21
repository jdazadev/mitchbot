## ADDED Requirements

### Requirement: Exportar una conversación

El sistema SHALL permitir descargar el historial completo de una conversación del proyecto en CSV o JSON, con los mensajes del cliente, del bot, del operador y las solicitudes de confirmación, ordenados por fecha. Los mensajes internos de herramientas SHALL NOT exportarse.

#### Scenario: Descarga en CSV

- **WHEN** un administrador exporta una conversación en CSV
- **THEN** recibe un archivo UTF-8 con BOM y una fila por mensaje visible, con cabecera de columnas

#### Scenario: Conversación de otro proyecto

- **WHEN** se pide exportar una conversación que no pertenece al proyecto activo
- **THEN** la respuesta es 404

### Requirement: Exportar en bloque por rango

El sistema SHALL permitir descargar los mensajes de un rango de fechas de todas las conversaciones del proyecto, agrupados por conversación y opcionalmente filtrados por canal. Sin rango SHALL usar los últimos 30 días. Un rango mayor de 366 días, invertido o con fechas inválidas SHALL responder 400.

#### Scenario: Últimos 30 días

- **WHEN** se exporta sin indicar rango
- **THEN** el archivo contiene los mensajes de los últimos 30 días del proyecto activo

#### Scenario: Filtro por canal

- **WHEN** se exporta con `platform=WhatsApp`
- **THEN** solo aparecen conversaciones de WhatsApp

#### Scenario: Rango inválido

- **WHEN** se pide un rango de más de 366 días o con `from` posterior a `to`
- **THEN** la respuesta es 400 con el motivo

### Requirement: CSV seguro para hojas de cálculo

El CSV SHALL seguir RFC 4180 y SHALL neutralizar las celdas que una hoja de cálculo interpretaría como fórmula, prefijándolas con un apóstrofo.

#### Scenario: Mensaje con fórmula

- **WHEN** un cliente escribe `=HYPERLINK("http://malo")` y se exporta en CSV
- **THEN** la celda contiene `'=HYPERLINK(""http://malo"")` entre comillas

### Requirement: Permisos y auditoría

Solo los roles `admin` y `support` SHALL poder exportar. Cada exportación SHALL registrar en la actividad del proyecto quién la hizo, el formato, el alcance y el número de mensajes.

#### Scenario: Rol sin permiso

- **WHEN** un usuario `assistant` pide una exportación
- **THEN** la respuesta es 403

#### Scenario: Registro de la exportación

- **WHEN** un administrador exporta en bloque
- **THEN** la actividad del proyecto incluye una entrada `conversations_exported` con su nombre y el total de mensajes

### Requirement: Exportación desde la interfaz

Conversaciones SHALL ofrecer a `admin` y `support` exportar la conversación abierta (CSV o JSON) y exportar en bloque eligiendo periodo, canal y formato. Los demás roles SHALL NOT ver estas acciones.

#### Scenario: Exportar la conversación abierta

- **WHEN** un administrador elige Exportar → CSV en la cabecera del hilo
- **THEN** el navegador descarga el archivo de esa conversación

#### Scenario: Exportación en bloque

- **WHEN** un administrador abre Exportar en la bandeja, elige 7 días, WhatsApp y JSON, y confirma
- **THEN** el navegador descarga el JSON con las conversaciones de WhatsApp de esos días
