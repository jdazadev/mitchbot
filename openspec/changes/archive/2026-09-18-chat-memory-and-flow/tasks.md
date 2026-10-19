## 1. Memoria de conversación

- [x] 1.1 Añadir un parámetro `history` (mensajes ya construidos) a `aiService.generateResponseStreamWithTools()` y a `generateResponseStream()`/`generateResponse()`, insertándolo entre el `SystemMessage` y el `HumanMessage` actual; verificar con `pnpm --filter @mitchbot/backend build`.
- [x] 1.2 Construir el historial en `chat.service` desde `getMessages()`: últimos 20 mensajes, `contact`/`human_agent` → `HumanMessage` (el agente humano con prefijo `[Agente humano]`), `ai_agent` → `AIMessage`, excluyendo `sender === 'tool'`, los `contentType` `tool_call`/`tool_result`/`confirmation_request` y placeholders vacíos.
- [x] 1.3 Pasar el historial tanto en `generateBotResponse()` como en `generateFinalToolResponse()`; verificar en una conversación real que el bot responde con contexto y no re-saluda en el tercer mensaje.
- [x] 1.4 Insertar un marcador en el historial cuando el hueco supere las 6 horas, para que el bot re-salude al retomar; verificar el escenario de pausa larga.

## 2. Saludo y despedida naturales

- [x] 2.1 Eliminar de `chat.service` el texto enlatado de bienvenida y la maquinaria asociada (`shouldSendWelcome()`, `hasGreeting()`, `hasQuestionIntent()` y las escrituras a `lastWelcomeAt`); verificar con `pnpm --filter @mitchbot/backend build`.
- [x] 2.2 Reescribir en `prompt-builder.service` la instrucción de saludo a "saluda únicamente al inicio de la conversación o cuando se retome tras una pausa larga", conservando el flag `enableWelcomeGreeting`; verificar que el primer mensaje del bot tiene un solo saludo.
- [x] 2.3 Quitar "gracias" y variantes de las keywords default de `isGoodbyeMessage()`; verificar que un "gracias" intermedio no cierra la conversación.
- [x] 2.4 Cambiar el flujo de despedida: `sendMessage()` calcula la intención y la pasa como `closeAfter` a `generateBotResponse()`, que tras una generación exitosa marca la conversación como `closed` y emite `chat:status` (sin mensaje enlatado ni corte previo); verificar que el bot se despide naturalmente y la conversación queda cerrada.

## 3. Propagación en vivo del estado

- [x] 3.1 Añadir en `services/socket.service.ts` los helpers `onConversationStatus`/`offConversationStatus` para el evento `chat:status`; verificar con `pnpm --filter @mitchbot/frontend build`.
- [x] 3.2 Suscribir `views/Messaging.vue` a `chat:status` para actualizar `selectedConversation.mode/status/tag` y el ítem de la lista; verificar que al transferir a un asesor el modo cambia a `human_takeover` sin recargar.
- [x] 3.3 Suscribir `views/TestChat.vue` a `chat:status` para no mostrar estado obsoleto; verificar la recepción del evento en la vista del cliente.
- [x] 3.4 Hacer que `PUT /api/conversations/:id/mode` emita `chat:status` (consistencia con la tool de transferencia); verificar con una llamada autenticada que el evento se emite.

## 4. Visibilidad de mensajes internos

- [x] 4.1 En `views/TestChat.vue`, no renderizar los mensajes `tool_call`/`tool_result` y conservar `confirmation_request` con sus acciones; verificar que un resultado de herramienta no aparece al cliente y que el dashboard sí lo muestra.
- [x] 4.2 Verificar que ante el fallo de una herramienta el cliente no recibe el detalle técnico del error.

## 5. Pruebas e2e

- [x] 5.1 Añadir/ajustar los specs de memoria (contexto en mensajes sucesivos), "gracias" no cierra, transferencia reflejada en vivo y herramientas ocultas al cliente; ajustar el stub de IA si el historial lo requiere.
- [x] 5.2 Ejecutar `pnpm test:e2e` y confirmar que la suite pasa.

## 6. Documentación y versión

- [x] 6.1 Actualizar `AGENTS.md` (secciones 1 y 9: memoria de conversación, saludo/despedida naturales, propagación de `chat:status`, visibilidad de mensajes de tools) y la tabla de eventos WebSocket.
- [x] 6.2 Registrar el cambio en `changelog.md` con la fecha actual y subir la versión a `v0.3.5`.

## 7. Verificación final

- [x] 7.1 Ejecutar `pnpm --filter @mitchbot/backend build`, `pnpm --filter @mitchbot/backend test` y `pnpm --filter @mitchbot/frontend build` y confirmar que pasan sin errores.
- [x] 7.2 Ejecutar `openspec validate chat-memory-and-flow --strict` y confirmar que el change es válido.
- [x] 7.3 Realizar el commit del cambio implementado.
