# Changelog — MitchBot v2

Todas las actualizaciones notables del proyecto están documentadas aquí.  
Formato basado en [Keep a Changelog](https://keepachangelog.com/) con versionado semántico.

---

## v0.4.32 — 2026-10-19

> **Limpieza profunda**: fuera la documentación obsoleta, las exploraciones de diseño descartadas y los borradores de diagramas

### 🗑️ Eliminado
- **Documentación obsoleta**: `examples/` (PDF de menú sin uso), `project.md` (plan inicial con Bun, Hono y Ollama), `backend_plan.md` y `.planning/` (8 planes de funciones ya implementadas).
- **Exploración de diseño superada**: el `.impeccable/` de la raíz (mocks de App Cálida y Prospecto Cívico, decision-payloads, capturas y `shot.mjs`) y los mundos descartados de `apps/frontend/.impeccable/mocks` (`rediseño`, `boveda`, `ejemplos`, `comparador.html` y `enfoque.html`). Se conservan el prototipo Aurora, `design.json`, los critiques y las surfaces. En Aurora se quitó el enlace al comparador.
- **Borradores de Archify**: de cada diagrama se eliminan los HTML y las revisiones superadas, y se conserva `candidate.json` con su versión final. `.archify/` pasa de unos 30 MB a 16 MB.
- **Código muerto**: `middleware/validation.middleware.ts` (`validateRequest` no se usaba).

### 🔧 Cambiado
- `.gitignore`: sin reglas duplicadas (Playwright, `.DS_Store`) ni las de modelos locales de la etapa Ollama. Se sacan del índice los estados de `.impeccable/questions/` que ya estaban ignorados.

### ✅ Verificación
- Backend `tsc --noEmit` y frontend `vue-tsc --noEmit` en verde. Cada diagrama conserva un único HTML final y los enlaces del README siguen funcionando. Todo lo eliminado está en el historial de git.

---

## v0.4.31 — 2026-10-19

> **README del proyecto**: visión, capacidades y puesta en marcha en un solo lugar

### 🔄 Cambiado
- **Renumeración pre-1.0**: el proyecto aún no ha llegado a la versión 1.0.0, así que todo el historial pasa a `0.x`. Cada versión mayor anterior se convierte en una menor (`v1`→`0.1`, `v2`→`0.2`, `v3`→`0.3`, `v4`→`0.4`) y sus entregas se numeran en el patch por orden cronológico (p. ej. `v4.14.1`→`v0.4.30`). Se actualizaron los `package.json`, este changelog, `AGENTS.md`, `README.md`, `DESIGN.md`, los critiques de Impeccable y las propuestas de OpenSpec archivadas. Los mensajes de commit anteriores conservan la numeración antigua.

### 📝 Documentación
- **Hoja de ruta visual**: nuevo diagrama Archify (`.archify/workflow-roadmap-20261019-175109/`) con lo entregado (v0.1–v0.4), lo siguiente (v0.5) y lo pendiente hasta la v1.0, en tres carriles: Plataforma e IA, Canales y Experiencia. Se exporta a `docs/roadmap.svg`, que sigue el tema claro u oscuro del sistema, y el README lo incrusta junto a una tabla de etapas.
- Nuevo `README.md` en la raíz: visión y público del producto, principios, capacidades por módulo, arquitectura y stack, puesta en marcha, variables de entorno, pruebas E2E, hoja de ruta y convenciones de contribución. Enlaza `PRODUCT.md`, `DESIGN.md`, `AGENTS.md` y los diagramas de `.archify/`.

---

## v0.4.30 — 2026-10-06

> **Diagramas del sistema**: flujos, casos de uso y procesos internos documentados con Archify

### ✨ Añadido
- Diez diagramas interactivos en `.archify/` (HTML autocontenido, tema claro/oscuro, exportables): arquitectura del sistema; inicio de sesión y onboarding; mensaje del cliente a respuesta del bot; herramienta con confirmación del cliente; control de herramientas (ninguna, cliente u operador); ingesta de conocimiento RAG; analítica del Dashboard e insights; y los ciclos de vida de conversación, fuente de conocimiento y ejecución de herramienta.
- Cada diagrama conserva su `candidate.json` (fuente editable) junto al HTML final en su carpeta `review-N`.

### ✅ Verificación
- Los diez pasan validación, entrega, comprobación estricta y navegador real (`finalize --quality showcase`) y se revisaron capturas a 1440×900. Sin cambios de código.
- Los diagramas se redactaron a partir del código del backend, no de una revisión fijada: el repositorio no tiene remoto `origin`, así que Archify no puede verificar fuentes con commit.

---

## v0.4.29 — 2026-09-30

> **Conversaciones más ligeras y accesibles**: historial bajo demanda, controles etiquetados y foco predecible

### ✨ Añadido
- El hilo muestra los 50 mensajes más recientes y permite cargar anteriores sin perder la posición de lectura; la operación admite reintento si falla.
- La API acepta `limit` y `before` para paginar por cursor; las llamadas existentes sin esos parámetros conservan su respuesta completa.
- Los controles de selección anuncian su estado, los campos tienen nombres accesibles y los modales largos se desplazan sin recortar contenido.
- El drawer móvil devuelve el foco al disparador al cerrarse y lo coloca en el contenido al navegar.

### 🔧 Cambiado
- El agente consulta una ventana acotada de mensajes elegibles; ya no recorre el hilo completo para construir sus últimos 20 turnos.
- El locale inglés se carga al seleccionarlo y los iconos Phosphor se generan en un chunk aparte; la entrada principal queda en 200,64 kB (66,99 kB gzip).

### ✅ Verificación
- Backend `build`; frontend `vue-tsc` + `build`; paridad es/en: **709/709**; detector Impeccable sin hallazgos.
- E2E focalizado de reintento/paginación: **2/2**. La suite completa de Mensajería quedó en **16/17** por timeout en insights; las siguientes pruebas no pudieron completarse cuando MongoDB E2E dejó de responder.

---

## v0.4.28 — 2026-09-30

> **Conversaciones más recuperables**: errores claros, reintentos y confirmación de acciones

### ✨ Añadido
- La bandeja y el hilo muestran errores de carga separados de los estados vacíos y permiten reintentar sin salir de la vista.
- Confirmar, cancelar o modificar una herramienta muestra el estado de envío; si el socket falla o no responde, la interfaz ofrece reintentar y evita repetir acciones ya procesadas.
- Etiquetas accesibles para el compositor y el editor JSON; categorías del gráfico de sentimiento traducidas al español e inglés.

### 🔧 Cambiado
- Los errores de `tool:confirm` incluyen `executionId` para asociar el fallo con la acción pendiente correcta.
- Las cargas de mensajes descartan respuestas atrasadas cuando el operador cambia de conversación.

### ✅ Verificación
- Backend `build` y frontend `vue-tsc` + `build`.
- E2E de Mensajería: **16/16**; paridad es/en: **706/706**; detector Impeccable sin hallazgos.

---

## v0.4.27 — 2026-09-28

> 📊 **Resumen funcional**: resultados del negocio y salud del bot con datos reales

### ✨ Añadido
- **Resultados**: el Resumen presenta conversaciones, leads capturados, citas por estado y conversión de conversaciones a leads.
- **Salud del bot**: muestra tasa real de respuesta, mediana del tiempo de primera respuesta, cobertura en piloto automático y backlog de atención/no leídos.
- **Automatización y volumen**: agrega sentimiento analizado y herramientas más usadas con tasa de éxito; el volumen separa mensajes de clientes, bot y agentes.
- **Actividad reciente**: se registran las conversaciones creadas/cerradas, contactos nuevos y herramientas ejecutadas. Un fallo de tracking no interrumpe el chat.
- **Estados vacíos localizados** en español e inglés para datos de respuesta, sentimiento y herramientas.

### 🔧 Cambiado
- `GET /api/dashboard/stats` devuelve métricas reales de mensajería, cobertura y backlog; se añaden `GET /api/dashboard/outcomes` y `GET /api/dashboard/automation`.
- Las métricas conservan el aislamiento por proyecto y aceptan `days` o `from`/`to`. El cálculo de respuesta limita la ventana a 5000 conversaciones por defecto y a 5000 ms; se puede ajustar con `DASHBOARD_RESPONSE_CONVERSATION_LIMIT` y `DASHBOARD_RESPONSE_TIMEOUT_MS`.
- El Resumen se organiza en las bandas **Resultados** y **Salud del bot**, con desglose de mensajes por emisor y formatos del locale activo.

### ✅ Verificación
- Backend `build`; frontend `vue-tsc --noEmit` y `build`.
- Suite E2E: **53/53**; paridad es/en: **698/698**.
- Chromium comprobó estados vacíos, cambio de idioma, tema oscuro y layout sin overflow a 1440/390.

---

## v0.4.26 — 2026-09-28

> 🚦 **Urgencia analizada**: prioridad del cliente visible en el hilo y la bandeja

### ✨ Añadido
- **Urgencia en AI Insights**: el análisis conjunto con sentimiento persiste un nivel (`low`, `medium`, `high`) y un motivo localizado (`none`, `deadline`, `incident`, `escalation`, `repetition`). La lectura y el análisis manual de insights también devuelven el campo cuando existe.
- **Indicador en la bandeja**: Media y Alta se distinguen en la fila y se actualizan en vivo; Baja y conversaciones sin análisis no añaden señal visual.
- **Motivos localizados** en español e inglés para el panel de urgencia.

### 🔧 Cambiado
- Los insights se recalculan al recibir cada mensaje del cliente, desde el primero y tanto en piloto automático como en toma de control humana. Los análisis de una conversación se serializan y dejan de ejecutarse después de las respuestas del bot.
- El panel muestra el nivel analizado, elevado a Media si hay una confirmación pendiente; sin urgencia analizada conserva la estimación heurística existente.
- `chat:insights` actualiza tanto la conversación abierta como la bandeja del dashboard sin duplicar el evento.

### ✅ Verificación
- Backend `build` y frontend `build` completados; paridad de traducciones **668/668**.
- E2E de Mensajería: **14/14**; comprobación en Chromium con navegador visible de Baja/Media/Alta, confirmación pendiente e indicador en vivo.

---

## v0.4.25 — 2026-09-28

> 🧰 **Tools**: catálogo configurable, aprobaciones de operador e historial de operaciones

### ✨ Añadido
- **Catálogo de herramientas por proyecto**: Agenda, Conocimiento, Inventario y Pagos exponen operaciones independientes (`leer`, `crear`, `editar`, `eliminar`) con binding interno. El agente recibe únicamente las operaciones habilitadas para el proyecto de la conversación.
- **Módulos internos**: Agenda consulta horarios y disponibilidad, crea/reprograma/cancela citas; Conocimiento reúne búsquedas de productos y preguntas frecuentes; Inventario administra pedidos; Pagos registra intenciones de cobro pendientes sin mover dinero.
- **Aprobaciones de operador**: el rol `approver` puede aprobar o rechazar cancelaciones e intenciones de cobro; `admin` conserva acceso de respaldo. Las solicitudes se notifican en vivo.
- **Auditoría e interfaz**: `/tools` reúne Catálogo, Aprobaciones e Historial con filtros, paginación y enlaces a las conversaciones de origen. `tool_executions` registra operación, binding, resultado, actor y fecha de decisión.
- **API**: `GET /api/tools`, `PUT /api/tools/config`, `GET /api/tool-executions`, `GET /api/tool-executions/pending` y rutas de aprobación/rechazo.

### 🔧 Cambiado
- Las creaciones y ediciones solicitan confirmación del cliente; las eliminaciones y `Pagos·crear` esperan aprobación del operador. Lecturas y herramientas de sistema no requieren aprobación.
- Los proyectos existentes conservan el comportamiento equivalente a las herramientas anteriores; los proyectos nuevos habilitan las operaciones internas del catálogo.
- `transfer_to_human` y `send_notification` quedan fuera del catálogo configurable y siempre disponibles.

### ✅ Verificación
- Backend: `tsc --noEmit` y pruebas de integración (**30 pasaron, 1 omitida**); frontend: `vue-tsc --noEmit` y build.
- E2E: **48/48** (`--workers=1`); paridad i18n es/en; detector Impeccable: **0 hallazgos**.
- La interfaz no desborda a 1440px en claro ni a 390px en oscuro; las pestañas funcionan con teclado.

---

## v0.4.24 — 2026-09-22

> 🎯 **Modo enfoque real**: las laterales de Conversaciones colapsan a carriles de iconos

### ✨ Añadido
- **Carril de iconos en modo enfoque (`Messaging.vue`)**: con enfoque activo en escritorio las dos laterales pasan a carriles de **74px** (`lg:grid-cols-[74px_1fr_74px]`; sin selección, `[74px_1fr]`). La **bandeja** muestra solo avatar + insignia de canal, no leídos (anillo sobre el avatar) y punto mantequilla si el cliente no está guardado; la **ficha** muestra avatar, sentimiento, urgencia con medidor de 3 tramos, estado del contacto y el botón de guardar con las iniciales + insignia `Plus`. Todo con `title`/`aria-label` descriptivos (`nombre · canal · no leídos · sin contacto`, `Sentimiento: … (%)`, `Urgencia: … — …`).
- **Búsqueda y filtro como iconos** dentro del carril: `MagnifyingGlass` abre un popover (`ADropdown` con `role="dialog"`) con el campo de búsqueda (filtra en vivo) y `Funnel` abre la lista de canales (`role="listbox"`, marca del activo y punto lila en el disparador).
- **`AIcon`**: se reincorpora `Funnel` (`PhFunnel`), retirado como muerto en v0.4.21.
- Claves i18n `messaging.inbox.search`, `messaging.inbox.filter` y `messaging.inbox.unread` (es/en).

### 🔧 Cambiado
- **Modo enfoque solo en escritorio**: `focusCollapsed = isFocusMode && matchMedia('(min-width: 1024px)')`; en móvil el modo se ignora (las laterales ya se ocultan) y la bandeja conserva `overflow-hidden`. El carril usa `overflow-visible` para que los popovers de búsqueda/filtro escapen del redondeo de la tarjeta.
- **`messaging.focus.hint`** describe el nuevo comportamiento (colapsa a iconos, no solo estrecha).
- Los indicadores de sentimiento, urgencia y contacto son **informativos** (`role="img"` + `aria-label`), no botones muertos; el único control del carril de ficha es guardar contacto.

### ✅ Verificación
- `vue-tsc --noEmit` y `build` en verde; paridad es/en **571/571**; detector Impeccable sobre `src` en **0 hallazgos**; suite e2e **44/44**. Medición en navegador a 1440 (carriles de 74/74px, popovers de 256px fuera del carril, 0 errores de consola) y 390 (modo ignorado, sin overflow horizontal).

---

## v0.4.23 — 2026-09-22

> 🧭 **Rail desnudo**: el sidebar deja de ser tarjeta y el item activo se marca con sello desregistrado + eco

### 🔧 Cambiado
- **`AuroraRail.vue` sin fondo en escritorio**: el rail pierde `bg-surface shadow-card` (y `rounded-big`/`overflow-hidden`) y pasa a ser **navegación desnuda** apoyada en el lienzo, como el título de cada vista; la `aurora-haze` vuelve a verse a través de él. El **drawer móvil** conserva `surface` + `shadow-card` porque flota sobre el contenido y necesita leerse.
- **Item activo = Sello desregistrado + Eco (variante C+G)**: el activo abandona el relleno de fila. Ahora lo marcan una cápsula `lilac-soft` con `inset: 3px -8px 3px -9px`, girada `-1.3deg`, corrida `-2px/-1px` y anillo lila interior de `1.5px`, más el **label duplicado en `text-lilac`** corrido `+1px/+2px` por detrás (eco de doble impresión). El icono Phosphor pasa a peso `fill` con tinta `lilac-ink` y el label a tinta plena.
- **Hover honesto en el rail**: sobre lienzo transparente el `hover:bg-canvas` era invisible; el item en reposo usa `hover:bg-sunken` y el activo no pinta hover (su señal es el sello).

### 📝 Documentación
- **`DESIGN.md`**: Layout, Elevation y Navigation actualizados (rail sin tarjeta ni sombra; el sello/eco documentado como marca del activo).
- **AGENTS.md** actualizado con la sección v0.4.23.

### ✅ Verificación
- `vue-tsc --noEmit` y `build` en verde; suite e2e **44/44** (incluida la auditoría de overflow y consola en 1440/390); medición en navegador de las propiedades computadas del sello y el eco y capturas en claro, oscuro y drawer móvil.

---

## v0.4.22 — 2026-09-22

> 🎨 **Disciplina del sistema**: pastel que significa, un solo set de iconos, selects unificados y recuperación de errores

### ✨ Añadido
- **Navegación por teclado en `ADropdown`**: al abrir recibe foco el primer ítem (o el seleccionado), `ArrowUp/Down` y `Home/End` recorren las opciones (`role="option"`/`menuitem*`), `Tab` cierra el menú y `Escape` devuelve el foco al disparador; los desplegables `dialog` (Notificaciones) conservan su foco propio.
- **Recuperación en Clientes**: el fallo de carga ya no reemplaza la tabla por un texto; muestra banner `role="alert"` con la clave `clients.errors.load` y botón **Reintentar** que reejecuta `fetchContacts()` conservando los filtros (como Usuarios y Brain).
- **Iconos Phosphor nuevos** en `AIcon`: `SmileyMeh`, `Smiley`, `SmileyWink`, `Target`, `PaintBrush`, `Broadcast`.
- **Guardado consistente en Configuración**: Canales y Opciones ganan el mismo indicador **"Cambios sin guardar"** y la barra pegajosa que ya tenía Agente (claves `settings.unsaved`).

### 🔧 Cambiado
- **El pastel vuelve a significar** (`Dashboard`, `ProjectSetup`): las métricas agregadas (total, activos, tasa) pasan a tinta neutra (`sunken`/`ink-2`) y el paso del agente usa **lima (bot)**; proyecto y canales quedan neutros. Se deja de rotar pasteles por variedad.
- **Fuera los emoji como iconografía**: `Settings` (😐🙂😄 → `SmileyMeh`/`Smiley`/`SmileyWink`; 🎯🎨 → `Target`/`PaintBrush`) y `ProjectSetup` (📁🤖📡 → `FolderOpen`/`Robot`/`Broadcast`); el idioma se muestra como texto ("Español"/"English") sin banderas.
- **Selects nativos → `ADropdown`** en los modales de edición de Clientes (plataforma, estado) y Usuarios (rol, estado) y en la creación de Usuarios; ahora el campo muestra chevron y se opera como lista.
- **`ADropdown`**: se retira la prop `autoFocus` (el foco inicial es siempre parte del componente).
- **`APill`**: los pills con icono interno (modo de Conversaciones y cabecera del chat público) usan `:dot="false"`; fin al doble marcador.
- **`TestChat` responsive**: el simulador apila el panel y el chat en móvil (`flex-col` → `lg:flex-row`, `w-full` → `lg:w-1/3`, alto mínimo del hilo) en vez de fijar `w-1/3` sin breakpoints.
- **`Profile`**: el rol se traduce con `users.roles.*` en lugar de mostrar el valor crudo.

### 📝 Documentación
- **AGENTS.md** actualizado con la sección v0.4.22.

### ✅ Verificación
- `vue-tsc --noEmit` y `build` (frontend) en verde; paridad es/en **568/568**; detector Impeccable sobre `src` en **0 hallazgos**; suite e2e completa **44/44**; auditoría de overflow en 1440 y 390 sin desborde.

---

## v0.4.21 — 2026-09-22

> 🧹 **Limpieza**: fuera dependencias, tipos, iconos, tokens, clases y claves i18n sin uso

### 🗑️ Eliminado
- **Dependencias del backend sin uso**: `@langchain/textsplitters` y `cheerio` (0 importaciones). El fallback OCR `pdf-parse` se conserva por su `import()` dinámico.
- **Tipo muerto** `apps/backend/src/types/index.ts` (`AppResponse`, sin referencias); se elimina la carpeta `types/` (el `types/` de `tools/` se mantiene).
- **`AIcon.vue`**: el `LEGACY_MAP` de Material Symbols (92 entradas) y 30 iconos Phosphor sin uso (`DotsThreeVertical`, `Buildings`, `ClockCounterClockwise`, `CalendarBlank`, `CurrencyDollar`, `Package`, `EnvelopeSimple`, `Play`, `Eye`, `DownloadSimple`, `TreeStructure`, `Paperclip`, `Smiley`, `Waves`, `ShieldCheck`, `Tag`, `Hash`, `Database`, `Cpu`, `Kanban`, `Megaphone`, `Sparkle`, `Funnel`, `ArrowUp`, `ArrowDown`, `ChartLine`, `TrendUp`, `Desktop`, `Palette`, `Circle`), junto con sus imports. `AButton` pasa de `progress_activity` a `SpinnerGap` (único uso heredado).
- **`style.css`**: clases de componente muertas `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` y `.stamp` (migradas a los primitivos `A*`), y tokens muertos `--display`, `--shadow`, `--shadow-lift`, `--r-bubble`, `--r-pill`, `--r-seal`.
- **i18n**: 68 claves sin uso por catálogo (namespace `agents.*` completo, `sidebar.*`, `app.name/tagline`, buena parte de `common.*`, `brain.stats.*`, `dashboard.stats.live`, `dashboard.channels.traffic`, `settings.agent.*` obsoletas, `publicChat.tool.tool`, etc.) y el duplicado `common.clear`.
- **Basura local**: `.DS_Store`, `spa.traineddata` (3.3 MB, sin referencias), `playwright-report/` y `test-results/`.

### ✅ Verificación
- `vue-tsc --noEmit`, `build` (frontend) y `tsc --noEmit` (backend) en verde; paridad es/en **567/567**; sin claves i18n huérfanas en las llamadas `t(...)`.

---

## v0.4.20 — 2026-09-22

> 🧩 **Shell consistente**: modal de proyecto, idioma como el de proyecto, Memoria y tooltips

### ✨ Añadido
- **Modal de creación de proyecto** desde el topbar: el ítem "Crear nuevo proyecto" del menú de proyectos abre un `AModal` (nombre + descripción) y crea el proyecto con agente y canales por defecto sin salir del dashboard; al crear, sincroniza el perfil, reconecta el socket y recarga. Nuevo `data-testid="project-selector"` en el disparador.
- **`ADropdown`** (componente base): primitivo único de cápsula + popover (trigger por slot, alineación, cierre por clic fuera/Escape, foco inicial, roles `menu`/`listbox`/`dialog`). Sustituye las cuatro implementaciones a mano del topbar (Proyectos, Idiomas, Notificaciones, Usuario) y los `<select>` nativos de filtro y tamaño de página de Clientes y Usuarios.
- **Tooltips** (`title`) en controles icon-only que no los tenían: toggle de navegación, notificaciones, paginación (Clientes y Usuarios), cierres de modales y toggles de sección de Configuración, y quitar palabra clave en Setup/Configuración.

### 🔧 Cambiado
- **Selector de idioma**: deja de ser un `<select>` nativo y pasa a botón **icon-only** (`Translate`) como sus vecinos, que abre un menú Español/Inglés con marca del idioma activo.
- **Espaciado del lienzo**: el contenido de todas las vistas suma `--shell-pad` arriba, separando el topbar de la primera tarjeta (el buscador de Clientes ya no se pega al topbar).
- **Topbar en móvil**: los nombres de proyecto y usuario truncan (`min-w-0`) y los botones de icono no se encogen (`shrink-0`); el clúster deja de desbordar a la derecha (medido: 390 = 390).
- **Brain → Memoria** en español (el inglés conserva "Brain"): rail, título de vista y catálogos i18n.
- **Menú de estado de Clientes** alineado a la derecha para no salirse del viewport.

### 🐛 Corregido
- **Spanglish del catálogo es**: `Memoria` por "Brain", `Sin correo`/`Correo` por "Sin email"/"Email", `Conversaciones activas` por "Chats activos", `Buscar conversaciones…` / `Selecciona una conversación…` por "chats", `Mitchbot (IA)` por "(AI)", `responde desde el panel` por "dashboard", `Correo y contraseña son requeridos` por "Email y contraseña…".

### 📝 Documentación
- **AGENTS.md** actualizado con la sección v0.4.20.

### ✅ Verificación
- `vue-tsc` + `build` en verde; paridad es/en **635/635**; detector Impeccable sobre lo tocado en **0 hallazgos**; suite e2e completa **41/41** (cubre el modal de proyecto, el dropdown de idioma y los filtros de Clientes); capturas de verificación en escritorio (1440) y móvil (390) sin desborde horizontal.

---

## v0.4.19 — 2026-09-22

> 🕒 **Shell afinado**: reloj al topbar, título honesto, Configuración/Mi Perfil al menú del usuario y adiós al spanglish

### ✨ Añadido
- **Reloj en el topbar**: fecha y hora en formato largo del idioma activo (`Tue, Sep 22, 2026 12:33 PM` / `mar, 22 sept 2026 12:33`), **anclado al clúster derecho junto al botón de proyecto** (el `mx-auto` anterior lo recentraba y se movía al cambiar de vista), visible desde `1360px`, con `tabular-nums` y refresco cada 10s.
- **Configuración** en el menú del usuario del topbar, junto a **Mi Perfil** y **Cerrar sesión**.

### 🔧 Cambiado
- **Título de vista honesto**: el `page-title` deja de ser una cápsula blanca con sombra (se leía como otro botón) y pasa a **texto plano** Bricolage 19px.
- **Rail simplificado**: solo marca + navegación (Panel · Conversaciones · Clientes · Brain · Usuarios); se retiran la tarjeta de hora y los enlaces de Configuración/Mi Perfil.
- **Modo claro por defecto**: `useTheme` y el script inline de `index.html` arrancan en claro cuando no hay preferencia guardada (ya no consultan `prefers-color-scheme`); el toggle sigue persistiendo en `localStorage` (`mitchbot.theme`).
- **Fechas y horas de Conversaciones y de la bandeja** usan el **locale de la app** (antes `[]` = locale del navegador), eliminando meses/días en inglés bajo interfaz española.

### 🐛 Corregido
- **Brain**: la cabecera de conocimiento ya no muestra `Unknown`; el estado de sincronización se deriva de las fuentes (procesando / error / indexado / `sin fuentes`) y el recuento de fuentes usa el total real.
- **Spanglish del catálogo es**: `Registros` por "logs", `Copiar enlace` / `Enlace copiado` por "link", `Tokens máximos` por "Max tokens", `Palabras clave` por "Keywords", `barra lateral` por "sidebar", `chat de prueba` por "test chat", `Prueba` por "Test", `Reiniciar` por "Resetear" y `Mitchbot` por `BotMaster` como título por defecto.

### 📝 Documentación
- **DESIGN.md** y **AGENTS.md** actualizados: topbar con título plano + reloj junto al clúster derecho, rail sin Configuración/Mi Perfil ni turno, menú del usuario con Configuración, y arranque en claro por defecto.

### ✅ Verificación
- `vue-tsc` + `build` en verde; paridad es/en 622/622; detector Impeccable sobre lo tocado en **0 hallazgos**.

---

## v0.4.18 — 2026-09-22

> 🌙 **Tema oscuro y endurecimiento del critique**: Aurora de noche, errores que se ven y accesibilidad real

Cierre de la tanda completa de remediación del critique Impeccable (#1→#6): modo oscuro, estados de error con recuperación, tercer nivel de urgencia, accesibilidad y limpieza del sistema de componentes.

### ✨ Añadido
- **Tema oscuro "Aurora de noche"**: set de tokens propio en `style.css` (`data-theme="dark"`) que **recompone** el mundo (papel púrpura cálido, tinta clara, pasteles profundos, sombras más densas, `aurora-haze` tenue) en lugar de invertirlo. Toggle en el topbar (`data-testid="theme-toggle"`, iconos `Sun`/`MoonStars`), persistencia en `localStorage` (`mitchbot.theme`) y arranque desde `prefers-color-scheme` sin flash (script inline en `index.html`). `useTheme.ts` gestiona el tema y `useBrand` recalcula `--brand*`/`--focus` por tema (`brandDerivatives(hsl, theme)`).
- **Par de acción `--ink-solid` / `--ink-solid-contrast`**: el primario sólido sigue siendo "tinta" sin perder contraste al cambiar de tema.
- **Reintento visible**: Usuarios y Brain muestran el error con botón **Reintentar**; el polling de Brain deja de tragarse los fallos.
- **TestChat a prueba de fallos**: banner de error inline (`role="alert"`) con reintento, borrador conservado y anti doble-submit; el cambio de proyecto en el topbar también muestra su error.
- **Urgencia de 3 niveles cableada**: el nivel **Alta** (rojo) se enciende con una señal real (sentimiento negativo + último mensaje del cliente sin responder).
- **Alternativa textual del gráfico de volumen**: tabla `sr-only` con fecha/recuento; el SVG pasa a decorativo.
- **Anuncio acotado en el chat público** (`role="status"`): solo los mensajes del agente, no el hilo completo.

### 🔧 Cambiado
- **Usuarios** migrado al patrón de Clientes: búsqueda en vivo, cabeceras ordenables (`<th scope="col" :aria-sort>` con botón), paginación con primera/última + tamaño de página y estado de error.
- **Fechas y números** con el locale de la app (Usuarios, Clientes, Brain, logs).
- **`ASwitch`** acepta nombre accesible (`aria-label`); las 10 instancias de Configuración y Setup lo reciben.
- **`scope="col"`** en las tablas de Brain y Usuarios.
- **DESIGN.md**: sección de modo oscuro y par de acción; el topbar suma el control de tema; brief de superficie de Mensajería reescrito para Aurora.

### 🗑️ Eliminado
- 11 componentes UI sin uso (`ABand`, `ACallout`, `ACard`, `AChip`, `ADropdown`, `AField`, `AKpi`, `ASearch`, `AStat`, `ATable`, `ATab`).
- Variantes sin uso de `AButton` (`lilac`/`lime`/`sky`/`danger`) y tonos `solid-*` de `APill`; tokens huérfanos `--ok`/`--warn`.

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde; paridad es/en **621/621**; detector Impeccable sobre `src/` en **0 hallazgos**.

---

## v0.4.17 — 2026-09-22

> 📊 **Honestidad de datos y limpieza del Panel**: el gráfico se puede leer y el shell deja de fingir

Cierre de los "minors" que el critique dejó abiertos tras los arreglos de fondo.

### 🔧 Cambiado
- **Gráfico de volumen** (`Dashboard.vue`): se elimina `preserveAspectRatio="none"` (los marcadores ya no se estiran en elipses), se añade **eje Y real** (0 / mitad / máximo del rango), tooltip nativo por punto (`fecha: recuento`) y `role="img"` con nombre accesible.
- **Fuera el badge "En vivo"** sobre un valor que no se empuja por socket y la línea decorativa `Tráfico: 100%` del panel de canales.
- **Favicon de marca** inline en `index.html` (data-URI lila con "M") en vez de `/vite.svg`; `useBrand` lo sigue reemplazando en runtime.
- **Reloj del rail**: actualiza cada 10s (antes 30s).

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde; detector Impeccable sobre `src/` en **0 hallazgos**.

---

## v0.4.16 — 2026-09-22

> ♿ **Accesibilidad del "modo serio"**: teclado y foco en las acciones de alto riesgo

Cierre de los red flags que el critique marcó alrededor de la toma de control y la mensajería.

### 🔧 Cambiado
- **Clientes**: las cabeceras ordenables pasan de `<th @click>` a `<th scope="col" :aria-sort>` con un `<button>` interno — ahora operables por teclado y con estado anunciado.
- **Popover de notificaciones** (`AuroraTopbar`): al abrir recibe foco (`tabindex="-1"` + `nextTick`); Escape sigue cerrándolo.
- **Drawer del rail en móvil** (`AuroraRail` variant `mobile`): `role="dialog"` + `aria-modal`, foco al primer enlace al abrir, Tab atrapado y Escape para cerrar.
- **Conversaciones**: el hilo deja de ser `role="log"` global; un `role="status"` `sr-only` anuncia solo los mensajes entrantes del cliente (`messaging.a11y.incoming`).

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde; paridad es/en **608/608**; detector Impeccable sobre `src/` en **0 hallazgos**.

---

## v0.4.15 — 2026-09-22

> 🧠 **Brain como conocimiento**: el RAG deja de parecer un gestor de archivos

El critique señaló que el foso del producto (el RAG) se presentaba como una tabla genérica con tres tarjetas de stat al pie. La vista ahora lidera con lo que el bot sabe.

### ✨ Añadido
- **Cabecera de conocimiento** en Brain: vectores · fuentes · sincronización y una **cobertura (%)** con barra segmentada por estado (lime=indexado, mantequilla=procesando, cielo=en cola, rojo=error) y leyenda con recuentos reales.
- Etiquetas visibles en las acciones de fila ("Ver texto", "Logs", "Eliminar") desde `xl`, conservando `aria-label` y `title`.

### 🔧 Cambiado
- Claves `brain.knowledge.*` y `brain.sources.label{Extracted,Logs,Delete}` (es/en). Sustituyen a las tres tarjetas de stat genéricas.

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde; paridad es/en **607/607**; detector Impeccable sobre `src/` en **0 hallazgos**.

---

## v0.4.14 — 2026-09-22

> 🖐️ **Modo serio en Conversaciones**: tomar el control se confirma, se pinta en lila y se acusa

Tomar el control de una conversación era la acción más importante del producto y la menos confirmada: un click inmediato sin confirmación ni acuse, apenas distinguible del silencio.

### ✨ Añadido
- **Modal de confirmación** (`AModal`) antes de tomar el control y antes de devolvérselo al bot, con copy que nombra la acción y su consecuencia.
- **Acuse efímero** (`role="status"`, 4s) en el hilo tras el cambio de modo.
- Claves `messaging.mode.*` para los modales y acuses (es/en).

### 🔧 Cambiado
- **Botón de modo con semántica pastel**: "Tomar control" en lila (persona/control) y "Piloto automático" en neutro, alineado con `DESIGN.md`. La pill de la cabecera queda como estado de solo lectura.

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde; paridad es/en **600/600**.

---

## v0.4.13 — 2026-09-22

> 🛟 **Mensajería a prueba de fallos**: enviar, tomar control y guardar contacto ya no fallan en silencio

El critique detectó que las tres acciones de mayor riesgo de Conversaciones se tragaban el error en `console.error`. Ahora el operador ve el fallo, puede reintentar y no pierde el borrador.

### ✨ Añadido
- **Banner de error inline** en el hilo de Conversaciones (`role="alert"`, descartable) que aparece cuando fallan enviar un mensaje, cambiar el modo, guardar el contacto o analizar el sentimiento.
- Claves `messaging.errors.*` (`send`/`mode`/`contact`/`insights`) en `es.json` y `en.json`.

### 🔧 Cambiado
- **Borrador conservado**: si el envío falla, el texto vuelve al compositor.
- **Anti doble-submit**: nuevo estado `isSending` deshabilita el botón de enviar mientras hay un mensaje en vuelo.

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde; paridad es/en **592/592**.

---

## v0.4.12 — 2026-09-22

> 🫥 **Shell honesto**: el topbar deja de mostrar instrumentos falsos (controles muertos y métricas inventadas)

El critique Impeccable detectó un **P0** en el shell: `TopbarContext.vue` renderizaba instrumentos de vista con **datos inventados** y **sin handlers**. Se elimina el componente; los controles reales permanecen dentro de cada vista.

### 🗑️ Eliminado
- **`apps/frontend/src/components/layout/TopbarContext.vue`** y su import/uso en `AuroraTopbar.vue`. Sus cápsulas (`segmented` de rango/periodo, contadores `12 activas`/`61 trozos`, chips de canal, roles) no tenían `@click` y su selección era una expresión estática — decoración que violaba el Principio 3 de `PRODUCT.md`.

### 🔧 Cambiado
- **`AuroraTopbar`**: el topbar queda con **título de página + invariantes** (Proyectos · Idiomas · Notificaciones · Usuario), sin instrumentos decorativos. Los controles de cada vista (rango y granularidad en el Panel, filtros y page size en Clientes, stats en Brain, modo en Conversaciones) siguen en su superficie.
- **`DESIGN.md`** y **`AGENTS.md`**: la sección Layout deja de prometer instrumentos por vista en el topbar.

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde.

---

## v0.4.11 — 2026-09-22

> 📐 **Margen uniforme del shell**: las tarjetas dejan de pegarse al rail y todo el lienzo respira 14px en las cuatro direcciones

El contenedor de contenido y el topbar usaban `md:pl-[242px]`, dejando solo **4px** entre el rail (termina en 238px) y las tarjetas, frente a los **14px (3.5)** del resto del lienzo. Se tokeniza el shell y se unifica el respiro.

### ✨ Añadido
- **Tokens de shell** en `style.css`: `--shell-pad: 0.875rem` (14px), `--rail-w: 14rem` (224px) y `--rail-offset: calc(var(--rail-w) + 2 * var(--shell-pad))` (252px).

### 🔧 Cambiado
- **`AuroraRail`**: el ancho y los márgenes pasan a `w-[var(--rail-w)]` e `inset-y-[var(--shell-pad)] left-[var(--shell-pad)]`.
- **`DashboardLayout` y `AuroraTopbar`**: sustituyen `px-3.5 … md:pl-[242px]` por `px-[var(--shell-pad)] … md:pl-[var(--rail-offset)]` (con `pt`/`pb` tokenizados). Topbar y contenido comparten el token, por lo que ya no pueden desalinearse.
- **`DESIGN.md`**: la sección Layout documenta el margen uniforme `--shell-pad` y el gutter de 252px (corrige el `2rem`/230px previos).

### ✅ Verificado
- `vue-tsc --noEmit` y `build` en verde.
- Detector Impeccable (`--scope layout` sobre el shell y global sobre los archivos tocados): **0 hallazgos**.
- **Medición real en navegador del CSS construido** (1440): rail `[14, 14 → 238, 886]`, contenido a `252` → gutter rail–tarjeta **14px**; cápsulas y tarjetas comparten borde izquierdo (`Δ = 0`); topbar a 14px del borde. A 390/820/1440/3440 el margen es 14px uniforme y no hay overflow horizontal.

---

## v0.4.10 — 2026-09-22

> 🔎 **Modo enfoque en Conversaciones**: un toggle estrecha las tarjetas laterales para dar espacio al hilo

Se añade un control de **modo enfoque** en la cabecera del hilo de Conversaciones: al activarlo, la bandeja de entrada y la tarjeta de detalle del cliente se **estrechan** y el hilo gana ese ancho. El control es una cápsula con `aria-pressed` e icono Phosphor (`ArrowsOutSimple` → entrar, `ArrowsInSimple` → salir), con `title` que describe el efecto.

### ✨ Añadido
- **Toggle "Modo enfoque"** en la cabecera del hilo (`Messaging.vue`): visible solo en `lg+` (en móvil/tablet las laterales ya se ocultan), con etiqueta visible a partir de `xl`.
- **Rejilla adaptable**: `[minmax(320px,30%)_1fr_300px]` → `[minmax(248px,22%)_1fr_240px]` con enfoque activo (sin selección: la bandeja pasa a `minmax(248px,22%)`); transición de `grid-template-columns` de 300ms, respetando `prefers-reduced-motion`.
- **Persistencia en `localStorage`** (`mitchbot.messaging.focus`) para que la preferencia del operador sobreviva a recargas.
- **Iconos `ArrowsInSimple` / `ArrowsOutSimple`** en `AIcon.vue` (import + mapa canónico).
- Claves i18n `messaging.focus.toggle` / `messaging.focus.hint` en `es.json` y `en.json`.

### 🐛 Corregido
- **Desbordamiento de la fila de Urgencia** con el panel estrecho: el motivo ("conversación abierta") se salía 36px del panel a 1024px. Ahora la fila usa `flex-wrap` con `min-w-0` y el texto cae a una segunda línea en lugar de recortarse. Verificado: `scrollWidth === clientWidth` en el panel de detalle.

### ✅ Verificado
- `pnpm --filter @mitchbot/frontend exec vue-tsc --noEmit` y `pnpm --filter @mitchbot/frontend build` en verde.
- Detector Impeccable sobre los archivos tocados: **0 hallazgos** (exit 0).
- **Medición real en navegador** (stack de desarrollo en 3000/5173) a 1024/1180/1280/1440: el hilo gana ancho con enfoque en todos los casos (p. ej. 1280: `376px` → `508px`; 1440: `501px` → `656px`); en móvil (390px) el control no se muestra y el layout no cambia.
- Paridad de claves `es.json`/`en.json`.

---

## v0.4.9 — 2026-09-22

> 🔍 **Cierre del critique Impeccable**: Panel honesto, semántica de canal unificada, Conversaciones móviles y Configuración por tareas

Se implementan, en orden de impacto, los 8 arreglos del critique (`/impeccable critique`, 24/40) sobre Aurora. El foco: alinear la interfaz con su propio principio de **honestidad funcional** y unificar decisiones que el sistema ya había tomado.

### ✨ Añadido
- **`lib/channels.ts`**: mapeo único canal → pastel (`CHANNEL_META`) con helpers `channelMeta/channelTone/channelFill/channelInk/channelIcon`. WhatsApp=lima, Instagram=lila, Web=cielo en **Panel, Conversaciones y Clientes**.
- **Panel**: estado de error real con **Reintentar** (antes el `error` se capturaba y nunca se mostraba) y **skeleton** en las métricas mientras carga (ya no enseña ceros).
- **Confirmación de borrado en Brain** con `AModal` (antes era inmediato y destructivo), con nombre de la fuente e hint de irreversibilidad.
- **Editor JSON con `AModal`** para "Modificar" una herramienta en Conversaciones y en el chat público (reemplaza `window.prompt`/`window.alert`).
- **Banner inline de error** en Clientes (actualizar/archivar/restaurar) en lugar de `alert()`.
- **Configuración → Agente IA por tareas**: 6 subsecciones plegables (Identidad, Voz y tono, Conocimiento, Generación, Mensajes, Instrucciones) con `aria-expanded`/`aria-controls` y **barra de guardado pegajosa** con aviso de **cambios sin guardar**.

### 🔄 Cambios
- **Conversaciones en móvil**: se muestra bandeja **o** hilo (no ambos apilados) con **botón de regreso**; el panel de Detalles solo aparece en `lg+`. El grid de 2/3 columnas queda reservado para escritorio.
- **Títulos sin duplicar**: Users, Configuración y DevTests dejan de repetir un `<h1>` interno; el título vive solo en la cápsula del topbar (se conserva el subtítulo).
- **i18n**: Login traducido por completo (`login.headline.*`, `login.badges.*`, `login.accountsNote`); estados de conversación legibles (`messaging.details.status.*`) y estado de fuente en Brain traducido (`brain.status.*`).
- **Foco visible**: selects de filtros de Clientes y selector de idioma del topbar con anillo `focus-visible` de marca (ya no quedan sin indicador por `outline-none`).
- **Topbar**: el botón de menú móvil expone `aria-expanded` real (recibe `navOpen` desde `DashboardLayout`); se añade `data-testid="nav-toggle"`.
- **Rail**: la hora y el día usan el locale de la app (no el del navegador).
- **`AEmptyState`**: el CTA usa `AButton` (elimina estilos duplicados).

### 🗑️ Eliminado
- **Deltas inventados del Panel** (`+12%`, `+1.2%`, `+0.5%`) y la tarjeta **"Conversión de leads"** con valor fijo, hasta que el backend los provea.
- **Affordance muerta "Ver todo"** en Actividad reciente (sin handler).
- Claves i18n asociadas (`dashboard.stats.leadConversion`, `dashboard.activity.viewAll`) y la variable muerta `hasBrand` en Configuración.

### 🧪 Pruebas
- **Suite e2e al día**: se corrigen selectores que quedaron obsoletos tras refactors previos de Aurora y que mantenían la suite en rojo (título `BotMaster` en login, `role="tab"` en los tabs de Configuración, título del wizard, logout desde el menú del topbar, filas de la bandeja como `button`, indicador de notificaciones). Se añaden `data-testid="nav-toggle"`, `data-testid="conversation-unread"` y `data-testid="notification-dot"` para aserciones estables.
- **41/41 pruebas e2e en verde** (`pnpm test:e2e`).

### ✅ Verificado
- `pnpm --filter @mitchbot/frontend exec vue-tsc --noEmit` y `pnpm --filter @mitchbot/frontend build` en verde.
- Detector Impeccable sobre `apps/frontend/src`: **0 hallazgos** (exit 0).
- Suite e2e completa: **41/41** en verde.
- Paridad de claves `es.json`/`en.json` (586/586).

---

## v0.4.8 — 2026-09-22

> 📐 **Contenedor de contenido centrado**: el área principal se acota y centra en pantallas ultrawide

La estructura del dashboard no tenía ancho máximo: en monitores ultrawide el contenido se estiraba de borde a borde (tarjetas y gráficos enormes, tablas con columnas separadísimas) y en Configuración el formulario quedaba pegado a la izquierda con la mitad derecha vacía. Se implementa la norma de `DESIGN.md` (contenido a **1400px centrado**) en la estructura general, de modo que aplica a todas las vistas actuales y futuras.

### 🔄 Cambios
- **`DashboardLayout`**: el `<main>` envuelve el slot en `mx-auto w-full max-w-[1400px]`. Centra y acota Panel, Conversaciones, Clientes, Brain, Usuarios, Configuración, Mi Perfil y DevTests (y cualquier vista futura).
- **`AuroraTopbar`**: la fila de cápsulas se envuelve en el mismo contenedor (`max-w-[1400px]`), de forma que el título de página, los instrumentos de la vista y los invariantes quedan alineados con el contenido centrado.
- **Configuración**: la columna (título, banners, tabs y paneles) se centra en `max-w-3xl`; se retiran los `max-w-*` internos para que todo comparta el mismo ancho centrado. Los tabs se estrechan o envuelven a medida que se añaden items.
- **Panel**: la rejilla de métricas pasa de `lg:grid-cols-4` a `repeat(auto-fit, minmax(240px, 1fr))`: al añadir métricas se agregan columnas (o se estrechan las tarjetas) en vez de fijarse en cuatro.

### ✅ Verificado
- Capturas en 3440 (ultrawide), 1440, 820 y 390: contenedor centrado y alineado con el topbar; tabs, tabla y métricas correctas.
- `vue-tsc --noEmit` y `pnpm --filter @mitchbot/frontend build` en verde.
- Detector Impeccable sobre los archivos tocados (`DashboardLayout.vue`, `AuroraTopbar.vue`, `Settings.vue`, `Dashboard.vue`): **0 hallazgos**.

---

## v0.4.7 — 2026-09-22

> ♿ **Endurecimiento de Aurora**: foco visible, navegación móvil, diálogos accesibles, i18n del rail y limpieza de deuda del sistema

Auditoría Impeccable `audit` sobre Aurora: **12/20 → trabajo de endurecimiento**. Se cierran los 5 hallazgos P1 y los P2/P3 de mayor valor sin tocar la identidad visual.

### ✨ Añadido
- **Navegación móvil**: el topbar incorpora una cápsula de menú (visible <768px) que despliega el rail como drawer flotante con backdrop; el rail ahora emite `navigate` y se cierra al elegir sección. Antes el rail desaparecía sin alternativa.
- **`AModal.vue`** (`components/ui/`): diálogo reutilizable con `role="dialog"`, `aria-modal`, `aria-label`, **focus trap**, cierre con `Escape`, foco inicial y restauración del foco al cerrar. Reemplaza los 6 overlays manuales de Usuarios, Clientes y Brain.
- **Skip-link** "Saltar al contenido" (i18n `a11y.skipToContent`) y `id="main-content"` en el layout.
- **`lib/markdown.ts`**: `renderMarkdown` compartido que **escapa el HTML** antes de aplicar negritas/itálicas y saltos de línea.

### 🔄 Cambios
- **Foco visible con contraste garantizado**: nuevos tokens `--focus` y `--focus-halo`; `useBrand` deriva la familia `--brand*` con *clamping* real (`brandDerivatives`) para que `--brand-soft` deje de saturar a blanco en marcas claras. El foco global, `.field` y los inputs con `outline-none` (anillo `focus-visible`/`focus-within`) ya no quedan invisibles. Corrige además el `--brand-h` estático (270) y `--brand-ink` contra el `DESIGN.md`.
- **i18n del rail**: las etiquetas del nav usan `nav.*` (antes hardcodeadas en español); `nav.primary` para el `aria-label`. Se añaden `common.clear`, `common.firstPage/lastPage`, `nav.primary`, `a11y.skipToContent`.
- **Icono Brain arreglado**: se importa `PhBrain` en `AIcon` (antes caía a un círculo genérico).
- **Menús del topbar accesibles**: Proyectos/Notificaciones/Usuario con `aria-haspopup`/`aria-expanded`, `role="menu"`/`menu` o `dialog`, `role="menuitem"`, cierre con `Escape` y cierre mutuo al abrir otro.
- **`ATabs`**: `tabindex` móvil (`0`/`-1`) y navegación por flechas/Home/End.
- **Mensajería y chat público**: contenedores `role="log"` + `aria-live="polite"`, cargando con `role="status"`.
- **Botones-icono** de tablas (Clientes, Usuarios, Brain) y paginación con `aria-label` explícito; overlays de paleta vía token `--overlay` (fuera `bg-black/40`).
- **`prefers-reduced-motion`**: se desactivan animaciones/transiciones; `transition-all` de `.btn` y de los envíos pasa a transiciones de propiedades concretas.

### 🧹 Limpieza
- **Tokens Tailwind muertos** retirados: bloque shadcn (`border/input/ring/primary/...`), remapeo `blue`, `brand: "hsl(var(--brand) 0 0)"` inválido, `darkMode`, radios `--radius`, keyframes de acordeón y el plugin `tailwindcss-animate`. Se documenta `brand-*`, `line-strong` y la rampa `fontSize` real.
- **Dependencias sin uso eliminadas**: `class-variance-authority`, `clsx`, `lucide-vue-next`, `radix-vue`, `tailwind-merge`, `tailwindcss-animate`; se elimina `src/lib/utils.ts`.
- **`DESIGN.md`**: se declara la rampa tipográfica real (`typography.*`) y se reescribe `Hierarchy`, de modo que las 146 advertencias `design-system-font-size` del detector quedan cubiertas.

### ✅ Verificado
- `vue-tsc --noEmit` y `pnpm --filter @mitchbot/frontend build` en verde.
- Detector Impeccable sobre `src/`: **0 hallazgos** (antes 148 advisory).

---

## v0.4.6 — 2026-09-21

> 🏛️ **«Aurora» pasa de mock a sistema**: tokens + componentes base + shell de cápsulas flotantes implementados, y el prototipo rehecho a fidelidad real con las etiquetas del producto

---

### ✨ Añadido
- **Sistema de diseño Aurora implementado** (`apps/frontend/src/style.css` + `tailwind.config.js`): reemplaza a «App Cálida» como mundo del código. Lienzo cálido `#F7F3EF`, tinta negra `#0B0B0C`, familia pastel semántica (cielo=Web, lima=bot, lila=persona, mantequilla=espera), radios 20/28/16px, sombras difusas de dos capas y utilidades nuevas (`canvas`, `surface`, `sunken`, `line`, `ink-1/2/3`, `sky/lime/lilac/butter`, `rounded-card/big/field`, `font-display/body`, `shadow-card/pop`, escala de spacing 4.5/8.5/9.5/10.5/13).
- **Tipografía propia**: Bricolage Grotesque (display; ejes `opsz`/`wdth`/`wght`) + Hanken Grotesk (cuerpo, cifras tabulares), cargadas en `index.html` en lugar de Nunito y Material Symbols.
- **Iconografía Phosphor** (`@phosphor-icons/vue`): dependencia nueva, envuelta en `src/components/ui/AIcon.vue` con los 6 pesos, `fill` para el nav activo y un mapa de nombres Material heredados para migrar vistas sin tocar el set. Retira la webfont de Material Symbols (~3 MB).
- **Componentes base** (`apps/frontend/src/components/ui/`): `AIcon`, `AButton`, `APill`, `AChip`, `ACard`, `AStat`, `ATable`, `AAvatar`, `AField`, `ASearch`, `ASwitch`, `ATab`, `ATabs`, `ADropdown`, `AEmptyState`, `ABubble`, `ABand`, `ACallout`, `AKpi`.
- **Shell Aurora** (`apps/frontend/src/components/layout/`): `AuroraRail.vue` (rail flotante con marca, nav de dos grupos y tarjeta de turno), `AuroraTopbar.vue`, `TopbarContext.vue` (instrumentos por vista) y `AuroraLayout.vue`, que compone rail + topbar + niebla `aurora-haze`.
- **Topbar de cápsulas flotantes**: deja de ser barra (sin fondo, borde ni blur); cada item es su propia pieza sobre el lienzo. Izquierda dinámica por vista (título de página + rango/granularidad, contadores y modo, filtros de canal, vectores, roles), derecha invariante (Proyectos · Idiomas ES/EN · Notificaciones · Usuario).
- **Menú de usuario en el topbar**: se mueve del pie del rail a una cápsula fija a la derecha con dropdown (Mi Perfil / Cerrar sesión). El selector de proyectos y de idiomas viven también en el cluster derecho.

### 🔄 Cambios
- **`useBrand.ts`**: color por defecto pasa de `#E86A33` a `#E2C6FF` (lila Aurora) y el favicon se dibuja con Bricolage Grotesque. El acento `--brand*` se reinterpreta como **identidad y selección** (item activo, avatar, punto de proyecto, foco), no como primario de acción — el primario es tinta negra.
- **`DESIGN.md` + `.impeccable/design.json`**: re-documentados para Aurora (tokens, reglas nominadas, iconografía Phosphor, firma de cápsulas y de burbuja).
- **Prototipo Aurora rehecho a fidelidad real** (`apps/frontend/.impeccable/mocks/aurora/`): 12 vistas con las etiquetas reales del producto (Panel · Conversaciones · Clientes · Brain · Usuarios · Configuración · Mi Perfil) y datos marcados como sintéticos; se elimina `agentes.html` porque Agents no está ruteado. Corrige fabricaciones del mock anterior (rail «Agente», etiquetas inventadas, topbar con fondo).
- **Responsive del prototipo**: por debajo de 1024px el rail se oculta y las rejillas colapsan; por debajo de 640px el topbar apila su cluster, el hilo envuelve sus acciones y las burbujas de herramienta no desbordan.

### ✨ Añadido (migración de vistas reales — 2ª tanda)
- **Migración completa de las vistas del dashboard a Aurora**: `Dashboard.vue` (stats, rango 7/30/90, volumen SVG, canales, actividad), `Messaging.vue` (3 columnas bandeja/hilo/detalles, `ABubble`, tarjeta de **Sentimiento**, bloque de **Urgencia**, mensajes de herramienta), `Clients.vue` (tabla, filtros, orden, paginación y modales), `Brain.vue` (stats, tabla de fuentes, dropzone y modales), `Users.vue`, `Profile.vue`, `Settings.vue` (tabs Agente IA · Información · Canales · Opciones + identidad de marca con swatches Aurora), `Login.vue`, `ProjectSetup.vue` (3 pasos), `TestChat.vue` y `DevTests.vue`. **Cero clases `warm-*`** restantes en el código.
- **Tarjeta de Urgencia en Conversaciones**: UI con placeholder (sin tocar backend), traducida en `messaging.urgency.*` (es/en).
- **Ajustes finos del shell**: marca centrada en el rail **sin subtítulo**, **iconos Phosphor** en el nav, y **pie del rail** con hora, día de la semana y fecha `DD/MM/AAAA` (reactivo con `setInterval`). El contenedor de contenido deja de centrarse con `max-w-[1400px]` y el `md:pl-[242px]` se aplica siempre para que nada quede bajo el rail flotante.
- **`Messaging.vue`**: layout `h-full min-h-0` con grid condicional de 3 columnas (con chat) vs 2 columnas (estado vacío).

### 🔄 Cambios (migración de vistas reales)
- Se eliminan `Sidebar.vue`, `Topbar.vue` y `Agents.vue` (sin uso/ruta); `AuroraLayout.vue` no se reintroduce (el shell vive en `DashboardLayout.vue`).

### ✅ Verificado
- `vue-tsc --noEmit` y `pnpm --filter @mitchbot/frontend build` en verde; bundle bajó de **6 MB a 559 KB** tras los imports explícitos de iconos en `AIcon.vue`.
- Detector mecánico Impeccable sobre `ui/` y el shell: 0 hallazgos no-advisory (los `design-system-font-size` son advisory y quedan cubiertos por la rampa documentada en `DESIGN.md`).
- Capturas e2e sobre las vistas reales (stub IA `:4010`, backend `:3100`, frontend `:5174`, seed `e2e@mitchbot.test`): Panel, Conversaciones, Clientes, Brain, Usuarios, Configuración y Mi Perfil sin desbordes, sin contenido bajo el rail flotante y con el topbar cambiando de items por vista.

### 📝 Notas
- El **Resumen (Dashboard) se conserva tal cual** (datos reales del backend) para adaptarlo con más fidelidad en una tanda posterior. La persistencia de `project.config.brand` sigue como decisión abierta hacia el backend.

## v0.4.5 — 2026-09-21

> 🎨 **Dos mundos nuevos de exploración («Aurora» y «Bóveda») con prototipo completo de 12 vistas, y un comparador que reúne todos los mundos**

---

### ✨ Añadido
- **Mundo «Aurora»** (`apps/frontend/.impeccable/mocks/aurora/`): reconstrucción del mundo pastel optimista de **orivo.webflow.io** — suelo cálido `#F7F3EF`, tinta negra, tipografía enorme (Instrument Sans + Inter), tarjetas de 20px sin borde y todo en píldora. Familia de pasteles con papel semántico (azul = canal Web, lima = bot, lila = persona, mantequilla = algo que espera). Prototipo navegable de las 12 vistas (`_gen.py` + `style.css` + `_shell.html` + `index.html`).
- **Mundo «Bóveda»** (`apps/frontend/.impeccable/mocks/boveda/`): reconstrucción del mundo cool premium de **per-ment.webflow.io** — blanco frío `#F9F7FE`, azul noche `#181D2A`, violeta único `#6638ED`, rejilla vertical fina sobre el fondo, navegación en cápsula flotante y serif itálica (Playfair Display) para el énfasis de los titulares. Prototipo navegable de las 12 vistas.
- **Comparador de mundos** (`apps/frontend/.impeccable/mocks/comparador.html`): tablero que reúne los 12 mundos de las 4 rondas con su ADN (paleta, tipografía, forma, clima), su origen y el enlace a cada prototipo; señala en qué ronda está cada uno y cuál está fijada.

### 🔄 Cambios
- Se conservan intactos `mocks/ejemplos/` (rondas 1–3) y `mocks/rediseño/` (Mesa de Exposición, fijada).

### ✅ Verificado
- Detector mecánico Impeccable sobre los dos mundos y el comparador: contraste del texto secundario corregido (de 234 avisos `low-contrast` a 7, de los que 6 son falsos positivos por gradientes/variables no resolubles) y tamaños del comparador subidos al suelo de 11px.
- Capturas de escritorio (1440×900) de dashboard, mensajería, clientes, conocimiento, ajustes, usuarios, alta, login y chat público de ambos mundos: sin desbordes ni vistas en blanco.

### 📝 Notas
- Ninguno de los dos mundos nuevos es un compromiso: son material de comparación. «Mesa de Exposición» sigue fijada y **aún no migrada** al código del frontend.

## v0.4.4 — 2026-09-21

### 🔄 Verificado
- **Re-ejecución de `$impeccable document` (modo scan, refresh)** sobre el mundo "App Cálida": los tokens de `apps/frontend/src/style.css`, `tailwind.config.js` y `useBrand.ts` coinciden 1:1 con el frontmatter de `DESIGN.md` y el sidecar `.impeccable/design.json` (sin drift). El sistema congelado se mantiene intacto; se refrescó el `generatedAt` del sidecar. Sin cambios de valores ni de estilos.

## v0.4.3 — 2026-09-21

> 📐 **El sistema "App Cálida" queda documentado**: `DESIGN.md` + sidecar de tokens para que cualquier agente genere pantallas on-brand

---

### ✨ Añadido
- **`apps/frontend/DESIGN.md`**: documentación del mundo visual "App Cálida" extraída en modo scan del código real (`style.css`, `tailwind.config.js`, `useBrand.ts`) — tokens normativos en frontmatter YML, colores con carácter ("Naranja Mandarina", "Suelo Papel"), reglas nominadas (La Regla de una Voz, La Regla del Suelo Cálido, La Regla del Sello, La Regla Sin Halo), componentes y Do's/Don'ts. Incluye nota de dirección: el sucesor "Mesa de Exposición" (v0.4.2) está decidido pero no migrado.
- **`apps/frontend/.impeccable/design.json`** (sidecar schemaVersion 2): tonal ramps por color, sombras/motion/breakpoints y 6 componentes autocontenidos (botón primario, ghost, campo, tarjeta, sello de estado y burbuja de chat) renderizables en shadow DOM.
- No se modificó ningún estilo ni componente: es documentación del sistema congelado.

---

## v0.4.2 — 2026-09-21

> 🎨 **Rediseño total decidido: mundo "Mesa de Exposición"** (estructura de Mesa de Señales + material de Ficha de Exposición), con prototipo navegable de todas las vistas antes de migrar

---

### ✨ Añadido
- **Decisión visual del rediseño total**: después de 4 rondas de tiradas Impeccable (y ejemplos HTML servidos en local), el usuario fijó la fusión **Mesa de Exposición**: topología de tablero de despacho (circuitos, lámparas de estado, llave de toma de control) + materialidad de ficha de imprenta (papel de calco, carga por hatching, magenta como único acento de acción/humano, regla tachada al cerrar, cruz 90° para conflictos).
- **Contrato de dirección** persistido en `.agents/skills/impeccable` surface brief (`apps/frontend/.impeccable/surfaces/…`) + `PRODUCT.md` mantenido.
- **Prototipo completo navegable en `apps/frontend/.impeccable/mocks/rediseño/`**: 12 vistas de ejemplo (login, setup 3 pasos, tablero, mensajería, clientes, cerebro/RAG, agentes, ajustes, usuarios, perfil, chat público, banco de pruebas) con sistema compartido `style.css`. **No toca el código real del frontend**: es material de decisión previo a la migración.
- **Ejemplos de rondas anteriores** conservados en `mocks/ejemplos/` (mesa-senales, centralita, ficha-exposicion, libro-mayor, periodico, grafita, cabina, horario, secuenciador) para trazabilidad del proceso.

### 🗺️ Decisiones abiertas (para la migración)
- La identidad de marca por proyecto (nombre, color, logo) aún requiere backend: persistencia en `project.config.brand` pendiente de diseño.
- El reemplazo de vistas se aplicará por vista en la migración real; Messaging es la superficie primaria.

---

## v0.4.1 — 2026-09-21

> 🔔 **El contador de no leídos deja de "resucitar": solo suma mensajes del cliente, la lectura se persiste y la bandeja ya no autoselecciona un chat**

---

### ✨ Añadido
- **Endpoint de lectura** `PUT /api/conversations/:id/read`: persiste `unreadCount = 0` acotado al proyecto (404 si no coincide, 403 si es de otro proyecto) y emite `chat:read` a la room del proyecto para sincronizar el badge entre sesiones.
- **Evento WebSocket `chat:read`**: una sesión notifica que marcó una conversación como leída y el resto actualiza su badge sin recargar.
- **Room de dashboard por proyecto** (`project:<id>:dashboard`): los sockets autenticados se unen a ella y los mensajes del cliente se entregan ahí (excluyendo la conversación abierta), de modo que el sidebar incrementa el contador en vivo para conversaciones **no abiertas** sin exponer conversaciones ajenas a los clientes públicos.
- **Script one-off** `scripts/reset-unread-counts.ts` para resetear los `unreadCount` contaminados existentes.

### 🔄 Cambios
- **Solo el cliente suma**: el `unreadCount` se incrementa únicamente con mensajes entrantes del cliente (`contact`); las respuestas del bot (directas y tras herramientas) y los mensajes del agente humano ya **no** suman.
- **Lectura persistente**: abrir una conversación llama a `PUT /:id/read` (además de poner el contador local a cero), así que la lectura sobrevive a recargar la página.
- **Estilo WhatsApp**: un mensaje entrante en la conversación abierta se re-marca como leída de inmediato, sin que el badge suba.
- **Sin selección por defecto**: al entrar a Messaging ya no se autoselecciona la primera conversación; se muestra el estado vacío hasta que el agente elija una. Se conserva el deep-link `?conversation=<id>`.
- **Alta de conversación**: una conversación nueva creada por el cliente nace con 1 no leído (se eliminó el doble conteo del mensaje inicial).

### 🧪 Pruebas
- `messaging.spec.ts`: casos nuevos que cubren que el mensaje del cliente sube el badge y se persiste al recargar, que un mensaje del bot/agente humano no incrementa, que entrar sin `?conversation=` no selecciona nada y que el deep-link selecciona la conversación correcta.

### 📚 Documentación
- `AGENTS.md` (regla de no leídos, `PUT /:id/read`, evento `chat:read`, room de dashboard, sin selección por defecto) y `changelog.md` actualizados. Versión del proyecto a **v0.4.1**.

---

## v0.4.0 — 2026-09-19

> 🎨 **Rediseño visual completo de la plataforma: sistema de diseño cálido con identidad de marca personalizable**

---

### ✨ Añadido
- **Sistema de diseño "App Cálida"** (`style.css`): paleta de tokens CSS (`--ground`, `--surface`, `--hairline`, `--ink-1/2/3`) con suelo cálido, tinta parda y un único acento de acción. Tipografía Nunito, radios por rol (`--r-card`, `--r-bubble`, `--r-seal`), sombras difusas y componentes base (`.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.field`, `.stamp`). Scrollbar y estados de foco templados al mundo.
- **Identidad de marca por proyecto**: nueva sección en Configuración para personalizar **nombre, color de marca y logo** (sección "Identidad"). El backend valida `config.brand` con Zod (color HEX, logo hasta 200 KB en `createProjectSchema` y `updateProjectSchema`).
- **Composable `useBrand`**: aplica el color de marca como variables HSL del proyecto (`--brand-h/s/l`) con variantes derivadas (`--brand-hover`, `--brand-deep`, `--brand-soft`, `--brand-softer`, `--brand-ink`, `--brand-contrast` con contraste automático según luminancia), teñido del favicon con canvas y carga el config del proyecto al iniciar.
- **Actualización**: favicon dinámico teñido con color de marca.

### 🔄 Cambios
- **Layout renovado**: `Sidebar`, `Topbar`, `DashboardLayout`, `App.vue` e `index.html` migran al nuevo sistema visual y consumen la identidad del proyecto (nombre y logo en el shell).
- **Módulo de Mensajería** y **Settings** rediseñados con los tokens del sistema (burbujas, composer, panel de insights, panel de identidad).
- **Compatibilidad con vistas legacy**: las clases `blue-*` de Tailwind se mapean al acento de marca y las utilidades `warm-*` exponen los tokens del mundo, permitiendo migrar vistas gradualmente.

### 🐛 Corregido
- **Fondo de burbuja en el chat (Messaging)**: los mensajes salientes (bot/agente humano) no tenían fondo; ahora usan el acento de marca con texto en color de contraste.

---

## v0.3.10 — 2026-09-19

> 💬 **El bot responde de una vez, los insights dejan de resumir y desde cada cliente se abre su conversación**

---

### ✨ Añadido
- **Ver conversación desde Clients**: cada fila con conversación ofrece una acción que abre la bandeja con esa conversación preseleccionada (`/messaging?conversation=<id>`). La conversación se resuelve en el servidor por `contactId` (`GET /api/conversations?contactId=<id>`, validado y acotado al proyecto), prefiriendo la activa y, en su defecto, la más reciente. Si el cliente no tiene conversación vinculada, la acción no se muestra.
- **Preselección en la bandeja**: `Messaging.vue` lee `route.query.conversation`, selecciona esa conversación (cargándola del servidor si no está entre las del listado) y aplica el fallback por defecto si no es válida, sin error visible.

### 🔄 Cambios
- **Respuesta del bot como mensaje completo**: se deja de emitir fragmentos parciales (`isDone: false`) en la respuesta directa y en la posterior a herramientas. El placeholder vacío sostiene el indicador de escritura y la respuesta llega completa en un único mensaje final (`isDone: true`); `Messaging.vue`, `TestChat.vue` y `useConversations` aplican únicamente el mensaje final.
- **AI Insights sin resumen**: el análisis produce únicamente sentimiento y su distribución. El resumen se retira del prompt, del tipo, de la validación, de la persistencia, del modelo de datos, de la tarjeta del panel y de los catálogos `es.json`/`en.json`. `GET /:id/insights` devuelve solo sentimiento y `sentimentScores` (aunque existan resúmenes antiguos) y el recálculo limpia `aiInsights.summary` con `$unset`.

### 🧪 Pruebas
- `realtime.spec.ts` ahora espera un único mensaje final con `isDone: true` y verifica que no hay fragmentos parciales.
- `messaging.spec.ts` valida el sentimiento por API y su etiqueta visible, y que no se devuelve resumen; el stub e2e deja de producir `summary`.
- `contacts.spec.ts` cubre abrir la conversación desde una fila y que un cliente sin conversación no muestra la acción (fixture de contacto sin conversación en el seed e2e).

### 📚 Documentación
- `AGENTS.md` (respuesta como mensaje completo, insights solo sentimiento, acceso a la conversación desde Clients, contrato de `chat:message_chunk`, filtro `?contactId=`) y `changelog.md` actualizados. Versión del proyecto a **v0.3.10**.

---

## v0.3.9 — 2026-09-19

> 🔒 **El Dashboard deja de mezclar datos de todos los proyectos: métricas autenticadas y acotadas al proyecto activo**

---

### 🔒 Seguridad
- **Endpoints del dashboard autenticados**: `GET /api/dashboard/stats|volume|channels|activities` ahora exigen token JWT (middleware `authenticate`) y resuelven el proyecto por petición (`X-Project-Id` o `activeProjectId`); sin credenciales responden `401`.

### 🐛 Corregido
- **Aislamiento por proyecto en las métricas**: `analyticsService.getStats`, `getVolume`, `getChannelDistribution` y `getRecentActivity` reciben `projectId` y lo incorporan a todos sus filtros (`countDocuments`, `$match`, `find`), combinándolo con el rango de fechas. La tarjeta "Conversaciones totales" ya no mezcla datos de otros proyectos.
- **Servicio de dashboard del frontend**: los cuatro métodos de `dashboard.service.ts` envían `Authorization` y `X-Project-Id` vía `authService.getHeaders()`, por lo que al cambiar de proyecto las métricas se recalculan para el nuevo proyecto.

### 🧪 Pruebas
- Spec e2e del dashboard ampliado: crea dos proyectos dedicados, genera tráfico en uno y comprueba que las métricas del otro no se alteran; además verifica que una petición sin autenticación es rechazada (`401`). Suite `pnpm test:e2e dashboard` en verde (4/4).

### 📚 Documentación
- `AGENTS.md` (endpoints del dashboard autenticados y acotados al proyecto) y `changelog.md` actualizados. Versión del proyecto a **v0.3.9**.

---

## v0.3.8 — 2026-09-19

> 🌐 **La interfaz deja de mezclar idiomas: i18n con español por defecto e inglés, selector en vivo y chat público con idioma propio**

---

### ✨ Añadido
- **Internacionalización (vue-i18n)**: catálogos `locales/es.json` y `locales/en.json` con claves por dominio, español por defecto y fallback a español. El plugin se registra en `main.ts` en modo Composition API.
- **Selector de idioma en el Topbar**: aplica el idioma en vivo a todo el dashboard sin recargar y persiste la preferencia en `localStorage` (`mitchbot.locale`); el atributo `lang` del documento refleja el idioma activo.
- **Chat público con idioma propio**: `TestChat.vue` usa un composer aislado y claves `publicChat.*`, y toma el idioma de la personalidad del agente del proyecto (nuevo endpoint público `GET /api/public/test-chat/:slug/config`); el idioma del dashboard no lo altera.
- **Spec e2e de idioma** (`i18n.spec.ts`) y caso de independencia del chat público respecto a la preferencia del dashboard.

### 🔄 Cambios
- **Todos los textos visibles del dashboard externalizados** a los catálogos: shell (`Sidebar`, `Topbar`), `Dashboard`, `Messaging`, `Clients`, `Brain`, `Settings`, `Users`, `Agents`, `Profile`, `DevTests`, `Login` y `ProjectSetup`. El shell pasa de inglés a español por defecto; se elimina el "spanglish".
- **`data-testid`** añadidos al título de página, la navegación del sidebar, las métricas y los controles de rango/granularidad del Dashboard para estabilizar los e2e.

### 🧪 Pruebas
- Specs e2e alineados al español por defecto y estabilizados con `data-testid`; nuevo `i18n.spec.ts` (español por defecto, cambio a inglés, `lang` y persistencia) y verificación de que el chat público conserva el idioma del agente.

### 📚 Documentación
- `AGENTS.md` (frontend: vue-i18n, catálogos es/en, selector en Topbar, idioma del chat público) y `changelog.md` actualizados. Versión del proyecto a **v0.3.8**.

---

## v0.3.7 — 2026-09-19

> 🧭 **La navegación deja de mezclar nombres, los controles de fecha por fin filtran de verdad y el centro de notificaciones deja de estar muerto**

---

### ✨ Añadido
- **Rango de fechas real en el Dashboard**: control de últimos 7/30/90 días (30 por defecto) que recalcula métricas, canales y volumen; los toggles Diaria/Semanal/Mensual cambian la granularidad del volumen y el gráfico se dibuja con los datos del rango.
- **Centro de notificaciones en el Topbar**: escucha `admin:notification` (emitido por la tool `send_notification`), acumula las notificaciones en estado local, muestra el indicador solo si hay no leídas y permite marcarlas como leídas o limpiarlas (alcance de sesión).
- **Backend de analítica ampliado**: `analytics.service`/`dashboard.controller` aceptan `days` o `from`/`to` y `period = daily | weekly | monthly`; `getStats`, `getVolume` y `getChannelDistribution` filtran por rango.
- **Script de normalización** `normalize-agent-language.ts`: migra los agentes con idioma `pt`, `auto` o ausente a español.

### 🔄 Cambios
- **Nomenclatura de módulos**: el sidebar y el Topbar muestran **"Brain"** (antes "Brain & RAG") y **"Clients"** (antes "Contacts"); la ruta pasa a `/clients` con redirección desde `/contacts`. Se renombran `views/Contacts.vue` → `views/Clients.vue` y `services/contact.service.ts` → `client.service.ts`; la API `/api/contacts`, la colección y los tipos internos no cambian.
- **Textos visibles del módulo de clientes** ("contacto" → "cliente") en búsqueda, tabla, modales y mensajes de error.
- **Se elimina el widget estático "Last 30 Days"** del Topbar (era UI muerta).
- **Idioma del agente restringido a `'es' | 'en'`**: se ajustan el tipo `AgentPersonality['language']` (frontend y backend), el `z.enum` de `agents.controller.ts` y `LANGUAGE_MAP` de `prompt-builder.service.ts`; se eliminan Portugués y "Detectar" de `Settings.vue`. Un idioma distinto de español/inglés se rechaza con error de validación y los valores obsoletos degradan a español.

### 🧪 Pruebas
- **e2e**: redirección `/contacts` → `/clients`, spec de clientes actualizado, cobertura de rango/granularidad en el Dashboard, nuevo spec del centro de notificaciones y verificación de que solo se ofrecen Español/Inglés y que el backend rechaza un idioma inválido.
- **Stub de IA** ampliado con el disparador `NOTIFICAR` → tool `send_notification`.
- Suite e2e completa en verde (32/32) y pruebas de integración del backend en verde (25/25).

### 📚 Documentación
- `AGENTS.md` (nueva sección "Shell y navegación", módulo de clientes, idioma del agente es/en y estructura del frontend) actualizado. Versión del proyecto a **v0.3.7**.

---

## v0.3.6 — 2026-09-19

> 🧹 **La bandeja de mensajería deja de aparentar: cada control funciona o desaparece, y llegan los AI Insights reales**

---

### ✨ Añadido
- **Filtros por canales habilitados**: los chips de canal se generan desde `project.config.channels` (solo los habilitados + "Todos") y filtran la lista por plataforma; un canal deshabilitado no aparece.
- **Búsqueda de conversaciones** por nombre del cliente y contenido del último mensaje (sin distinguir mayúsculas); vaciar restaura la lista.
- **Agrupación de mensajes por día** con encabezados reales ("Hoy", "Ayer", fecha), en orden cronológico.
- **Toma de control manual bidireccional**: `PUT /api/conversations/:id/mode` expuesto en `messagingService.updateConversationMode`; "Take Over" ↔ "Auto-Pilot" actualiza el badge sin recargar y el bot no responde en `human_takeover`.
- **Guardar cliente como contacto**: `POST /api/conversations/:id/contact` respaldado por `ensureContactCreated(id, { force: true })`; idempotente y funcional aunque `autoCreateContact` esté deshabilitado.
- **Conteo de no leídos real** en el sidebar mediante el composable `useConversations` (estado de módulo compartido), con incremento en vivo por `chat:message` y `chat:new_conversation`.
- **AI Insights reales**: nuevo `services/insights.service.ts` que analiza la conversación con `OPENROUTER_INSIGHTS_MODEL` (fallback a `OPENROUTER_LLM_MODEL`), valida `{ sentiment, sentimentScores, summary }`, lo persiste en `conversation.aiInsights` y lo emite por `chat:insights`. `GET /:id/insights` lee lo almacenado y `POST /:id/insights` recalcula; el panel del dashboard muestra sentimiento, distribución y resumen, con estado vacío y actualización en vivo.
- **Análisis automático fire-and-forget** tras cada respuesta del bot (fallo silencioso que no afecta la respuesta).

### 🔄 Cambios
- **Compositor honesto**: se eliminan chips de sugerencia, emoji, adjuntos, imagen, botón de filtro, menú de tres puntos, indicador "online" simulado y badge de confianza; solo quedan las acciones funcionales (enviar y tomar control).
- **`ensureContactCreated()`** acepta `{ force }` y devuelve el contacto con su estado de creación, manteniendo la búsqueda idempotente por identificador + proyecto.
- **Evento de socket `chat:insights`** para la actualización en vivo de los insights.

### 🐛 Corregido
- **Respuestas fuera de orden en Contactos**: `fetchContacts()` ignora respuestas obsoletas cuando varios filtros disparan fetches seguidos (la concurrencia extra introducida por el fetch del sidebar lo exponía).

### 🧪 Pruebas
- Nuevos specs en `messaging.spec.ts`: filtros de canal + búsqueda, guardar contacto idempotente con auto-creación deshabilitada, toma de control bidireccional (con bot en pausa) e insights automáticos/manuales.
- Stub de IA ampliado con respuesta JSON determinista para el análisis de insights (`INSIGHTS_JSON`); seed e2e con un segundo proyecto `e2e-nocontact` sin auto-creación de contactos y canales con Instagram deshabilitado.
- Suite e2e completa en verde (28/28) y pruebas de integración del backend en verde (25/25).

### 📚 Documentación
- `AGENTS.md` (sección 1 de mensajería, estructura backend/frontend, tabla de endpoints, modelo `conversations`, evento `chat:insights` y variables de entorno con `OPENROUTER_INSIGHTS_MODEL`) actualizado. Versión del proyecto a **v0.3.6**.

---

## v0.3.5 — 2026-09-18

> 🧠 **El chatbot ahora recuerda la conversación, saluda y se despide con naturalidad, y el estado de la conversación se refleja en vivo**

---

### ✨ Añadido
- **Memoria de conversación**: la generación de respuestas (directas y tras ejecutar herramientas) recibe el historial reciente (últimos 20 mensajes) como turnos de usuario/asistente. Se excluyen los mensajes internos de herramientas (`tool_call`, `tool_result`, `confirmation_request`) y los placeholders vacíos; el agente humano se representa con el prefijo `[Agente humano]`.
- **Re-saludo tras pausa larga**: si el hueco respecto al mensaje anterior supera las 6 horas, se inserta un marcador en el historial para que el bot retome con un saludo.
- **Propagación en vivo de `chat:status`**: `Messaging.vue` y `TestChat.vue` consumen el evento y actualizan modo/estado/tag sin recargar; `PUT /api/conversations/:id/mode` ahora también emite `chat:status`.
- **Badge "Human Takeover"** en el dashboard cuando la conversación está en control humano.

### 🔄 Cambios
- **Saludo natural**: se elimina el texto enlatado de bienvenida y su maquinaria (`shouldSendWelcome`, `hasGreeting`, `hasQuestionIntent`, `lastWelcomeAt`); el system prompt indica saludar solo al inicio o tras una pausa larga.
- **Despedida no destructiva**: al detectar una despedida, el bot responde con naturalidad y, después de generarla, la conversación se marca como `closed` (sin mensaje enlatado ni corte previo); si la generación falla, no se cierra.
- **"Gracias" y variantes ya no cierran la conversación**: se retiran de las keywords de despedida (defaults del backend, setup, configuración y seed e2e).
- **Visibilidad por audiencia**: en la vista del cliente (`TestChat.vue`) ya no se renderizan las tarjetas `tool_call`/`tool_result`; las `confirmation_request` conservan sus acciones. El dashboard sigue mostrándolas.

### 🧪 Pruebas
- Nuevo spec `chat-memory-and-flow.spec.ts`: memoria del historial, "gracias" no cierra y transferencia reflejada en vivo.
- Stub de IA ampliado: disparador de memoria (`RECUERDA`) y de transferencia (`TRANSFERIR`); seed e2e idempotente para el `config` del agente.
- Escenario en `public-chat.spec.ts`: el cliente ve la confirmación pero no la tarjeta interna de la herramienta.
- Suite e2e completa en verde (24/24).

### 📚 Documentación
- `AGENTS.md` (secciones 1 y 9 y tabla de eventos WebSocket) actualizado. Versión del proyecto a **v0.3.5**.

---

## v0.3.4 — 2026-09-18

> 🧠 **Los modelos de IA pasan a ser configuración de despliegue: se resuelven desde variables de entorno y desaparece la selección de modelo en la interfaz**

---

### 🔄 Cambios
- **Modelos resueltos desde el entorno**: el chat usa siempre `OPENROUTER_LLM_MODEL` (requerido, sin default); embeddings `OPENROUTER_EMBEDDING_MODEL`; OCR `OPENROUTER_OCR_MODEL`; conversión de archivos `OPENROUTER_FILE_MODEL` (opcional, CSV crudo si falta) y re-ranking `OPENROUTER_RERANKER_MODEL` (opcional, fallback al modelo de embeddings).
- **Onboarding sin invocar a OpenRouter**: el bloque "Modelo IA" del setup se elimina; el alta del proyecto ya no requiere elegir modelo.
- **Interfaz sin selectores de modelo**: se quitan el selector/buscador de Agentes y el selector del formulario de Configuración; Configuración muestra una tarjeta de solo lectura con los modelos de chat, embeddings y OCR.
- **Endpoint de solo lectura**: `GET /ai-models/providers/active/:type` devuelve el modelo resuelto del entorno (llm, embedding, file, ocr).

### 🗑️ Eliminado
- **Overrides de modelo en base de datos**: `provider_configs.selectedModel` (embedding y file), `rag.ocr_openrouter_model` y `rag.reranker_model` dejan de tener efecto. Los campos `modelId`/`modelValue` del agente quedan ignorados en runtime.
- **Frontend**: `getModelsForAgent()` y el tipo `AgentModelGroup` de `settings.service.ts`; envío de `model`/`modelValue` en setup, agentes y configuración.
- **Pruebas**: filas de `provider_configs` de modelos en `seed-e2e.ts` y pasos de selección de modelo en `onboarding.spec.ts`.

### 📚 Documentación
- `apps/backend/.env.example` y `AGENTS.md` actualizados (secciones 4.1/4.2/4.3, pipeline OCR, re-ranking, flujo de setup y tabla de variables) incluyendo el caveat de reindexado al cambiar `OPENROUTER_EMBEDDING_MODEL`. Versión del proyecto a **v0.3.4**.

### 🧪 Pruebas
- Suite e2e completa en verde (20/20) con `OPENROUTER_LLM_MODEL` apuntando al stub.

---

## v0.3.3 — 2026-09-18

> 🔐 **Validación del setup: la primera vez lleva al wizard, la sesión inválida vuelve al login y el login queda limpio**

---

### 🔄 Cambios
- **Validación interna del setup**: `ProjectSetup.vue` consulta al servidor si el usuario ya tiene proyecto al montarse. Si ya lo tiene y no pidió crear uno nuevo, redirige al dashboard (la validación ya no depende solo del guard de navegación).
- **Creación de proyectos múltiples preservada**: el botón "Crear nuevo proyecto" del `Topbar` navega a `/setup?mode=new`, que omite la validación interna y abre el wizard.
- **Login sin credenciales demo**: se elimina el bloque con `admin@mitchbot.io` / `admin123` de `Login.vue`. El registro de usuarios no forma parte de esta app.

### 🐛 Corregido
- **Sesión "zombie" (token local válido pero rechazado por el servidor)**: `checkProject()` ahora distingue `401/403` (`SessionInvalidError`) de "sin proyecto". El guard y el setup limpian la sesión y redirigen silenciosamente al login, en vez de enviar al usuario al wizard con errores de "Cuenta desactivada".

### 📚 Documentación
- `AGENTS.md` actualizado (flujo de onboarding, módulo Login y versión a **v0.3.3**).

### 🧪 Pruebas
- Nuevo spec e2e `setup-validation.spec.ts`: usuario con proyecto entra a `/setup` → dashboard; el botón del Topbar abre el wizard con `?mode=new`; sesión inválida → login.

---

## v0.3.2 — 2026-09-18

> 🧹 **Pulido de `docker-compose`: solo los servicios en uso, MongoDB anclado, healthchecks y Redis durable (AOF)**

---

### 🔄 Cambios
- **`docker-compose.yml` reducido a los servicios en uso**: se quitan `ollama`, `open-webui` y `nats`, junto con los volúmenes `ollama_data` y `open-webui_data`, y la clave `version` (obsoleta en Compose v2). Quedan `mongodb`, `redis` y `qdrant`.
- **MongoDB anclado a `mongo:8`** (antes `mongo:latest`). Se mantiene el major 8 porque MongoDB no soporta downgrade: un volumen creado por 8.x no puede abrirse con 6.x.
- **Healthchecks** en `mongodb` (`mongosh` ping), `redis` (`redis-cli ping`) y `qdrant` (probe TCP por bash, ya que la imagen no incluye `curl`/`wget`).
- **Redis listo para producción**: persistencia AOF (`--appendonly yes`), volumen `redis_data:/data` y `--maxmemory-policy noeviction` (requisito de BullMQ).

### 🗑️ Eliminado
- **Código muerto de NATS**: `apps/backend/src/config/nats.ts`, su import y llamada en el bootstrap (`src/index.ts`), la fila NATS del reporte de infraestructura y `NATS_URL` de `src/config/env.ts`, `.env` y `.env.example`.
- **Dependencia npm `nats`** (además marcada como deprecated por el proveedor).
- **Residuos de Ollama**: `OLLAMA_URL` de `apps/backend/.env` y `playwright.config.ts`.

### 📚 Documentación
- `AGENTS.md` actualizado (servicios Docker, stack, variables de entorno y comandos) y versión del proyecto a **v0.3.2**.

### 🧰 Limpieza operativa (una sola vez)
```bash
docker compose down
docker rm nats                                                   # contenedor huérfano (si existía)
docker volume rm mitchbot_v2_ollama_data mitchbot_v2_open-webui_data
docker compose up -d --remove-orphans
```

---

## v0.3.1 — 2026-09-18

> 🧪 **Suite de pruebas end-to-end con Playwright: entorno aislado, autenticación reutilizable y proveedor de IA determinista (stub)**

---

### ✨ Nuevas funcionalidades
- **Suite e2e (Playwright)**: cubre autenticación, onboarding, dashboard, mensajería, contactos, base de conocimiento (RAG), usuarios, configuración/agentes, perfil, chat público y tiempo real (streaming + confirmación/cancelación de herramientas).
- **Autenticación reutilizable**: *setup project* que hace login una sola vez y persiste `storageState` para el resto de las pruebas; los specs públicos corren sin sesión.
- **Entorno e2e aislado**: backend en el puerto 3100, frontend en 5174, base de datos MongoDB `mitchbot_e2e` y puertos dedicados, sin interferir con el entorno de desarrollo (3000/5173).
- **Stub local de IA compatible con la API de OpenAI** (`tests/stub/openai-stub.mjs`): respuesta de texto determinista, streaming SSE, tool calls (`create_appointment`) y embeddings deterministas (768 dims). Se activa vía `OPENROUTER_BASE_URL`.
- **Seed e2e dedicado** (`apps/backend/src/scripts/seed-e2e.ts`): usuario, proyecto, agente y proveedores de prueba idempotentes y no destructivos; además limpia los contadores de rate limiting WebSocket entre corridas.
- **Chequeo de prerrequisitos**: la suite falla con un mensaje claro si faltan los servicios Docker o los servidores.
- **Prueba de guardia** (`provider-guard.spec.ts`): verifica que el backend apunta al stub y no genera tráfico al proveedor real.
- **Scripts npm**: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:ci`, `test:e2e:report`, `stub:e2e`, `seed:e2e`.

### 🔄 Cambios
- `fetchOpenRouterModels` usa `OPENROUTER_BASE_URL` (permite apuntar al stub en pruebas); por defecto sigue usando el endpoint real.
- `GET /ai-models/agent/models` y `GET /ai-models/remote/openrouter` ya no exigen `projectId` (el proveedor es global), habilitando la selección de modelo en el onboarding.
- Rutas `contacts` y `agents` aplican `authenticate` (faltaba tras el modelo multi-proyecto) y el servicio de contactos del frontend envía `Authorization` + `X-Project-Id`.

### 📚 Documentación
- `tests/e2e/README.md` con prerrequisitos, comandos y estructura de la suite.
- `AGENTS.md` documenta la sección de pruebas e2e.

---

## v0.3.0 — 2026-09-18

> 🔒 **Proveedor único OpenRouter: credenciales fuera de la base de datos y eliminación del rol `devadmin`**

---

### ⚠️ Breaking changes
- **Proveedor único OpenRouter**: el sistema usa exclusivamente OpenRouter para LLM, embeddings y OCR. Se eliminan las integraciones de **Ollama**, **Google Gemini** y **Mistral** del enrutador de IA y de las cadenas de fallback. Cualquier intento de usar otro proveedor se rechaza con un error explícito.
- **Credenciales fuera de la base de datos**: las API keys provienen exclusivamente de variables de entorno. `provider_configs` deja de almacenar `apiKey` (migración incluida). Ninguna respuesta de API devuelve credenciales.
- **Se elimina el rol `devadmin`**: los roles válidos pasan a ser `admin`, `support` y `assistant`. Los usuarios existentes con rol `devadmin` se normalizan a `assistant`/`Inactive` durante la migración.
- **Endpoints eliminados**: `/ai-models/ollama/models`, `/ai-models/remote/gemini`, `/ai-models/remote/openrouter/embeddings`, `/ai-models/providers/configs*`, `/ai-models/providers/config` y `/ai-models/providers/test*`. El CRUD de `ai_models` restringido a `devadmin` también se elimina. Se conservan `/ai-models/remote/openrouter` y `/ai-models/agent/models`.
- **Se elimina la vista de proveedores** (`DevAdminModels.vue`) y su ruta `/devadmin/models`.

### ✨ Nuevas funcionalidades
- **Variables de entorno del proveedor**: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_EMBEDDING_MODEL` y `OPENROUTER_OCR_MODEL` (con valores por defecto razonables).
- **Herramientas internas aisladas**: el módulo de pruebas se sirve en la ruta `/dev/tests` (solo accesible por URL, autenticada, sin entrada en el menú lateral). Los endpoints asociados pasan a `/api/brain/dev/extract` y `/api/brain/dev/pdf-to-images`.

### 🔄 Cambios
- `llm-provider.service.ts` queda reducido a la rama de OpenRouter para chat y embeddings; `ai.service.resolveModelConfig` resuelve el modelo por agente y toma la credencial del entorno.
- `ocr.service.ts` se simplifica a OpenRouter como único proveedor, conservando el fallback legacy `pdf-parse`.
- `reranker.service.ts` re-rankea con embeddings de OpenRouter (configurable con `rag.reranker_model`), desactivable con `rag.use_reranker=false` y con degradación a heurística/similarity-only.
- Los embeddings usan un modelo por defecto de OpenRouter, sobreescribible desde configuración. La dimensión del vector se alinea con `rag.qdrant_vector_size` (768) para reutilizar las colecciones Qdrant existentes.
- Modelo OCR por defecto actualizado a `google/gemini-3.8-flash` (el anterior `google/gemini-2.0-flash-001` ya no existe en OpenRouter).
- El arranque del backend ya no comprueba la conexión con Ollama.
- Nueva migración `scripts/migrate-openrouter.ts`: elimina `apiKey` de `provider_configs` y normaliza/desactiva usuarios `devadmin`.
- El `seed` de modelos locales de Ollama se elimina; los modelos se listan dinámicamente desde OpenRouter.
- `AGENTS.md` y `apps/backend/.env.example` documentan el proveedor único y las variables de entorno.

---

## v0.2.0 — 2026-09-18

> 🏢 **Modelo multi-proyecto: pertenencia usuario↔proyecto, resolución de contexto por request y aislamiento total**

---

### ⚠️ Breaking changes
- **Los usuarios pertenecen a proyectos**: cada usuario tiene `projectIds` (lista de proyectos) y `activeProjectId` (proyecto activo). Un usuario solo accede a sus proyectos.
- **Resolución de proyecto por request**: el middleware de autenticación resuelve el proyecto desde el header `X-Project-Id` (validando pertenencia) o, en su defecto, desde el `activeProjectId` del usuario. **Desaparece el proyecto global único.**
- **Se elimina el caché local `mitchbot_project_setup` como fuente de verdad** del onboarding: el guard consulta al servidor (`GET /project/check`) según los proyectos del usuario.

### ✨ Nuevas funcionalidades
- **Multi-proyecto por usuario**: cualquier usuario autenticado puede crear proyectos; el creador queda como miembro y el proyecto pasa a ser su activo (`POST /api/project`).
- **Selector de proyecto en la barra superior** (`Topbar.vue`) con listado de proyectos del usuario y opción de crear uno nuevo; al cambiar, se reasigna el socket y se recargan las vistas.
- **Endpoints nuevos**: `GET /api/project/list` (proyectos del usuario) y `PUT /api/project/active` (cambio de proyecto activo persistido).
- **Asignación de proyectos por administradores**: `POST/PUT /api/users` aceptan `projectIds`; UI de selección múltiple en `Users.vue`.
- **Agente por proyecto**: `agents.projectId` y `getActiveAgent(projectId)`; el bot usa el agente del proyecto de la conversación.
- **Aislamiento de contactos**: `contacts.projectId` (nuevo), filtrado por proyecto en listado, detalle, edición, archivado y restauración, y en la auto-creación de contactos.
- **Sesiones de tiempo real por proyecto**: el socket se autentica con el proyecto activo (o el indicado al conectar), entra en room `project:<id>` y valida pertenencia al unirse a conversaciones.
- **Script de migración** `scripts/migrate-multi-project.ts`: asigna el proyecto actual a usuarios existentes, fija su `activeProjectId` y vincula los agentes existentes a su proyecto.

### 🔄 Cambios
- `auth.middleware.ts` adjunta el `projectId` resuelto y responde **403** ante un header de proyecto ajeno.
- `project.service.ts`: se elimina la restricción de proyecto único activo; `getActiveProject(user)` pasa a ser por usuario y se añade `getUserProjects()`.
- Los eventos de tiempo real `chat:new_conversation` y `admin:notification` se emiten **solo al proyecto** (`emitToProject`), no globalmente.
- `socket.service.ts` (frontend) envía el proyecto en el handshake y expone `reconnect(projectId)`; se corrige la lectura del token (`mitchbot_token`).
- `Profile.vue` muestra los proyectos del usuario y el activo.

### 🧪 Tests
- Nuevo test de integración `tests/integration/multi-project-isolation.test.ts`: resolución por header/activo, denegación de proyecto ajeno (403) y aislamiento de proyectos por usuario.

---

## v0.1.38 — 2026-09-18

> 🐛 **Fix: resolución de módulos del frontend (artefactos compilados obsoletos)**

---

### 🐛 Fixes & Optimizations

#### Frontend
- **Eliminados 56 artefactos compilados obsoletos** (`.js`, `.vue.js` y `.js.map`) dentro de `apps/frontend/src/` que eclipsaban a los fuentes `.ts`/`.vue` en la resolución de Vite (prioridad `.js` sobre `.ts` en imports sin extensión). Esto provocaba `TypeError: socketService.onMessageUpdated is not a function` en `/messaging` y el spinner "Cargando conversaciones..." permanente.
- **Carga resiliente de la bandeja** (`Messaging.vue`): la carga de conversaciones se ejecuta antes e independientemente de la inicialización del socket; los errores de socket se registran sin bloquear los datos ni dejar `isLoadingChats` en `true`.
- **Prevención de recurrencia**: `noEmit: true` en `apps/frontend/tsconfig.json` para que la comprobación de tipos no emita `.js` junto a los fuentes, y reglas en `.gitignore` para no rastrear artefactos `.js`/`.js.map` dentro de `apps/frontend/src/`.

### ⚠️ Breaking changes
- Ninguno.

---

## v0.1.37 — 2026-09-17

> 🤖 **Agent Tool Use, OCR unificado y RAG multilingüe**

---

### ✨ Nuevas funcionalidades

#### Backend — Agent Tool Use (Function Calling)
- **Sistema de herramientas** (`src/tools/`) con 8 herramientas zero-config: `create_appointment`, `create_order`, `get_product_info`, `get_business_hours`, `get_service_availability`, `transfer_to_human`, `send_notification`, `get_faq_answer`.
- **Ejecutor** (`services/tool.service.ts`): esquemas OpenAI-compatible, detección de tool calls en texto libre y ejecución normalizada.
- **Tool calling nativo** (`bindTools`) para OpenRouter y Gemini; para Ollama se inyectan las herramientas en el system prompt y se detecta el JSON de invocación.
- **Flujo de confirmación**: colección `tool_executions`, mensajes `confirmation_request`/`tool_result` (`sender: 'tool'`), evento WebSocket `tool:confirm` (`confirm`/`cancel`/`modify`) y regeneración de la respuesta final con el resultado.
- **Nuevas colecciones** `appointments` y `orders` con servicios y endpoints REST (`/api/appointments`, `/api/orders`).

#### Backend — Pipeline OCR unificado
- **`services/ocr.service.ts`** convierte **todos** los PDFs a imágenes (`pdf-to-img`, escala 2) y aplica OCR.
- Proveedores: **Ollama (Qwen2.5-VL) → Mistral OCR → OpenRouter → pdf-parse** (fallback legacy).
- Salida estructurada `{ text, pages, method, confidence }` con batching de páginas (batch 4) y timeouts.
- Estadísticas por fuente: `extractionTimeMs`, `extractionConfidence`, `pagesProcessed`, `ocrProvider`, `ocrModel`.
- Nuevo tipo de proveedor **`ocr`** y endpoint `POST /api/ai-models/providers/test-ocr`.

#### Backend — RAG multilingüe
- **Chunking semántico** (`utils/chunking.ts`): encabezados Markdown, tablas atómicas, prefijo `Document | Section`, 800/100 tokens, `page_number` y detección de idioma (`en`/`es`/`mixed`).
- **Re-ranking** (`services/reranker.service.ts`): top 10 → top 3 con embeddings locales de Ollama y fallback heurístico (falla rápido si el modelo no está disponible).
- **Qdrant tuning**: HNSW `m:16`, `ef_construct:100`, `ef:64`, `on_disk` e índices de payload `language`/`document_id`.
- **Reindexado en background** con cola BullMQ `rag-reindex`, progreso por fuente y rollback de vectores parciales.

#### Frontend
- **UI de confirmación de herramientas** en **Messaging** y **TestChat** (botones Confirmar / Cancelar / Modificar).
- **Renderizado de mensajes de herramienta** (`tool_result`, `confirmation_request`) con estado y tarjetas.
- **Nueva pestaña OCR** en DevAdmin → Proveedores (proveedor, modelo, parámetros y test de conexión).

### 🔄 Cambios
- **Extracción de archivos**: los PDFs ya no usan texto embebido; pasan siempre por OCR. `extractTextOnly` (DevAdmin) usa el mismo pipeline.
- **Búsqueda RAG**: recupera top 10 y re-rankea a top 3 (configurable vía `rag.use_reranker`).
- **Mensajes**: `sender` ahora incluye `tool`; `contentType` incluye `tool_call`, `tool_result` y `confirmation_request`; nuevo campo `toolData`.

### 🛠️ Migración
- **No requiere migración de datos.** Las colecciones nuevas se crean on-demand.
- Para aplicar el nuevo chunking a fuentes existentes: `pnpm --filter @mitchbot/backend tsx src/scripts/reindex-rag.ts`.
- OCR local recomendado: `ollama pull qwen2.5-vl`; re-ranking local: `ollama pull nomic-embed-text`.
- Config OCR: `rag.ocr_*`. Config del negocio para las tools: `business.hours`, `business.services`, `business.timezone`, `business.slot_minutes`, `business.currency`.

### ⚠️ Breaking changes
- Ninguno. Si no hay herramientas ni modelos configurados, el chat sigue funcionando igual (degradación graceful).

---

## v0.1.36 — 2026-09-17

> 🐛 **Fix: carga de variables de entorno en scripts**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Ruta de `.env` corregida en scripts** — Los scripts `seed`, `cleanup-project`, `purge-qdrant` y `reindex-rag` cargaban `apps/backend/.env` con un path relativo que fallaba al ejecutarse desde `apps/backend` (resolvía a `apps/backend/apps/backend/.env`), dejando `dotenv` con los valores por defecto. Ahora resuelven el `.env` relativo al propio archivo vía `__dirname`, por lo que funcionan desde cualquier directorio de trabajo.

---

## v0.1.35 — 2026-06-13

> 🔒 **WebSocket Security Hardening**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Autenticación JWT para Socket.io** — Todas las conexiones WebSocket requieren token JWT válido.
- **Autorización de Rooms** — Los usuarios solo pueden unirse a conversaciones de su proyecto asignado.
- **Rate Limiting** — Límite de 30 mensajes/minuto y 10 joins/minuto por usuario (usando Redis).
- **CORS Restrictivo** — En producción, solo orígenes permitidos en `FRONTEND_URL`. Desarrollo mantiene `*`.
- **Middleware de seguridad** — Nuevo `socket-auth.middleware.ts` con validación completa.

#### Frontend
- **Socket con autenticación** — El `socketService` envía automáticamente el token JWT en el handshake.
- **Soporte para chat público** — El `TestChat` envía el slug del proyecto en la conexión pública.
- **Manejo de errores** — Los componentes `Messaging` y `TestChat` manejan errores de WebSocket.

### 🛡️ Seguridad
- **Protección contra acceso no autorizado** — Conexiones sin token son rechazadas inmediatamente.
- **Validación de proyecto** — Los usuarios no pueden acceder a conversaciones de otros proyectos.
- **Rate limiting por IP** — Prevención de abuso vía Redis.

### 📝 Documentación
- **AGENTS.md actualizado** — Documentación de la arquitectura de seguridad WebSocket.

---

## v0.1.34 — 2026-04-08

> 🧪 **Extraccion PDF completa por imagenes**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Config global de extraccion PDF** — Nuevos parametros para controlar escala, limites, batch y timeouts con soporte de 0 = sin limites.
- **Extraccion por pagina configurable** — PDFs se procesan por imagen con batch configurable y logs de conteo.
- **Salida completa** — Se elimina el recorte fijo de 50k y se respeta el limite configurable (o sin limite).

#### Frontend
- **Parametros PDF en DevAdmin** — Controles de extraccion agregados en Proveedores > Image para aplicar a DevAdmin y RAG.

---

## v0.1.33 — 2026-04-08

> 🧪 **DevAdmin: PDF a imagenes con preview**

---

### ✨ Nuevas funcionalidades

#### Backend
- **DevAdmin PDF preview** — Nuevo endpoint para convertir PDFs a imagenes y devolverlas en base64.
- **Calidad configurada** — Se ajusta la escala de conversion segun un ajuste DevAdmin independiente.

#### Frontend
- **Pestaña PDF a imagenes** — Se agrega tab en Pruebas para subir PDF y mostrar preview por pagina.
- **Selector de calidad** — Se agrega un selector simple de calidad en Proveedores > Image (config independiente).

### 🐛 Fixes & Optimizations

#### Frontend
- **Config separada** — La configuracion de calidad se separa del proveedor y tiene guardado propio.

### 🐛 Fixes & Optimizations

#### Frontend
- **Servicio Brain DevAdmin** — Se sincroniza el servicio para incluir la conversion PDF a imagenes.

---

## v0.1.32 — 2026-04-08

### 🐛 Fixes & Optimizations

#### Frontend
- **Servicio Brain DevAdmin** — Se sincroniza el servicio para incluir la conversion PDF a imagenes.

---

## v0.1.31 — 2026-04-08

> 🧠 **RAG: Extraccion por imagenes en PDFs**

---

### ✨ Nuevas funcionalidades

#### Backend
- **PDF → imagenes** — Los PDFs ahora se convierten a PNG y se extraen con el modelo image (temperatura 0).
- **CSV via modelo file** — El CSV se formatea via modelo tipo file antes del chunking.
- **Vision provider fijo** — Se evita el formato Gemini cuando el proveedor es otro, mejorando la compatibilidad con OpenRouter/Ollama.
- **Validacion de modelo image** — Se corta temprano si el modelo no parece soportar vision y se registra el motivo.
- **Mejor cobertura** — Mayor escala al renderizar PDF, mayor maxTokens y solicitud de detalle alto.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Extraccion consistente** — Se unifica la ruta de extraccion para PDFs con modelo image por pagina.

---

## v0.1.30 — 2026-04-01

> 🧠 **RAG: Document inputs dinamicos**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Inputs dinamicos** — PDFs se envian como `input_file` y imagenes como `input_image` (con fallback), segun modelo.
- **Imagenes en ingesta** — La cola RAG acepta imagenes y las procesa como fuente.

#### Frontend
- **Subida de imagenes** — El modulo Brain permite subir imagenes y muestra tipo IMAGE.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Trazabilidad de extraccion** — Se registra el metodo de extraccion (parser, raw, csv, llm_file, llm_vision) por fuente.

---

## v0.1.29 — 2026-04-01

> 🧠 **RAG: Extraccion multimodal para PDFs e imagenes**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Extraccion vision** — PDFs escaneados e imagenes se procesan con modelo multimodal (OpenRouter) antes del embedding.
- **Imagenes en ingesta** — La cola RAG acepta imagenes y las procesa como fuente.

#### Frontend
- **Subida de imagenes** — El modulo Brain permite subir imagenes y muestra tipo IMAGE.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Trazabilidad de extraccion** — Se registra el metodo de extraccion (parser, raw, csv, llm_file, llm_vision) por fuente.

---

## v0.1.28 — 2026-03-25

> 🧪 **DevAdmin: Modulo de pruebas y extraccion sin indexar**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Extraccion directa** — Nuevo endpoint DevAdmin para extraer texto sin guardar ni indexar en Qdrant.
- **Soporte de imagenes** — El extractor acepta archivos de imagen en el flujo de pruebas.

#### Frontend
- **Modulo Pruebas** — Nueva vista DevAdmin con subitem “Extraer texto” estilo chat para validar modelos file.

---

## v0.1.27 — 2026-03-21

> 🧹 **RAG: Eliminacion garantizada en Qdrant**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Delete hard** — Eliminar fuente ahora falla si Qdrant no borra, evitando inconsistencias.
- **Log de borrado** — Se registra confirmacion de eliminacion en Qdrant.

#### Frontend
- **Delete UX** — Mensajes claros al eliminar fuente.

---

## v0.1.26 — 2026-03-21

> 🧠 **RAG: Texto extraido y prompt estricto**

---

### 🐛 Fixes & Optimizations

#### Backend
- **LLM estricto** — Se obliga a devolver Markdown o NO_TEXT_FOUND para evitar alucinaciones.

#### Frontend
- **Texto extraido** — Boton ahora consulta endpoint y maneja errores en UI.

---

## v0.1.25 — 2026-03-21

> 🧠 **RAG: Extraccion Markdown via LLM**

---

### 🐛 Fixes & Optimizations

#### Backend
- **OCR removido** — La extraccion vuelve a ser solo LLM y se guarda Markdown extraido.

#### Frontend
- **Ver texto extraido** — Nueva accion para ver el Markdown extraido por documento.

---

## v0.1.24 — 2026-03-21

> 🧠 **RAG: OCR local para PDFs escaneados**

---

### ✨ Nuevas funcionalidades

#### Backend
- **OCR local** — Si el parser y el modelo file no extraen texto, se usa OCR local para PDFs imagen.
- **Logs de OCR** — Se agrega log de inicio y fin de OCR en la fuente.

---

### 🐛 Fixes & Optimizations

#### Backend
- **Deteccion PDF** — Se detecta si el PDF es imagen o texto antes de ejecutar OCR.

## v0.1.23 — 2026-03-21

> 🐛 **RAG: Worker estable + progreso real**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Worker** — Ajustes de lock y uso de sourceId en el worker para actualizar progreso y logs.

#### Frontend
- **Logs vivos** — Polling refresca logs cuando estan abiertos.

---

## v0.1.22 — 2026-03-21

> 🐛 **RAG: Colecciones por modelo de embeddings**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Coleccion por modelo** — Se separa la coleccion Qdrant por modelo de embeddings activo para evitar error de dimensiones.

---

## v0.1.21 — 2026-03-21

> 🐛 **RAG: Cola BullMQ estable**

---

### 🐛 Fixes & Optimizations

#### Backend
- **BullMQ Redis** — Se usa configuracion dedicada compatible con BullMQ para evitar jobs atascados.

---

## v0.1.20 — 2026-03-21

> ⚙️ **RAG: Subida en background con progreso y logs**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Cola BullMQ** — Subida de archivos ahora se procesa en background con Redis.
- **Estados y progreso** — `status`, `stage`, `progress`, timestamps y logs por fuente.
- **Endpoints** — Nuevos endpoints para estado y logs por fuente.

#### Frontend
- **UX de progreso** — Barra de avance, etapa actual y logs inline por fuente.

---

### 🐛 Fixes & Optimizations

#### Backend
- **BullMQ** — Redis config ahora setea `maxRetriesPerRequest: null` para evitar error de worker.

## v0.1.19 — 2026-03-21

> 🐛 **RAG: Mejor uso de base64 en PDF**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Extractor file** — Siempre envia PDF en base64 al modelo tipo file (con data URI) y evita perder texto extraido por parser.

---

## v0.1.18 — 2026-03-21

> 🧹 **RAG: Rollback en uploads fallidos**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Rollback automatico** — Si falla la subida o el procesamiento, se eliminan los vectores en Qdrant y el documento en Mongo.

---

## v0.1.17 — 2026-03-21

> 🐛 **RAG: Mejor extraccion para PDFs sin texto**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Extractor file** — Si un PDF no tiene texto seleccionable, se envia base64 truncado al modelo tipo file para intentar extraer contenido.

---

## v0.1.16 — 2026-03-21

> 🧩 **RAG: Bloqueo de uploads sin modelo file**

---

### 🐛 Fixes & Optimizations

#### Frontend
- **Subida de archivos** — Se deshabilita el flujo de archivos cuando no hay proveedor tipo file activo y se muestra aviso con link a DevAdmin.

---

## v0.1.15 — 2026-03-21

> 🧠 **RAG: Extraccion LLM + payload con indices dinamicos**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Extractor LLM tipo file** — PDF y CSV ahora pasan por el modelo tipo `file` antes del chunking; TXT se procesa directo.
- **Payload enriquecido** — Se agregan `document_id`, `chunk_id`, `text`, `category`, `tags`, `author`, `access_level`, `created_at` y metadatos de proyecto en Qdrant.
- **Indices dinamicos** — Config `rag.qdrant_payload_indexes` en `app_config` para crear indices de payload en Qdrant.
- **Reindex actualizado** — El script de reindexado preserva y reinyecta metadata completa.

---

## v0.1.14 — 2026-03-20

> 🧹 **UX: Simplificación de pestaña LLM**

---

### 🐛 Fixes & Optimizations

#### Frontend
- **DevAdmin LLM** — Se elimina la sección “Modelo IA del agente” para evitar duplicidad con el selector de proveedor/modelo.
- **Estado vacío** — Se oculta el badge de activo cuando no hay proveedor/modelo configurado y se muestra aviso para seleccionar proveedor.

---

## v0.1.13 — 2026-03-20

> 🧩 **UX: Flujo unificado de proveedores y modelos**

---

### ✨ Nuevas funcionalidades

#### Frontend
- **Formato unificado** — Todos los tipos de proveedor ahora siguen el mismo flujo: seleccionar proveedor → abrir modal → filtrar modelo.
- **Modal de modelos** — Selección de modelos con buscador para Ollama, OpenRouter y Gemini en LLM, Embeddings, File, Image y Audio.

---

## v0.1.12 — 2026-03-19

> 🛡️ **Refactor: Modo DevAdmin y Proveedores Avanzados**

---

### ✨ Nuevas funcionalidades

#### Backend
- **Rol `devadmin`** — Nuevo rol interno de superadmin para gestionar proveedores/modelos. No se puede crear ni asignar via API.
- **Proveedores extendidos** — `provider_configs` ahora soporta tipos `file`, `image` y `audio` ademas de `llm` y `embedding`.
- **Seguridad en rutas** — Las rutas de `ai-models` y proveedores quedan restringidas a `devadmin`.

#### Frontend
- **Vista DevAdmin** — Nueva pantalla para administrar proveedores y modelos por tipo (LLM, Embedding, File, Image, Audio).
- **Settings simplificado** — Se removieron pestañas de proveedores; la personalizacion del bot permanece.
- **UI de usuarios** — Visualizacion de rol `devadmin` como interno.
- **Modelo IA** — Seleccion del modelo del agente movida a DevAdmin.
- **RAG** — Mensaje de configuracion apunta a DevAdmin cuando falta embeddings.

---

## v0.1.11 — 2026-03-18

> 🧹 **Herramientas: Limpieza y reindex de RAG**

---

### 🐛 Fixes & Optimizations

#### Backend
- **Scripts de mantenimiento** — Se agregan scripts para purgar Qdrant, reindexar RAG y limpiar un proyecto activo.
- **Reindex controlado** — Reindex del proyecto activo borrando su colección y reconstruyendo vectores.
- **Limpieza total** — Script para limpiar datos del proyecto activo y su colección en Qdrant.

---

## v0.1.10 — 2026-03-17

> 🧠 **Feature: Sistema de Personalidad Dinámica para el Chatbot**

---

### 💥 Breaking Changes

- **`systemPrompt` reemplazado por `personality`**: El campo `systemPrompt` (string libre) fue reemplazado por un objeto estructurado `personality` en el modelo de Agente. Los agentes existentes necesitan recrearse o actualizar su documento en la BD.

### ✨ Nuevas funcionalidades

#### Backend
- **`prompt-builder.service.ts`** — Nuevo servicio que genera dinámicamente el system prompt a partir de la configuración de personalidad del agente.
- **Modelo `AgentPersonality`** — Objeto tipado con: `role`, `traits` (máx. 3), `emojiUsage`, `language`, `responseLength`, `ragBehavior`, `fallbackMessage`, `additionalInstructions`.
- **`getDefaultPersonality()`** — Función que provee valores por defecto para nuevos agentes.
- **`agent.model.ts`** — Schema actualizado: `systemPrompt: string` → `personality: AgentPersonality`.
- **`chat.service.ts`** — Usa `buildSystemPrompt(personality)` en vez de pasar el string directamente.
- **`agent.service.ts`** — Create/update manejan el objeto `personality` con merge de defaults.
- **`agents.controller.ts`** — Schemas Zod actualizados con validación del objeto `personality`.
- **`project.service.ts` / `project.controller.ts`** — Aceptan `personality` en la creación de proyectos.

#### Frontend
- **`settings.service.ts`** — Interfaz `AgentPersonality` y `AgentData` actualizados.
- **`Settings.vue` / Tab Agente IA rediseñado** — Interfaz visual con:
  - Selector de **Rol** (Asistente, Profesor, Vendedor, Soporte, Atención al Cliente)
  - Selector de **Rasgos** (chips con máximo 3 seleccionables)
  - Selector de **Emojis** (Bajo, Medio, Alto)
  - Selector de **Idioma** (Español, Inglés, Portugués, Auto-detectar)
  - Selector de **Longitud de respuesta** (Corta, Media, Detallada)
  - Selector de **Comportamiento RAG** (Solo documentos, Híbrido, General)
  - Slider de **Creatividad/Temperatura** con etiquetas y advertencia
  - Área de **Instrucciones adicionales** (texto libre opcional)
- **`ProjectSetup.vue`** — Onboarding actualizado con selector de Rol visual (en vez de textarea de system prompt).
- **`Agents.vue`** — Eliminadas referencias a `systemPrompt` en modales de crear/editar.

### 🗑️ Eliminado
- Campo `systemPrompt` del modelo Agent y de todas las interfaces frontend.
- Personality `systemPrompt` del config service default.

---

## v0.1.9 — 2026-03-16

> 📝 **Documentación: Reescritura completa de AGENTS.md**

---

### 📝 Documentación

- **AGENTS.md reescrito desde cero**: Se actualizó el archivo de guía del proyecto para reflejar con precisión el estado actual de la arquitectura.
  - Estructura detallada del monorepo con árbol de archivos del backend y frontend.
  - Stack tecnológico actualizado con todas las dependencias reales (`@langchain/core` v1.x, Zod v4, Radix Vue, Lucide Icons, etc.).
  - Servicios Docker documentados con puertos y propósito.
  - Lógica de negocio completa de los 7 módulos (Mensajería, Contactos, Cerebro/RAG, Configuración, Usuarios, Login, Seguridad).
  - Arquitectura del chatbot con diagrama ASCII del flujo: `chat.service → ai.service → llm-provider.service`.
  - Flujo de autenticación y onboarding con diagrama de decisión.
  - Tabla completa de API endpoints (11 módulos).
  - Modelos de datos MongoDB (11 colecciones con campos clave).
  - Eventos WebSocket documentados (7 eventos).
  - Comandos de desarrollo y variables de entorno.
  - Roadmap actualizado con checkboxes de estado.

---

## v0.1.8 — 2026-03-13

> 🧪 **Test chat sin sidebar**

---

### 🐛 Fixes & Optimizations

- **Test Chat**: el layout sin sidebar aplica tambien en el bundle JS del router.

---

## v0.1.7 — 2026-03-11

---

## v0.1.6 — 2026-03-11

#### Streaming de Respuestas (WebSockets)
- **Generación en Tiempo Real**: Se reemplazó la espera bloqueante por una emisión continua de tokens (`generateResponseStream` usando `.stream()`).
- **Typing Indicator Instantáneo**: Ahora, cuando el bot comienza a pensar, se emite un mensaje vacío ("...") de inmediato antes incluso de que RAG cargue, dándole al cliente la sensación de respuesta instantánea.
- **Frontend Streaming UI**: Tanto el simulador del cliente (`TestChat.vue`) como el panel de administración (`Messaging.vue`) actualizan el contenido de los mensajes letra por letra al recibir el evento `chat:message_chunk`.
- **Renderizado Markdown Básico**: Los chats ahora procesan negritas e itálicas que la IA produce naturalmente en tiempo real.

### 🐛 Fixes & Optimizations

- **Fail-fast en OpenRouter**: Se deshabilitaron los reintentos automáticos e infinitos (`maxRetries: 0`) en la librería `@langchain/openai`. Esto impedía que los modelos gratuitos (saturados) o con errores (429) se quedaran bloqueados por minutos, devolviendo una respuesta de timeout predecible en su lugar.
- **Limitación de RAG (Context Truncation)**: Se acotó el historial de base de conocimientos inyectado a los 2 documentos más relevantes y truncados a un máximo de 1000 caracteres. Esto reduce drásticamente el Time-To-First-Token (TTFT) para consultas de IA.
- **Timeouts preventivos en Vector Store**: Se añadió un `timeout` seguro de 5 segundos en `rag.service.ts` a la hora de consultar `QdrantVectorStore`. Si los embeddings fallan o tardan de más, el bot continuará y responderá para nunca dejar al usuario esperando colgado.



## v0.1.5 — 2026-03-11

> 🧠 **Feature/Fix: Capa de Abstracción AI, Enrutador e Integración nativa de OpenRouter**

---

### 💥 Breaking Changes

- **AI Model Instantiation**: El servicio `@langchain/openai` requería un formato específico (`configuration: { apiKey, baseURL }`) para inicializar el cliente de OpenRouter, el cual era ignorado en el formato anterior (causando "Missing credentials" silenciados en la invocación).
- **Abstracción del Chatbot (`ai.service.ts`)**: El Chatbot ya no sabe internamente qué tipo de IA está usando. Simplemente envía `SystemPrompt + Context + Mensajes` y espera la respuesta en cadena.
- **El Enrutador (`llm-provider.service.ts`)**: Concentra todo el desacoplamiento de modelos, inicializando dinámicamente clientes de Ollama, OpenRouter o Gemini según base de datos y retornando una abstracción `BaseChatModel`.

### ✨ New Features

- **Manejo Sensato de Errores de LLMs**: Ahora, cuando falla un proveedor externo o interno, el bot envía al chat un mensaje de sistema claro y fácil de entender (ej: "Error de OpenRouter: Missing Credentials. Revisa Settings") para el usuario en vez de quedarse callado sin responder la petición inicial por web-socket. Se introdujo también un timeout general de 60s preventivo para LLMs que se queden en estado "zombie".

---


> 🔄 **Refactor: Proveedores `local` → `ollama` + Modal de selección de modelos**

---

### 💥 Breaking Changes

- **Proveedor "local" renombrado a "ollama"**: Todas las referencias a `local` como proveedor ahora usan `ollama`. La configuración existente debe actualizarse.

### ✨ Nuevas funcionalidades

#### Backend
- **`GET /api/ai-models/ollama/models`**: Nuevo endpoint que lista modelos directamente desde la API de Ollama (`/api/tags`)
- **Validación de modelos Ollama**: Antes de invocar un modelo, se verifica que exista en Ollama. Si no, se envía un error descriptivo al chat.
- **`testOllamaConnection()`**: Nuevo método que verifica conectividad con Ollama y reporta cantidad de modelos
- **Timeout de 60s**: Las invocaciones al LLM ahora tienen timeout para evitar cuelgues infinitos
- **Error messages en chat**: Si el bot falla al responder, envía un mensaje de error visible en la conversación

#### Frontend
- **Modal de selección de modelos**: En la pestaña "Agente IA", los modelos se seleccionan mediante un modal con buscador y filtros
- **Vista previa de Ollama**: En "Proveedor LLM", al seleccionar Ollama se muestran los modelos disponibles con tamaño y parámetros
- **Proveedor Embeddings**: Ahora lista modelos de Ollama en vez de archivos .gguf

### 🗑️ Eliminado
- Lectura de archivos `.gguf` (carpetas `assets/llm/` y `assets/embedding/`) — ya no se usan
- Endpoints `GET /local/llm` y `GET /local/embeddings` reemplazados por `GET /ollama/models`
- Interfaz `LocalAssetInfo` eliminada del frontend y backend

---

## v0.1.4 — 2026-03-10

> 🐛 **Bugfixes: Test conexión, flujo local, OpenRouter y auto-respuesta del bot**

---

### 🐛 Fixes

#### Test de Conexión
- **Test local** ahora verifica que Ollama esté corriendo (`/api/tags`) en vez de intentar invocar un modelo
- **Test result** muestra un mensaje descriptivo (ej: "Ollama conectado. 3 modelo(s) disponibles")
- **Test online** envía un mensaje corto al modelo para verificar la API key

#### Proveedor Local (Ollama)
- **Ya no requiere tener archivos .gguf** para guardar proveedor local — solo activar "Local" es suficiente
- **Archivos .gguf son opcionales** — se muestra info explicando que los modelos se cargan desde Ollama
- **Modelos del agente** ahora consulta `GET /api/tags` de Ollama para listar modelos descargados + archivos .gguf locales

#### Proveedor OpenRouter
- **Los modelos aparecen correctamente** en el selector del agente después de guardar la API key
- **Resultados limitados a 200 modelos** para evitar responses enormes
- **Buscador de modelos** — se agrega campo de búsqueda cuando hay más de 10 modelos para filtrar rápidamente

#### Agente — Guardado de Modelo
- **`modelValue` ahora se acepta** en los schemas Zod de create y update agent (antes se descartaba)
- **Agent service actualizado** para guardar `modelValue` directamente sin requerir lookup en `ai_models` collection
- **Soporte para modelos remotos** — IDs como `openai/gpt-4` o `gemini-2.0-flash` se guardan directamente

#### Chat — Auto-respuesta del Bot
- **Bot ahora usa el system prompt del agente activo** en vez de un prompt hardcodeado en inglés
- **Fallback a prompt por defecto** si el agente no tiene system prompt configurado
- **RAG graceful degradation** — si la búsqueda RAG falla (ej: colección no existe), el bot continua sin contexto en vez de crashear
- **`agentService` importado estáticamente** en chat.service.ts para resolver error TS2307

---

## v0.1.3 — 2026-03-10

> 🔄 **Refactorización del flujo de proveedores: LLM + Embeddings separados, APIs dinámicas**

---

### 🔄 Refactored (Breaking Changes)

#### Flujo de Proveedores Rediseñado

- **Proveedores separados por tipo** — Ahora hay configuraciones independientes para LLM y Embeddings
  - **LLM**: `local` | `openrouter` | `gemini`
  - **Embedding**: `local` | `openrouter`
- **Solo 1 proveedor activo por tipo** — Al seleccionar un proveedor, se desactivan los demás del mismo tipo
- **Eliminados proveedores OpenAI y Claude** como opciones directas (accesibles vía OpenRouter)
- **Eliminado `@langchain/anthropic`** — Ya no es dependencia directa
- **Eliminadas variables de entorno de API keys** — `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` ya no están en `env.ts` (se gestionan desde la BD)

#### Modelo `ProviderConfig` Actualizado

- Nuevo campo `type: 'llm' | 'embedding'` — Identifica el tipo de proveedor
- Nuevo campo `selectedModel` — Modelo seleccionado (para local y embeddings)
- Nuevo campo `selectedModelName` — Nombre legible del modelo

### ✨ New

#### Lectura de Assets Mejorada

- **Carpetas + .gguf** — Ahora `readLocalAssets()` detecta tanto carpetas como archivos `.gguf`
- Ambas rutas: `src/assets/llm/` y `src/assets/embedding/`

#### APIs Remotas Dinámicas

- **`GET /api/ai-models/remote/openrouter`** — Consulta la API de OpenRouter (`GET /api/v1/models`) para listar modelos LLM en tiempo real
- **`GET /api/ai-models/remote/openrouter/embeddings`** — Consulta OpenRouter filtrando por "embedd" para modelos de embedding
- **`GET /api/ai-models/remote/gemini`** — Consulta `generativelanguage.googleapis.com/v1/models` para listar modelos Gemini

#### Endpoint de Modelos para Agente

- **`GET /api/ai-models/agent/models`** — Consulta el proveedor LLM activo y devuelve los modelos disponibles
  - Si local: devuelve el modelo seleccionado al configurar
  - Si openrouter/gemini: consulta la API remota con la API key guardada

#### Provider Config por Tipo

- **`GET /api/ai-models/providers/active/:type`** — Obtiene el proveedor activo para `llm` o `embedding`
- **`GET /api/ai-models/providers/configs/:type`** — Lista configs por tipo
- **`DELETE /api/ai-models/providers/config/:type/:provider`** — Elimina config por tipo+proveedor

#### Frontend — Pestañas Separadas

- **Pestaña "Proveedor LLM"** — Selector visual de proveedor (local/openrouter/gemini)
  - Local: muestra carpetas y archivos .gguf para selección inmediata del modelo
  - OpenRouter/Gemini: input de API Key (modelo se selecciona en el agente)
  - Test de conexión integrado
- **Pestaña "Proveedor Embeddings"** — Selector (local/openrouter)
  - Local: muestra archivos .gguf para selección inmediata
  - OpenRouter: API Key + botón "Cargar Modelos" + selector de modelo embedding
- **Pestaña "Agente IA"** — Modelo se carga dinámicamente desde `getModelsForAgent()`
  - Si no hay proveedor, muestra aviso amigable
  - Usa `<optgroup>` para agrupar por proveedor

#### RAG Service — Embeddings Dinámicos

- Ya no crea embeddings estáticos al inicio — resuelve la config del proveedor de embeddings activo en cada operación
- Función `resolveEmbeddingsConfig()` busca el proveedor de embedding activo en BD

---

## v0.1.2 — 2026-02-28

> 🔧 **Refactorización de librerías deprecadas + Soporte multi-proveedor LLM**

---

### 🔄 Refactored (Breaking Changes)

#### Migración de LangChain (eliminación de imports deprecados)

- **`ChatOllama`** — Migrado de `@langchain/community/chat_models/ollama` → `@langchain/ollama`
- **`OllamaEmbeddings`** — Migrado de `@langchain/community/embeddings/ollama` → `@langchain/ollama`
- **`QdrantVectorStore`** — Migrado de `@langchain/community/vectorstores/qdrant` → `@langchain/qdrant`
- **`RecursiveCharacterTextSplitter`** — Migrado de `langchain/text_splitter` → `@langchain/textsplitters`
- **`@langchain/core`** — Actualizado de `v0.3.x` → `v1.1.x` para compatibilidad con los nuevos paquetes
- **`@langchain/community`** — Eliminado completamente como dependencia directa
- **`langchain` (base)** — Ya no es necesario, se eliminó del proyecto
- **`@types/bcryptjs`** y **`@types/uuid`** — Eliminados (los paquetes ya incluyen sus propios tipos)

#### Compatibilidad Zod v4

- **`validation.middleware.ts`** — Reemplazado `AnyZodObject` (eliminado en Zod v4) por `z.ZodType<any>`
- **`error.middleware.ts`** — Actualizado `.errors` → `.issues` para compatibilidad con Zod v4

### ✨ New

#### Carpeta Assets (LLM + Embeddings)

- **`src/assets/llm/`** — Carpeta para almacenar modelos LLM locales (.gguf, .bin, .safetensors, .pt, .onnx)
- **`src/assets/embedding/`** — Carpeta para almacenar modelos de embeddings locales
- **`.gitignore`** — Configurado para ignorar archivos de modelo pero mantener `.gitkeep`
- **Endpoint `GET /api/ai-models/local/llm`** — Lee y lista los archivos de modelo en `assets/llm/`
- **Endpoint `GET /api/ai-models/local/embeddings`** — Lee y lista los archivos de embedding en `assets/embedding/`

#### Servicio Multi-Proveedor LLM (`llm-provider.service.ts`)

- **Nuevo servicio central** — Crea instancias de `ChatModel` dinámicamente según el proveedor configurado
- **Proveedores soportados:**
  - 🦙 **Ollama** (Local) — Sin API key, usa URL del servidor Ollama
  - 🤖 **OpenAI** — GPT-4o, GPT-4o Mini, GPT-4 Turbo
  - ✨ **Google Gemini** — Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
  - 🧠 **Anthropic Claude** — Claude Sonnet 4, Claude 3.5 Haiku, Claude 3 Opus
  - 🔀 **OpenRouter** — Acceso a cientos de modelos via una sola API
- **Paquetes NPM instalados:**
  - `@langchain/ollama` — ChatOllama + OllamaEmbeddings modernos
  - `@langchain/qdrant` — QdrantVectorStore moderno
  - `@langchain/textsplitters` — RecursiveCharacterTextSplitter moderno
  - `@langchain/openai` — ChatOpenAI (OpenAI + OpenRouter)
  - `@langchain/google-genai` — ChatGoogleGenerativeAI (Gemini)
  - `@langchain/anthropic` — ChatAnthropic (Claude)

#### API de Proveedores (Backend)

- **`GET /api/ai-models/providers/list`** — Lista proveedores disponibles con estado de configuración
- **`GET /api/ai-models/providers/configs`** — Obtiene configs guardadas (API keys enmascaradas)
- **`POST /api/ai-models/providers/config`** — Guarda API key de un proveedor
- **`DELETE /api/ai-models/providers/config/:provider`** — Elimina API key de un proveedor
- **`POST /api/ai-models/providers/test`** — Prueba la conexión con un proveedor
- **Modelo `ProviderConfig`** — Nueva colección MongoDB `provider_configs` para almacenar API keys por proveedor

#### Resolución Dinámica de Modelo (`ai.service.ts`)

- **Refactorizado completamente** — Ya no tiene modelo hardcodeado
- **`resolveModelConfig()`** — Busca el agente activo, obtiene su modelo y proveedor, y crea el ChatModel correcto dinámicamente
- **Fallback inteligente** — Si no encuentra configuración, usa Ollama con `llama3.2:3b`

#### Frontend — Pestaña Proveedores

- **Nueva pestaña** "Proveedores" en `Settings.vue` — Gestión completa de API keys
  - Input de API key con toggle mostrar/ocultar
  - Botón "Guardar" para persistir la key
  - Botón "Test" para probar la conexión
  - Botón "Eliminar" para quitar la key
  - Indicadores de estado: "Configurado", "Local"
  - Listado de modelos disponibles por proveedor
- **Selector de modelo agrupado** — En `Settings.vue`, `Agents.vue` y `ProjectSetup.vue`, los modelos ahora se muestran agrupados por proveedor con optgroups
- **Agents.vue** — Vista completamente funcional con create, edit, delete, y badges de proveedor
- **settings.service.ts** — Nuevos tipos y métodos para: `getProviders()`, `getProviderConfigs()`, `saveProviderConfig()`, `deleteProviderConfig()`, `testProviderConnection()`, `getLocalModels()`, `getLocalEmbeddings()`

#### Configuración

- **`config/env.ts`** — Nuevas variables de entorno opcionales: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`

---

## v0.1.1 — 2026-02-28

### ✨ New

- **`.gitignore` configurado** — Archivo `.gitignore` completo para el monorepo, cubriendo `node_modules`, builds, archivos `.env`, IDEs, archivos del SO, uploads de usuario, y archivos temporales.

---

## v0.1.0 — 2026-02-28

> 🚀 **Release inicial del MVP completo** — Backend + Frontend + Infraestructura Docker

---

### ✨ New

#### Infraestructura & Monorepo

- **Monorepo con pnpm Workspaces** — Estructura organizada con `apps/backend`, `apps/frontend` y `packages/shared`, gestionada con pnpm workspaces.
- **Docker Compose para servicios** — Orquestación de MongoDB, Redis, Qdrant, Ollama y NATS con un solo comando (`docker-compose up`). Incluye persistencia de volúmenes para datos y modelos.
- **Variables de entorno validadas con Zod** — Configuración centralizada en `config/env.ts` con validación estricta de todas las variables de entorno al iniciar el servidor.

#### Backend — API REST (Express + TypeScript)

- **Servidor Express con TypeScript** — Backend completo sobre Express 4 con TypeScript estricto, estructura modular en capas (controllers → services → models).
- **Sistema de autenticación JWT** — Registro, login y verificación de token con expiración de 24 horas. El primer usuario registrado se convierte automáticamente en admin. Passwords hasheados con bcrypt (12 rounds).
- **Middleware de autenticación y autorización** — `authenticate` valida JWT en cada request protegido. `authorize('admin', 'support')` permite control de acceso por roles.
- **Gestión de usuarios** — CRUD completo de usuarios con roles (`admin`, `support`, `assistant`), estados (`Active`, `Inactive`), búsqueda, paginación, ordenamiento, y cambio de contraseña. Nunca se expone el hash de password en respuestas.
- **Gestión de contactos** — CRUD completo con búsqueda por nombre/email/teléfono, filtros por plataforma, estado y tags, paginación, ordenamiento, soft delete (archivar/restaurar), y creación automática de contactos al responder el primer mensaje.
- **Sistema de conversaciones en tiempo real** — Conversaciones multi-plataforma (WhatsApp, Instagram, Web) con modos `auto_pilot` y `human_takeover`, estados (active, closed, pending_human), conteo de mensajes no leídos, y datos temporales del cliente (`clientInfo`) antes de crear el contacto.
- **Chat Service con lógica de negocio** — Envío de mensajes por `contact`, `ai_agent` y `human_agent`. Creación automática del contacto cuando un agente humano responde por primera vez. Generación automática de respuestas del bot en modo auto_pilot usando RAG + IA.
- **Motor RAG (Retrieval-Augmented Generation)** — Procesamiento de archivos PDF, TXT y CSV. Text splitting con `RecursiveCharacterTextSplitter` (1000 chars, 200 overlap). Embeddings con `nomic-embed-text` vía Ollama. Indexación vectorial en Qdrant con `QdrantVectorStore`. Búsqueda semántica por similaridad. También acepta texto escrito manualmente como fuente de conocimiento.
- **Servicio de IA con Ollama** — Integración con `ChatOllama` de LangChain para generar respuestas y analizar sentimiento. Soporte para system prompts personalizables y contexto RAG inyectado automáticamente.
- **Gestión de modelos IA** — CRUD de modelos IA con seed automático al inicio (Llama 3.2, Qwen 2.5 Coder, CodeLlama). Filtro por modelos activos/inactivos. Prevención de duplicados por `value`.
- **Gestión de agentes** — CRUD de agentes IA con referencia a modelos, system prompts, mensajes de bienvenida/despedida, configuración de temperatura y max tokens, habilitación por canal, y estado activo/inactivo.
- **Sistema de proyectos** — Creación de proyecto con agente asociado automáticamente. Solo se permite un proyecto activo. Configuración de canales, mensajes y opciones del bot.
- **Configuración dinámica** — Sistema key-value en MongoDB para configuraciones globales (canales, mensajes, personalidad, opciones). Merge con valores por defecto si no existen en la BD. Soporte para upsert individual y masivo (`setAll`).
- **Dashboard Analytics** — Estadísticas de conversaciones (total, activas, cerradas, tasa de respuesta), volumen por período, distribución por canal, y actividad reciente.
- **WebSocket (Socket.io)** — Comunicación en tiempo real para mensajes de chat y notificaciones de nuevas conversaciones. Soporte para rooms por conversación (`join:room`).
- **Upload de archivos** — Middleware Multer para subida de archivos con almacenamiento en `uploads/`.
- **Middleware de validación y errores** — Validación de requests y manejo global de errores con responses estandarizadas.
- **Script de seed** — Script `pnpm seed` que limpia toda la base de datos y crea un usuario admin demo (`admin@mitchbot.io` / `admin123`).

#### Frontend — Dashboard (Vue 3 + TypeScript + Tailwind CSS)

- **App Vue 3 con Composition API** — Frontend con `<script setup>` y TypeScript en todo el código. Build con Vite. Routing con Vue Router.
- **Layout System** — `DashboardLayout` con `Sidebar` colapsable y `Topbar`. Vistas sin layout para Login y ProjectSetup.
- **Pantalla de Login** — Autenticación con JWT, almacenamiento de sesión en localStorage, redirección automática si ya está autenticado.
- **Project Setup (Onboarding)** — Flujo de configuración inicial del proyecto y agente IA. Si no existe un proyecto, el usuario es redirigido al setup antes de acceder al dashboard.
- **Dashboard principal** — Vista con métricas de conversaciones, gráficos de volumen y distribución por canal, y actividad reciente.
- **Messaging (Centro de mensajes)** — Vista completa de mensajería en tiempo real con lista de conversaciones, panel de chat, envío de mensajes como agente humano, y conexión WebSocket para actualizaciones en vivo.
- **Contactos** — Gestión completa de contactos con búsqueda, filtros, paginación, y acciones de editar/archivar/restaurar.
- **Brain (Base de conocimiento)** — Interfaz para subir documentos (PDF, TXT, CSV) y texto manual a la base de conocimiento RAG. Lista de fuentes indexadas con estado (Processing, Indexed, Failed).
- **Agents** — Gestión de agentes IA con selección de modelo, configuración de prompts, temperatura y tokens, y canales habilitados. Los modelos se cargan dinámicamente desde el backend.
- **Settings** — Configuración global del proyecto: canales habilitados, mensajes de bienvenida/despedida, y opciones. Datos cargados y guardados desde/hacia la base de datos.
- **Profile** — Vista de perfil del usuario autenticado (separada de Settings) con edición de nombre, email y contraseña.
- **Users** — Gestión de usuarios del sistema con CRUD completo conectado al backend: crear, editar, cambiar roles, activar/desactivar usuarios.
- **Test Chat** — Vista de pruebas para simular conversaciones y probar la respuesta del bot.
- **Services Layer** — Capa de servicios en el frontend (`auth`, `brain`, `contact`, `dashboard`, `messaging`, `project`, `settings`, `socket`, `user`) que abstrae todas las llamadas HTTP y WebSocket al backend.
- **Navigation Guard** — Protección de rutas: verificación de autenticación, verificación de proyecto configurado, y redirección automática según el estado del usuario.

#### API Endpoints

| Módulo | Endpoints | Descripción |
|:-------|:----------|:------------|
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password` | Autenticación y perfil |
| **Users** | `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id` | Gestión de usuarios |
| **Contacts** | `GET /api/contacts`, `GET /api/contacts/:id`, `PUT /api/contacts/:id`, `PATCH /api/contacts/:id/archive`, `PATCH /api/contacts/:id/restore` | Gestión de contactos |
| **Conversations** | `GET /api/conversations`, `GET /api/conversations/:id`, `GET /api/conversations/:id/messages`, `POST /api/conversations/:id/messages`, `PATCH /api/conversations/:id/mode`, `PATCH /api/conversations/:id/status` | Mensajería |
| **Brain** | `GET /api/brain/sources`, `POST /api/brain/upload`, `POST /api/brain/text`, `DELETE /api/brain/sources/:id`, `POST /api/brain/search` | Base de conocimiento RAG |
| **Agents** | `GET /api/agents`, `POST /api/agents`, `PUT /api/agents/:id`, `DELETE /api/agents/:id` | Agentes IA |
| **AI Models** | `GET /api/ai-models`, `POST /api/ai-models`, `PUT /api/ai-models/:id`, `DELETE /api/ai-models/:id` | Modelos de IA |
| **Config** | `GET /api/config`, `PUT /api/config` | Configuración global |
| **Project** | `GET /api/project`, `GET /api/project/check`, `POST /api/project`, `PUT /api/project/:id` | Gestión de proyecto |
| **Dashboard** | `GET /api/dashboard/stats`, `GET /api/dashboard/volume`, `GET /api/dashboard/channels`, `GET /api/dashboard/activity` | Analytics |

#### Modelos de Datos (MongoDB)

| Colección | Campos Clave |
|:----------|:-------------|
| `users` | name, email, password (hash), role, status, avatar |
| `contacts` | name, phone, email, platform, status, tags, metadata |
| `conversations` | contactId, platform, status, mode, clientInfo, unreadCount |
| `messages` | conversationId, sender, content, contentType, isBot |
| `agents` | name, modelId, systemPrompt, config |
| `ai_models` | name, value, provider, category, isActive |
| `projects` | name, agentId, config (channels, messages, options) |
| `knowledge_sources` | name, type, size, status, vectorCount, filePath |
| `config` | key, value (key-value store dinámico) |
| `activities` | type, description, createdAt |

#### Stack Tecnológico

| Capa | Tecnologías |
|:-----|:------------|
| **Runtime** | TypeScript, tsx (desarrollo) |
| **Backend** | Express 4, Socket.io, Multer, Zod |
| **Frontend** | Vue 3, Vite, Tailwind CSS 3, Pinia, Vue Router 4 |
| **Base de datos** | MongoDB 6 (principal), Redis (cache), Qdrant (vectorial) |
| **IA** | Ollama, LangChain.js, nomic-embed-text (embeddings) |
| **Mensajería** | NATS (event bus), Socket.io (tiempo real) |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Infraestructura** | Docker Compose, pnpm workspaces |

---
