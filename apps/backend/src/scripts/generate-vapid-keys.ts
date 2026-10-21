/**
 * Genera un par de claves VAPID para las notificaciones push:
 *   pnpm --filter @mitchbot/backend vapid:generate
 * Copia las líneas en `apps/backend/.env`. Cambiar las claves invalida las suscripciones.
 */
import webPush from 'web-push';

const { publicKey, privateKey } = webPush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:tu-correo@tu-dominio.com');
