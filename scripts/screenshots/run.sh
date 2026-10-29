#!/usr/bin/env bash
# Regenera las capturas del README sobre la demo de Panadería Aurora.
# Levanta el stub de IA y Meta, el backend con la base `mitchbot_demo` y el frontend
# en puertos propios, siembra la demo, captura en docs/screenshots y apaga lo que arrancó.
# Requiere los servicios de Docker (MongoDB, Redis y Qdrant).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STUB_PORT="${SCREENSHOTS_STUB_PORT:-4030}"
API_PORT="${SCREENSHOTS_API_PORT:-3120}"
WEB_PORT="${SCREENSHOTS_WEB_PORT:-5195}"
DB="mongodb://localhost:27017/mitchbot_demo"
LOGS="$(mktemp -d)"
export NO_PROXY="localhost,127.0.0.1,::1" no_proxy="localhost,127.0.0.1,::1"

pids=()
# Cierra solo lo que arrancó este script (y los hijos de `pnpm exec`).
cleanup() {
  for pid in "${pids[@]}"; do pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT

wait_for() {
  for _ in $(seq 1 60); do curl -sf --noproxy '*' -o /dev/null "$1" && return 0; sleep 2; done
  echo "No respondió $1 (logs en $LOGS)" >&2; exit 1
}

cd "$ROOT"
STUB_PORT=$STUB_PORT STUB_META_TOKEN=demo-wa STUB_META_APP_ID=100200300 STUB_META_APP_SECRET=demo-secret \
  STUB_REPLY='¡Hola! Sí, hoy tenemos pan de masa madre recién salido del horno 🥐 ¿Quieres que te aparte uno?' \
  node tests/stub/openai-stub.mjs > "$LOGS/stub.log" 2>&1 &
pids+=($!)

(cd apps/backend && MONGODB_URI=$DB pnpm exec tsx src/scripts/seed-demo.ts)

(cd apps/backend && PORT=$API_PORT NODE_ENV=development MONGODB_URI=$DB \
  OPENROUTER_API_KEY=demo OPENROUTER_BASE_URL=http://localhost:$STUB_PORT/v1 \
  OPENROUTER_LLM_MODEL=stub-model OPENROUTER_INSIGHTS_MODEL=stub-insights OPENROUTER_EMBEDDING_MODEL=stub-embed \
  CHANNEL_QUEUE_PREFIX=demo \
  WHATSAPP_TOKEN=demo-wa WHATSAPP_APP_SECRET=demo-secret WHATSAPP_VERIFY_TOKEN=demo-verify \
  WHATSAPP_API_URL=http://localhost:$STUB_PORT/meta META_APP_ID=100200300 WHATSAPP_SIGNUP_CONFIG_ID=400500600 \
  CREDENTIALS_KEY="$(node -e "console.log(Buffer.alloc(32,5).toString('base64'))")" \
  INSTAGRAM_TOKEN=demo-ig INSTAGRAM_APP_SECRET=demo-ig-secret INSTAGRAM_VERIFY_TOKEN=demo-ig-verify \
  INSTAGRAM_API_URL=http://localhost:$STUB_PORT/meta VAPID_PUBLIC_KEY= VAPID_PRIVATE_KEY= \
  FRONTEND_URL=http://localhost:$WEB_PORT \
  exec pnpm exec tsx src/index.ts) > "$LOGS/backend.log" 2>&1 &
pids+=($!)

(cd apps/frontend && VITE_API_URL=http://localhost:$API_PORT/api exec pnpm exec vite --port "$WEB_PORT" --strictPort) > "$LOGS/frontend.log" 2>&1 &
pids+=($!)

wait_for "http://localhost:$API_PORT/health"
wait_for "http://localhost:$WEB_PORT/"

rm -rf docs/screenshots
SCREENSHOTS_API="http://localhost:$API_PORT" node scripts/screenshots/capture.mjs "http://localhost:$WEB_PORT" docs/screenshots
echo "✅ Capturas en docs/screenshots"
