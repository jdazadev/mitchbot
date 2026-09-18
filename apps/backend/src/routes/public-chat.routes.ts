import { Router } from 'express';
import { publicStartConversation, publicSendMessage } from '../controllers/public-chat.controller';

const router = Router();

router.post('/test-chat/:slug/start', publicStartConversation);
router.post('/test-chat/:slug/:id/messages', publicSendMessage);

export default router;
