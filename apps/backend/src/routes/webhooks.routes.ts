import { Router } from 'express';
import {
  receiveInstagramWebhook,
  receiveWhatsAppWebhook,
  verifyInstagramWebhook,
  verifyWhatsAppWebhook,
} from '../controllers/webhooks.controller';

/** Webhooks de canales externos: públicos, autenticados por la firma de cada proveedor. */
const router = Router();

router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', receiveWhatsAppWebhook);
router.get('/instagram', verifyInstagramWebhook);
router.post('/instagram', receiveInstagramWebhook);

export default router;
