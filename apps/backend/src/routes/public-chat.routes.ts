import { Router } from 'express';
import { publicStartConversation, publicSendMessage, publicGetConfig } from '../controllers/public-chat.controller';

const router = Router();

router.get('/test-chat/:slug/config', publicGetConfig);
router.post('/test-chat/:slug/start', publicStartConversation);
router.post('/test-chat/:slug/:id/messages', publicSendMessage);

export default router;
