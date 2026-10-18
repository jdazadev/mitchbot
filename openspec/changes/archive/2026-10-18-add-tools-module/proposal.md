## Why

Hoy el agente tiene 8 herramientas compiladas en código, todas siempre activas para todos los proyectos, sin forma de verlas, configurarlas ni auditarlas desde el dashboard. El set solo *crea* (agendar, pedir) y no permite leer, editar ni cancelar lo creado, y no existe ninguna superficie REST ni de interfaz para el operador. El cliente que adopta la plataforma no puede adaptar el comportamiento del agente a su negocio, y quien opera no tiene rastro de qué acciones ejecutó el bot ni con qué resultado.

Este cambio introduce un **módulo de Herramientas** que convierte las capacidades del agente en *productos configurables*: cada herramienta se compone de operaciones (leer, crear, editar, eliminar), un módulo interno y, a futuro, integraciones externas; el cliente elige qué se activa y cómo se comporta, y cada uso queda registrado y auditado.

## What Changes

- **Modelo de herramienta**: cada herramienta (Agenda, Conocimiento, Inventario, Pagos) se compone de **operaciones** canónicas (`leer`, `crear`, `editar`, `eliminar`), un **módulo interno** (implementación propia ya existente o nueva) y el **contrato de integraciones** (adapters externos, sin implementar en este cambio).
- **Catálogo y binding dinámico**: el sistema SHALL exponer al modelo únicamente las operaciones habilitadas del proyecto de la conversación, en lugar de las 8 herramientas globales de hoy.
- **Configuración por proyecto**: matriz `herramienta -> operación -> binding` que enciende/apaga herramientas y operaciones y elige el binding; permite restricciones por binding (p. ej. escribir solo en el módulo interno).
- **Herramientas internas completas**: Agenda deja de ser solo-crear y gana `leer`/`editar`/`eliminar` (con cancelación) absorbiendo horarios y disponibilidad en su lectura; Conocimiento unifica `get_product_info` y `get_faq_answer` en una sola operación de lectura RAG; Inventario gestiona pedidos con `leer`/`crear`/`editar`/`eliminar`; Pagos nace como módulo interno de cobros (el cliente indica cómo pagará y un aprobador confirma).
- **Herramientas de sistema**: `transfer_to_human` y `send_notification` pasan a ser herramientas de plataforma siempre disponibles, fuera del catálogo configurable.
- **Doble circuito social**: confirmación del cliente en el chat (operaciones seguras) frente a aprobación de un operador con rol (operaciones destructivas y cobros), con cola de solicitudes pendientes.
- **Rol nuevo `approver`**: se añade el rol Aprobador a los roles del sistema (BREAKING: amplía el conjunto cerrado de roles).
- **Módulo Tools en el dashboard**: nueva ruta `/tools` con Catálogo, Aprobaciones (con badge de pendientes) e Historial, añadida a la navegación como "Tools"/"Tools" (presentación).
- **Historial de uso**: se extiende el registro de ejecuciones con operación, binding, resultado de la aprobación y actor, y se expone en la interfaz con enlace a la conversación.

Fuera de alcance (cambios posteriores): adapters externos (Google Calendar, Calendly, Shopify, WooCommerce, Stripe, PayPal, MercadoPago), conectores de Brain (Notion, Drive, Obsidian), Query Tools allowlisteadas y el motor de guards/variables.

## Capabilities

### New Capabilities
- `tools`: catálogo de herramientas y operaciones, módulo interno, contrato de integraciones, configuración por proyecto y binding dinámico al modelo.
- `tool-approvals`: rol aprobador, circuito de confirmación del cliente vs. aprobación del operador, cola de solicitudes y panel de aprobación.
- `tool-history`: registro y consulta del historial de ejecuciones de herramientas.

### Modified Capabilities
- `user-roles`: se añade el rol `approver` al conjunto de roles del sistema.
- `shell-navigation`: se añade el módulo "Tools" a la navegación y su nomenclatura.

## Impact

- **Backend**: reorganización de `src/tools/` en herramientas con operaciones; `tool.service` y `ai.service` pasan a resolver el subconjunto por proyecto; nuevos servicios de pedidos/cobros; extensión de `tool-executions`; endpoints REST de herramientas, configuración e historial; autorización por rol aprobador; `users.role`.
- **Frontend**: nueva vista `/tools` (Catálogo, Aprobaciones, Historial); enlace en `AuroraRail`; reutilización de `ADropdown`, `AModal`, `ASwitch`, `AIcon`; claves i18n nuevas en `tools.*` y `users.roles.approver` (es/en).
- **Datos**: nueva colección de cobros; extensión de `tool_executions`; configuración de herramientas por proyecto.
- **Pruebas**: e2e de configuración, binding dinámico, aprobación por rol e historial; paridad de claves es/en.
