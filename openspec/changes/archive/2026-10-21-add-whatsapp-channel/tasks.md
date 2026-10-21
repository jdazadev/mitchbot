# Tareas

## 1. Backend

- [x] 1.1 Entorno: `WHATSAPP_APP_SECRET`, `WHATSAPP_API_URL`, `WHATSAPP_API_VERSION`; `.env.example`.
- [x] 1.2 Modelos: `project.config.whatsapp.phoneNumberId` (índice único parcial), `conversation.channelAccount`, `InboundMessage.account`, `OutboundMessage.account`, estados `delivered`/`read`.
- [x] 1.3 Pasarela: `dispatch` exige `channelAccount`; `receive` guarda la cuenta; continuidad en `pending_human` y por plataforma; `applyDeliveryStatus` monótono y fallo asíncrono.
- [x] 1.4 `src/channels/whatsapp/`: firma, parser del webhook, clasificación de errores y adaptador `send`.
- [x] 1.5 Rutas `GET|POST /api/webhooks/whatsapp` con cuerpo crudo; registro del adaptador al arrancar.
- [x] 1.6 Proyecto: validación del `phoneNumberId`, 409 por número repetido y `GET /api/project/channels/status`.

## 2. Frontend

- [x] 2.1 `DeliveryStatus`: Entregado y Leído.
- [x] 2.2 Configuración → Canales: Phone Number ID, URL del webhook, estado del servidor y guardado con "Cambios sin guardar".
- [x] 2.3 i18n es/en con paridad.

## 3. Pruebas

- [x] 3.1 Unitarios backend: firma, parser, clasificación de errores, adaptador con `fetch` falso, rango de estados.
- [x] 3.2 Unitarios frontend: `DeliveryStatus` con los estados nuevos.
- [x] 3.3 Integración: webhook → conversación, enrutado por número, canal deshabilitado, estados y fallo asíncrono, simulador sin cola.
- [x] 3.4 E2E: stub de la Graph API; verificación, firma, mensaje real con respuesta del bot entregada y leída, fallo con Reintentar, configuración del número en la UI.

## 4. Cierre

- [x] 4.1 Changelog, AGENTS.md, README y versión 0.6.0.
- [x] 4.2 Validar, archivar y commit.
