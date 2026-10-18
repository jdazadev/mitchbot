---
target: Conversaciones (Messaging.vue)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/jdaza/projects/mitchbot_v2/apps/frontend/src/views/Messaging.vue"
target_fingerprint: "sha256:f466834a48da73bd30461b0da127fc975e16ac871b16a650939ec3a07ebab973"
target_path: /Users/jdaza/projects/mitchbot_v2/apps/frontend/src/views/Messaging.vue
timestamp: 2026-09-30T07-40-26Z
slug: src-views-messaging-vue
---
⚠️ DEGRADED: single-context (no sub-agent/Task tool exposed in this session)

## Critique: Conversaciones
**Objetivo:** `apps/frontend/src/views/Messaging.vue` · **Modo:** Operate · **Método:** evaluación manual seguida del detector; el resultado del detector no influyó en la evaluación manual.

### Salud de diseño
| # | Heurística | Puntuación | Problema clave |
|---|---|---:|---|
| 1 | Visibilidad del estado del sistema | 2/4 | Los fallos al cargar la bandeja y los mensajes no se anuncian en la interfaz. |
| 2 | Correspondencia con el mundo real | 3/4 | El flujo y los términos son claros; el gráfico de sentimiento deja categorías en inglés. |
| 3 | Control y libertad | 3/4 | Hay cancelación y regreso; las decisiones de herramientas no muestran estado inmediato. |
| 4 | Consistencia y estándares | 3/4 | Patrones y semántica visual coherentes; el feedback de errores varía según la acción. |
| 5 | Prevención de errores | 3/4 | Se confirma el cambio de modo y se valida JSON; falta feedback explícito en decisiones de herramientas. |
| 6 | Reconocimiento en lugar de recuerdo | 3/4 | Acciones y filtros se ven; el modo enfoque depende de iconos y ayudas emergentes. |
| 7 | Flexibilidad y eficiencia | 3/4 | Búsqueda, filtros y modo enfoque ayudan; no hay atajos ni acciones por lotes. |
| 8 | Diseño estético y minimalista | 3/4 | La jerarquía por bandeja, hilo y ficha es adecuada; falta inspección visual en navegador. |
| 9 | Reconocimiento y recuperación de errores | 2/4 | El envío conserva el borrador, pero los fallos de carga quedan sin recuperación. |
| 10 | Ayuda y documentación | 1/4 | Hay ayudas puntuales, no orientación contextual para los flujos menos obvios. |
| **Total** | | **26/40** | **Aceptable: la estructura funciona, pero hay brechas de feedback y recuperación.** |

### Veredicto de especificidad
La superficie se siente hecha para operar conversaciones: bandeja, hilo y ficha lateral reflejan el trabajo real, y los colores distinguen bot, persona y espera. El detector no encontró infracciones (`[]`). La limitación es que no pude inspeccionar la vista en navegador; el juicio visual se basa en el código y en `DESIGN.md`, no en una captura renderizada.

### Impresión general
La arquitectura de la pantalla está bien enfocada y ofrece controles útiles sin llenar el hilo de acciones decorativas. La mayor oportunidad es que la interfaz comunique con la misma claridad tanto el fallo de carga como el resultado de las acciones operativas.

### Lo que funciona
- La separación entre bandeja, conversación y detalles permite escanear y atender sin perder contexto.
- El cambio entre piloto automático y toma de control confirma una acción de alto impacto y deja un acuse visible.
- Búsqueda, filtros, modo enfoque y retorno móvil resuelven necesidades distintas sin cambiar el modelo principal.

### Problemas prioritarios
1. **[P1] Fallos de carga indistinguibles de estados vacíos.** `fetchChats()` y `fetchMessages()` atrapan el error y solo escriben en consola (`Messaging.vue:102-117`, `210-220`). Si falla la API, el operador puede ver una bandeja vacía o un hilo sin mensajes como si fueran resultados reales, sin aviso ni reintento. **Corrección:** separar error de estado vacío, mostrar un aviso en la superficie afectada y ofrecer Reintentar. **Comando sugerido:** `$impeccable harden`.
2. **[P1] Decisiones de herramientas sin acuse inmediato.** Confirmar o cancelar emite por socket sin estado pendiente local; los errores del socket también van solo a consola (`Messaging.vue:623-629`, `702-705`). Para aprobaciones sensibles, el operador no sabe si la decisión se recibió hasta que llegue una actualización, y no tiene recuperación visible si no llega. **Corrección:** deshabilitar la acción mientras se procesa, mostrar estado de espera y resultado/error con una vía de reintento. **Comando sugerido:** `$impeccable harden`.
3. **[P2] Categorías del gráfico sin localizar.** En español, las etiquetas del reparto de sentimiento se renderizan literalmente como `negative`, `neutral` y `positive` (`Messaging.vue:1336-1339`), aunque el resto de la pantalla cambia de idioma. **Corrección:** usar las claves traducidas de sentimiento ya disponibles para estas etiquetas. **Comando sugerido:** `$impeccable clarify`.

### Alertas por persona
- **Alex, usuario experto:** puede filtrar y estrechar la bandeja, pero no hay atajos de teclado ni acciones por lotes para manejar colas grandes.
- **Sam, usuario dependiente de accesibilidad:** los errores de carga no llegan a una región de estado; además, las decisiones de herramientas no anuncian inmediatamente que quedaron pendientes o se completaron.
- **Jordan, usuario primerizo:** un fallo de carga puede parecer una bandeja genuinamente vacía y no indica qué hacer después.

### Observaciones menores
- El campo de texto del compositor se identifica solo mediante placeholder (`Messaging.vue:1158-1164`); conviene añadir una etiqueta accesible persistente.
- El editor JSON de parámetros de herramienta tiene un `textarea` sin etiqueta explícita (`Messaging.vue:1415-1419`).
- El modo enfoque usa botones solo con icono en el carril; el tooltip/label accesible ayuda, pero la función sigue siendo menos descubrible para quien no pase el puntero.
