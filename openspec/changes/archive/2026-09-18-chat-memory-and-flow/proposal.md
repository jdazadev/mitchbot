## Why

En las pruebas del chatbot el bot no recuerda la conversación: el LLM solo recibe el mensaje actual, por lo que vuelve a saludar en cada mensaje y responde sin contexto. La bienvenida además se genera con dos mecanismos redundantes (un texto enlatado antepuesto más una instrucción al LLM), produciendo saludos duplicados; y palabras como "gracias" cierran la conversación a mitad del diálogo. Aparte, cuando el bot transfiere a un asesor el modo cambia en base de datos pero la interfaz no lo refleja (nadie consume el evento `chat:status`), y las tarjetas internas de herramientas se muestran al cliente final.

## What Changes

- **Memoria de conversación**: la generación de respuestas (con y sin herramientas) recibe los últimos mensajes de la conversación; el LLM deja de tratar cada mensaje como una conversación nueva. Los mensajes internos de herramientas se excluyen del historial.
- **Saludo y despedida naturales**: se elimina el texto enlatado de bienvenida y su maquinaria asociada (`shouldSendWelcome`, `hasGreeting`, `hasQuestionIntent`, `lastWelcomeAt`). El system prompt indica saludar solo al inicio de la conversación o tras una pausa larga; una pausa superior a 6 horas se marca en el historial para que el LLM re-salude.
- **Despedida no destructiva**: se quita "gracias" (y variantes) de las palabras clave de despedida; al detectar una despedida el LLM responde con naturalidad y, después, la conversación se cierra — sin enviar un mensaje enlatado ni cortar la generación.
- **Estado de conversación en vivo**: el dashboard de mensajería y la vista pública del cliente consumen `chat:status` y reflejan el cambio de modo/estado (p. ej. `auto_pilot` → `human_takeover`) sin recargar.
- **Visibilidad por audiencia**: los mensajes de `tool_call` y `tool_result` no se muestran al cliente final; solo las solicitudes de confirmación (`confirmation_request`) con sus acciones permanecen visibles.

## Capabilities

### New Capabilities

- `messaging`: comportamiento y visibilidad de la conversación — memoria del chatbot, saludo/despedida naturales, propagación en vivo del modo/estado de la conversación y qué mensajes internos se ocultan al cliente.

### Modified Capabilities

- (ninguna)

## Impact

- **Backend**: `services/chat.service.ts` (historial, saludo/despedida, cierre), `services/ai.service.ts` (parámetro de historial), `services/prompt-builder.service.ts` (instrucciones de saludo/despedida).
- **Frontend**: `views/Messaging.vue` (listener `chat:status`, badge de modo), `views/TestChat.vue` (ocultar mensajes internos de tools), `services/socket.service.ts` (helpers de `chat:status`).
- **Pruebas e2e**: escenarios de memoria, despedida con "gracias" y transferencia a humano; stub de IA si requiere historial.
- **Documentación**: `AGENTS.md` (secciones 1 y 9) y `changelog.md` (bump de versión).
