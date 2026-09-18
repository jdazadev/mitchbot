import { Router } from 'express';
import { listAgents, getAgent, createAgent, updateAgent, deleteAgent } from '../controllers/agents.controller';

const router = Router();

router.get('/', listAgents);         // Listar agentes
router.get('/:id', getAgent);        // Obtener agente
router.post('/', createAgent);       // Crear agente
router.put('/:id', updateAgent);     // Editar agente
router.delete('/:id', deleteAgent);  // Eliminar agente

export default router;
