# Refactorizacion modo devadmin

## Objetivo

Implementar el rol **devadmin** como superadmin interno para gestionar toda la configuracion de modelos y proveedores (LLM, Embedding, File, Image, Audio), separando esa capa de la configuracion externa del bot.

## Alcance funcional

- Nuevo rol `devadmin` en backend y frontend, siempre por encima de `admin`.
- El rol `devadmin` **no** se crea ni edita via API. Solo se crea internamente por base de datos.
- La personalizacion del bot **se mantiene** en la configuracion actual (Settings / agente).
- Se habilita una vista/pestana exclusiva para `devadmin` con toda la gestion de proveedores y modelos.
- Se agregan nuevos tipos de proveedor: `file`, `image`, `audio`.
- La logica de uso de esos modelos queda preparada para futuras funciones.

## Cambios backend

1. **Roles**
   - Extender el tipo `User.role` para incluir `devadmin`.
   - Mantener el primer usuario registrado como `admin`.
   - En seeds y scripts, no crear `devadmin` por defecto.

2. **Bloqueo de creacion por API**
   - `POST /api/users` no acepta `devadmin`.
   - `PUT /api/users/:id` no permite escalar a `devadmin`.
   - Si se recibe `devadmin`, devolver error 403/400 con mensaje claro.

3. **Permisos en rutas de modelos/proveedores**
   - Proteger `/api/ai-models/*` con `authorize('devadmin')`.
   - Asegurar que los endpoints de proveedores y tests solo sean accesibles por `devadmin`.

4. **ProviderConfig extendido**
   - `type`: `llm | embedding | file | image | audio`.
   - Mantener la regla de un proveedor activo por tipo.
   - Reutilizar la misma estructura de `ProviderConfig`.

5. **Servicios y controladores**
   - Actualizar validaciones Zod y tipos en `ai-models.controller.ts`.
   - Extender `ai-model.service.ts` para manejar los nuevos tipos.
   - Mantener compatibilidad con `llm` y `embedding` existentes.

## Cambios frontend

1. **Rol devadmin**
   - Extender tipo `User.role` en `auth.service.ts`.
   - Guard de rutas para permitir acceso solo a `devadmin`.

2. **Nueva vista para configuracion avanzada**
   - Nueva ruta y vista (ej. `/devadmin/models`).
   - Menu lateral visible solo para `devadmin`.
   - Contenido: gestion de proveedores y seleccion de modelos para:
     - LLM
     - Embedding
     - File
     - Image
     - Audio

3. **Settings**
   - Mantener solo configuracion externa (personalidad del bot, canales, opciones, info).
   - Remover pestañas de proveedores desde Settings.

## Modelo de datos

- `provider_configs` mantiene la misma coleccion.
- Se agregan nuevos documentos con `type` adicional.

## Seguridad

- `devadmin` es el unico rol con acceso a gestion de proveedores.
- `admin`, `support`, `assistant` quedan sin acceso a ese modulo.

## Versionado y documentacion

- Actualizar `changelog.md` siguiendo Keep a Changelog.
- Actualizar `AGENTS.md` con nuevos roles y modulo.
- Bump de version semver acorde al cambio (minor).

## Notas de implementacion

- La UI de proveedores debe seguir el estilo existente (cards + selectores).
- Se debe manejar el estado cuando no exista proveedor configurado para un tipo.
- No cambiar la logica actual de RAG/LLM, solo preparar nuevos tipos.
