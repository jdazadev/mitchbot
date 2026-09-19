## Context

Ver `proposal.md` para la motivación. Estado relevante para el diseño:

- La lista de conversaciones se carga con `messagingService.getConversations()`; no hay estado compartido (no existe ningún store Pinia aunque la dependencia está instalada).
- La configuración de canales vive en `project.config.channels` (`{ whatsapp, instagram, web }`), editable en Settings y consumida hoy por nadie en mensajería.
- El endpoint `PUT /api/conversations/:id/mode` existe pero `messagingService` no lo expone y el frontend no lo usa.
- La creación de contacto automática está en `chat.service.ensureContactCreated()`, condicionada por `project.config.options.autoCreateContact`; no hay endpoint manual.
- `GET /api/conversations/:id/insights` es un stub con valores fijos; el campo `conversation.aiInsights` existe y nunca se puebla.
- El footer de `Messaging.vue` tiene 6 controles sin handler; el badge del sidebar es el literal `'12'`.

## Goals / Non-Goals

**Goals:**

- Que cada control visible en la bandeja funcione o desaparezca.
- Canales, búsqueda, no leídos y toma de control basados en datos reales.
- Insights aproximados con costo controlado (modelo dedicado y barato).
- Introducir un estado compartido mínimo de conversaciones sin agregar dependencias.

**Non-Goals:**

- Notificaciones push, adjuntos reales de archivos o emoji picker (se retiran por ahora).
- Persistencia histórica de notificaciones.
- Componente compartido de burbujas/tarjetas de tools (deuda del change `chat-memory-and-flow`).
- Reindexado o cambios en RAG.

## Decisions

### D1. Filtros de canal desde la configuración del proyecto

`Messaging.vue` carga la config de canales del proyecto activo y construye los chips dinámicamente (solo habilitados + "Todos"); el filtrado por plataforma es en cliente (la lista está limitada a 50).

- **Rationale**: la lista ya llega completa; evita un nuevo parámetro de API y refleja la configuración existente.
- **Alternativas**: filtro en backend por `platform` (más trabajo y sin beneficio con 50 ítems).

### D2. Estado compartido con un composable, no un store Pinia

Se introduce un composable `useConversations` con estado a nivel de módulo (lista, no leídos, canal activo) que la bandeja y el sidebar consumen; se refresca con eventos de socket.

- **Rationale**: el sidebar necesita el conteo sin refetch duplicado; un composable evita la ceremonia de un store y no añade dependencias.
- **Alternativas**: store Pinia (más estructura de la necesaria hoy); fetch independiente en Sidebar (riesgo de desincronización).

### D3. Endpoint de contacto idempotente con `force`

Se añade `POST /api/conversations/:id/contact`, que refactoriza `ensureContactCreated(conversationId, { force: true })` para ignorar la opción `autoCreateContact` (acción explícita del agente) y reutiliza la búsqueda por identificador + proyecto para no duplicar.

- **Rationale**: reutiliza la lógica probada y mantiene el aislamiento por proyecto.
- **Alternativas**: crear contacto desde el cliente con datos sueltos (duplica validación y riesgo de cross-project).

### D4. Toma de control con el endpoint existente

`messagingService` expone `updateConversationMode(id, mode)` contra `PUT /api/conversations/:id/mode`; el backend emite `chat:status` (tarea ya prevista en `chat-memory-and-flow`) y la UI alterna el badge.

- **Rationale**: usa el contrato existente y unifica la propagación en vivo.
- **Alternativas**: lógica de modo solo en frontend (no persiste ni pausa el bot).

### D5. Insights con servicio dedicado y modelo por entorno

Nuevo `insights.service` que analiza el historial reciente con `OPENROUTER_INSIGHTS_MODEL` (fallback a `OPENROUTER_LLM_MODEL`) y devuelve `{ sentiment, sentimentScores, summary }` validado. Se invoca en modo fire-and-forget al finalizar una respuesta del bot y desde un botón. Se persiste en `conversation.aiInsights` (se amplía la interfaz con `summary?`) y se emite un evento de socket para actualización en vivo. `GET /:id/insights` devuelve lo almacenado y `POST /:id/insights` fuerza el recálculo (reemplaza el stub).

- **Rationale**: el modelo barato y el modo fire-and-forget acotan costo y latencia; separar `GET`/`POST` distingue lectura de recálculo.
- **Alternativas**: análisis con el modelo de chat (costo/latencia mayores); analizar en cada mensaje del cliente (más llamadas).

### D6. Limpieza del compositor y agrupación por fecha

Se eliminan los controles sin handler y se calcula la agrupación de mensajes por día en el cliente. El badge de confianza y el indicador "online" simulado se retiran por no tener datos que los respalden.

- **Rationale**: reduce la superficie de UI muerta y hace honesta la interfaz.
- **Alternativas**: implementar emoji/adjuntos (fuera de alcance) o dejarlos deshabilitados (sigue siendo ruido).

## Risks / Trade-offs

- **Costo del análisis automático en cada respuesta** → modelo dedicado barato, fire-and-forget y errores silenciosos; se puede desactivar cambiando la variable si molesta.
- **Un composable con estado de módulo puede quedar obsoleto** → se refresca con los eventos de socket y al entrar a la bandeja.
- **El `force` del contacto podría chocar con la regla de "no crear contactos manualmente"** → es una acción explícita del agente sobre una conversación existente, acotada por proyecto e idempotente.
- **Los e2e pueden asumir el stub de insights o los chips hardcodeados** → actualizar specs y seeds en el mismo change.

## Migration Plan

1. Definir `OPENROUTER_INSIGHTS_MODEL` (opcional) en los entornos; sin ella se usa el modelo de chat.
2. Desplegar backend y frontend juntos (nuevo endpoint de contacto, emisión de modo y panel de insights real).
3. No hay migración de datos; las conversaciones sin `aiInsights` muestran el estado vacío hasta el próximo análisis.
4. Rollback: revertir el despliegue; los insights almacenados son dato legítimo y no rompen versiones previas (campo opcional).

## Open Questions

- Nombre exacto del evento de socket para los insights (p. ej. `chat:insights`): se decide en implementación y no altera specs ni tareas.
