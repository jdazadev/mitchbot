import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getStats, getVolume, getChannelDistribution, getActivities } from '../controllers/dashboard.controller';

const router = Router();

router.get('/stats', authenticate, getStats);
router.get('/volume', authenticate, getVolume);
router.get('/channels', authenticate, getChannelDistribution);
router.get('/activities', authenticate, getActivities);

export default router;
