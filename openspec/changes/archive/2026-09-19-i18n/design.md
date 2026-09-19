## Context

Ver `proposal.md` para la motivación. Estado relevante para el diseño:

- No existe ninguna librería de i18n y todos los textos visibles están hardcodeados en las vistas.
- El patrón actual mezcla idiomas: el shell (Sidebar, Topbar, Dashboard, Brain, Messaging) está en inglés y las vistas de gestión (Settings, Users, Agents, Clients, ProjectSetup) en español.
- `index.html` declara `lang="en"`.
- `TestChat.vue` es la vista pública del cliente; el idioma del agente ya existe en su personalidad (`es`/`en` tras el change `shell-y-naming`).
- Pinia está instalado pero no hay stores; el proyecto usa Composition API con `<script setup>`.

## Goals / Non-Goals

**Goals:**

- Base de i18n única para el dashboard con español por defecto e inglés como alternativa.
- Selector de idioma persistente y aplicado en vivo.
- Cero textos de interfaz hardcodeados tras la extracción.
- Chat público con idioma propio derivado del agente.

**Non-Goals:**

- Internacionalizar los mensajes de error del backend (requiere códigos de error; fuera de alcance).
- Añadir más idiomas que español e inglés (coherente con `shell-y-naming`).
- Detección automática del idioma del navegador (se prioriza un comportamiento predecible).

## Decisions

### D1. vue-i18n en modo Composition API

Se añade `vue-i18n` (modo `legacy: false`) y se registra el plugin en `main.ts`.

- **Rationale**: estándar de facto en Vue 3, con soporte de Composition API, interpolación y pluralización; evita mantener un diccionario casero.
- **Alternativas**: diccionario reactivo propio (reinventa features y mantenimiento); soluciones basadas en build (menos ergonomía en runtime).

### D2. Catálogos `es.json`/`en.json` con claves por dominio, español como fallback

Las claves se organizan por módulo (`nav.*`, `common.*`, `dashboard.*`, `messaging.*`, `clients.*`, `brain.*`, `settings.*`, `users.*`, `agents.*`, `profile.*`) y el idioma de respaldo es español.

- **Rationale**: extracción incremental por vista y claves localizables; el fallback evita ver claves crudas si falta una traducción.
- **Alternativas**: un solo archivo plano (difícil de mantener); claves por defecto en inglés (rompe el default español).

### D3. Selector en el Topbar con persistencia en `localStorage`

El idioma inicial proviene de `localStorage` ("mitchbot.locale") y, si no existe, es español. El selector del Topbar actualiza el idioma en vivo y lo persiste.

- **Rationale**: comportamiento determinista y persistente sin backend; no se depende del idioma del navegador.
- **Alternativas**: detectar el navegador (resultado impredecible en la demo); guardar en el perfil del usuario (requiere backend y autenticación, innecesario ahora).

### D4. Catálogo propio para el chat público

`TestChat.vue` usa un conjunto de claves propio (`publicChat.*`) y selecciona el idioma según la personalidad del agente del proyecto, no según el `localStorage` del dashboard.

- **Rationale**: el cliente final no debe ver el idioma que eligió el agente humano; el idioma del chat depende del agente del proyecto.
- **Alternativas**: reutilizar el locale del dashboard (acopla la vista pública a una preferencia interna).

### D5. Estabilidad de e2e

Los specs que hoy localizan elementos por texto se ajustan para usar roles/`data-testid` donde sea razonable y corren con el idioma por defecto (español); se añade un spec que verifica el cambio de idioma.

- **Rationale**: la extracción de textos no debe convertir los e2e en frágiles ante traducciones.
- **Alternativas**: fijar el idioma en los tests sin estabilizar selectores (deja fragilidad latente).

## Risks / Trade-offs

- **Diff mecánico y extenso** → se extrae por vista y se verifica con el build; el cambio se implementa al final (tras limpiar UI muerta) para no traducir textos que se eliminan.
- **Claves faltantes o textos olvidados** → fallback a español y una tarea de barrido final por vista.
- **e2e dependientes de texto** → estabilización con selectores y spec dedicado de idioma en el mismo change.
- **Elegir idioma por `localStorage` no sigue al usuario entre dispositivos** → aceptable; se anota como posible mejora futura (perfil de usuario).

## Migration Plan

1. Desplegar solo el frontend (no hay cambios de backend ni de datos).
2. La preferencia de idioma arranca en español; los usuarios que ya usaban la app no ven cambios de contrato.
3. Rollback: revertir el despliegue; no hay estado persistido salvo la clave de `localStorage`, que se ignora sin la librería.

## Open Questions

- ¿El idioma del dashboard debería seguir la preferencia del perfil del usuario a futuro? Se difiere; no cambia specs, enfoque ni tareas.
