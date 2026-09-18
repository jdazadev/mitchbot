## Why

El proyecto no tiene pruebas automatizadas: existe solo la plantilla por defecto de Playwright apuntando a un sitio externo. Tras una regresión severa por artefactos compilados obsoletos que rompió la mensajería, se necesita una batería e2e extensa que valide los flujos críticos de la plataforma de forma determinista y repetible, sin costo de proveedor ni dependencias frágiles, ejecutable en local y en CI.

## What Changes

- Configurar Playwright con `baseURL` de la aplicación, reutilización de servidores de desarrollo y reporte HTML.
- Autenticación reutilizable mediante estado de almacenamiento (login una vez, reutilizado por las pruebas).
- Datos de prueba dedicados (fixtures/seed) y aislamiento entre pruebas.
- Respuestas del bot deterministas: las pruebas SHALL NOT invocar al proveedor de IA real.
- Batería de pruebas por módulo: autenticación, onboarding/setup, dashboard, mensajería (streaming y confirmación de herramientas), contactos, base de conocimiento (RAG), usuarios, configuración, agentes, perfil y chat público.
- Reporte de resultados y comandos de ejecución documentados.

## Capabilities

### New Capabilities

- `e2e-testing`: Infraestructura y batería de pruebas end-to-end de la plataforma, con autenticación reutilizable, datos de prueba aislados y respuestas del bot deterministas.

### Modified Capabilities

<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Nuevos**: `playwright.config.ts` (ajustado), `tests/` (setup de autenticación, fixtures, specs por módulo), utilidades de datos de prueba.
- **Backend**: posibilidad de apuntar el proveedor a una base URL configurable para el entorno de pruebas (stub local); sin cambios de comportamiento en producción.
- **Dependencias**: `@playwright/test` ya instalado; puede requerir una utilidad de stub/mock local.
- **Sin impacto** en base de datos de producción ni en la API pública.
- **Dependencia de orden**: la batería se escribe contra la UI final de los changes `fix-ui-shadowing`, `refactor-proveedores-openrouter` y `multi-proyecto-usuarios`; se implementa al final.
