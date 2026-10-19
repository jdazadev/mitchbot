## 1. Backend — contador solo del cliente

- [x] 1.1 En `services/chat.service.ts` condicionar el `$inc: { unreadCount: 1 }` de `sendMessage` a `sender === 'contact'`; verificar con un mensaje `human_agent` que el contador de la conversación no cambia
- [x] 1.2 Eliminar los `$inc: { unreadCount: 1 }` de las respuestas del bot (respuesta directa ~línea 482 y respuesta tras herramientas ~línea 707), dejando solo el `$set` de último mensaje; verificar que una respuesta del bot no incrementa el contador
- [x] 1.3 Confirmar que la creación de conversación (`ready`/primer mensaje del cliente, ~línea 144) mantiene `unreadCount: 1`; verificar que una conversación nueva creada por el cliente nace con 1 no leído

## 2. Backend — endpoint de lectura y evento

- [x] 2.1 Agregar `markConversationRead` en `controllers/messaging.controller.ts`: valida `projectId`, `updateOne({ _id, projectId }, { $set: { unreadCount: 0, updatedAt } })`, 404 si `matchedCount === 0`, y en try/catch `emitToProject(projectId, 'chat:read', { conversationId })`; verificar que devuelve 200 y que un id ajeno responde 404
- [x] 2.2 Registrar `router.put('/:id/read', authenticate, markConversationRead)` en `routes/messaging.routes.ts`; verificar con `curl` autenticado que la ruta responde 200
- [x] 2.3 Verificar que emitir `chat:read` a la room del proyecto no rompe la respuesta HTTP cuando el socket no está inicializado (try/catch)

## 3. Backend — reset de datos contaminados

- [x] 3.1 Crear `scripts/reset-unread-counts.ts` (patrón `cleanup-project.ts`) que ejecute `updateMany({}, { $set: { unreadCount: 0 } })` sobre `conversations`, registre el `modifiedCount` y cierre la conexión
- [x] 3.2 Ejecutar `pnpm --filter @mitchbot/backend tsx src/scripts/reset-unread-counts.ts` y verificar en MongoDB que todas las conversaciones quedan con `unreadCount: 0`

## 4. Frontend — servicios y socket

- [x] 4.1 Agregar `messagingService.markConversationRead(conversationId)` que haga `PUT /conversations/:id/read` con `authService.getHeaders()`; verificar que no lanza en 2xx
- [x] 4.2 Agregar `onConversationRead`/`offConversationRead` en `services/socket.service.ts` para el evento `chat:read`; verificar el tipado del payload `{ conversationId: string }`

## 5. Frontend — composable de conversaciones

- [x] 5.1 Añadir el estado de módulo `openConversationId` con setter `setOpenConversation` y exponerlo en el return de `useConversations`
- [x] 5.2 Hacer que `markConversationRead` persista vía `messagingService.markConversationRead` (fire-and-forget con catch) además de poner el contador local a cero; verificar que no rompe si la llamada falla
- [x] 5.3 En `handleSocketMessage`, si `sender === 'contact'` y `convId === openConversationId`, no incrementar local y llamar a `markConversationRead`; si no está abierta, incrementar local como hoy
- [x] 5.4 En `bindConversationSocket`, escuchar `chat:read` y poner el `unreadCount` de esa conversación a cero en la lista local; verificar que es idempotente

## 6. Frontend — Messaging.vue

- [x] 6.1 Eliminar el bloque `const first = filteredChats.value[0] || chats.value[0]; if (first) selectChat(first);` de `fetchChats`, conservando la resolución de `?conversation=`; verificar el estado vacío al entrar sin query
- [x] 6.2 En `selectChat`, llamar a `setOpenConversation(chat._id)` y mantener `markConversationRead(chat._id)` (ahora persistente); verificar que al abrir la conversación el badge baja y no vuelve tras recargar

## 7. Tests e2e

- [x] 7.1 Agregar a `tests/e2e/specs/messaging.spec.ts` un caso que verifique: mensaje del cliente sube el badge, abrir la conversación lo baja y recargar la página lo mantiene en 0
- [x] 7.2 Agregar un caso que verifique que un mensaje del bot no incrementa el badge
- [x] 7.3 Agregar un caso que verifique que al entrar a `/messaging` sin `?conversation=` no hay conversación seleccionada (estado vacío visible)
- [x] 7.4 Agregar un caso que verifique que el deep-link `?conversation=<id>` selecciona la conversación correcta
- [x] 7.5 Ejecutar `pnpm test:e2e messaging` y confirmar que los specs nuevos y existentes pasan

## 8. Documentación y cierre

- [x] 8.1 Actualizar `AGENTS.md` (sección de Mensajería: regla de no leídos, endpoint `PUT /:id/read`, evento `chat:read`, sin selección por defecto) y bump de versión a v0.4.1; verificar coherencia de la tabla de endpoints y eventos WebSocket
- [x] 8.2 Actualizar `changelog.md` (formato Keep a Changelog, fecha actual) con el fix
- [x] 8.3 Ejecutar lint/typecheck del monorepo y confirmar que no hay errores
- [x] 8.4 Hacer el commit correspondiente del cambio
