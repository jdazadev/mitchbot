import { createECDH } from 'node:crypto';

/**
 * Importar después de `isolated-env`: claves VAPID de prueba y un proveedor de
 * push local permitido (la prueba levanta el servidor en `PUSH_PORT`).
 */
export const PUSH_PORT = 4597;
const vapid = createECDH('prime256v1');
vapid.generateKeys();
process.env.VAPID_PUBLIC_KEY = vapid.getPublicKey().toString('base64url');
process.env.VAPID_PRIVATE_KEY = vapid.getPrivateKey().toString('base64url');
process.env.VAPID_SUBJECT = 'mailto:pruebas@mitchbot.test';
process.env.PUSH_ALLOWED_HOSTS = `127.0.0.1:${PUSH_PORT}`;
