import { Router } from 'express';
import contactRoutes from './contacts.routes';
import brainRoutes from './brain.routes';
import messagingRoutes from './messaging.routes';
import dashboardRoutes from './dashboard.routes';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import agentsRoutes from './agents.routes';
import configRoutes from './config.routes';
import projectRoutes from './project.routes';
import aiModelsRoutes from './ai-models.routes';
import appointmentsRoutes from './appointments.routes';
import ordersRoutes from './orders.routes';
import publicChatRoutes from './public-chat.routes';
import { aiService } from '../services/ai.service';
import { aiModelService } from '../services/ai-model.service';
import { agentService } from '../services/agent.service';

const router = Router();

// Público
router.use('/auth', authRoutes);
router.use('/public', publicChatRoutes);

// Módulos del dashboard
router.use('/contacts', contactRoutes);
router.use('/brain', brainRoutes);
router.use('/conversations', messagingRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', usersRoutes);
router.use('/agents', agentsRoutes);
router.use('/config', configRoutes);
router.use('/project', projectRoutes);
router.use('/ai-models', aiModelsRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/orders', ordersRoutes);

export default router;
