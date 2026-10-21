import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { 
  listConversations, 
  getConversation, 
  listMessages, 
  sendMessage, 
  updateMode, 
  updateStatus,
  markConversationRead,
  getInsights,
  analyzeInsights,
  createConversationContact,
  retryMessageDelivery,
  exportConversations,
  exportConversation,
  sendConversationTemplate,
} from '../controllers/messaging.controller';

const router = Router();

// === Rutas del DASHBOARD (admin/agente) ===
router.get('/', authenticate, listConversations);                    // Listar conversaciones
// Exportación (datos personales): solo admin y support. Antes de `/:id` para que `export` no se lea como id.
router.get('/export', authenticate, authorize('admin', 'support'), exportConversations);
router.get('/:id/export', authenticate, authorize('admin', 'support'), exportConversation);
router.get('/:id', authenticate, getConversation);                   // Detalle de conversación
router.get('/:id/messages', authenticate, listMessages);             // Mensajes de una conversación
router.post('/:id/messages', authenticate, sendMessage);             // Enviar mensaje como agente (auto-crea contacto)
router.post('/:id/template', authenticate, sendConversationTemplate);  // Enviar plantilla de WhatsApp
router.post('/:id/messages/:messageId/retry', authenticate, retryMessageDelivery); // Reencolar una entrega fallida
router.put('/:id/mode', authenticate, updateMode);                   // Cambiar modo (auto_pilot / human_takeover)
router.put('/:id/status', authenticate, updateStatus);               // Cambiar estado (active / closed)
router.put('/:id/read', authenticate, markConversationRead);         // Marcar conversación como leída (persistente)
router.post('/:id/contact', authenticate, createConversationContact); // Guardar cliente como contacto (idempotente)
router.get('/:id/insights', authenticate, getInsights);              // AI Insights (lectura)
router.post('/:id/insights', authenticate, analyzeInsights);         // AI Insights (recálculo manual)

export default router;
