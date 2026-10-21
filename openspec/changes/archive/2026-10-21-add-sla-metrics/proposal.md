# Add SLA Metrics

## Why

El panel muestra la mediana de primera respuesta, pero no dice si el equipo cumple lo que promete a sus clientes ni avisa cuando alguien lleva demasiado tiempo esperando. Con WhatsApp, Instagram y el widget, las esperas largas ocurren sobre todo cuando la conversación pasa a una persona, y hoy solo se descubren revisando la bandeja a mano.

## What Changes

- **Objetivos por proyecto** (`config.sla { responseMinutes, resolutionHours, alerts }`, por defecto 15 minutos, 24 horas y avisos activos), en Configuración → Opciones.
- **Espera en curso**: la conversación guarda `awaitingReplySince` (el primer mensaje del cliente sin responder).
  - **Cuándo se borra**: cuando el cliente recibe una respuesta del bot o del operador, una solicitud de confirmación o una plantilla.
  - **Cuándo no se borra**: el aviso de error del bot, porque el cliente sigue esperando.
- **Cierre**: `closedAt` se registra al cerrar y se borra al reabrir.
- **`GET /api/dashboard/sla?days=|from=&to=`**:
  - **Respuesta**: cada mensaje del cliente que espera respuesta es un turno. El cumplimiento es el porcentaje de turnos respondidos dentro del objetivo; un turno sin respuesta que ya superó el objetivo cuenta como fuera de plazo. Además devuelve la mediana y el percentil 90 de la espera.
  - **Resolución**: entre las conversaciones creadas en el rango, el porcentaje cerradas dentro del objetivo; las abiertas que ya lo superaron cuentan como fuera de plazo. Además devuelve la mediana de la duración.
  - **Ahora**: las conversaciones abiertas esperando fuera de plazo (con las 10 más antiguas) y las que están a punto de vencer (al 75 % del objetivo).
- **Aviso de espera vencida**: al empezar una espera se programa un trabajo diferido de BullMQ (`sla-alerts`). Si al vencer el objetivo el cliente sigue esperando y la conversación sigue abierta, se avisa al proyecto con `admin:notification`, una sola vez por espera.
- **Interfaz**:
  - El Resumen añade un bloque **SLA**: respuesta y resolución en plazo, mediana de espera y la lista "Esperando fuera de plazo", con enlaces a las conversaciones.
  - La bandeja marca cada conversación como **Fuera de plazo** o **Vence pronto**, y se actualiza en vivo.
  - Configuración → Opciones permite cambiar los objetivos y los avisos.
- i18n es/en.

## Non-goals

- Horario laboral y festivos: los plazos se cuentan en tiempo corrido.
- Objetivos por canal, por prioridad o por operador.
- Informes programados.

## Capabilities

### New Capabilities

- `sla-metrics`: objetivos de respuesta y resolución por proyecto, cumplimiento en el Resumen, esperas fuera de plazo en la bandeja y avisos al vencer.

## Impact

- **Backend**:
  - Nuevos: `services/sla.ts` (cálculo puro), `services/sla.service.ts` y `queues/sla-alerts.ts`.
  - Modificados: `chat.service.ts` (espera y cierre), `messaging.controller.ts`, `dashboard.controller.ts` y las rutas, `project.controller.ts`, los modelos e `index.ts`.
- **Frontend**:
  - Nuevos: `lib/sla.ts` y `components/dashboard/SlaPanel.vue`.
  - Modificados: `Dashboard.vue`, `Messaging.vue`, `useConversations`, `Settings.vue` y los locales.
- **Pruebas**:
  - Unitarios del cálculo y del estado en la bandeja.
  - Integración de la espera, el cierre, el endpoint y el aviso.
  - E2E del Resumen, la bandeja y la configuración.
