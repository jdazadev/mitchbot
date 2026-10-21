/**
 * Debe importarse antes que cualquier módulo de `src/`: `config/env` lee
 * `process.env` al cargarse y dotenv no pisa variables ya definidas.
 *
 * - La IA apunta a un puerto cerrado: el bot y los insights fallan al instante
 *   en lugar de llamar a OpenRouter con la clave del `.env` de desarrollo.
 * - Las colas de canales usan su propio prefijo para no cruzarse con un backend
 *   de desarrollo que comparta Redis.
 * - El circuit breaker se abre y se recupera rápido para poder probarlo.
 */
process.env.OPENROUTER_BASE_URL = 'http://127.0.0.1:9/v1';
process.env.OPENROUTER_API_KEY = 'offline-integration-key';
process.env.CHANNEL_QUEUE_PREFIX = `itest-${process.pid}`;
process.env.CHANNEL_BREAKER_THRESHOLD = '2';
process.env.CHANNEL_BREAKER_COOLDOWN_MS = '5000';
// Webhook de WhatsApp verificable en las pruebas; sin token no se registra el adaptador real.
process.env.WHATSAPP_APP_SECRET = 'integration-app-secret';
process.env.WHATSAPP_VERIFY_TOKEN = 'integration-verify-token';
process.env.INSTAGRAM_APP_SECRET = 'integration-ig-secret';
process.env.INSTAGRAM_VERIFY_TOKEN = 'integration-ig-verify';
// Sin tokens reales: las pruebas nunca llaman a Meta con las credenciales del `.env`.
process.env.WHATSAPP_TOKEN = '';
process.env.INSTAGRAM_TOKEN = '';
