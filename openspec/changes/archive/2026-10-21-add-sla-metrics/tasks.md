# Tareas

## 1. Backend

- [x] 1.1 Modelos: `config.sla`, `conversation.awaitingReplySince`, `slaBreachNotifiedAt`, `closedAt`.
- [x] 1.2 `chat.service`: abrir la espera con el mensaje del cliente, cerrarla con las respuestas visibles, registrar el cierre.
- [x] 1.3 `services/sla.ts`: turnos, cumplimiento, percentiles, resolución y estado de una espera.
- [x] 1.4 `GET /api/dashboard/sla` y objetivos validados en `PUT /api/project`.
- [x] 1.5 Cola `sla-alerts`: aviso diferido, una vez por espera.

## 2. Frontend

- [x] 2.1 Bloque SLA en el Resumen.
- [x] 2.2 Estado de la espera en la bandeja, en vivo.
- [x] 2.3 Objetivos y avisos en Configuración → Opciones; i18n es/en.

## 3. Pruebas

- [x] 3.1 Unitarios: cálculo de turnos y resolución, percentiles, estado de la espera.
- [x] 3.2 Integración: espera abierta y cerrada, cierre, endpoint, aviso diferido.
- [x] 3.3 E2E: Resumen, bandeja, configuración.

## 4. Cierre

- [x] 4.1 Changelog, AGENTS.md, README, versión 0.11.0 y hoja de ruta.
- [x] 4.2 Validar, archivar y commit.
