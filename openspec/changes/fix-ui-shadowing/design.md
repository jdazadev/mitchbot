## Context

Ver `proposal.md - Why`. El mecanismo del defecto es de resolución de módulos: Vite resuelve imports sin extensión con prioridad `.js` sobre `.ts`, por lo que 56 artefactos compilados antiguos (28 `.js`/`.vue.js` + 28 `.js.map`, fechados marzo/abril) ubicados junto a los fuentes vigentes ganan la resolución. El backend y la base de datos no participan del defecto: `/api/conversations` responde en milisegundos y la colección está vacía.

Diagnóstico reproducido en navegador headless: el módulo servido al navegador fue `socket.service.js` (sin `onMessageUpdated`), lo que produjo `TypeError` en el hook `onMounted` de `Messaging.vue` y dejó `isLoadingChats` en `true` de forma permanente.

## Goals / Non-Goals

**Goals:**

- Devolver al frontend a una resolución de módulos basada únicamente en fuentes actuales.
- Hacer que la bandeja de conversaciones cargue siempre (lista o estado vacío), sin depender del éxito de la inicialización del socket.
- Evitar que artefactos compilados vuelvan a convivir con los fuentes.

**Non-Goals:**

- No se rediseña la vista de mensajería ni su funcionalidad pendiente (búsqueda, filtros, insights), que se tratan por separado.
- No se cambia el backend ni el contrato de la API.
- No se introduce un framework de pruebas en este cambio (ver change `e2e-playwright`).

## Decisions

### D1: Eliminar los artefactos obsoletos en lugar de renombrar imports

Se eliminan los `.js`/`.vue.js` de `apps/frontend/src/`. Alternativa considerada: forzar extensiones explícitas (`.ts`) en cada import para evitar la ambigüedad. Se descarta porque no elimina la causa raíz y deja basura regenerable en el árbol de fuentes.

### D2: Endurecer el arranque de `Messaging.vue` moviendo la carga de datos a un punto garantizado

La inicialización de socket y la carga de datos se desacopla: la carga de conversaciones no debe quedar después de llamadas que pueden lanzar excepción. Alternativa considerada: envolver todo `onMounted` en `try/catch`. Se prefiere garantizar que la carga de datos se ejecute y que sus errores se registren, cumpliendo el requisito de carga resiliente.

### D3: Prevención por configuración de compilación + control de versiones

Se evita la emisión de artefactos dentro de `src/` en la configuración de TypeScript del frontend y se excluyen del control de versiones. Alternativa considerada: dejar solo la eliminación puntual. Se descarta porque el problema reaparecería si alguna herramienta vuelve a compilar in-place.

## Risks / Trade-offs

- **[Se elimina algún artefacto `.js` que sí sea fuente real]** → Se verifica primero que cada `.js` tiene su `.ts`/`.vue` equivalente antes de borrar; ante duda se conserva y se reporta.
- **[La app depende accidentalmente de un artefacto obsoleto]** → Tras eliminar, se valida la carga de las rutas principales en navegador; cualquier dependencia oculta se hace visible y se corrige sobre el fuente.
- **[El cambio no aporta specs de valor]** → Se acota a `frontend-module-loading` con escenarios verificables (carga de mensajería y resolución de módulos).

## Migration Plan

1. Verificar correspondencia 1:1 entre cada artefacto obsoleto y su fuente.
2. Eliminar los artefactos y reiniciar el servidor de desarrollo de Vite.
3. Validar `/messaging`, `/contacts`, `/brain` y `/` en navegador sin errores de consola.
4. Aplicar la prevención de configuración para que no se regeneren.

Rollback: los artefactos son regenerables; en el peor caso se restaura desde el commit inicial.

## Open Questions

Ninguna.
