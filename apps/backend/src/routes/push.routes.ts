import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getMyPush,
  getPushConfig,
  sendTestPush,
  subscribePush,
  unsubscribePush,
  updatePushPreferences,
} from '../controllers/push.controller';

const router = Router();

router.get('/config', authenticate, getPushConfig);
router.get('/me', authenticate, getMyPush);
router.post('/subscriptions', authenticate, subscribePush);
router.delete('/subscriptions', authenticate, unsubscribePush);
router.put('/preferences', authenticate, updatePushPreferences);
router.post('/test', authenticate, sendTestPush);

export default router;
