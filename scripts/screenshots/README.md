# Capturas del README

Las imágenes de [`docs/screenshots/`](../../docs/screenshots) salen de una demo con datos inventados: **Panadería Aurora**, con conversaciones por WhatsApp, Instagram y la web, contactos, citas, aprobaciones pendientes, fuentes de conocimiento y un equipo de cuatro personas.

```bash
docker compose up -d          # MongoDB, Redis y Qdrant
scripts/screenshots/run.sh    # siembra, levanta la demo, captura y la apaga
```

- **Qué hace `run.sh`**:
  - Usa la base `mitchbot_demo` y **la borra** en cada ejecución.
  - La IA y la Graph API de Meta son el stub de las pruebas E2E, así que no gasta créditos ni llama a Meta.
  - Puertos: 4030 (stub), 3120 (backend) y 5195 (frontend). Se cambian con `SCREENSHOTS_STUB_PORT`, `SCREENSHOTS_API_PORT` y `SCREENSHOTS_WEB_PORT`.
- **Piezas**:
  - `apps/backend/src/scripts/seed-demo.ts` (`pnpm --filter @mitchbot/backend seed:demo`) siembra la demo.
  - `capture.mjs` hace las 17 capturas con Playwright a 1440×900 (×2) y 390×844 en el móvil. El widget se muestra en una web de ejemplo en `127.0.0.1:5199`, que el seed autoriza.
- **Acceso a la demo**: `demo@mitchbot.io` / `demo12345`.
