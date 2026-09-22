---
name: Mitchbot
description: SaaS multi-canal de chatbot con IA y RAG — dashboard en tiempo real para operadores de conversación
colors:
  canvas: "#f7f3ef"
  surface: "#ffffff"
  sunken: "#efebe5"
  line: "#eae4dc"
  line-strong: "#ddd5ca"
  ink-1: "#0b0b0c"
  ink-2: "#56534e"
  ink-3: "#6f6960"
  sky: "#bbecff"
  sky-ink: "#0f4a64"
  sky-soft: "#e8f8fe"
  lime: "#dcfebc"
  lime-ink: "#2c5a15"
  lime-soft: "#f1fee4"
  lilac: "#e2c6ff"
  lilac-ink: "#4a2470"
  lilac-soft: "#f3ebff"
  butter: "#f1ee83"
  butter-ink: "#5e5a00"
  butter-soft: "#fbfae0"
  danger: "#b92f1a"
  danger-soft: "#fdece9"
  brand: "#e2c6ff"
  brand-ink: "#4a2470"
  brand-soft: "#f3ebff"
typography:
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    letterSpacing: "0.08em"
  micro:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
  meta:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
  caption:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  note:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  compact:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  bodyLg:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  bodyLgStrong:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 600
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  titleTight:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 700
  heading:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
  displaySm:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  displayMd:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
  displayLg:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
  displayXl:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
  display2xl:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
  display3xl:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
spacing:
  control-y: "0.6rem"
  control-x: "1.25rem"
  field-y: "0.7rem"
  field-x: "0.95rem"
  container: "2rem"
rounded:
  card: "20px"
  big: "28px"
  bubble: "20px"
  field: "16px"
  pill: "9999px"
  seal: "14px 6px 14px 6px"
components:
  button-primary:
    backgroundColor: "{colors.ink-1}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0.6rem 1.25rem"
  button-secondary:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.pill}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.field}"
    padding: "0.7rem 0.95rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  stamp:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
---

# Design System: Mitchbot ("Aurora")

## Overview

**Creative North Star: "El Estudio Optimista"**

El dashboard de Mitchbot se siente como entrar a un estudio de trabajo a media mañana: un lienzo de papel cálido (`--canvas #f7f3ef`) donde el lila, la lima y el cielo asoman por los bordes como luz de ventana, tinta negra de imprenta en lugar de gris administrativo y una familia de pasteles que **significa algo**. El bot va al día por su cuenta y el operador supervisa: la atmósfera es **clara, luminosa y amable**, con densidad de herramienta y foco en la conversación que se atiende.

El rasgo estructural es que **cada color tiene un papel, no solo un tono**: el lila es una persona (toma de control, selección, marca), la lima es el bot (resolución automática, éxito), el cielo es Web (un canal) y la mantequilla es algo que espera (confirmación, alerta operativa). Alrededor de esa semántica, el suelo, la tinta y las líneas son neutrales y estables; el acento de identidad por proyecto se inyecta como familia HSL (`--brand*`) y gobierna **selección y orientación**, nunca las acciones — el primario de acción es siempre tinta negra.

**Key Characteristics:**
- Lienzo de papel cálido con niebla de pasteles en los bordes (`aurora-haze`) y tarjetas blancas de radio generoso (20–28px).
- Un acento de identidad por proyecto (`--brand*`) reservado a item activo, tinte de avatar, punto de proyecto y anillo de foco.
- Tinta en tres pasos (`ink-1/2/3`) sobre hairlines cálidas — negro de imprenta, nunca gris frío.
- Familia pastel semántica: lila=persona/selección · lima=bot/éxito · cielo=Web · mantequilla=espera.
- Topología de **cápsulas flotantes**: el rail y el topbar son piezas sueltas sobre el lienzo, sin barras ni fondos de shell.
- Honestidad funcional: todo elemento visible tiene comportamiento real.

## Colors

Lienzo cálido con tinta negra, familia pastel semántica y un acento de identidad de hue variable.

### Identity accent
- **Lila Aurora** (`#E2C6FF`, por defecto): el acento de **identidad y selección** del proyecto. Pinta el item activo del rail, el tinte del avatar, el punto del selector de proyecto, el punto de notificaciones y el favicon. Se recalcula por proyecto desde Configuración → Identidad: si el color es claro (l ≥ 72%), contraste tinta negra (`#0b0b0c`), si no, blanco.
- **Derivados HSL** (`--brand-h/s/l` → `--brand`, `--brand-hover`, `--brand-deep`, `--brand-soft`, `--brand-softer`, `--brand-ink`): se sobre-racionalizan en vivo vía `useBrand`.

### Semantic pastels
- **Cielo** (`#bbecff` / tinta `#0f4a64` / fondo `#e8f8fe`): canal Web, información neutra.
- **Lima** (`#dcfebc` / tinta `#2c5a15` / fondo `#f1fee4`): el bot, lo resuelto, lo saludable.
- **Lila** (`#e2c6ff` / tinta `#4a2470` / fondo `#f3ebff`): una persona, el control humano, la selección.
- **Mantequilla** (`#f1ee83` / tinta `#5e5a00` / fondo `#fbfae0`): algo que espera tu visto bueno, alerta operativa.
- **Rojo peligro** (`#b92f1a` / fondo `#fdece9`): conflicto, error real.

### Neutral
- **Lienzo** (`#f7f3ef`): fondo global de la app.
- **Hundido** (`#efebe5`): zonas hundidas, segmented controls, hover de superficie.
- **Papel blanco** (`#ffffff`): tarjetas, inputs, cápsulas.
- **Hairline** (`#eae4dc`): bordes de 1px cálidos; hover de borde de campo `#ddd5ca`.
- **Tinta principal** (`#0b0b0c`): texto, titulares y el primario de acción.
- **Tinta secundaria** (`#56534e`): texto de apoyo, iconos.
- **Tinta terciaria** (`#6f6960`): placeholders, meta, etiquetas de columna.

### Named Rules
**La Regla del Color que Significa.** Un pastel solo aparece si dice algo: lila es una persona, lima es el bot, cielo es Web, mantequilla es una espera. No se usa lila como decoración ni lima como acento arbitrario.
**La Regla de la Tinta Primaria.** El primario de acción es **tinta negra**, no color. El acento de marca no pinta botones: pinta orientación y selección.
**La Regla del Lienzo Cálido.** Toda superficie neutra nace del papel (`--canvas/--surface`) con hairline cálida; prohibido introducir grises fríos o azules de panel administrativo.

### Dark mode — "Aurora de noche"
El tema oscuro **recompone** el mundo, no lo invierte. El papel se hunde a un púrpura cálido (`--canvas #16141b`, `--surface #211e28`, `--sunken #2b2733`, `--line #332e3d`), la tinta sube a un blanco cálido (`--ink-1 #f3f0ea`, `--ink-2 #bdb6ad`, `--ink-3 #918a80`) y la familia pastel pasa a tintes profundos con tinta clara (`--sky-soft #16303d`/`--sky-ink #d8f1ff`, etc.). El acento de identidad se **aclara** para sobrevivir al suelo oscuro y el par de acción se invierte con tokens propios: `--ink-solid` (= `--ink-1`) y `--ink-solid-contrast` (= `#16141b`), de modo que el primario sigue siendo "tinta" sin perder contraste. Las sombras difusas se profundizan (la tinta ya no proyecta sobre el suelo) y la niebla `aurora-haze` baja de intensidad y se tiñe del acento. La familia `--brand*` la recalcula `useBrand` con el tema activo (`brandDerivatives(hsl, theme)`); el tema se aplica con `data-theme` en `<html>`, se persiste en `localStorage` (`mitchbot.theme`) y arranca desde `prefers-color-scheme` sin flash (script inline en `index.html`).

**La Regla del Par de Acción.** El primario sólido nunca se pinta con `--ink-1` directo: usa `--ink-solid` + `--ink-solid-contrast` para sobrevivir al cambio de tema.

## Typography

**Display Font:** Bricolage Grotesque (fallback `ui-sans-serif, system-ui, sans-serif`) — ejes `opsz`/`wdth`/`wght`.
**Body Font:** Hanken Grotesk (fallback `ui-sans-serif, system-ui, sans-serif`)
**Label Font:** Hanken Grotesk en peso 800, uppercase con tracking `+0.08em`

**Character:** Bricolage es expresiva y se aprieta con tracking negativo justo donde hay titulares grandes; Hanken sostiene el cuerpo denso con x-height alta y cifras tabulares. Los títulos aprietan tracking (−0.02em a −0.04em); las etiquetas de estado son sellos uppercase de 10px. Los números comparables usan `tabular-nums`.

### Hierarchy
La rampa real implementada sube en pasos cortos dentro de cuatro familias:
- **Label / Micro** (10–11px, pesos 800/600): sellos uppercase `.stamp`, badges, microtexto de estado.
- **Meta / Caption / Note / Compact** (11.5–13px, tinta terciaria y secundaria): descripciones, etiquetas de columna, metadatos de tabla, texto de controles densos.
- **Body** (14px, line-height 1.5): tamaño base de todo el dashboard. **Body-Lg** (15–15.5px) para el cuerpo de listas y cabeceras de panel.
- **Title / Heading** (16–19px, Bricolage 700): títulos de tarjeta, cabeceras de sección y display del topbar.
- **Display** (22–38px, Bricolage 700, tracking −0.02em a −0.04em): titulares de vista y métricas grandes.
Cada paso declarado en el frontmatter (`typography.*`) es el que aparece en la implementación; no se introducen tamaños fuera de esa lista.

### Named Rules
**La Regla del Sello.** Todo microtexto de estado va en sello uppercase de 10px peso 800 dentro de una pill; no se improvisan tamaños de badge.
**La Regla del Display.** Los titulares usan Bricolage Grotesque; nunca se sustituye por la fuente de cuerpo ni por una sans del sistema.

## Layout

La app es un lienzo con **cápsulas flotantes**, no un shell con barras: el rail es una tarjeta fija a la izquierda (`--shell-pad` de margen, ancho `--rail-w: 224px`, radio 28px) y el topbar es una fila de cápsulas sueltas que respira sobre el papel. El contenido ocupa `max-width: 1400px` centrado con un **margen uniforme de `--shell-pad` (14px) en todas las direcciones**: el mismo valor separa el rail del borde, el topbar y las tarjetas. El gutter rail → contenido es `--rail-offset: calc(--rail-w + 2 × --shell-pad) = 252px`, de modo que la separación rail–tarjeta iguala exactamente el margen del lienzo (topbar y layout comparten el token, así que no pueden desalinearse).

- **Topbar — izquierda (dinámico):** el título de página es la única cápsula (conserva `data-testid="page-title"`). Los instrumentos de vista (rango y granularidad en el Panel, filtros en Clientes, contadores y modo en Conversaciones, vectores en Brain) viven **dentro de la superficie que los posee**, no en el topbar.
- **Topbar — derecha (invariante):** Proyectos (punto de marca + nombre → dropdown) · Idiomas ES/EN (conserva `data-testid="language-selector"`) · Tema claro/oscuro (`data-testid="theme-toggle"`) · Notificaciones · Usuario (avatar + nombre → dropdown con Mi Perfil / Cerrar sesión).
- **Rail:** marca del proyecto, navegación (Panel · Conversaciones · Clientes · Brain · Usuarios), separador, Configuración y Mi Perfil, y la tarjeta de turno.
- **Margen del lienzo (`--shell-pad`, 14px):** un único valor rige el respiro del shell en todas las direcciones — rail respecto al borde (arriba/izquierda/abajo), topbar y contenido respecto al borde (arriba/derecha/abajo) y la separación rail → tarjetas. `--rail-w` (224px) y `--rail-offset` (`--rail-w + 2 × --shell-pad` = 252px) derivan de él; topbar y `DashboardLayout` consumen el mismo token.
- **Conversaciones — modo enfoque:** la cabecera del hilo ofrece un toggle que estrecha las laterales para dar ancho al hilo: `[minmax(320px,30%)_1fr_300px]` → `[minmax(248px,22%)_1fr_240px]`, con transición de `grid-template-columns` (300ms, sujeta a `prefers-reduced-motion`). Es una cápsula con `aria-pressed`, icono Phosphor y `title` que describe el efecto; vive solo en `lg+` y se persiste en `localStorage`.
- **Por debajo de 1024px:** el rail se oculta, el topbar apila sus cápsulas y las rejillas colapsan; el cluster derecho se conserva.

## Elevation & Depth

El mundo usa **elevación difusa ambiente**: las cápsulas y tarjetas proyectan una sombra de dos capas casi invisible (`0 1px 2px` + `0 14px 44px` de tinta al 4–6%) y solo los overlays se levantan de verdad (`0 2px 4px + 0 28px 70px`, 12%). La profundidad adicional la hacen la hairline cálida y el contraste superficie/lienzo.

### Shadow Vocabulary
- **Sombra de tarjeta/cápsula** (`--shadow-card: 0 1px 2px rgba(11,11,12,.04), 0 14px 44px rgba(11,11,12,.06)`): toda `.card` y toda cápsula del topbar y el rail, en reposo.
- **Sombra de popover** (`--shadow-pop: 0 2px 4px rgba(11,11,12,.05), 0 28px 70px rgba(11,11,12,.12)`): dropdowns, menús, modales.

### Named Rules
**La Regla Sin Halo.** Ninguna sombra lleva tinte del acento; la proyección siempre es tinta neutra.
**La Regla del Hover Elevado.** El hover de los botones sólidos levanta 1px (`translateY(-1px)`) y añade sombra; nunca se hincha el color.

## Shapes

El lenguaje es de **cápsulas y tarjetas de esquina generosa**: tarjetas 20px (`--r-card`), superficies grandes 28px (`--r-big`), burbujas de chat 20px con la esquina del hablante recortada a 7px, campos 16px (`--r-field`) y pills completamente redondas. Solo una silueta es asimétrica: el **sello** (`--r-seal: 14px 6px 14px 6px`). Los bordes son siempre hairlines cálidas de 1px.

## Components

### Buttons
- **Shape:** cápsulas completas (`--r-pill`), `0.6rem 1.25rem`.
- **Primary** (`.btn-primary`): fondo **tinta negra** (`--ink-1`), texto blanco, peso 600; hover levanta 1px con sombra.
- **Secondary** (`.btn-secondary`): fondo hundido (`--sunken`), texto tinta; hover con sombra suave.
- **Ghost** (`.btn-ghost`): transparente, texto tinta secundaria; hover invade el lienzo.
- **Pastel en cápsula** (no en `AButton`): las acciones de semántica pastel (tomar control, resolver, conectar) usan `bg-lilac`/`bg-lime`/`bg-sky` directamente sobre la cápsula, no una variante del botón base.
- **Disabled:** opacidad 45% + cursor not-allowed.

### Stamps / Pills
- **Style:** pill (`border-radius: 9999px`), fondo del estado en versión suave, texto en su tinta, 11.5px peso 600, con punto de color `currentColor`. El sello de microtexto es uppercase 10px/800.

### Cards / Containers
- **Corner Style:** 20px (`--r-card`); las bandas de sección usan 28px (`--r-big`).
- **Background:** papel blanco sobre lienzo `#f7f3ef`.
- **Shadow Strategy:** `--shadow-card`; ver Elevation.
- **Border:** opcional hairline `#eae4dc`; por defecto las tarjetas solo llevan sombra.

### Inputs / Fields
- **Style:** fondo blanco, borde hairline 1px, rounded 16px, padding `0.7rem 0.95rem`, texto 14px.
- **Hover:** borde `#ddd5ca`.
- **Focus:** borde `--brand` + halo `0 0 0 4px var(--brand-soft)`.
- **Placeholder:** tinta terciaria `#6f6960`.

### Navigation — la fila de cápsulas
- **Rail:** tarjeta flotante con radio 28px; item en reposo tinta secundaria, item activo fondo `lilac-soft` con tinta `lilac-ink` e icono Phosphor en peso `fill`.
- **Topbar:** **sin fondo, sin borde, sin blur** — cada item es su propia cápsula blanca con `--shadow-card`. Izquierda = título de página; derecha = invariantes (Proyectos · Idiomas · Tema · Notificaciones · Usuario).
- El foco visible global es un outline de 2px `--brand` con offset 2px.

### Iconography
- **Phosphor** (`@phosphor-icons/vue`), envuelto en `AIcon.vue` para que el set siga siendo intercambiable. Seis pesos (`regular` → `fill` para el nav activo, `duotone` disponible para teñir semántica). `AIcon` acepta nombres canónicos (`ChatCircleDots`) y un mapa de nombres Material heredados (`chat`, `dashboard`, …) para migrar vistas sin tocar el set.

### Firma: la Burbuja de Conversación
- **Corner Style:** 20px (`--r-bubble`) con la esquina del hablante a 7px.
- **Bot:** fondo tinta negra, texto blanco, alineado a la derecha. **Cliente:** papel blanco con hairline, a la izquierda. **Agente humano:** `lilac-soft` con anillo lila, a la derecha. **Herramienta:** `butter-soft` con sello de confirmación. Indicador de escritura: tres puntos con animación de parpadeo. Es el componente que define el look de Conversaciones y del chat público.

## Do's and Don'ts

### Do:
- **Do** diseñar contra las variables `--brand*` y derivar estados en vivo; nunca asumir el hue del proyecto.
- **Do** usar cada pastel por su papel semántico (lila=persona, lima=bot, cielo=Web, mantequilla=espera).
- **Do** mantener la tinta negra como primario de acción y el acento de marca para orientación/selección.
- **Do** construir el topbar como cápsulas flotantes sin fondo de barra, y mantener el cluster derecho invariante.
- **Do** usar tracking negativo en titulares Bricolage y envolver todo icono en `AIcon`.

### Don't:
- **Don't** reintroducir una barra de shell con fondo, borde y blur en el topbar: la tesis es la fila de cápsulas.
- **Don't** pintar botones primarios con el acento de marca ni introducir segundas voces de color.
- **Don't** usar halos de color en sombras, ni glassmorphism, ni gradientes chillones ni neón.
- **Don't** inventar tamaños de badge fuera del sello (10px/800/pill).
- **Don't** mezclar la webfont de Material Symbols con Phosphor: el set es uno solo.

> **Dirección implementada:** Aurora reemplaza al mundo "App Cálida" (v4.0.0) como sistema de diseño. Los tokens viven en `apps/frontend/src/style.css` y `tailwind.config.js`; los componentes base en `apps/frontend/src/components/ui/*`; el shell en `components/layout/Aurora{Rail,Topbar}.vue`, compuestos dentro de `DashboardLayout.vue`. **Todas las vistas del dashboard están migradas** (cero clases `warm-*` en el código): Panel, Conversaciones (con tarjeta de Sentimiento y bloque de Urgencia), Clientes, Brain, Usuarios, Configuración, Mi Perfil, Login, Setup, TestChat y DevTests; el Resumen (Dashboard) se conserva tal cual para refinar en una tanda posterior. Queda pendiente la persistencia de `project.config.brand` en el backend. El prototipo fiel de 12 vistas está en `apps/frontend/.impeccable/mocks/aurora/`.
