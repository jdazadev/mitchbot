import { Router } from 'express';
import { receiveWhatsAppWebhook, verifyWhatsAppWebhook } from '../controllers/webhooks.controller';

/** Webhooks de canales externos: públicos, autenticados por la firma de cada proveedor. */
const router = Router();

router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', receiveWhatsAppWebhook);

export default router;
