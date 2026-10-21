import webPush from 'web-push';
import { ObjectId } from 'mongodb';
import env from '../config/env';
import { getPushSubscriptionsCollection, type PushSubscription } from '../models/push-subscription.model';
import { logger } from '../utils/logger';
import { isAllowedEndpoint, parseAllowedHosts } from './push-policy';

const SEND_TIMEOUT_MS = 10_000;
const TTL_SECONDS = 60 * 60;

export const pushConfigured = () => !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;

export const allowedPushHosts = () => parseAllowedHosts(env.PUSH_ALLOWED_HOSTS);

export type PushResult = 'sent' | 'gone' | 'failed' | 'blocked';

/**
 * Envía un push cifrado (aes128gcm) y firmado (VAPID) a una suscripción.
 * `web-push` prepara la petición y la enviamos nosotros: así se comprueba el
 * endpoint justo antes de enviar y el transporte tiene tiempo límite.
 */
export async function sendPush(subscription: Pick<PushSubscription, '_id' | 'endpoint' | 'keys'>, payload: object): Promise<PushResult> {
  if (!pushConfigured()) return 'failed';
  if (!isAllowedEndpoint(subscription.endpoint, allowedPushHosts())) return 'blocked';

  const details = webPush.generateRequestDetails(
    { endpoint: subscription.endpoint, keys: subscription.keys },
    JSON.stringify(payload),
    {
      TTL: TTL_SECONDS,
      urgency: 'high',
      vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY! },
    },
  );

  try {
    const response = await fetch(details.endpoint, {
      method: details.method,
      headers: details.headers as Record<string, string>,
      body: details.body as unknown as BodyInit,
      redirect: 'manual',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) {
      // El navegador anuló la suscripción: ya no tiene sentido guardarla.
      if (subscription._id) await getPushSubscriptionsCollection().deleteOne({ _id: new ObjectId(subscription._id) });
      return 'gone';
    }
    if (!response.ok) {
      logger.warn(`[Push] El proveedor respondió ${response.status} para ${new URL(subscription.endpoint).host}`);
      return 'failed';
    }
    if (subscription._id) {
      await getPushSubscriptionsCollection().updateOne({ _id: new ObjectId(subscription._id) }, { $set: { lastSuccessAt: new Date() } });
    }
    return 'sent';
  } catch (error: any) {
    logger.warn(`[Push] No se pudo enviar a ${new URL(subscription.endpoint).host}: ${error?.message || error}`);
    return 'failed';
  }
}
