import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getTools, updateToolConfig } from '../controllers/tools.controller';

const router = Router();
router.use(authenticate);
router.get('/', getTools);
router.put('/config', updateToolConfig);

export default router;
