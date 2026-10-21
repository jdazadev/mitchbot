/**
 * Importar después de `isolated-env`: apunta la API de perfiles de Instagram a
 * un servidor local que levanta la propia prueba.
 */
export const PROFILE_PORT = 4599;
process.env.INSTAGRAM_TOKEN = 'integration-ig-token';
process.env.INSTAGRAM_API_URL = `http://127.0.0.1:${PROFILE_PORT}`;
