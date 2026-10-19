## 1. Configuración de entorno

- [x] 1.1 Añadir `OPENROUTER_API_KEY` (y modelos por defecto opcionales para embeddings/OCR) al esquema validado en `config/env.ts` y verificar que el backend arranca con y sin la variable (error claro si falta al generar).
- [x] 1.2 Documentar las nuevas variables en `AGENTS.md` y en el ejemplo de entorno, excluyéndolas de control de versiones; verificar que no se versionan valores reales.

## 2. Proveedor único OpenRouter (backend)

- [x] 2.1 Reducir `llm-provider.service.ts` a la rama de OpenRouter para LLM y embeddings, eliminando ollama/gemini; verificar compilación de tipos y que la creación de modelo de chat funciona.
- [x] 2.2 Simplificar la cadena de `ocr.service.ts` a OpenRouter como proveedor, eliminando ollama/mistral y conservando el fallback de extracción legacy; verificar extracción sobre un PDF de prueba (usando DevAdminTests tras el punto 6).
- [x] 2.3 Reimplementar `reranker.service.ts` sobre embeddings de OpenRouter (o dejarlo desactivable por `rag.use_reranker`) y verificar que una consulta RAG funciona con y sin re-ranker.
- [x] 2.4 Eliminar endpoints de proveedores obsoletos (`/providers/configs*`, `/providers/test*`, `/ollama/models`, `/remote/gemini`) y conservar `/remote/openrouter` y `/agent/models`; verificar que las rutas eliminadas responden 404 y las conservadas funcionan.

## 3. Credenciales fuera de la base de datos

- [x] 3.1 Eliminar `apiKey` de `ProviderConfig` y de `ai-model.service.ts`, ajustando `ai.service.resolveModelConfig` para tomar la credencial del entorno; verificar que ninguna respuesta de API devuelve credenciales.
- [x] 3.2 Ajustar embeddings (`rag.service.ts`) y OCR para tomar modelo/credenciales de configuración/entorno; verificar indexación de un archivo de prueba.

## 4. Roles sin devadmin (backend)

- [x] 4.1 Quitar `devadmin` del enum de `user.model.ts`, de `auth.service.ts`, `user.service.ts` y `users.controller.ts`, y reasignar/eliminar autorizaciones `authorize('devadmin')`; verificar compilación y que crear/asignar `devadmin` por API es rechazado.
- [x] 4.2 Actualizar `scripts/seed.ts` para no crear usuario `devadmin`; verificar que el seed no crea roles inválidos.

## 5. Frontend: eliminación de la UI de proveedores

- [x] 5.1 Eliminar `views/DevAdminModels.vue`, su ruta `/devadmin/models` y las funciones de `settings.service.ts` que solo servía; verificar que no quedan referencias y que el frontend compila.
- [x] 5.2 Quitar de `Sidebar.vue` y `Users.vue` toda referencia a `devadmin`; verificar que el menú no muestra "Proveedores" y que la gestión de usuarios solo ofrece roles válidos.
- [x] 5.3 Verificar que la selección de modelo del agente en `Agents.vue` sigue funcionando con `/agent/models` (solo OpenRouter).

## 6. Ruta aislada de herramientas internas

- [x] 6.1 Mover `DevAdminTests.vue` a la ruta `/dev/tests` (autenticada, sin guard de rol, sin entrada de menú) y eliminar `/devadmin/tests`; verificar acceso por URL autenticado y redirección a login sin sesión.
- [x] 6.2 Verificar que la extracción de texto de prueba no crea fuentes de conocimiento (consultar colección antes/después).

## 7. Migración de datos

- [x] 7.1 Ejecutar la migración para eliminar `apiKey` de `provider_configs` y normalizar/eliminar el usuario `devadmin`; verificar que ningún documento conserva `apiKey` y que no queda ningún usuario con rol `devadmin`.

## 8. Verificación integral

- [x] 8.1 Verificar flujo completo: chat del bot con OpenRouter (modelo del agente), RAG con embeddings OpenRouter y generación de respuesta con streaming.
- [x] 8.2 Ejecutar la comprobación de tipos de backend y frontend y confirmar que pasan sin errores.

## 9. Cierre

- [x] 9.1 Actualizar `changelog.md` y `AGENTS.md` (proveedor único, variables de entorno, roles, ruta de pruebas) y subir la versión según semver. **BREAKING** sobre v0.2.0 → **v0.3.0** (ajustado respecto al 1.18.0 original, desactualizado por el change `multi-proyecto-usuarios`).
