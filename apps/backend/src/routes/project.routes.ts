import { Router } from 'express';
import { checkProject, listProjects, getProject, createProject, updateProject, setActiveProject, getChannelsStatus, listWhatsAppTemplates, getWhatsAppSignupConfig, completeWhatsAppSignup, disconnectWhatsAppSignup } from '../controllers/project.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/check', authenticate, checkProject);         // ¿El usuario tiene proyectos?
router.get('/list', authenticate, listProjects);          // Listar proyectos del usuario
router.put('/active', authenticate, setActiveProject);    // Cambiar proyecto activo
router.get('/channels/status', authenticate, getChannelsStatus); // Canales externos conectados en el servidor
router.get('/whatsapp/templates', authenticate, listWhatsAppTemplates); // Plantillas aprobadas de la WABA
router.get('/whatsapp/signup/config', authenticate, authorize('admin'), getWhatsAppSignupConfig); // App y configuración de Meta
router.post('/whatsapp/signup', authenticate, authorize('admin'), completeWhatsAppSignup);      // Alta tras la ventana de Meta
router.delete('/whatsapp/signup', authenticate, authorize('admin'), disconnectWhatsAppSignup);  // Desconectar el número
router.get('/', authenticate, getProject);                // Obtener proyecto activo
router.post('/', authenticate, createProject);            // Crear proyecto + agente
router.put('/', authenticate, updateProject);             // Actualizar proyecto activo

export default router;
