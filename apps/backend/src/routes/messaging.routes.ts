import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { 
  listConversations, 
  getConversation, 
  listMessages, 
  sendMessage, 
  updateMode, 
  updateStatus,
  getInsights,
  analyzeInsights,
  createConversationContact,
  clientStartConversation,
  clientSendMessage
} from '../controllers/messaging.controller';

const router = Router();

// === Rutas del DASHBOARD (admin/agente) ===
router.get('/', authenticate, listConversations);                    // Listar conversaciones
router.get('/:id', authenticate, getConversation);                   // Detalle de conversación
router.get('/:id/messages', authenticate, listMessages);             // Mensajes de una conversación
router.post('/:id/messages', authenticate, sendMessage);             // Enviar mensaje como agente (auto-crea contacto)
router.put('/:id/mode', authenticate, updateMode);                   // Cambiar modo (auto_pilot / human_takeover)
router.put('/:id/status', authenticate, updateStatus);               // Cambiar estado (active / closed)
router.post('/:id/contact', authenticate, createConversationContact); // Guardar cliente como contacto (idempotente)
router.get('/:id/insights', authenticate, getInsights);              // AI Insights (lectura)
router.post('/:id/insights', authenticate, analyzeInsights);         // AI Insights (recálculo manual)

// === Rutas del CLIENTE (chatbot/widget) ===
router.post('/client/start', authenticate, clientStartConversation); // Cliente inicia conversación
router.post('/client/:id/messages', authenticate, clientSendMessage); // Cliente envía mensaje

export default router;
