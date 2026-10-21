# Tareas

## 1. Backend

- [x] 1.1 `src/export/conversation-format.ts`: columnas, celda CSV segura, fila, nombre de archivo, rango.
- [x] 1.2 `conversation-export.service.ts`: cursor por conversación, filtro de mensajes visibles, escritura con contrapresión, CSV y JSON.
- [x] 1.3 Endpoints de exportación individual y en bloque con `authorize('admin', 'support')` y actividad `conversations_exported`.

## 2. Frontend

- [x] 2.1 `downloadBlob` y servicio de exportación con nombre desde `Content-Disposition`.
- [x] 2.2 Menú Exportar en el hilo y modal de exportación en bloque, solo para admin y support.
- [x] 2.3 i18n es/en.

## 3. Pruebas

- [x] 3.1 Unitarios: celda CSV, inyección de fórmulas, filas, nombre de archivo, rango; `downloadBlob` y nombre del archivo.
- [x] 3.2 Integración: filtros de rango y canal, aislamiento, mensajes internos excluidos, JSON válido.
- [x] 3.3 E2E: API (CSV y JSON, rango, canal, aislamiento, 403, 400) y UI (descarga individual y en bloque).

## 4. Cierre

- [x] 4.1 Changelog, AGENTS.md, README, versión 0.8.0 y hoja de ruta.
- [x] 4.2 Validar, archivar y commit.
