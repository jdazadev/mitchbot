## 1. Configuración base de Playwright

- [x] 1.1 Configurar `playwright.config.ts` con `baseURL` de la app, `webServer` con `reuseExistingServer`, proyecto Chromium por defecto y reporter HTML; verificar con una prueba trivial contra la app local.
- [x] 1.2 Añadir scripts/comandos de ejecución (suite completa, un módulo, modo UI) en `package.json` y verificar que cada comando funciona.
- [x] 1.3 Documentar prerrequisitos (servicios Docker y servidores de la app/stub) y verificar que la suite falla con un mensaje claro si faltan.

## 2. Autenticación y datos de prueba

- [x] 2.1 Implementar un *setup project* que autentique un usuario e2e y persista `storageState`; verificar que las pruebas reutilizan la sesión sin volver a loguearse.
- [x] 2.2 Crear/extender un seed e2e que garantice un proyecto y usuario dedicados; verificar que la suite puede operar sobre ellos sin tocar datos de producción.
- [x] 2.3 Implementar utilidades de generación de datos únicos por prueba y limpieza best-effort; verificar ejecución en paralelo sin colisiones.

## 3. Determinismo del proveedor de IA

- [x] 3.1 Hacer configurable la base URL del proveedor (`OPENROUTER_BASE_URL`) en el backend y verificar que por defecto sigue usando el endpoint real.
- [x] 3.2 Implementar un stub local compatible con la API de OpenAI (respuesta y streaming) y levantarlo en el entorno e2e; verificar que una respuesta de bot se genera sin llamar al proveedor real.
- [x] 3.3 Verificar que las pruebas no realizan tráfico saliente al proveedor real (falla si se detecta) mediante una prueba de guardia.

## 4. Batería por módulo

- [x] 4.1 Specs de autenticación: login válido/ inválido, registro y cierre de sesión; verificar redirecciones correctas.
- [x] 4.2 Specs de onboarding/setup: creación del primer proyecto y llegada al dashboard; verificar el flujo completo.
- [x] 4.3 Specs de dashboard: carga de métricas y navegación principal; verificar que no hay errores de consola.
- [x] 4.4 Specs de mensajería: listado de conversaciones (regresión del cuelgue), apertura de un chat, envío como agente humano; verificar contenidos y ausencia de spinner permanente.
- [x] 4.5 Specs de contactos: listado, búsqueda/filtro, edición y archivado/restauración; verificar resultados.
- [x] 4.6 Specs de base de conocimiento: subida de texto/fuente, listado y búsqueda; verificar estados de indexación con el proveedor stub.
- [x] 4.7 Specs de usuarios: alta con proyectos asignados, edición, roles válidos; verificar listado y permisos.
- [x] 4.8 Specs de configuración, agentes y perfil: canales, mensajes, selección de modelo del agente y edición de perfil; verificar persistencia.
- [x] 4.9 Specs de chat público: inicio de conversación por slug y llegada del mensaje a la bandeja; verificar el flujo cliente→dashboard.
- [x] 4.10 Specs de tiempo real: streaming incremental de la respuesta del bot y flujo de confirmación/cancelación de herramienta; verificar ambos caminos.

## 5. Verificación y CI

- [x] 5.1 Ejecutar la suite completa en local y verificar que pasa de forma estable (al menos dos corridas consecutivas).
- [x] 5.2 Dejar la suite lista para CI (headless, sin `test.only`, workers configurados) y verificar una corrida en modo CI.

## 6. Cierre

- [x] 6.1 Actualizar `changelog.md` y `AGENTS.md` con la sección de pruebas e2e y subir la versión según semver (cambio menor: 1.18.0 o 2.0.1 según el estado tras los changes previos).
