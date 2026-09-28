## Context

El sistema de herramientas actual vive en `apps/backend/src/tools/`: un arreglo compilado de 8 herramientas (`index.ts`) que `ai.service.ts:199` pasa completo a `bindTools()` para todos los proyectos. Cada herramienta es un objeto con `name`, `description`, `parameters` (JSON Schema), `requiresConfirmation` y `execute()`. El ejecutor (`tool.service.ts`) normaliza tool calls nativos y de texto, y `chat.service` orquesta la confirmación con la colección `tool_executions` y los eventos WebSocket `tool:confirm` / `tool:confirmed`. El dashboard no expone ninguna superficie para listar, configurar o auditar herramientas. Ver `proposal.md - Why` para la motivación.

Este diseño se apoya en un precedente ya presente en el código: `llm-provider.service.ts` resuelve un contrato (chat/embeddings/OCR) contra un proveedor activo. La misma forma —contrato + binding activo— se aplica aquí a las acciones.

## Goals / Non-Goals

**Goals:**
- Reorganizar el catálogo compilado en herramientas con operaciones y un binding activo (módulo interno; integraciones como contrato futuro).
- Resolver el subconjunto de operaciones por proyecto en el momento de generar la respuesta.
- Introducir el circuito de aprobación por rol sin romper la confirmación del cliente existente.
- Dar al operador visibilidad del uso (historial) y de lo pendiente (cola de aprobaciones).
- Preservar el comportamiento actual de los proyectos existentes tras la migración.

**Non-Goals:**
- Implementar adapters externos (Google Calendar, Calendly, Shopify, WooCommerce, Stripe, PayPal, MercadoPago).
- Conectores de Brain (Notion, Drive, Obsidian) y Query Tools allowlisteadas.
- Motor de guards (horarios, límites por contacto, duplicados) y catálogo de variables de contexto.
- Herramientas custom definidas por el cliente o por el LLM.

## Decisions

### Catálogo en código, configuración en datos
Las herramientas y sus operaciones se implementan y revisan como código; el cliente solo enciende/apaga y elige binding. Alternativas descartadas: (a) tools como JSON en BD creadas por el cliente — abre ejecución arbitraria, SSRF e inyección, imposible de curar; (b) tools webhook genéricas — potentes pero inseguras y prematuras para la etapa. El modelo elegido da adaptabilidad por catálogo, no por código del cliente, y es consistente con el router de proveedores existente.

### Operaciones como funciones distinguibles
Cada par (herramienta, operación) se expone al modelo como una función propia con su JSON Schema (p. ej. `agenda_leer`, `agenda_crear`) en lugar de una sola función con un parámetro `operation`. Alternativa descartada: función única con enum de operación — menos esquema, pero empeora la selección del modelo y mezcla parámetros. La mitigación del crecimiento de contexto es el binding por proyecto: solo viajan las operaciones habilitadas.

### Binding como contrato tipo proveedor
`Binding` declara qué operaciones soporta; el módulo interno implementa todas las de su herramienta y es el único disponible en este cambio. Las integraciones externas se implementarán después como adapters del mismo contrato, reutilizando la forma de `llm-provider.service`. Evita diseñar dos veces cuando lleguen Google Calendar o Stripe.

### Capa de control por operación
Se sustituye el booleano `requiresConfirmation` por una capa de control `ninguna | confirmacion_cliente | aprobacion_operador`. La confirmación del cliente reutiliza el flujo existente (`confirmation_request` + `tool:confirm`); la aprobación del operador es un circuito nuevo que reutiliza `tool_executions` añadiendo el estado `pending_approval` y los campos de decisión. Dos circuitos, un solo registro.

### Rol `approver` con respaldo de `admin`
La aprobación se restringe al rol `approver`, y `admin` siempre puede aprobar. Alternativa descartada: capacidad otorgable por usuario — más flexible pero añade un sistema de permisos granulares que el producto aún no necesita. El respaldo de `admin` evita colas muertas cuando el proyecto no tiene usuarios con ese rol.

### Herramientas de sistema fuera del catálogo
`transfer_to_human` y `send_notification` se separan del catálogo configurable y quedan siempre disponibles. Evita que un cliente desactive accidentalmente la escalación a humano o el aviso al equipo.

### Persistencia
- Reutilizar `appointments` y `orders` para los módulos internos de Agenda e Inventario.
- Nueva colección `payments` (intención de cobro + estado de aprobación); nunca movimiento de dinero.
- Extender `tool_executions` con operación, binding, estado de aprobación y actor.
- Guardar la configuración de herramientas del proyecto en `projects.config.tools` por reutilizar el patrón de configuración por proyecto y el `projectId` ya resuelto por request. Alternativa descartada: colección dedicada — útil solo si la configuración creciera a un historial versionado, hoy innecesario.

### Lectura unificada
`Conocimiento·leer` reemplaza `get_product_info` y `get_faq_answer`. `Agenda·leer` absorbe `get_business_hours` y `get_service_availability`. Se retiran las cuatro herramientas antiguas del registro.

## Risks / Trade-offs

- **Crecimiento del contexto del modelo** (varias operaciones × varias herramientas) → binding por proyecto reduce el conjunto; descripciones concisas; medir la calidad de selección tras el cambio.
- **Cola de aprobaciones sin resolver** → respaldo del rol `admin`; el indicador de pendientes hace visible lo atascado.
- **Deriva de alcance en Pagos** → solo registra intención y aprueba; prohibido cualquier movimiento de dinero o integración de cobro en este cambio.
- **Regresión de comportamiento en proyectos existentes** → configuración por defecto que reproduce el set actual (ver Migración) y pruebas e2e de continuidad.
- **Fuga entre proyectos** → toda la configuración, los registros y las aprobaciones se filtran por `projectId`; pruebas de aislamiento.
- **Paridad i18n** → nuevas claves `tools.*` y `users.roles.approver` añadidas a `es.json` y `en.json` en el mismo cambio.

## Migration Plan

1. Desplegar el registro nuevo manteniendo el comportamiento por defecto: cada proyecto recibe habilitadas las operaciones internas equivalentes al set actual (`Agenda·crear`, `Inventario·crear`, `Conocimiento·leer`) y las herramientas de sistema siempre activas.
2. Mapeo de las 8 herramientas actuales:
   - `create_appointment` → `Agenda·crear`
   - `get_business_hours` + `get_service_availability` → `Agenda·leer`
   - `get_product_info` + `get_faq_answer` → `Conocimiento·leer`
   - `create_order` → `Inventario·crear`
   - `transfer_to_human` → herramienta de sistema
   - `send_notification` → herramienta de sistema
3. Añadir el rol `approver` (sin asignar usuarios por defecto; el respaldo de `admin` cubre la aprobación).
4. Rollback: la configuración por proyecto permite deshabilitar operaciones nuevas sin desplegar; si el binding dinámico falla, se puede forzar temporalmente el conjunto interno completo hasta corregir.

## Open Questions

- Esquema exacto de los identificadores de función expuestos al modelo (`agenda_leer` vs. `agenda.read`): deferible, no cambia el comportamiento observable ni las tareas.
- Conjunto habilitado por defecto en proyectos nuevos (todas las operaciones internas vs. solo las equivalentes al set actual): decisión de producto que no altera el diseño ni las tareas.
