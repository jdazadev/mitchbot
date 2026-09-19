## 1. Renombre de módulos

- [x] 1.1 Cambiar las etiquetas del menú lateral ("Brain", "Clients") y los títulos correspondientes en `Topbar.vue`; verificar visualmente que no queda "Brain & RAG" ni "Contacts".
- [x] 1.2 Cambiar la ruta a `/clients` con redirección desde `/contacts` y renombrar `views/Contacts.vue` → `views/Clients.vue` y `services/contact.service.ts` → `client.service.ts`; verificar con `pnpm --filter @mitchbot/frontend build`.
- [x] 1.3 Actualizar los textos visibles del módulo ("contacto" → "cliente") manteniendo las llamadas a `/api/contacts`; verificar que listar, editar, archivar y restaurar siguen funcionando.

## 2. Rango de fechas del panel

- [x] 2.1 Eliminar el widget estático "Last 30 Days" del `Topbar.vue`; verificar que ya no aparece.
- [x] 2.2 Añadir el control de rango (7/30/90 días, por defecto 30) en `Dashboard.vue` y conectar los toggles Diaria/Semanal/Mensual; verificar que cambiar el rango recalcula métricas y volumen.
- [x] 2.3 Ampliar `analytics.service`/`dashboard.controller` para aceptar rango de fechas y `period = monthly`; verificar con una llamada autenticada.

## 3. Centro de notificaciones

- [x] 3.1 Conectar `Topbar.vue` al evento `admin:notification` y acumular las notificaciones en estado local; verificar que llega la notificación de `send_notification`.
- [x] 3.2 Implementar el panel desplegable con listado, indicador de no leídas condicional y acción de marcar como leídas; verificar que el indicador aparece y desaparece según corresponda.

## 4. Idioma del agente

- [x] 4.1 Quitar Portugués y "Detectar" de las opciones de `Settings.vue` y del tipo en `services/settings.service.ts`; verificar que solo quedan Español e Inglés.
- [x] 4.2 Reducir el tipo `AgentPersonality['language']`, el `z.enum` de `agents.controller.ts` y `LANGUAGE_MAP` a `'es' | 'en'`; verificar con `pnpm --filter @mitchbot/backend build` y que un idioma inválido se rechaza.
- [x] 4.3 Añadir y ejecutar un script que normalice agentes con `pt`/`auto` a `es`; verificar que no quedan documentos con idioma no soportado.

## 5. Pruebas e2e

- [x] 5.1 Actualizar los specs que navegan a `/contacts` y añadir cobertura de rango de fechas, notificaciones e idioma del agente.
- [x] 5.2 Ejecutar `pnpm test:e2e` y confirmar que la suite pasa.

## 6. Documentación y versión

- [x] 6.1 Actualizar `AGENTS.md` (nomenclatura Brain/Clients, rango de fechas, notificaciones e idioma del agente limitado a es/en).
- [x] 6.2 Registrar el cambio en `changelog.md` con la fecha actual y subir la versión de forma menor.

## 7. Verificación final

- [x] 7.1 Ejecutar `pnpm --filter @mitchbot/backend build`, `pnpm --filter @mitchbot/backend test` y `pnpm --filter @mitchbot/frontend build` y confirmar que pasan sin errores.
- [x] 7.2 Ejecutar `openspec validate shell-y-naming --strict` y confirmar que el change es válido.
- [x] 7.3 Realizar el commit del cambio implementado.
