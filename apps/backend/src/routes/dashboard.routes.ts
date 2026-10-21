import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getStats, getOutcomes, getAutomation, getVolume, getChannelDistribution, getActivities, getSla } from '../controllers/dashboard.controller';

const router = Router();

router.get('/stats', authenticate, getStats);
router.get('/outcomes', authenticate, getOutcomes);
router.get('/automation', authenticate, getAutomation);
router.get('/volume', authenticate, getVolume);
router.get('/channels', authenticate, getChannelDistribution);
router.get('/activities', authenticate, getActivities);
router.get('/sla', authenticate, getSla);

export default router;
