## Context

Ver `proposal.md - Why`. El contador vive en `conversations.unreadCount` (MongoDB) y hoy solo se incrementa: hay cuatro puntos que lo tocan (`chat.service.ts` líneas ~144 creación, ~217 envío genérico, ~482 respuesta del bot, ~707 respuesta tras herramientas) y ninguno lo decrementa. El frontend (`composables/useConversations.ts`) mantiene la lista a nivel de módulo compartida entre la bandeja y el sidebar, y solo pone el contador local a cero al abrir una conversación — sin llamar al servidor. El socket del dashboard entra a la room `project:<id>` y ya existe `emitToProject` (`websocket/socket.ts:220`) usado para eventos como `chat:status`.

## Goals / Non-Goals

**Goals:**

- Que el contador refleje solo mensajes pendientes del cliente y sobreviva a recargas.
- Que la lectura se propague en vivo entre sesiones del mismo proyecto.
- Que abrir el módulo no imponga una conversación seleccionada.

**Non-Goals:**

- No cambiar el modelo de datos (`unreadCount` sigue siendo un número por conversación).
- No introducir lectura "por mensaje" ni `readBy` por usuario: el estado de leído es a nivel de conversación y de proyecto.
- No modificar la vista pública del cliente (TestChat) ni su comportamiento de mensajes.

## Decisions

**1. Qué suma: solo `sender === 'contact'`.**
En `chat.service.ts`, el `$inc` de `sendMessage` se condiciona a `sender === 'contact'`; los `$inc` de las respuestas del bot (directa y tras herramientas) se eliminan. Alternativa considerada: contador a nivel de usuario/rol — descartada por sobre-ingeniería para el estado actual (el badge es del proyecto, no del usuario).

**2. Persistir la lectura con `PUT /:id/read` y notificar con `chat:read`.**
Nuevo handler acotado al proyecto (`updateOne({ _id, projectId }, { $set: { unreadCount: 0 } })`) que responde 404 si no coincide y, en try/catch, ejecuta `emitToProject(projectId, 'chat:read', { conversationId })` — mismo patrón tolerante a fallos que `updateMode`. El evento va a la room del proyecto (no a la room de la conversación) porque el badge es compartido por todas las sesiones del proyecto. Alternativa: emitir solo a la room de la conversación — insuficiente para actualizar el sidebar de otras sesiones que no estén en esa room.

**3. Re-marcar en conversación abierta (estilo WhatsApp).**
El backend incrementa `unreadCount` **antes** de emitir `chat:message`; por eso, al recibir un mensaje del cliente para la conversación abierta, el frontend no basta con no incrementar localmente: debe llamar a `PUT /:id/read`. El composable expone `openConversationId` (estado de módulo) que `Messaging.vue` fija al seleccionar; `handleSocketMessage` lo consulta. Alternativa: que el backend omita el incremento si "alguien" tiene la conversación abierta — descartada porque el servidor no conoce la presencia del dashboard de forma fiable.

**4. Sincronización entre sesiones.**
`socket.service.ts` agrega `onConversationRead`/`offConversationRead`; `useConversations` escucha `chat:read` y pone el contador local de esa conversación a cero. Es idempotente: la propia sesión que leyó también recibe el evento.

**4b. Entrega en vivo para conversaciones no abiertas.**
`chat:message` solo se emitía a la room de la conversación, así que el sidebar no se enteraba de mensajes entrantes en conversaciones no abiertas (el escenario "Actualización en vivo" no se cumplía). Los sockets autenticados entran además a una room exclusiva del dashboard (`project:<id>:dashboard`) y, para mensajes del cliente, se emite `chat:message` a esa room con `except(conversationId)`: el sidebar actualiza el contador en vivo sin duplicar la entrega a la conversación abierta y sin exponer conversaciones ajenas a los clientes públicos. Alternativa descartada: emitir a la room compartida `project:<id>` — filtra mensajes de otras conversaciones a los clientes públicos del mismo proyecto.

**5. Sin autoselección.**
`Messaging.vue` elimina el bloque que selecciona `filteredChats[0] || chats[0]`. Se conserva el deep-link `?conversation=<id>` (resolución vía `resolveRequestedChat`, ya acotada al proyecto) y el estado vacío del template ya existente. Alternativa: dejar la selección por defecto y solo arreglar el badge — descartada por decisión de producto.

**6. Reset de datos contaminados.**
Script one-off `scripts/reset-unread-counts.ts` (modelo `cleanup-project.ts`) que ejecuta `updateMany({}, { $set: { unreadCount: 0 } })` sobre todas las conversaciones de todos los proyectos y reporta el conteo; se ejecuta una vez tras desplegar el fix. Alternativa: no resetear y dejar que se corrija al abrir cada conversación — descartada porque los contadores inflados reaparecerían mientras tanto.

## Risks / Trade-offs

- **`emitToProject` sin projectId**: el handler retorna 400 si falta `projectId`, así que el evento siempre tiene slot destino; el `emitToProject` ya tolera `undefined` internamente.
- **Falsa lectura por socket**: si el cliente emite `chat:read` desde un socket que no pertenece al proyecto, el handler HTTP valida pertenencia vía `req.projectId` antes de escribir; el evento se deriva del proyecto validado, no del payload.
- **Reset global irreversible**: deja `unreadCount = 0` en todas las conversaciones; aceptable porque la funcionalidad estaba defectuosa y no hay valor de negocio en los conteos previos.
- **Carrera al re-marcar**: si entre el incremento del backend y el `PUT /read` entra otro mensaje del cliente, el `PUT` deja el contador en 0 igualmente; el mensaje nuevo ya se está mostrando en la conversación abierta, así que es consistente con el comportamiento "estilo WhatsApp".

## Migration Plan

1. Desplegar backend + frontend con el fix.
2. Ejecutar `pnpm --filter @mitchbot/backend tsx src/scripts/reset-unread-counts.ts` una vez.
3. Rollback: revertir el despliegue; los contadores quedan en 0 (no hay pérdida de datos relevante).

## Open Questions

- Ninguna que afecte specs, enfoque o desglose de tareas.
