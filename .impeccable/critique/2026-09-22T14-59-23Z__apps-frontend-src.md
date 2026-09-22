---
target: todo el diseno (apps/frontend/src)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/jdaza/projects/mitchbot_v2/apps/frontend/src"
timestamp: 2026-09-22T14-59-23Z
slug: apps-frontend-src
---
# Critique — Todo el diseño (apps/frontend/src)

**Target:** `apps/frontend/src` (11 vistas + 20 componentes + shell) · **Modo:** Operate · **Fecha:** 2026-09-22

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons reales en Panel, pero "Cargando…" en texto plano en Clients/Brain/Users; el envío en Messaging no muestra estado pendiente/optimista |
| 2 | Match System / Real World | 3 | Etapas técnicas expuestas en Brain ("extracting/chunking/embedding/indexing"); el resto habla el idioma del operador |
| 3 | User Control and Freedom | 3 | Modales con Escape/backdrop, archivar con restaurar; faltan guardas de "cambios sin guardar" en Configuración → Agente |
| 4 | Consistency and Standards | 2 | 11 de 20 componentes UI declarados sin usar; 3 views reinventan el buscador; dos idiomas de modal; padding y tamaños de stat divergentes |
| 5 | Error Prevention | 3 | Confirmaciones de borrado/archivo y validaciones presentes; sin validación de formato/unicidad de slug ni guarda al salir |
| 6 | Recognition Rather Than Recall | 3 | Rail y pills etiquetados; acciones icono-solo dependen de `title` (hover) y Brain no permite editar tags aunque los guarda |
| 7 | Flexibility and Efficiency | 2 | Cero atajos/paleta de comandos; sin acciones en lote ni paginación en la bandeja; sin filtros guardados |
| 8 | Aesthetic and Minimalist Design | 3 | Aurora limpio y compuesto; Dashboard y Brain usan tamaños de cifra distintos (38 vs 32px) y hay datos decorativos no honestos |
| 9 | Error Recovery | 2 | Panel con banner + Reintentar (excelente), pero Messaging pierde el mensaje en silencio (solo `console.error`) |
| 10 | Help and Documentation | 2 | Sin ayuda contextual ni centro de ayuda; hay hints `*-Hint` útiles y logs en Brain |
| **Total** | | **26/40** | **Acceptable** (65%) |

## Design Specificity Verdict

**Veredicto: específico en el shell, genérico en el interior.**

**Evaluación LLM.** El shell Aurora sí está autorado: lienzo de papel cálido, topbar de cápsulas flotantes, rail flotante, y una familia pastel que significa algo (lila=persona/marca, lima=bot, cielo=Web, mantequilla=espera). Un producto ajeno no podría usar el shell sin que se note. Pero al entrar en las vistas el carácter se diluye: Configuración, Usuarios, Clientes y el Panel vuelven a patrones de admin genéricos (título 15.5px + tabla + modal), y buena parte de la paleta semántica no se usa donde debería (las tarjetas de rol del agente pintan todo de lila, sin semántica). La causa raíz es que el sistema se extrajo pero no se adoptó: 11 de 20 componentes (`ASearch`, `AStat`, `ACard`, `ATable`, `AField`, `ADropdown`, `ACallout`, `AChip`, `AKpi`, `ABand`, `ATab`) no tienen ni un uso, mientras las vistas los reinventan a mano.

**Escaneo determinista.** `impeccable detect` sobre `apps/frontend/src` (con y sin config): 0 hallazgos (exit 0) — consistente con las corridas previas documentadas en AGENTS.md. Señal real (no hay anti-patrones que el detector conozca), pero no cubre contraste fino, jerarquía de encabezados, i18n ni divergencia de tokens: esos son los falsos negativos que esta crítica sí levanta.

**Visual overlays.** No hay automatización de navegador expuesta; no se intentó inyección ni hay overlay visible. Señal de fallback: revisión estática de fuente + detector CLI.

## Overall Impression

El mundo visual es lo mejor del proyecto: coherente, cálido y con identidad. Lo que falla no es el gusto, es la coherencia operativa: el sistema de componentes vive a medias, el formateo de fechas ignora el idioma elegido, y la superficie más importante (Conversaciones) es la que peor maneja el error. La mayor oportunidad: terminar de adoptar el sistema que ya existe y subir la recuperación de errores de Messaging al nivel del Panel.

## What's Working

1. El shell como tesis, no como decoración. La fila de cápsulas del topbar (sin barra, sin blur) + el rail flotante + `--shell-pad` unificado; el margen de 14px se aplica con un solo token (DashboardLayout.vue, AuroraTopbar.vue).
2. Color con semántica y reglas escritas. Los pasteles significan algo y la tinta negra es el primario de acción, no la marca (style.css, DESIGN.md). El acento `--brand*` se recalcula en vivo con clamping real (useBrand.ts).
3. Base de accesibilidad donde se implementó. Skip-link, foco visible con contraste garantizado, focus-trap + Escape en AModal.vue, `role="log"`/`aria-live` en los dos chats, `prefers-reduced-motion` global y paridad i18n perfecta (588/588 claves).

## Priority Issues

### [P1] Conversaciones falla en silencio — el mensaje se pierde
- What: `handleSendMessage` limpia el input antes de la petición y, si falla, solo hace `console.error` (Messaging.vue). `toggleMode` y `saveAsContact` tienen el mismo patrón. No hay banner, reintento ni estado pendiente.
- Why it matters: es la superficie central. El operador cree que respondió al cliente cuando el envío falló; el texto se pierde. El Panel sí muestra error + "Reintentar".
- Fix: conservar el borrador hasta confirmar; estado optimista con reintento; banner inline para modo/contacto; deshabilitar el envío mientras hay uno en vuelo.
- Suggested command: /impeccable harden

### [P1] El sistema de diseño está a medio adoptar
- What: 11/20 componentes sin uso. Tres buscadores hechos a mano sin botón de limpiar (Messaging, Clients, Users) cuando ASearch ya lo resuelve; dos idiomas de modal (Brain vs Clients/Users); padding de tarjeta distinto (Panel/Brain vs Config/Perfil); cifra de stat 38px en Panel y 32px en Brain.
- Why it matters: cada divergencia es re-aprendizaje; la librería sin usar es deuda de mantenimiento.
- Fix: barrer las vistas para consumir los componentes; unificar modal y escala tarjeta/stat; retirar lo que no se use.
- Suggested command: /impeccable polish

### [P2] El formato de fecha ignora el idioma de la interfaz
- What: Brain fuerza `en-US`, Users fuerza `es-ES`, Clients/Messaging usan el locale del navegador `[]`; el rail sí usa `locale.value`. TestChat fija "Cliente Test" en duro.
- Why it matters: con la UI en inglés, Brain/Users siguen mostrando fechas en español (o al revés); rompe la promesa bilingüe.
- Fix: helper común `formatDate` derivado de `locale.value`; mover "Cliente Test" a `publicChat.*`.
- Suggested command: /impeccable harden

### [P2] Datos fabricados contradicen la "honestidad funcional" del producto
- What: el Panel imprime `traffic: 100%` literal (Dashboard.vue). La barra de Urgencia de 3 pasos se deriva de un booleano; el comentario del código lo admite (Messaging.vue).
- Why it matters: insinúa precisión inexistente; el principio rector es no mostrar lo que no es real.
- Fix: exponer el dato real o degradar a bandera binaria "requiere acción"; quitar el 100% o etiquetarlo.
- Suggested command: /impeccable clarify

### [P2] Sin modo oscuro ni ruta 404
- What: PRODUCT.md y DESIGN.md prometen claro/oscuro; style.css solo define tokens claros y no hay `prefers-color-scheme`/`.dark`/`darkMode`. El router no tiene catch-all, así que una URL desconocida renderiza en blanco.
- Why it matters: incumple lo documentado y deja al usuario sin salida ante un enlace roto.
- Fix: decidir y ejecutar modo oscuro o corregir la doc; añadir ruta 404.
- Suggested command: /impeccable adapt

## Persona Red Flags

**Alex (Power User)** — Sin atajos ni paleta de comandos; sin acciones en lote en Clientes ni bandeja; la bandeja no pagina ni ordena más allá de canal+búsqueda; en Brain las acciones de fila son icono-solo (hover); las etiquetas de cliente no se pueden editar aunque se guardan.

**Sam (Accessibility-Dependent)** — Jerarquía de encabezados rota (título de página h2 sin h1); ATabs con `role="tab"` pero sin `aria-controls`/`tabpanel`; notificaciones leídas a `opacity-60` y filas archivadas a `opacity-50` bajan el texto bajo 4.5:1; acciones icono-solo dependen de `title`; sin modo oscuro pese a lo documentado.

**Marisol (Operadora, persona de proyecto)** — La Urgencia promete un gradiente que es un booleano, no se puede confiar en ella para priorizar; sin temporizadores/SLA; Insights solo dan sentimiento; no puede marcar varias conversaciones como atendidas.

## Minor Observations

- Queda un `console.log("Admin notification:", data)` en Messaging.vue; 17 `console.*` en views/ como único manejo de error.
- AIcon mapea `expand_less → CaretUpDown`; las secciones expandidas muestran un icono de "ordenar".
- Paginación inconsistente: Clientes con iconos, Usuarios con botones de texto.
- Estado vacío inconsistente: Messaging usa AEmptyState; el resto usa texto plano.
- El gráfico del Panel no es accesible (SVG sin role/title ni datos).
- TestChat no es responsive (panel a w-1/3 fijo, sin colapso móvil).
- Drift de documentación: límite de logo 150 KB en código vs 200 KB en AGENTS.md.
- El `…` de paginación usa `text-line-strong` (~1.5:1), un glifo de contenido casi invisible.

## Questions to Consider

- Si el sistema Aurora ya existe, ¿qué impide que las vistas lo consuman?
- ¿La Urgencia es mejor como gradiente falso, o como bandera binaria honesta "requiere acción"?
- ¿El modo oscuro es un requisito real del operador o una línea heredada de la documentación?
- ¿Qué pasaría si Messaging tuviera un estado pendiente por mensaje con reintento, como un cliente de correo?
