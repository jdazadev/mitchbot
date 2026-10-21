import { Request, Response } from 'express';
import env from '../config/env';
import { handleWhatsAppWebhook } from '../channels/whatsapp/handler';
import { parseWhatsAppWebhook, verifySignature } from '../channels/whatsapp/webhook';
import { logger } from '../utils/logger';

/** Reto de suscripción de Meta: devuelve `hub.challenge` solo con el token de verificación configurado. */
export const verifyWhatsAppWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN && typeof challenge === 'string') {
    return res.status(200).type('text/plain').send(challenge);
  }
  return res.sendStatus(403);
};

/** Webhook de la Cloud API. Firma obligatoria; un 500 hace que Meta reintente y la pasarela deduplica. */
export const receiveWhatsAppWebhook = async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!verifySignature(rawBody, req.get('x-hub-signature-256'), env.WHATSAPP_APP_SECRET)) {
    return res.sendStatus(401);
  }
  try {
    const result = await handleWhatsAppWebhook(parseWhatsAppWebhook(req.body));
    return res.status(200).json(result);
  } catch (error: any) {
    logger.error(`[WhatsApp] Webhook no procesado: ${error?.message || error}`);
    return res.sendStatus(500);
  }
};
