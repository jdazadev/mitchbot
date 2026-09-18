import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  listAIModels,
  getAIModel,
  createAIModel,
  updateAIModel,
  deleteAIModel,
  listOllamaModels,
  listOpenRouterModels,
  listOpenRouterEmbeddings,
  listGeminiModels,
  getProviderConfigs,
  getProviderConfigsByType,
  getActiveProvider,
  saveProviderConfig,
  deleteProviderConfig,
  testLLMConnection,
  testOcrConnection,
  getModelsForAgent,
} from '../controllers/ai-models.controller';

const router = Router();

// ===== Ollama Models =====
router.get('/ollama/models', authenticate, authorize('devadmin'), listOllamaModels);

// ===== Remote Model APIs =====
router.get('/remote/openrouter', authenticate, authorize('devadmin'), listOpenRouterModels);
router.get('/remote/openrouter/embeddings', authenticate, authorize('devadmin'), listOpenRouterEmbeddings);
router.get('/remote/gemini', authenticate, authorize('devadmin'), listGeminiModels);

// ===== Provider Configs =====
router.get('/providers/configs', authenticate, authorize('devadmin'), getProviderConfigs);
router.get('/providers/configs/:type', authenticate, authorize('devadmin'), getProviderConfigsByType);
router.get('/providers/active/:type', authenticate, getActiveProvider);
router.post('/providers/config', authenticate, authorize('devadmin'), saveProviderConfig);
router.delete('/providers/config/:type/:provider', authenticate, authorize('devadmin'), deleteProviderConfig);
router.post('/providers/test', authenticate, authorize('devadmin'), testLLMConnection);
router.post('/providers/test-ocr', authenticate, authorize('devadmin'), testOcrConnection);

// ===== Agent Models =====
router.get('/agent/models', authenticate, getModelsForAgent);

// ===== AI Models CRUD (debe ir al final por el param :id) =====
router.get('/', authenticate, authorize('devadmin'), listAIModels);
router.post('/', authenticate, authorize('devadmin'), createAIModel);
router.get('/:id', authenticate, authorize('devadmin'), getAIModel);
router.put('/:id', authenticate, authorize('devadmin'), updateAIModel);
router.delete('/:id', authenticate, authorize('devadmin'), deleteAIModel);

export default router;
