## 1. Contrato de canales

- [x] 1.1 Crear `src/channels/types.ts` con `InboundMessage`, `OutboundMessage`, `ChannelAdapter` (`platform`, `external`, `parseWebhook?`, `send`) y `ChannelError { kind: transient | permanent, retryAfterMs? }`; verificar typecheck
- [x] 1.2 Crear el registro `src/channels/registry.ts` (`registerAdapter`, `getAdapter`, `isExternal`) y el adaptador Web (`send` no-op, `external: false`); unitarios del registro
- [x] 1.3 Función pura `normalizeInbound` que valida y recorta el payload (identificador, contenido no vacío, plataforma conocida); unitarios de casos válidos e inválidos

## 2. Entrada por el gateway

- [x] 2.1 Añadir `external { platform, messageId }` y `delivery { status, attempts, externalId?, error?, updatedAt }` a `Message`, y crear al arrancar el índice único parcial sobre `external.platform + external.messageId`
- [x] 2.2 Implementar `receive(inbound)` (`channels/inbound.ts`): reutiliza `createConversationFromClient`/`sendMessage`, inserta con `external` y trata el error 11000 como duplicado sin efectos; integración: dos `receive` con el mismo id externo dejan un mensaje y una respuesta del bot
- [x] 2.3 Cambiar `public-chat.controller.ts` para construir el `InboundMessage` y llamar a `receive`; verificar que los E2E de chat público siguen en verde sin cambios
- [x] 2.4 Cola `channel-inbound` y su worker (concurrencia 1) que llama a `receive`; integración: un trabajo encolado crea el mensaje

## 3. Salida por canal

- [x] 3.1 Implementar `dispatch(message, conversation)` (`channels/outbound.ts`): solo `ai_agent`/`human_agent`, solo canales externos, excluye `tool_call`/`tool_result`; fija `delivery.status = queued` y encola en `channel-outbound-<canal>`; unitarios de la regla de qué se entrega
- [x] 3.2 Llamar a `dispatch` desde `sendMessage` y desde los mensajes finales del bot en `generateBotResponse`/`generateFinalToolResponse`; verificar que Web no encola (E2E de regresión)
- [x] 3.3 Worker de salida por canal con limitador configurable (`CHANNEL_<CANAL>_RATE_MAX`, `CHANNEL_<CANAL>_RATE_MS` en `env.ts`, con valores por defecto) que llama a `adapter.send`, guarda `sent` + `externalId` y emite `chat:message_updated`; integración con un adaptador falso

## 4. Resiliencia

- [x] 4.1 Función pura `nextDelay(attempt, error)` (exponencial, base 2 s, tope 60 s, respeta `retryAfterMs`) y conversión de errores permanentes en `UnrecoverableError`; unitarios
- [x] 4.2 Integración: un adaptador falso que falla una vez de forma transitoria termina en `sent` con `attempts = 2`; uno que falla de forma permanente termina en `failed` con un solo intento
- [x] 4.3 Máquina de estados pura del circuit breaker (`closed`/`open`/`half_open`, umbral y espera configurables con `CHANNEL_BREAKER_THRESHOLD` y `CHANNEL_BREAKER_COOLDOWN_MS`); unitarios de todas las transiciones, incluido que los errores permanentes no cuentan
- [x] 4.4 Persistir el estado del breaker en Redis, pausar/reanudar la cola del canal y emitir `admin:notification` a los proyectos con mensajes pendientes; integración con un adaptador que falla siempre
- [x] 4.5 Fallo definitivo: `delivery.status = failed` con motivo, conversación a `pending_human`, `chat:message_updated`, `chat:status` y `admin:notification`; integración

## 5. Reintento manual

- [x] 5.1 `POST /api/conversations/:id/messages/:messageId/retry` (autenticado, acotado al proyecto): reencola si está en `failed`, 409 en otro estado, 404 si no pertenece a la conversación; integración de los tres casos

## 6. Interfaz

- [x] 6.1 Tipos de `delivery` en `messaging.service.ts` y método `retryMessage`; `vue-tsc --noEmit`
- [x] 6.2 Componente `DeliveryStatus.vue` (enviando / enviado / no entregado + Reintentar, `role="status"` en el fallo) usado en las burbujas salientes de `Messaging.vue`; actualizar el mensaje con `chat:message_updated`
- [x] 6.3 Claves `messaging.delivery.{queued,sent,failed,retry,retrying,retryError}` en es/en; verificar paridad
- [x] 6.4 Unitarios del componente con Vue Test Utils (cada estado, emite `retry`, oculto sin `delivery`)

## 7. Verificación y cierre

- [x] 7.1 `pnpm test:unit`, `pnpm test:integration` y `pnpm test:e2e` completos en verde; backend `tsc --noEmit` y frontend `build`
- [x] 7.2 Actualizar `changelog.md`, `AGENTS.md` (sección nueva, eventos, endpoints, variables de entorno) y la versión (v0.5.0: funcionalidad nueva); `.env.example` con las variables nuevas
- [x] 7.3 Commit del cambio

> El E2E del estado de entrega en el hilo llega con `add-whatsapp-channel`, cuando exista un canal externo con stub HTTP. Aquí se cubre con unitarios del componente e integración del backend.
