---
version: 1
slug: "apps-frontend-src-views-messaging-vue"
primary_target: "apps/frontend/src/views/Messaging.vue"
related_targets:
  - "apps/frontend/src/views/TestChat.vue"
---

# Mensajería (Messaging) · superficie primaria

- Modo: Operate. Plataforma: web. Alcance: la vista de Conversaciones del dashboard y, como cara del cliente, el chat público (`TestChat.vue`). El mundo vigente es **Aurora** (ver `DESIGN.md`).

## Audience, job, action
- Operador PYME/soporte en escritorio, jornada larga; escanea la bandeja, atiende el hilo o toma el control. Realtime vivo (badges de no leídos, modos `auto_pilot`/`human_takeover`, insights de sentimiento, tool use). Honestidad funcional: solo elementos con comportamiento real.

## Direction contract
- THESIS: "un estudio optimista a media mañana": lienzo de papel cálido con niebla de pasteles en los bordes, tinta negra de imprenta, tipografía display enorme y una familia pastel que **significa algo** — lila=persona/selección, lima=bot/éxito, cielo=Web, mantequilla=espera.
- OWN-WORLD: `--canvas #f7f3ef`, `--surface #fff`, `--sunken #efebe5`, `--ink-1 #0b0b0c`; pasteles `--sky/--lime/--lilac/--butter` con `-ink`/`-soft`; acento de identidad por proyecto (`--brand*`, recalcula `useBrand`); radios `--r-card 20px`/`--r-big 28px`/`--r-bubble 20px`; sombras difusas sin halo de color. Tema oscuro "Aurora de noche" por `data-theme` (recompone, no invierte).
- STORY: el operador lee la cola, abre el hilo, responde o despliega la toma de control (confirmada en modal), y ve el estado del bot/insights/urgencia sin recargar.
- FIRST VIEWPORT: rail flotante con marca + nav; bandeja con búsqueda, chips de canal y badge de no leídos; hilo con cabecera (pill de modo, toggle de **modo enfoque**, confirmación de cambio de modo) y composer honesto; tarjeta lateral de Sentimiento y bloque de **Urgencia** (3 niveles; el alto enciende rojo con sentimiento negativo + mensaje del cliente sin responder).
- FORM: Aurora (cápsulas flotantes, tinta primaria de acción, pasteles semánticos). Code-led.
- Memorable moment: girar la llave de modo (lila=persona) confirma en modal y deja un acuse honesto en el hilo, sin abandonar el piloto automático por accidente.
- FINISH: errores de envío/modo/contacto/insights con banner inline y reintento; anti doble-submit; borrador conservado; anuncio acotado de mensajes entrantes; sin acciones decorativas.
