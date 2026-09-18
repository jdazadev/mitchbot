import { Router } from 'express';
import { getStats, getVolume, getChannelDistribution, getActivities } from '../controllers/dashboard.controller';

const router = Router();

router.get('/stats', getStats);
router.get('/volume', getVolume);
router.get('/channels', getChannelDistribution);
router.get('/activities', getActivities);

export default router;
