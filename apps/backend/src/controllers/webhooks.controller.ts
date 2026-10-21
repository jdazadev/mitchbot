import { Request, Response } from 'express';
import env from '../config/env';
import { verifySignature } from '../channels/meta/signature';
import { handleWhatsAppWebhook } from '../channels/whatsapp/handler';
import { parseWhatsAppWebhook } from '../channels/whatsapp/webhook';
import { handleInstagramWebhook } from '../channels/instagram/handler';
import { parseInstagramWebhook } from '../channels/instagram/webhook';
import { logger } from '../utils/logger';

interface MetaWebhookOptions<Parsed> {
  name: string;
  verifyToken: () => string | undefined;
  appSecret: () => string | undefined;
  parse: (payload: unknown) => Parsed;
  handle: (parsed: Parsed) => Promise<unknown>;
}

/**
 * Par de handlers de un webhook de Meta:
 * - `verify` es el reto de suscripción y devuelve `hub.challenge` solo con el token configurado.
 * - `receive` exige la firma; un 500 hace que Meta reintente y la pasarela deduplica.
 */
function metaWebhook<Parsed>(options: MetaWebhookOptions<Parsed>) {
  const verify = (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expected = options.verifyToken();
    if (mode === 'subscribe' && expected && token === expected && typeof challenge === 'string') {
      return res.status(200).type('text/plain').send(challenge);
    }
    return res.sendStatus(403);
  };

  const receive = async (req: Request, res: Response) => {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!verifySignature(rawBody, req.get('x-hub-signature-256'), options.appSecret())) {
      return res.sendStatus(401);
    }
    try {
      const result = await options.handle(options.parse(req.body));
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error(`[${options.name}] Webhook no procesado: ${error?.message || error}`);
      return res.sendStatus(500);
    }
  };

  return { verify, receive };
}

const whatsapp = metaWebhook({
  name: 'WhatsApp',
  verifyToken: () => env.WHATSAPP_VERIFY_TOKEN,
  appSecret: () => env.WHATSAPP_APP_SECRET,
  parse: parseWhatsAppWebhook,
  handle: handleWhatsAppWebhook,
});

const instagram = metaWebhook({
  name: 'Instagram',
  verifyToken: () => env.INSTAGRAM_VERIFY_TOKEN,
  appSecret: () => env.INSTAGRAM_APP_SECRET,
  parse: parseInstagramWebhook,
  handle: handleInstagramWebhook,
});

export const verifyWhatsAppWebhook = whatsapp.verify;
export const receiveWhatsAppWebhook = whatsapp.receive;
export const verifyInstagramWebhook = instagram.verify;
export const receiveInstagramWebhook = instagram.receive;
