import { Router } from 'express';
import { checkProject, getProject, createProject, updateProject } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/check', authenticate, checkProject);   // ¿Existe un proyecto?
router.get('/', authenticate, getProject);           // Obtener proyecto activo
router.post('/', authenticate, createProject);       // Crear proyecto + agente
router.put('/', authenticate, updateProject);        // Actualizar proyecto

export default router;
