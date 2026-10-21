import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { agentService } from '../services/agent.service';
import { receive } from '../channels/inbound';
import { InvalidInboundError, normalizeInbound } from '../channels/normalize';
import { getConversationsCollection } from '../models/conversation.model';
import { ObjectId } from 'mongodb';
import { clientToken, verifyClientToken } from '../widget/access';

export const publicGetConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: 'Project slug requerido' });

    const project = await projectService.findBySlug(slug);
    if (!project?._id) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const agent = await agentService.getActiveAgent(project._id.toString());
    const language = agent?.personality?.language === 'en' ? 'en' : 'es';

    res.json({ language });
  } catch (error) {
    next(error);
  }
};

export const publicStartConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: 'Project slug requerido' });

    const project = await projectService.findBySlug(slug);
    if (!project?._id) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { platform, clientName, clientPhone, clientEmail, clientIdentifier, initialMessage } = req.body;
    if (!platform || !clientIdentifier || !initialMessage) {
      return res.status(400).json({
        error: 'platform, clientIdentifier y initialMessage son requeridos'
      });
    }

    const inbound = normalizeInbound({
      projectId: project._id.toString(),
      platform,
      clientIdentifier,
      sender: { name: clientName, phone: clientPhone, email: clientEmail },
      text: initialMessage,
    });
    const result = await receive(inbound);
    const conversationId = ('conversation' in result ? result.conversation?._id : undefined)?.toString();

    // El token es la prueba de que esta conversación es de quien la inició.
    res.status(201).json({ ...result, clientToken: conversationId ? clientToken(conversationId) : undefined });
  } catch (error) {
    if (error instanceof InvalidInboundError) return res.status(400).json({ error: error.message });
    next(error);
  }
};

export const publicSendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, id } = req.params;
    if (!slug) return res.status(400).json({ error: 'Project slug requerido' });

    const project = await projectService.findBySlug(slug);
    if (!project?._id) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { content, senderName } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ConversationId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(id),
      projectId: project._id,
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    if (!verifyClientToken(id, req.body.clientToken ?? req.get('x-client-token'))) {
      return res.status(403).json({ error: 'Token de la conversación inválido' });
    }

    const inbound = normalizeInbound({
      projectId: project._id.toString(),
      platform: convo.platform,
      clientIdentifier: convo.clientInfo.identifier,
      sender: { name: senderName },
      text: content,
    });
    const { message } = await receive(inbound, { conversationId: id });
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof InvalidInboundError) return res.status(400).json({ error: error.message });
    next(error);
  }
};
