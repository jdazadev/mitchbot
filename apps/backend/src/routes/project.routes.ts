import { Router } from 'express';
import { checkProject, listProjects, getProject, createProject, updateProject, setActiveProject } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/check', authenticate, checkProject);         // ¿El usuario tiene proyectos?
router.get('/list', authenticate, listProjects);          // Listar proyectos del usuario
router.put('/active', authenticate, setActiveProject);    // Cambiar proyecto activo
router.get('/', authenticate, getProject);                // Obtener proyecto activo
router.post('/', authenticate, createProject);            // Crear proyecto + agente
router.put('/', authenticate, updateProject);             // Actualizar proyecto activo

export default router;
