# Add Conversation Export

## Why

Los equipos necesitan sacar sus conversaciones de Mitchbot para auditarlas, analizarlas en una hoja de cálculo, entregarlas a un cliente que las pide o archivarlas fuera de la plataforma. Hoy solo pueden copiarlas a mano desde el hilo. Es el primer punto de la v0.8 y no depende de terceros.

## What Changes

- **Exportar una conversación**: `GET /api/conversations/:id/export?format=csv|json` descarga el historial completo de esa conversación.
- **Exportar en bloque**: `GET /api/conversations/export?format=csv|json&days=|from=&to=&platform=` descarga los mensajes del rango, agrupados por conversación, de todas las conversaciones del proyecto (opcionalmente de un canal).
  - Por defecto, los últimos 30 días.
  - Rango máximo de 366 días; las fechas inválidas o un rango invertido responden 400.
- **Contenido**: solo lo que vio el cliente y el equipo: mensajes del cliente, del bot, del operador y las solicitudes de confirmación. Los detalles internos de herramientas (`tool_call`, `tool_result`) no se exportan; ya tienen su historial en `/tools`.
- **Formatos**:
  - **CSV**: una fila por mensaje, con UTF-8 + BOM para que Excel respete los acentos, RFC 4180 y protección contra inyección de fórmulas: las celdas que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno de carro se prefijan con `'`.
  - **JSON**: `{ exportedAt, project, range, conversations: [{ …, messages: [...] }] }`.
- **Columnas**: conversación, canal, cliente (nombre, identificador, teléfono, correo), estado, mensaje, fecha ISO, remitente, nombre del remitente, tipo, contenido y estado de entrega.
- **Streaming**: la respuesta se escribe conversación a conversación, respetando la contrapresión, sin cargar todo en memoria. Nombre de archivo `mitchbot-conversaciones-<proyecto>-<fecha>.<ext>` (o `mitchbot-conversacion-<cliente>-<fecha>.<ext>`) en `Content-Disposition`.
- **Permisos y auditoría**: solo `admin` y `support` (contienen datos personales); 403 para el resto. Cada exportación queda registrada en la actividad del proyecto (`conversations_exported`), con quién exportó, el formato y cuántos mensajes.
- **Interfaz**:
  - En el hilo, un menú **Exportar** (CSV / JSON) en la cabecera.
  - En la bandeja, un botón **Exportar** que abre un modal con periodo (7, 30 o 90 días, o fechas propias), canal y formato.
  - Solo lo ven `admin` y `support`; los errores se muestran en línea.
- **i18n**: claves `messaging.export.*` (es/en).

## Non-goals

- Exportaciones programadas o enviadas por correo.
- Otros formatos (PDF, XLSX).
- Exportar adjuntos (Mitchbot todavía no los guarda).

## Capabilities

### New Capabilities

- `conversation-export`: exportación de conversaciones a CSV y JSON, individual y por rango, con permisos y auditoría.

## Impact

- **Backend**:
  - Nuevos: `src/export/conversation-format.ts` (serialización pura) y `src/services/conversation-export.service.ts` (cursor y streaming).
  - Modificados: `controllers/messaging.controller.ts`, `routes/messaging.routes.ts` y `models/activity.model.ts`.
- **Frontend**:
  - Nuevos: `lib/download.ts` y `components/messaging/ExportDialog.vue`.
  - Modificados: `services/messaging.service.ts`, `views/Messaging.vue` y los locales.
- **Pruebas**:
  - Unitarios de la serialización y del rango.
  - Integración del servicio contra MongoDB.
  - E2E de la API (contenido, aislamiento y permisos) y de la UI (descargas).
