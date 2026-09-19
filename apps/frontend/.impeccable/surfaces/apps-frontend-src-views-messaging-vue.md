---
version: 1
slug: "apps-frontend-src-views-messaging-vue"
primary_target: "apps/frontend/src/views/Messaging.vue"
related_targets: []
---

# Mensajería (Messaging) · prima de todo el sistema Mitchbot

## Scope & visitor mode
- **Modo: Operate.** La vista Messaging es la primera superficie del rediseño y el escaparate de la App Cálida; Sidebar/Topbar/DashboardLayout heredan el mismo mundo.
- Superficie primaria: `apps/frontend/src/views/Messaging.vue` + `components/layout/*`.

## Audience, job, action
- Operador (PYME / soporte / agencia) certando la cola del día: escanear conversaciones, ver estado (bot/humano/cerrado), responder, tomar control.
- Restricción dura: solo elementos funcionales (honestidad funcional); realtime (badges, modos, typing) debe seguir reaccionando en vivo.

## Direction contract
- THESIS: "Mitchbot es el ayudante diario del negocio": suelo cálido, tarjetas con radio 14-16px y un único color de acción que aparece solo donde hay algo que hacer; el color de la marca del proyecto ES ese acento (variable CSS), rechazando el dashboard azul corporativo.
- OWN-WORLD: ground tintado cálido `#FBF7F2`, tarjetas blancas con sombra difusa mínima y radio 14px (mensajes 18px), ink `#2E2A26` / `#7A6A5D` (nunca gris puro), acento = variable de marca (semitono pastel para fondos y estados), tipografía humanista redondeada (Nunito 400/600/700/800), sin gradientes decorativos.
- STORY: el operador entra, ve la cola con sellos de estado claros y badges de no leídos viven, entra al hilo que le importa, responde o toma control; la marca del proyecto da identidad desde la marca lateral.
- FIRST VIEWPORT: sidebar con marca (logo/nombre por proyecto), lista de conversaciones con avatar "sello" redondeado y badge de contador en acento solo-acción, hilo a la derecha con burbujas en acento (del bot/humano) vs blancas (del cliente), composer siempre visible.
- FORM: aceite sobre el heredado; parte de la respuesta visual del mock `app-calida.html`.
- FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment
- El cambio de color del proyecto se replica al instante en toda la interfaz (una sola variable de acento) + sello-avatar con radio bicolor 14/6px.

## Unresolved decisions
- Persistencia backend de la configuración de marca (nombre/color/logo) por proyecto: el frontend consume `project.config.brand` cuando exista; backend pendiente.
