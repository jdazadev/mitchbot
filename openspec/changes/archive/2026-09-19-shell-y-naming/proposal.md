## Why

La navegación mezcla nombres inconsistentes ("Brain & RAG", "Contacts"), el selector "Last 30 Days" del Topbar y los toggles de periodo del Dashboard no hacen nada, y el botón de notificaciones está muerto pese a que la tool `send_notification` ya emite eventos. Además el idioma del agente ofrece Portugués y "Detectar" cuando la operación solo contempla inglés y español. Son detalles visibles que restan credibilidad a la demo.

## What Changes

- **Renombres de módulos**: "Brain & RAG" pasa a "Brain" y "Contacts" a "Clients" (etiquetas del menú, títulos, ruta `/contacts` → `/clients` con redirección, archivos y servicios del frontend y textos de las vistas). El backend, su API (`/api/contacts`) y la colección de datos quedan intactos.
- **Rango de fechas funcional**: se elimina el widget estático "Last 30 Days" del Topbar y se añade en el Dashboard un control real (últimos 7/30/90 días) junto con los toggles de granularidad (diaria/semanal/mensual) funcionando; el backend acepta rango de fechas y periodo mensual.
- **Centro de notificaciones**: el botón de notificaciones del Topbar abre un panel con las notificaciones recibidas por el evento `admin:notification`, un indicador solo cuando hay no leídas y una acción para limpiarlas (alcance de sesión).
- **Idioma del agente**: se elimina Portugués y "Detectar"; el agente solo puede configurarse en español o inglés (interfaz, tipos, validación y prompt), normalizando los agentes existentes con valores obsoletos a español.

## Capabilities

### New Capabilities

- `shell-navigation`: nomenclatura de los módulos, selector de rango de fechas del panel de métricas y centro de notificaciones.
- `agent-configuration`: ajustes de configuración del agente de IA, en particular el idioma en que responde.

### Modified Capabilities

- (ninguna)

## Impact

- **Frontend**: `components/layout/Sidebar.vue`, `components/layout/Topbar.vue`, `router/index.ts`, `views/Dashboard.vue`, `views/Contacts.vue` (→ `Clients.vue`), `services/contact.service.ts` (→ `client.service.ts`), `views/Settings.vue`, `services/settings.service.ts`, `services/socket.service.ts`.
- **Backend**: `services/analytics.service.ts`, `controllers/dashboard.controller.ts`, `models/agent.model.ts`, `controllers/agents.controller.ts`, `services/prompt-builder.service.ts`, script de normalización.
- **Pruebas e2e**: navegación por `/clients`, rango de fechas, notificaciones e idioma del agente.
- **Documentación**: `AGENTS.md` y `changelog.md` (bump de versión menor).

## Nota de alcance

El renombre es de presentación y de frontend; no se renombran la colección `contacts` ni los endpoints del backend, para evitar cambios de contrato y migración de datos.
