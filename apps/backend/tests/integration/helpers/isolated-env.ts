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
