## 1. Diagnóstico y verificación previa

- [x] 1.1 Inventariar todos los `.js`, `.vue.js` y `.js.map` dentro de `apps/frontend/src/` y verificar que cada uno tiene su fuente `.ts`/`.vue` correspondiente (comando de listado; reportar cualquier artefacto sin fuente equivalente antes de borrar).
- [x] 1.2 Confirmar el defecto en navegador headless: navegar a `/messaging` con sesión inyectada y registrar el `TypeError` de `onMessageUpdated` y el spinner permanente (evidencia en consola/red).

## 2. Limpieza de artefactos obsoletos

- [x] 2.1 Eliminar los 56 artefactos (`.js`, `.vue.js` y `.js.map`) de `apps/frontend/src/` y verificar con un listado que no queda ninguno.
- [x] 2.2 Reiniciar el servidor de desarrollo de Vite (y forzar recarga sin caché) y verificar que el módulo servido para `socket.service` es el fuente `.ts` actual mediante petición al servidor de desarrollo.

## 3. Carga resiliente de la bandeja

- [x] 3.1 Refactorizar la inicialización de `Messaging.vue` para que la carga de conversaciones se ejecute aunque falle la inicialización del socket, registrando el error (verificar por revisión de código y prueba en navegador con el socket caído).
- [x] 3.2 Verificar que `isLoadingChats` finaliza en todos los caminos y que la vista muestra lista o estado vacío (prueba en navegador headless).

## 4. Prevención de recurrencia

- [x] 4.1 Configurar la compilación de TypeScript del frontend para no emitir dentro de `apps/frontend/src/` y verificar que la comprobación de tipos no genera `.js` junto a los fuentes.
- [x] 4.2 Asegurar que los artefactos compilados quedan excluidos del control de versiones y verificar con `git status`/`git check-ignore` que no se rastrean.

## 5. Verificación integral

- [x] 5.1 Validar en navegador headless las rutas `/`, `/messaging`, `/contacts` y `/brain` sin errores de consola y con sus datos cargando (evidencia de consola limpia).
- [x] 5.2 Ejecutar la comprobación de tipos del frontend y confirmar que pasa sin errores.

## 6. Cierre

- [x] 6.1 Actualizar `changelog.md` y `AGENTS.md` con el fix y subir la versión de parche (semver) según la convención del proyecto.
