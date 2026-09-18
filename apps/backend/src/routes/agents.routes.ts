import { Router } from 'express';
import { listAgents, getAgent, createAgent, updateAgent, deleteAgent } from '../controllers/agents.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, listAgents);         // Listar agentes
router.get('/:id', authenticate, getAgent);        // Obtener agente
router.post('/', authenticate, createAgent);       // Crear agente
router.put('/:id', authenticate, updateAgent);     // Editar agente
router.delete('/:id', authenticate, deleteAgent);  // Eliminar agente

export default router;
