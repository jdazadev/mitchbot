## 1. Infraestructura de i18n

- [x] 1.1 Añadir `vue-i18n` a `apps/frontend/package.json` e instalar; verificar con `pnpm install`.
- [x] 1.2 Crear `locales/es.json` y `locales/en.json` (claves por dominio) y registrar el plugin en `main.ts` con español por defecto y fallback a español; verificar con `pnpm --filter @mitchbot/frontend build`.
- [x] 1.3 Actualizar `index.html` para reflejar el idioma activo en el atributo `lang`.

## 2. Selector de idioma

- [x] 2.1 Añadir el selector de idioma en `Topbar.vue` conectado a vue-i18n; verificar que cambiar a inglés actualiza la interfaz sin recargar.
- [x] 2.2 Persistir la preferencia en `localStorage` ("mitchbot.locale") y restaurarla al iniciar; verificar que se conserva tras recargar.

## 3. Extracción de textos del dashboard

- [x] 3.1 Extraer los textos de shell (`Sidebar.vue`, `Topbar.vue`) y de `Dashboard.vue`; verificar que no quedan textos hardcodeados.
- [x] 3.2 Extraer los textos de `Messaging.vue` y `Clients.vue`; verificar en ambos idiomas.
- [x] 3.3 Extraer los textos de `Brain.vue`, `Settings.vue`, `Users.vue`, `Agents.vue`, `Profile.vue` y `DevTests.vue`; verificar en ambos idiomas.
- [x] 3.4 Barrido final de strings hardcodeados en `apps/frontend/src` y verificar que ambos catálogos tienen las mismas claves.

## 4. Chat público

- [x] 4.1 Añadir las claves `publicChat.*` y hacer que `TestChat.vue` seleccione el idioma según la personalidad del agente del proyecto; verificar que el dashboard no altera el idioma del chat público.
- [x] 4.2 Verificar que cambiar el idioma del agente en la configuración cambia los textos del chat público.

## 5. Pruebas e2e

- [x] 5.1 Estabilizar los specs que dependen de texto (roles/`data-testid`) y añadir un spec del cambio de idioma; verificar que corren con español por defecto.
- [x] 5.2 Ejecutar `pnpm test:e2e` y confirmar que la suite pasa.

## 6. Documentación y versión

- [x] 6.1 Actualizar `AGENTS.md` (frontend: vue-i18n, catálogos es/en, selector en Topbar, idioma del chat público).
- [x] 6.2 Registrar el cambio en `changelog.md` con la fecha actual y subir la versión de forma menor.

## 7. Verificación final

- [x] 7.1 Ejecutar `pnpm --filter @mitchbot/frontend build` (y `pnpm --filter @mitchbot/backend build` como control) y confirmar que pasan sin errores.
- [x] 7.2 Ejecutar `openspec validate i18n --strict` y confirmar que el change es válido.
- [ ] 7.3 Realizar el commit del cambio implementado.
