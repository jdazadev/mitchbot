## Purpose

Garantiza que el frontend se ejecute siempre a partir de sus fuentes TypeScript/Vue actuales, sin artefactos compilados obsoletos que las eclipsen, y que las vistas toleren fallos de inicialización sin quedar en estados de carga permanentes.

## ADDED Requirements

### Requirement: Resolución de módulos desde fuentes actuales

El frontend SHALL resolver todos sus imports de código desde los fuentes vigentes (`.ts` y `.vue`). No DEBE existir ningún artefacto compilado (`.js` o `.vue.js`) dentro de `apps/frontend/src/` que pueda tener prioridad sobre los fuentes.

#### Scenario: Mensajería carga el código actual

- **WHEN** un usuario autenticado navega a `/messaging`
- **THEN** el módulo de socket cargado incluye la API completa del servicio actual (incluida la suscripción a mensajes actualizados)
- **AND** no se produce ningún `TypeError` de inicialización en la vista

#### Scenario: Import sin extensión resuelve al fuente

- **WHEN** un módulo importa otro sin especificar extensión (por ejemplo `../services/socket.service`)
- **THEN** la resolución usa el archivo `.ts` vigente y no un `.js` compilado

### Requirement: Carga resiliente de vistas

Toda vista que dispare carga de datos en su inicialización SHALL finalizar su estado de carga aunque falle la inicialización de algún servicio auxiliar (conexión de socket, suscripciones de eventos). Un fallo SHALL registrarse y SHALL NOT impedir la carga de los datos principales.

#### Scenario: Fallo de inicialización no bloquea los datos

- **WHEN** la inicialización de un servicio auxiliar de una vista lanza un error
- **THEN** la vista continúa y ejecuta la carga de sus datos principales
- **AND** el indicador de carga deja de mostrarse cuando la carga finaliza

#### Scenario: Listado de conversaciones siempre resuelve

- **WHEN** un usuario autenticado abre la bandeja de conversaciones
- **THEN** el indicador "Cargando conversaciones..." desaparece y se muestra la lista o su estado vacío
- **AND** el indicador no permanece visible de forma indefinida

### Requirement: Prevención de artefactos compilados en el código fuente

El proyecto SHALL configurar la compilación y el control de versiones de forma que no se generen ni se rastreen archivos compilados dentro de `apps/frontend/src/`.

#### Scenario: El compilador no emite dentro de src

- **WHEN** se ejecuta la verificación o compilación de tipos del frontend
- **THEN** no se crean archivos `.js` junto a los `.ts`/`.vue` en `apps/frontend/src/`

#### Scenario: Los artefactos obsoletos quedan fuera del repositorio

- **WHEN** se inspeccionan los archivos versionados del frontend
- **THEN** no aparecen artefactos `.js`/`.vue.js` junto a los fuentes
