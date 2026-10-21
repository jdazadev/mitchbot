# Tareas

## 1. Backend

- [ ] 1.1 Modelos: `contentType: 'template'`, `message.template`, `conversation.lastInboundAt`, `project.config.whatsapp.wabaId`; `WHATSAPP_WABA_ID`.
- [ ] 1.2 `channels/whatsapp/templates.ts`: parser de componentes, variables, compatibilidad, render y payload para Meta; cliente paginado.
- [ ] 1.3 `template.service.ts`: caché, validación de variables y envío.
- [ ] 1.4 Adaptador: `type: template`; errores 132xxx.
- [ ] 1.5 Endpoints: catálogo y envío; validación de `wabaId`.
- [ ] 1.6 Las plantillas cuentan como mensajes del operador en el historial del bot, la exportación y las métricas.

## 2. Frontend

- [ ] 2.1 `TemplatePicker.vue` con búsqueda, vista previa y variables.
- [ ] 2.2 Ventana de 24 h en el hilo y acceso desde el compositor y desde las entregas fallidas por `131047`.
- [ ] 2.3 WABA ID en Configuración → Canales; i18n es/en.

## 3. Pruebas

- [ ] 3.1 Unitarios: parser, variables, render, payload, ventana.
- [ ] 3.2 Integración: envío, validación, caché, conversación no WhatsApp.
- [ ] 3.3 E2E: catálogo, envío con estado de entrega, ventana cerrada, fallo de Meta, WABA en Configuración.

## 4. Cierre

- [ ] 4.1 Changelog, AGENTS.md, README, versión 0.9.0 y hoja de ruta.
- [ ] 4.2 Validar, archivar y commit.
