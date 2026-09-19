## Context

Ver `proposal.md` — Why. Tres piezas ya existentes condicionan el diseño:

- **Respuesta del bot**: los eventos `chat:message_chunk` del backend llevan el **texto acumulado completo**, no deltas; el frontend solo asigna `content`. El callback `onChunk` es opcional. El indicador de escritura se sostiene con un mensaje placeholder vacío, no con los chunks. Por tanto, dejar de emitir fragmentos parciales no requiere cambiar el frontend.
- **Insights**: `insights.service.ts` valida hoy que el resumen exista y lanza error si falta; el resumen atraviesa tipo, prompt, persistencia, modelo de datos, panel e i18n. El stub e2e usa una marca interna (`INSIGHTS_JSON`) para reconocer la petición y devuelve un resumen determinista.
- **Clientes → conversación**: `Clients.vue` no conoce ninguna conversación; el listado de conversaciones del backend no filtra por `contactId` y aplica un límite fijo de 50; la ruta `/messaging` no admite selección previa. Un contacto puede tener varias conversaciones (una por ciclo tras cada cierre).

## Goals / Non-Goals

**Goals:**

- Entregar la respuesta del bot como mensaje completo sin tocar el contrato de tiempo real.
- Eliminar el resumen de insights en todas las capas, sin romper el análisis.
- Abrir la conversación de un cliente desde su fila, resolviéndola en el servidor.

**Non-Goals:**

- No se ataca la latencia de generación (RAG/prompt/modelo): el cambio es de presentación, no de rendimiento.
- No se elimina el canal de tiempo real `chat:message_chunk`; el mensaje final lo sigue usando.
- No se crean conversaciones desde el directorio: la conversación la inicia el cliente (regla de negocio).

## Decisions

### D1. Respuesta directa: silenciar los fragmentos, conservar el mensaje final

Se elimina la emisión de chunks parciales en `chat.service.ts` (respuesta directa y respuesta final tras herramientas) y se conserva el mensaje final con `isDone: true`, que ya contiene el texto completo. El placeholder vacío sigue dando el indicador de escritura.

- Alternativa descartada (Opción B): migrar a `invoke()` no-streaming en `ai.service.ts`. Añade una variante nueva con tool calling y no mejora el tiempo total percibido; más superficie de cambio para el mismo resultado observable.
- Los manejadores del frontend (`Messaging.vue`, `TestChat.vue`, `useConversations`) pueden ignorar explícitamente `isDone: false` para documentar la intención, aunque funcionan igual sin ese cambio.

### D2. Insights sin resumen: quitar las cinco capas a la vez

Se retira el resumen del prompt, del tipo de resultado, de la validación, de la persistencia (`$set`) y del modelo de datos, además de la tarjeta del panel y las claves i18n. **La validación es crítica**: si se retira del prompt pero no de la validación, todos los análisis fallan. La marca interna del prompt (`INSIGHTS_JSON`) se conserva porque el stub e2e la necesita.

- Alternativa descartada: dejar de mostrar el resumen solo en el frontend. Deja el costo de tokens y el dato muerto en base de datos.
- Datos huérfanos: las conversaciones existentes conservan `aiInsights.summary` en Mongo. El frontend ya no lo mostrará; se puede limpiar con `$unset` al re-analizar o dejar como dato inerte (a decidir en tareas, sin impacto observable).

### D3. Botón "Ver conversación": query param + resolución server-side

- **Navegación**: `/messaging?conversation=<id>`, por consistencia con `Settings ?tab` y `ProjectSetup ?mode`, y porque no toca el router ni el guard.
- **Resolución**: el frontend no puede mapear contacto→conversación hoy. Se extiende el listado de conversaciones con un filtro opcional por `contactId` (acotado al proyecto), en lugar de crear un endpoint nuevo, reutilizando la agregación existente.
- **Multi-conversación**: se prefiere la `active`; si no, la más reciente por `lastMessageAt` (el orden ya existente).
- **Límite de 50**: como el listado está limitado, el filtro por `contactId` se resuelve en el servidor; así el resultado no depende de que la conversación esté entre las 50 más recientes.
- **Cliente sin conversación**: la acción no se ofrece.

## Risks / Trade-offs

- [El test e2e de tiempo real espera más de un chunk] → Actualizar la aserción a un único mensaje final con `isDone: true` y renombrar el caso.
- [El test e2e de insights depende del resumen] → Reescribir las aserciones sobre el sentimiento (API y etiqueta visible) y ajustar el stub.
- [Contacto con conversación sin `contactId` (nunca se guardó como contacto)] → La acción no aparece; es consistente con la regla de que el vínculo canónico es el contacto.
- [Contactos archivados] → El botón se mantiene disponible: el historial de mensajería sigue siendo consultable.
- [Percepción de lentitud al quitar el streaming] → Trade-off aceptado: se prioriza la respuesta directa; el tiempo total no aumenta, solo deja de verse el avance.

## Migration Plan

1. Backend y frontend se despliegan juntos (el frontend ya tolera el mensaje final).
2. Sin migración de datos obligatoria. Opcional: limpiar `aiInsights.summary` existente.
3. Rollback: revertir el commit restaura streaming, resumen y ausencia del botón.

## Open Questions

Ninguna.
