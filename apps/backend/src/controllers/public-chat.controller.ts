import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { chatService } from '../services/chat.service';
import { getConversationsCollection } from '../models/conversation.model';
import { ObjectId } from 'mongodb';

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

    const result = await chatService.createConversationFromClient({
      platform,
      clientName,
      clientPhone,
      clientEmail,
      clientIdentifier,
      initialMessage,
      projectId: project._id.toString(),
    });

    res.status(201).json(result);
  } catch (error) {
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

    const message = await chatService.sendMessage(id, content, 'contact', senderName);
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};
