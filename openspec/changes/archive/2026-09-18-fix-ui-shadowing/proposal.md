## Why

El frontend está ejecutando una mezcla de código compilado obsoleto (marzo/abril) y fuentes TypeScript actuales. Existen 56 artefactos compilados (28 `.js`/`.vue.js` + 28 `.js.map`) junto a los `.ts`/`.vue`, y Vite resuelve `.js` con prioridad en imports sin extensión. Esto provoca que `/messaging` reciba un `socket.service.js` viejo sin `onMessageUpdated`, el `onMounted` lance `TypeError`, `fetchChats()` nunca se ejecute y la vista quede en "Cargando conversaciones..." de forma permanente, además de otros comportamientos fantasma difíciles de diagnosticar.

## What Changes

- Eliminar los 56 artefactos compilados obsoletos (`.js`, `.vue.js` y `.js.map`) dentro de `apps/frontend/src/`.
- Verificar que Vite resuelve los fuentes `.ts`/`.vue` actuales y que el listado de conversaciones carga correctamente.
- Blindar la inicialización de `Messaging.vue` para que un fallo en la conexión de servicios (socket) no impida cargar los datos ni deje el estado de carga eterno.
- Prevenir la recurrencia: configurar el compilador para no emitir dentro de `src/` y mantener esos artefactos fuera del control de versiones.

## Capabilities

### New Capabilities

- `frontend-module-loading`: Resolución de módulos del frontend desde los fuentes actuales y carga resiliente de vistas ante fallos de inicialización.

### Modified Capabilities

<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Código**: `apps/frontend/src/**/*.js`, `apps/frontend/src/**/*.vue.js`, `apps/frontend/src/views/Messaging.vue`.
- **Configuración**: `apps/frontend/tsconfig*.json` (evitar emisión en `src/`), `.gitignore`.
- **Sin cambios** en API backend, base de datos ni dependencias.
- **Riesgo**: bajo; solo se eliminan artefactos regenerables y se endurece el manejo de errores de arranque de una vista.
