import { Router } from 'express';
import { publicStartConversation, publicSendMessage, publicGetConfig } from '../controllers/public-chat.controller';
import { getWidgetConfig, getWidgetHistory, serveFrame } from '../controllers/widget.controller';

const router = Router();

router.get('/test-chat/:slug/config', publicGetConfig);
router.post('/test-chat/:slug/start', publicStartConversation);
router.post('/test-chat/:slug/:id/messages', publicSendMessage);

// Widget embebible
router.get('/widget/:slug/config', getWidgetConfig);
router.get('/widget/:slug/frame', serveFrame);
router.get('/widget/:slug/conversations/:id/messages', getWidgetHistory);

export default router;
