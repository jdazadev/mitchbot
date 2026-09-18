import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listOpenRouterModels,
  getActiveProvider,
  getModelsForAgent,
} from '../controllers/ai-models.controller';

const router = Router();

// ===== Remote Model APIs (proveedor único OpenRouter) =====
router.get('/remote/openrouter', authenticate, listOpenRouterModels);

// ===== Provider Configs =====
router.get('/providers/active/:type', authenticate, getActiveProvider);

// ===== Agent Models =====
router.get('/agent/models', authenticate, getModelsForAgent);

export default router;
