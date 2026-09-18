## Context

Ver `proposal.md` para la motivación. Estado relevante para el diseño:

- `ai.service.generateResponseStreamWithTools()` construye siempre `[SystemMessage, HumanMessage(mensaje actual)]`; nunca recibe historial. `generateFinalToolResponse()` usa la misma forma.
- `chat.service.generateBotResponse()` orquesta el flujo: placeholder + streaming + RAG + (opcional) tools. El historial completo ya vive en MongoDB y se lee con `chatService.getMessages()`.
- La bienvenida se genera con dos mecanismos: la instrucción del system prompt (`prompt-builder` línea 107, "Saluda al iniciar la conversación o si se retoma luego de 6 horas") y un texto enlatado antepuesto en `chat.service` (líneas 446-474) condicionado por `shouldSendWelcome`/`lastWelcomeAt`.
- `isGoodbyeMessage()` (default keywords) incluye "gracias" y variantes, y `handleAutoGoodbye()` envía un texto enlatado, cierra la conversación y corta el flujo (`return`) sin que el LLM responda.
- `transfer_to_human` ya cambia el modo/estado en BD y emite `chat:status`; el frontend no tiene ningún listener de ese evento.
- `TestChat.vue` (vista pública del cliente) renderiza tarjetas de `tool_call`/`tool_result`/`confirmation_request` con la misma lógica duplicada que `Messaging.vue`.

## Goals / Non-Goals

**Goals:**

- Dar memoria al chatbot sin romper la capa de abstracción (`aiService` no conoce MongoDB).
- Que saludo y despedida sean naturales y no destructivos.
- Que el cambio de modo/estado (transferencia a humano) se refleje en vivo en el dashboard y en la vista del cliente.
- Que el cliente final no vea mensajes internos de herramientas.

**Non-Goals:**

- Extraer un componente compartido de burbuja/tarjeta de tools entre `Messaging.vue` y `TestChat.vue` (deuda técnica consciente).
- El botón manual "Take Over" y el resto de la limpieza del módulo de mensajería (change separado); aquí solo se garantiza la propagación del evento.
- Eliminar el campo `lastWelcomeAt` ni otros campos del modelo `conversation` (sin cambios de esquema).
- Resumir conversaciones largas con un LLM (se acota por ventana).

## Decisions

### D1. El historial es un parámetro de la capa de IA

`aiService.generateResponseStreamWithTools()` (y por extensión `generateResponseStream`/`generateResponse`) recibe un `history` de mensajes ya construidos; `chat.service` lo arma desde `getMessages()`. `aiService` permanece sin acceso a base de datos.

- **Rationale**: preserva la abstracción (el chatbot no sabe de dónde viene el contexto) y centraliza el filtrado/mapeo en quien conoce el dominio de mensajes.
- **Alternativas**: que `aiService` lea la conversación de MongoDB (rompe la abstracción); memoria en proceso (no escala ni sobrevive reinicios).

### D2. Ventana de 20 mensajes con mapeo por rol y exclusión de mensajes internos

Se toman los últimos 20 mensajes: `contact` → `HumanMessage`, `ai_agent` → `AIMessage`, `human_agent` → `HumanMessage` con prefijo `[Agente humano]`. Se excluyen los mensajes con `sender === 'tool'` y los `contentType` `tool_call`/`tool_result`/`confirmation_request`, así como placeholders vacíos.

- **Rationale**: acota tokens/costo y latencia; evita exponer al modelo el andamiaje interno; los resultados de herramientas ya quedan reflejados en la respuesta final del bot.
- **Alternativas**: historial completo (crece sin límite); resumen incremental con LLM (costo y complejidad no justificados aún).

### D3. La pausa larga se comunica con un marcador en el historial

Al construir el historial, si el hueco entre el último mensaje y el actual supera las 6 horas, se inserta un marcador (`--- El cliente retoma la conversación tras una pausa ---`) junto al turno actual.

- **Rationale**: el modelo no percibe el tiempo; un marcador es barato en tokens frente a timestamps por mensaje.
- **Alternativas**: timestamps por mensaje (más tokens); conservar `shouldSendWelcome` como señal separada (maquinaria redundante que se elimina).

### D4. Se elimina el texto enlatado y su maquinaria; el prompt gobierna el saludo

Se eliminan `shouldSendWelcome()`, `hasGreeting()`, `hasQuestionIntent()` y las escrituras a `lastWelcomeAt`. La instrucción del prompt se reescribe a "Saluda únicamente al inicio de la conversación o cuando se retome tras una pausa larga; el resto del tiempo continúa la conversación". El flag `enableWelcomeGreeting` sigue gobernando esa instrucción.

- **Rationale**: una sola fuente de verdad para el saludo (el LLM con historial), coherente con la decisión de que el bot sea natural.
- **Alternativas**: conservar el antepuesto condicionado (sigue siendo redundante); eliminarlo sin tocar el prompt (el LLM seguiría saludando en cada mensaje al no tener historial).

### D5. Despedida natural que cierra al final, no al principio

Se quitan "gracias" y variantes de las keywords default de `isGoodbyeMessage()`. `sendMessage()` deja de invocar el envío enlatado: calcula la intención de despedida y se la pasa a `generateBotResponse()` como `closeAfter`; tras una generación exitosa, se marca la conversación como `closed` (y se emite `chat:status`). Si la generación falla, no se cierra.

- **Rationale**: el bot se despide naturalmente (tiene historial) y el cierre refleja el final real del diálogo.
- **Alternativas**: mantener el cierre inmediato (impide la respuesta natural); cerrar por palabras clave sin pasar por el LLM (cierra en falsos positivos).

### D6. Consumo de `chat:status` en el frontend y emisión consistente en el endpoint de modo

`socket.service.ts` expone helpers `onConversationStatus`/`offConversationStatus`. `Messaging.vue` actualiza `selectedConversation.mode/status/tag` y el ítem de la lista al recibir el evento; `TestChat.vue` lo recibe para no mostrar estado obsoleto. Además, `PUT /api/conversations/:id/mode` emite `chat:status` (hoy solo lo hace la tool), para que cualquier cambio de modo se propague.

- **Rationale**: cierra el punto donde el modo cambia en BD pero la UI queda desactualizada; deja la base lista para el botón "Take Over" del change siguiente.
- **Alternativas**: recargar la lista tras cada evento (peor UX y más tráfico).

### D7. Visibilidad según audiencia en la capa de presentación del cliente

En `TestChat.vue`, los mensajes `tool_call`/`tool_result` no se renderizan; las `confirmation_request` conservan sus acciones. El dashboard (`Messaging.vue`) mantiene el render completo. No se crea todavía un componente compartido.

- **Rationale**: cambio mínimo y localizado; evita exponer detalles internos y errores técnicos al cliente.
- **Alternativas**: filtrar en el backend por room/audiencia (más invasivo, afecta confirmaciones); extraer componente compartido (se difiere).

## Risks / Trade-offs

- **El historial aumenta tokens, latencia y costo** → ventana de 20, exclusión de mensajes internos y truncado de contexto RAG ya existente.
- **El LLM podría no saludar/despedirse según lo esperado** → es el comportamiento buscado (natural); ajustar la instrucción del prompt es suficiente y no requiere cambiar specs.
- **Cierre por falso positivo de despedida** → se acotan las keywords a despedidas reales (fuera "gracias").
- **Los e2e pueden asumir dos mecanismos de bienvenida o tarjetas visibles al cliente** → actualizar los specs afectados en el mismo change.
- **Eventos en rooms por proyecto** → `chat:status` ya se emite al room de la conversación; verificar que el listener del cliente (handshake por slug) esté en el room correcto.

## Migration Plan

1. Desplegar backend y frontend juntos: el backend cambia el comportamiento conversacional y el frontend necesita consumir `chat:status`.
2. No hay migración de datos: cada conversación obtiene historial en el siguiente mensaje.
3. Rollback: revertir el despliegue; no hay estado persistido que deshacer (salvo el modo/estado de conversaciones ya transferidas, que es dato legítimo).

## Open Questions

- Forma exacta del marcador de pausa (mensaje de sistema adicional vs. nota en el turno actual): se decide en implementación y no altera los specs ni el desglose de tareas.
