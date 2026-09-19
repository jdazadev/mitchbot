## Why

La interfaz mezcla inglés y español en el mismo flujo (menú en inglés, configuración en español, botones como "Take Over" junto a "Enviar"), y no existe infraestructura de internacionalización: todos los textos están hardcodeados. El "spanglish" es difícil de mantener y da una imagen descuidada; se necesita una base de i18n con español e inglés.

## What Changes

- Introducir **vue-i18n** con catálogos de español e inglés y **español por defecto**.
- Añadir un **selector de idioma en el Topbar**, persistido en el navegador y aplicado en vivo a todas las vistas del dashboard.
- **Externalizar todos los textos visibles** del dashboard a los catálogos, eliminando la mezcla de idiomas en un mismo flujo.
- Que el **chat público del cliente** (TestChat) use su propio idioma, siguiendo el idioma del agente, de forma independiente del idioma del dashboard.
- Reflejar el idioma activo en el atributo `lang` del documento.

## Capabilities

### New Capabilities

- `i18n`: internacionalización de la interfaz del dashboard (español/inglés) y del chat público, con selección de idioma, catálogos de traducción y persistencia.

### Modified Capabilities

- (ninguna)

## Impact

- **Frontend**: `package.json` (nueva dependencia `vue-i18n`), `main.ts` (registro del plugin), nuevos `locales/es.json` y `locales/en.json`, `components/layout/Sidebar.vue` y `Topbar.vue`, todas las vistas (`Dashboard`, `Messaging`, `Clients`, `Brain`, `Settings`, `Users`, `Agents`, `Profile`, `DevTests`), `views/TestChat.vue` y `index.html`.
- **Pruebas e2e**: los specs que seleccionan por texto pueden verse afectados; se estabilizan con `data-testid`/roles y locale por defecto en español.
- **Documentación**: `AGENTS.md` y `changelog.md` (bump de versión menor).

## Nota de alcance

Los mensajes de error del backend permanecen en español; internacionalizarlos implicaría códigos de error en la API y queda fuera de este cambio.
