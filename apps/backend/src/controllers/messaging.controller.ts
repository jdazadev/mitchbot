import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { agentService } from '../services/agent.service';
import { insightsService } from '../services/insights.service';
import { getConversationsCollection } from '../models/conversation.model';
import { getMessagesCollection } from '../models/message.model';
import { emitToRoom } from '../websocket/socket';
import { ObjectId } from 'mongodb';

/**
 * Lista las conversaciones con lookup al contacto (si existe).
 * Las conversaciones sin contacto aún se muestran con clientInfo.
 */
export const listConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const contactId = req.query.contactId as string | undefined;
    const match: any = {};
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    match.projectId = new ObjectId(projectId);
    if (status && status !== 'All') match.status = status.toLowerCase();
    if (contactId) {
      if (!ObjectId.isValid(contactId)) return res.status(400).json({ error: 'contactId inválido' });
      match.contactId = new ObjectId(contactId);
    }

    const conversations = await getConversationsCollection().aggregate([
      { $match: match },
      { $sort: { lastMessageAt: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'contacts',
          localField: 'contactId',
          foreignField: '_id',
          as: 'contact'
        }
      },
      {
        $unwind: {
          path: '$contact',
          preserveNullAndEmptyArrays: true // Conversaciones sin contacto aún
        }
      },
      {
        $addFields: {
          // Si tiene contacto, usa sus datos; si no, usa clientInfo
          contactName: { 
            $ifNull: ['$contact.name', { $ifNull: ['$clientInfo.name', 'Cliente Nuevo'] }] 
          },
          contactAvatar: '$contact.avatar',
          contactPhone: { 
            $ifNull: ['$contact.phone', '$clientInfo.phone'] 
          },
          contactEmail: { 
            $ifNull: ['$contact.email', '$clientInfo.email'] 
          },
          platform: { $ifNull: ['$platform', '$contact.platform'] }
        }
      }
    ]).toArray();

    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    const convo = await getConversationsCollection().findOne(query);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    res.json(convo);
  } catch (error) {
    next(error);
  }
};

export const listMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const messages = await chatService.getMessages(req.params.id);
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * Envía un mensaje desde el dashboard (human_agent).
 * Si es la primera respuesta humana, automáticamente crea el contacto.
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, sender } = req.body;
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    
    // Desde el dashboard, solo se puede enviar como human_agent
    // (o forzar ai_agent para testing)
    const validSender = sender === 'ai_agent' ? 'ai_agent' : 'human_agent';
    
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const message = await chatService.sendMessage(
      req.params.id, 
      content, 
      validSender as 'human_agent' | 'ai_agent'
    );
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint para que el CLIENTE inicie una conversación.
 * Este es el único punto de entrada para crear conversaciones.
 * No requiere contactId — el contacto se crea al recibir la primera respuesta humana.
 */
export const clientStartConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, clientName, clientPhone, clientEmail, clientIdentifier, initialMessage } = req.body;
    const projectId = (req as any).projectId as string | undefined;

    if (!projectId) {
      return res.status(400).json({ error: 'ProjectId requerido' });
    }
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });

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
      projectId,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint para que el CLIENTE envíe un mensaje a una conversación existente.
 */
export const clientSendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, senderName } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const message = await chatService.sendMessage(
      req.params.id,
      content,
      'contact',
      senderName
    );
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

export const updateMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mode } = req.body; // 'auto_pilot' | 'human_takeover'
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    const result = await getConversationsCollection().updateOne(
        query,
        { $set: { mode, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    try {
      emitToRoom(req.params.id, 'chat:status', { mode });
    } catch (e) {
      // La propagación en vivo no debe romper la respuesta HTTP
    }
    res.json({ message: `Mode updated to ${mode}` });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body; // 'active' | 'closed'
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    const result = await getConversationsCollection().updateOne(
        query,
        { $set: { status, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    if (status === 'closed') {
      const agent = await agentService.getActiveAgent(projectId);
      if (agent?.config?.enableGoodbyeMessage) {
        await chatService.handleAutoGoodbye(req.params.id, agent);
      }
    }
    res.json({ message: `Status updated to ${status}` });
  } catch (error) {
    next(error);
  }
};

/**
 * Acción explícita del agente: crea o vincula el contacto del cliente a partir
 * de los datos de la conversación, incluso si `autoCreateContact` está deshabilitado.
 * Es idempotente (no duplica) y queda acotada al proyecto de la conversación.
 */
export const createConversationContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });

    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const result = await chatService.ensureContactCreated(req.params.id, { force: true });
    if (!result) return res.status(400).json({ error: 'No se pudo crear el contacto' });

    res.status(result.created ? 201 : 200).json({
      contact: result.contact,
      created: result.created,
      isContactCreated: true,
    });
  } catch (error) {
    next(error);
  }
};

/** Lectura de los insights almacenados (o `null` si aún no hay análisis). */
export const getInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const insights = convo.aiInsights;
    // Solo sentimiento y su distribución: nunca un resumen (aunque exista en datos antiguos).
    res.json(insights ? { sentiment: insights.sentiment, sentimentScores: insights.sentimentScores } : null);
  } catch (error) {
    next(error);
  }
};

/** Recálculo manual de insights (botón "Analizar"). */
export const analyzeInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const insights = await insightsService.analyzeConversation(req.params.id);
    res.json(insights);
  } catch (error) {
    next(error);
  }
};
