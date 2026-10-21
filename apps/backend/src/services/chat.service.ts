import { ObjectId } from 'mongodb';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { getConversationsCollection, Conversation } from '../models/conversation.model';
import { getMessagesCollection, Message } from '../models/message.model';
import { getContactsCollection, Contact } from '../models/contact.model';
import { Activity } from '../models/activity.model';
import { getProjectsCollection } from '../models/project.model';
import { ragService } from './rag.service';
import { aiService } from './ai.service';
import { agentService } from './agent.service';
import { aiModelService } from './ai-model.service';
import { toolService, ParsedToolCall } from './tool.service';
import { toolExecutionService } from './tool-execution.service';
import { buildSystemPrompt, getDefaultPersonality } from './prompt-builder.service';
import { insightsService } from './insights.service';
import { emitToRoom, emitToProject, emitToProjectDashboard } from '../websocket/socket';
import { ToolContext } from '../tools/types';
import { logger } from '../utils/logger';
import { analyticsService } from './analytics.service';
import { dispatch } from '../channels/outbound';

const isDuplicateKey = (error: any) => error?.code === 11000;

function trackActivitySafely(activity: Omit<Activity, '_id' | 'createdAt'>) {
  if (!activity.projectId) return;
  void analyticsService.trackActivity(activity).catch((error) => {
    logger.warn('[Analytics] Could not record activity', error);
  });
}

export const chatService = {
  isGoodbyeMessage(message: string, keywords: string[] = []) {
    const normalized = message.trim().toLowerCase();
    if (!normalized) return false;
    const safeKeywords = keywords.length > 0 ? keywords : [
      'adios', 'adiós', 'hasta luego', 'hasta pronto', 'nos vemos',
      'chao', 'ciao', 'bye', 'goodbye',
    ];
    return safeKeywords.some(keyword => normalized.includes(keyword.toLowerCase()));
  },

  /** Ventana de historial enviada al LLM */
  HISTORY_WINDOW: 20,
  /** Umbral de pausa larga para marcar el reinicio de la conversación */
  LONG_PAUSE_MS: 6 * 60 * 60 * 1000,

  /**
   * Construye el historial reciente de la conversación para el LLM.
   * - Últimos 20 mensajes elegibles.
   * - `contact`/`human_agent` → HumanMessage (el humano con prefijo), `ai_agent` → AIMessage.
   * - Excluye mensajes internos de herramientas y placeholders vacíos.
   * - Excluye el mensaje actual del cliente (se pasa aparte) e inserta un marcador
   *   cuando la pausa respecto al mensaje anterior supera las 6 horas.
   */
  async buildConversationHistory(conversationId: string, currentUserMessage?: string): Promise<BaseMessage[]> {
    const messages = await this.getRecentMessages(conversationId, this.HISTORY_WINDOW + 1);
    const EXCLUDED_CONTENT_TYPES = new Set(['tool_call', 'tool_result', 'confirmation_request']);

    const eligible = messages.filter(m => {
      if (m.sender === 'tool') return false;
      if (EXCLUDED_CONTENT_TYPES.has(m.contentType)) return false;
      if (!m.content || !m.content.trim()) return false;
      return true;
    });

    const windowed = eligible.slice(-this.HISTORY_WINDOW);

    let resumed = false;
    const last = windowed[windowed.length - 1];
    if (last && last.sender === 'contact' && (currentUserMessage === undefined || last.content === currentUserMessage)) {
      const currentAt = new Date(last.createdAt).getTime();
      const prev = windowed[windowed.length - 2];
      if (prev && currentAt - new Date(prev.createdAt).getTime() > this.LONG_PAUSE_MS) {
        resumed = true;
      }
      windowed.pop();
    }

    const history: BaseMessage[] = windowed.map(m => {
      if (m.sender === 'ai_agent') return new AIMessage(m.content);
      if (m.sender === 'human_agent') return new HumanMessage(`[Agente humano] ${m.content}`);
      return new HumanMessage(m.content);
    });

    if (resumed) {
      history.push(new SystemMessage('--- El cliente retoma la conversación tras una pausa ---'));
    }

    return history;
  },

  async handleAutoGoodbye(conversationId: string, agent: any) {
    if (!agent.config?.enableGoodbyeMessage) return;
    const goodbyeText = '¡Gracias por tu consulta! Hasta pronto.';
    await this.sendMessage(conversationId, goodbyeText, 'ai_agent', agent.name || 'Mitchbot');
    try {
      const conversation = await getConversationsCollection().findOne({ _id: new ObjectId(conversationId) });
      await getConversationsCollection().updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { status: 'closed', updatedAt: new Date() } }
      );
      if (conversation?.status !== 'closed') {
        trackActivitySafely({
          projectId: conversation?.projectId,
          type: 'conversation_closed',
          title: 'Conversación cerrada',
          detail: conversation?.clientInfo.name || 'Cliente',
          icon: 'CheckCircle',
          color: 'lime',
          metadata: { conversationId },
        });
      }
    } catch (e) {
      logger.warn('[Chat] Could not update conversation status after goodbye', e);
    }
  },

  /** Marca la conversación como cerrada y notifica a las interfaces conectadas */
  async markConversationClosed(conversationId: string) {
    try {
      const conversation = await getConversationsCollection().findOne({ _id: new ObjectId(conversationId) });
      await getConversationsCollection().updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { status: 'closed', updatedAt: new Date() } }
      );
      emitToRoom(conversationId, 'chat:status', { mode: conversation?.mode, status: 'closed' });
      if (conversation?.status !== 'closed') {
        trackActivitySafely({
          projectId: conversation?.projectId,
          type: 'conversation_closed',
          title: 'Conversación cerrada',
          detail: conversation?.clientInfo.name || 'Cliente',
          icon: 'CheckCircle',
          color: 'lime',
          metadata: { conversationId },
        });
      }
    } catch (e) {
      logger.warn('[Chat] Could not close conversation', e);
    }
  },

  async createConversationFromClient(data: {
    platform: 'WhatsApp' | 'Instagram' | 'Web';
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientIdentifier: string; 
    initialMessage: string;
    projectId?: string;
    external?: Message['external'];
    channelAccount?: string;
  }) {
    const conversationsColl = getConversationsCollection();

    // Webhook repetido: no se reabre ni se crea conversación por un mensaje ya registrado.
    if (data.external) {
      const duplicate = await getMessagesCollection().findOne({
        'external.platform': data.external.platform,
        'external.messageId': data.external.messageId,
      });
      if (duplicate) {
        const conversation = await conversationsColl.findOne({ _id: duplicate.conversationId });
        return { conversation, message: duplicate, isNew: false, duplicate: true };
      }
    }

    // Una conversación que espera a una persona sigue abierta: el cliente continúa en ella.
    const existingQuery: any = {
      'clientInfo.identifier': data.clientIdentifier,
      platform: data.platform,
      status: { $in: ['active', 'pending_human'] },
    };
    if (data.projectId && ObjectId.isValid(data.projectId)) {
      existingQuery.projectId = new ObjectId(data.projectId);
    }
    const existingConversation = await conversationsColl.findOne(existingQuery);

    if (existingConversation) {
      if (data.channelAccount && existingConversation.channelAccount !== data.channelAccount) {
        // El proyecto cambió de número: se responde desde el que recibió el último mensaje.
        await conversationsColl.updateOne(
          { _id: existingConversation._id },
          { $set: { channelAccount: data.channelAccount } },
        );
        existingConversation.channelAccount = data.channelAccount;
      }
      const message = await this.sendMessage(
        existingConversation._id!.toString(),
        data.initialMessage,
        'contact',
        data.clientName || 'Cliente',
        { external: data.external }
      );
      return { conversation: existingConversation, message, isNew: false };
    }

    const conversation: Conversation = {
      _id: new ObjectId(),
      projectId: data.projectId && ObjectId.isValid(data.projectId) ? new ObjectId(data.projectId) : undefined,
      platform: data.platform,
      status: 'active',
      mode: 'auto_pilot',
      // El primer mensaje del cliente (sendMessage) incrementa a 1.
      unreadCount: 0,
      clientInfo: {
        name: data.clientName,
        phone: data.clientPhone,
        email: data.clientEmail,
        identifier: data.clientIdentifier,
      },
      ...(data.channelAccount ? { channelAccount: data.channelAccount } : {}),
      isContactCreated: false,
      lastMessage: data.initialMessage,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await conversationsColl.insertOne(conversation);

    trackActivitySafely({
      projectId: conversation.projectId,
      type: 'conversation_created',
      title: 'Nueva conversación',
      detail: data.clientName || 'Cliente nuevo',
      icon: 'ChatTeardropText',
      color: 'sky',
      metadata: { conversationId: conversation._id!.toString(), platform: data.platform },
    });

    const message = await this.sendMessage(
      conversation._id!.toString(),
      data.initialMessage,
      'contact',
      data.clientName || 'Cliente',
      { external: data.external }
    );

    try {
      emitToProject(conversation.projectId?.toString(), 'chat:new_conversation', conversation);
    } catch (e) {
      logger.warn('Socket emit new_conversation failed', e);
    }

    return { conversation, message, isNew: true };
  },

  async sendMessage(
    conversationId: string,
    content: string,
    sender: 'contact' | 'ai_agent' | 'human_agent',
    senderName?: string,
    options?: { external?: Message['external'] }
  ) {
    const messagesColl = getMessagesCollection();
    const conversationsColl = getConversationsCollection();

    const defaultNames: Record<string, string> = {
      contact: 'Cliente',
      ai_agent: 'Mitchbot',
      human_agent: 'Admin',
    };

    const newMessage: Message = {
      _id: new ObjectId(),
      conversationId: new ObjectId(conversationId),
      sender,
      senderName: senderName || defaultNames[sender] || 'Unknown',
      content,
      contentType: 'text',
      isBot: sender === 'ai_agent',
      ...(options?.external ? { external: options.external } : {}),
      createdAt: new Date(),
    };

    try {
      await messagesColl.insertOne(newMessage);
    } catch (error) {
      // Mismo id externo en paralelo: gana el primero y este no tiene efectos.
      if (!isDuplicateKey(error) || !options?.external) throw error;
      const existing = await messagesColl.findOne({
        'external.platform': options.external.platform,
        'external.messageId': options.external.messageId,
      });
      return existing!;
    }
    
    const updateSet: any = {
      lastMessage: content,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    };
    if (sender === 'ai_agent') {
      updateSet.lastBotMessageAt = new Date();
    }

    const conversationUpdate: any = { $set: updateSet };
    // Solo los mensajes entrantes del cliente suman al contador de no leídos.
    if (sender === 'contact') {
      conversationUpdate.$inc = { unreadCount: 1 };
    }

    await conversationsColl.updateOne(
      { _id: new ObjectId(conversationId) },
      conversationUpdate
    );

    try {
      emitToRoom(conversationId, 'chat:message', newMessage);
    } catch (e) {
      logger.warn('Socket emit failed', e);
    }

    if (sender !== 'contact') {
      const target = await conversationsColl.findOne(
        { _id: new ObjectId(conversationId) },
        { projection: { platform: 1, projectId: 1, channelAccount: 1 } },
      );
      await dispatch(newMessage, target);
    }

    if (sender === 'human_agent') {
      await this.ensureContactCreated(conversationId);
    }

    if (sender === 'contact') {
      const conv = await conversationsColl.findOne({ _id: new ObjectId(conversationId) });

      // Sincroniza el sidebar del dashboard aunque la conversación no esté abierta.
      // Se excluye la room de la conversación para no duplicar la entrega a los
      // sockets que ya la tienen abierta (y no exponerla a clientes públicos).
      try {
        emitToProjectDashboard(conv?.projectId?.toString(), 'chat:message', newMessage, conversationId);
      } catch (e) {
        logger.warn('Socket emit (dashboard) failed', e);
      }

      const agent = await agentService.getActiveAgent(conv?.projectId?.toString());
      const closeAfter = !!agent && this.isGoodbyeMessage(content, agent.config?.goodbyeKeywords || []);

      logger.info(`[Chat] Sender=contact, conv mode=${conv?.mode}, will trigger bot: ${conv?.mode === 'auto_pilot'}`);
      if (conv?.mode === 'auto_pilot') {
        logger.info(`[Chat] >>> Triggering generateBotResponse for ${conversationId}`);
        chatService.generateBotResponse(conversationId, content, { closeAfter }).catch(err => 
          logger.error('[Chat] Bot response CATCH:', err?.message || err)
        );
      }
      void insightsService.refreshInBackground(conversationId);
    }

    return newMessage;
  },

  /**
   * Crea (o vincula) el contacto de una conversación de forma idempotente.
   * - Por defecto respeta `autoCreateContact` del proyecto (auto-creación).
   * - Con `{ force: true }` ignora esa opción (acción explícita del agente).
   * La búsqueda por identificador + proyecto evita duplicados.
   */
  async ensureContactCreated(
    conversationId: string,
    options?: { force?: boolean }
  ): Promise<{ contact: Contact; created: boolean } | null> {
    const conversationsColl = getConversationsCollection();
    const contactsColl = getContactsCollection();
    const force = options?.force === true;

    const conversation = await conversationsColl.findOne({
      _id: new ObjectId(conversationId)
    });

    if (!conversation) {
      return null;
    }

    if (conversation.isContactCreated && !force) {
      return null;
    }

    if (!force && conversation.projectId) {
      const project = await getProjectsCollection().findOne({ _id: conversation.projectId });
      const autoCreateContact = project?.config?.options?.autoCreateContact ?? true;
      if (!autoCreateContact) {
        logger.info(`[Chat] Auto-create contact disabled for project ${conversation.projectId.toString()}`);
        return null;
      }
    }

    const existingQuery: any = {
      $or: [
        { phone: conversation.clientInfo.identifier },
        { email: conversation.clientInfo.identifier },
        { 'metadata.identifier': conversation.clientInfo.identifier },
      ].filter(Boolean),
    };
    if (conversation.projectId) {
      existingQuery.projectId = conversation.projectId;
    }
    const existingContact = await contactsColl.findOne(existingQuery);

    let contact: Contact;
    let created = false;

    if (existingContact) {
      contact = existingContact;
      logger.info(`Contact already exists: ${contact._id}, linking to conversation`);
    } else {
      const newContact: Contact = {
        projectId: conversation.projectId,
        name: conversation.clientInfo.name || 'Cliente Nuevo',
        phone: conversation.clientInfo.phone || conversation.clientInfo.identifier,
        email: conversation.clientInfo.email,
        platform: conversation.platform,
        status: 'New',
        tags: [],
        metadata: {
          identifier: conversation.clientInfo.identifier,
        },
        lastContactAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await contactsColl.insertOne(newContact);
      contact = { ...newContact, _id: result.insertedId };
      created = true;
      logger.info(`New contact created: ${contact._id} for conversation ${conversationId}`);
      trackActivitySafely({
        projectId: conversation.projectId,
        type: 'new_contact',
        title: 'Nuevo contacto',
        detail: contact.name,
        icon: 'UserPlus',
        color: 'lilac',
        metadata: { contactId: contact._id!.toString(), conversationId },
      });
    }

    await conversationsColl.updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          contactId: contact._id,
          isContactCreated: true,
          updatedAt: new Date(),
        }
      }
    );

    return { contact, created };
  },

  async generateBotResponse(conversationId: string, userMessage: string, options?: { closeAfter?: boolean }) {
    logger.info(`[Bot] ===== START generateBotResponse =====`);
    logger.info(`[Bot] Conversation: ${conversationId}`);
    logger.info(`[Bot] User message: "${userMessage.substring(0, 100)}"`);

    // 1. Create a placeholder message in DB so frontend has an ID to update IMMEDIATELY
    // This gives instant visual feedback ("typing indicator") while we do RAG and LLM setup
    const messagesColl = getMessagesCollection();
    const placeholderMsgId = new ObjectId();
    
    const placeholderMsg: Message = {
      _id: placeholderMsgId,
      conversationId: new ObjectId(conversationId),
      sender: 'ai_agent',
      senderName: 'Mitchbot',
      content: '', // Starts empty
      contentType: 'text',
      isBot: true,
      createdAt: new Date(),
    };
    
    await messagesColl.insertOne(placeholderMsg);
    
    // Emit the empty message immediately
    try {
      emitToRoom(conversationId, 'chat:message', placeholderMsg);
    } catch (e) {
      logger.warn('Socket emit failed for placeholder', e);
    }

    try {
      const conversation = await getConversationsCollection().findOne({ _id: new ObjectId(conversationId) });
      const projectId = conversation?.projectId?.toString();
      if (!projectId) {
        throw new Error('No hay proyecto asociado a la conversación');
      }

      const agent = await agentService.getActiveAgent(projectId);
      if (!agent) {
        throw new Error('No hay agente activo configurado. Ve a Settings > Agente IA.');
      }

      const personality = agent.personality || getDefaultPersonality();
      const systemPrompt = buildSystemPrompt(personality, {
        agentName: agent.name,
        agentDescription: agent.description,
        enableFallbackAdvisor: agent.config?.enableFallbackAdvisor ?? false,
        enableWelcomeGreeting: agent.config?.enableWelcomeGreeting ?? false,
        enableGoodbyeMessage: agent.config?.enableGoodbyeMessage ?? false,
        goodbyeKeywords: agent.config?.goodbyeKeywords ?? [],
      });

      logger.info(`[Bot] Agent: "${agent.name}", model: "${agent.modelValue || 'sin modelo'}"`);

      const history = await this.buildConversationHistory(conversationId, userMessage);

      let contextText = '';
      try {
        const embeddingConfig = await aiModelService.getActiveEmbeddingConfig(projectId);
        if (!embeddingConfig) {
          logger.info('[Bot] RAG disabled: no embedding model configured');
        } else {
          const collectionName = await ragService.getProjectCollectionName(projectId);
          const contextDocs = await ragService.search(userMessage, collectionName, 3, projectId);
          
          const MAX_DOCS = 2;
          const MAX_CHARS_PER_DOC = 1000;
          
          contextText = contextDocs
            .slice(0, MAX_DOCS)
            .map(d => {
              const content = d.pageContent || '';
              return content.length > MAX_CHARS_PER_DOC 
                ? content.substring(0, MAX_CHARS_PER_DOC) + '...' 
                : content;
            })
            .join('\n\n');
            
          logger.info(`[Bot] RAG: ${contextDocs.length} docs found, using top ${Math.min(contextDocs.length, MAX_DOCS)}`);
        }
      } catch (ragError) {
        logger.warn('[Bot] RAG search failed (continuing without context)');
      }

      // El bot no emite fragmentos parciales: el placeholder da el indicador de
      // escritura y la respuesta llega completa en el mensaje final.
      logger.info('[Bot] Calling aiService.generateResponseStreamWithTools...');

      const toolRun = await aiService.generateResponseStreamWithTools({
        systemPrompt,
        userMessage,
        context: contextText,
        projectId,
        toolsEnabled: true,
        history,
      });

      // Si el LLM decidió invocar una herramienta, seguimos el flujo de tools
      if (toolRun.toolCalls.length > 0) {
        const toolOutcome = await chatService.handleToolCalls({
          conversationId,
          projectId,
          conversation: conversation as Conversation,
          userMessage,
          agent,
          systemPrompt,
          toolCalls: toolRun.toolCalls,
          placeholderMsgId,
        });
        if (options?.closeAfter && !toolOutcome?.awaitingConfirmation) {
          await this.markConversationClosed(conversationId);
        }
        logger.info(`[Bot] ===== END generateBotResponse (tool flow) =====`);
        return;
      }

      const responseText = toolRun.text;

      const responseTextFinal = responseText?.trim() || '';

      // 3. Finalize message update
      let content = typeof responseTextFinal === 'string' ? responseTextFinal : String(responseTextFinal);

      if (!content) {
        await messagesColl.deleteOne({ _id: placeholderMsgId });
        return;
      }

      // Update the message in DB with final content
      await messagesColl.updateOne(
        { _id: placeholderMsgId },
        { $set: { content } }
      );
      await dispatch({ ...placeholderMsg, content }, conversation);
      
      // Update the conversation's last message
      const conversationsColl = getConversationsCollection();
      await conversationsColl.updateOne(
        { _id: new ObjectId(conversationId) },
        { 
          $set: { 
            lastMessage: content, 
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          }
        }
      );

      // Final emit to notify done and update chat lists
      try {
        emitToRoom(conversationId, 'chat:message_chunk', {
          messageId: placeholderMsgId.toString(),
          conversationId,
          content,
          isDone: true
        });
      } catch (e) {}

      logger.info(`[Bot] ✅ Stream Response OK (${content.length} chars)`);

      if (options?.closeAfter) {
        await this.markConversationClosed(conversationId);
      }

      logger.info(`[Bot] ===== END generateBotResponse (success) =====`);
    } catch (error: any) {
      logger.error(`[Bot] ❌ ERROR: ${error?.message || error}`);
      if (error?.stack) logger.error(`[Bot] Stack: ${error.stack}`);

      try {
        const errorMsg = `⚠️ **Error del bot**: ${error?.message || 'Error desconocido'}`;
        // Update the placeholder with the error message
        await getMessagesCollection().updateOne(
          { _id: placeholderMsgId },
          { $set: { content: errorMsg } }
        );
        emitToRoom(conversationId, 'chat:message_chunk', {
          messageId: placeholderMsgId.toString(),
          conversationId,
          content: errorMsg,
          isDone: true
        });
      } catch (sendError: any) {
        logger.error('[Bot] Could not send error message to chat:', sendError?.message);
      }
      logger.info(`[Bot] ===== END generateBotResponse (error) =====`);
    }
  },

  /** Crea y emite un mensaje especial (tool_call / tool_result / confirmation_request) */
  async createToolMessage(data: {
    conversationId: string;
    sender: Message['sender'];
    senderName: string;
    content: string;
    contentType: Message['contentType'];
    toolData?: Message['toolData'];
  }): Promise<Message> {
    const messagesColl = getMessagesCollection();

    const message: Message = {
      _id: new ObjectId(),
      conversationId: new ObjectId(data.conversationId),
      sender: data.sender,
      senderName: data.senderName,
      content: data.content,
      contentType: data.contentType,
      isBot: data.sender !== 'contact',
      toolData: data.toolData,
      createdAt: new Date(),
    };

    await messagesColl.insertOne(message);
    await getConversationsCollection().updateOne(
      { _id: new ObjectId(data.conversationId) },
      { $set: { lastMessage: data.content, lastMessageAt: new Date(), updatedAt: new Date() } }
    );

    try {
      emitToRoom(data.conversationId, 'chat:message', message);
    } catch (e) {
      logger.warn('Socket emit failed for tool message', e as any);
    }

    if (data.contentType === 'confirmation_request') {
      const target = await getConversationsCollection().findOne(
        { _id: new ObjectId(data.conversationId) },
        { projection: { platform: 1, projectId: 1, channelAccount: 1 } },
      );
      await dispatch(message, target);
    }

    return message;
  },

  buildToolContext(conversation: Conversation, projectId: string, userMessage: string, agent: any): ToolContext {
    return {
      conversationId: conversation._id!.toString(),
      projectId,
      contactId: conversation.contactId?.toString(),
      userMessage,
      agent,
    };
  },

  /**
   * Maneja los tool_calls detectados por el LLM.
   * - Si la herramienta requiere confirmación, guarda la ejecución pendiente y
   *   envía un mensaje `confirmation_request`.
   * - Si no, ejecuta las herramientas, guarda los `tool_result` y genera la
   *   respuesta final con los resultados.
   */
  async handleToolCalls(args: {
    conversationId: string;
    projectId: string;
    conversation: Conversation;
    userMessage: string;
    agent: any;
    systemPrompt: string;
    toolCalls: ParsedToolCall[];
    placeholderMsgId: ObjectId;
  }): Promise<{ awaitingConfirmation: boolean }> {
    const context = this.buildToolContext(args.conversation, args.projectId, args.userMessage, args.agent);
    const approvalCall = args.toolCalls.find(call => toolService.requiresApproval(call.name));
    const confirmationCall = args.toolCalls.find(call => toolService.requiresConfirmation(call.name));

    if (approvalCall) {
      await getMessagesCollection().deleteOne({ _id: args.placeholderMsgId });
      const details = toolService.details(approvalCall.name);
      const execution = await toolExecutionService.create({
        conversationId: args.conversationId,
        projectId: args.projectId,
        contactId: args.conversation.contactId?.toString(),
        toolName: approvalCall.name,
        toolId: details?.toolId,
        operation: details?.operation,
        binding: details?.binding,
        params: approvalCall.arguments || {},
        status: 'pending_approval',
        userMessage: args.userMessage,
      });
      const content = `La solicitud para ${toolService.describeCall(approvalCall)} fue enviada a un operador para su aprobación.`;
      const pendingMessage = await this.createToolMessage({
        conversationId: args.conversationId,
        sender: 'tool',
        senderName: 'Sistema',
        content,
        contentType: 'confirmation_request',
        toolData: {
          toolName: approvalCall.name,
          params: approvalCall.arguments || {},
          status: 'pending_approval',
          executionId: execution._id!.toString(),
        },
      });
      await toolExecutionService.setMessageId(execution._id!, pendingMessage._id!);
      emitToProject(args.projectId, 'admin:notification', {
        message: 'Hay una nueva operación pendiente de aprobación.',
        level: 'warning',
        conversationId: args.conversationId,
        projectId: args.projectId,
        toolExecutionId: execution._id!.toString(),
        createdAt: new Date(),
      });
      return { awaitingConfirmation: true };
    }

    if (confirmationCall) {
      // El placeholder de streaming no se usará como respuesta final
      try {
        await getMessagesCollection().deleteOne({ _id: args.placeholderMsgId });
      } catch (e) {
        logger.warn('Could not delete streaming placeholder', e as any);
      }

      const details = toolService.details(confirmationCall.name);
      const execution = await toolExecutionService.create({
        conversationId: args.conversationId,
        projectId: args.projectId,
        contactId: args.conversation.contactId?.toString(),
        toolName: confirmationCall.name,
        ...toolService.details(confirmationCall.name),
        toolId: details?.toolId,
        operation: details?.operation,
        binding: details?.binding,
        params: confirmationCall.arguments || {},
        status: 'pending_confirmation',
        userMessage: args.userMessage,
      });

      const content = `Voy a ${toolService.describeCall(confirmationCall)}. ¿Confirmas?`;
      const confirmationMsg = await this.createToolMessage({
        conversationId: args.conversationId,
        sender: 'tool',
        senderName: 'Sistema',
        content,
        contentType: 'confirmation_request',
        toolData: {
          toolName: confirmationCall.name,
          params: confirmationCall.arguments || {},
          status: 'needs_confirmation',
          executionId: execution._id!.toString(),
        },
      });
      await toolExecutionService.setMessageId(execution._id!, confirmationMsg._id!);

      logger.info(`[Bot] Confirmación solicitada: ${confirmationCall.name} (execution=${execution._id})`);
      return { awaitingConfirmation: true };
    }

    const results: { name: string; success: boolean; message: string }[] = [];
    for (const call of args.toolCalls) {
      const details = toolService.details(call.name);
      const execution = await toolExecutionService.create({
        conversationId: args.conversationId,
        projectId: args.projectId,
        contactId: args.conversation.contactId?.toString(),
        toolName: call.name,
        toolId: details?.toolId,
        operation: details?.operation,
        binding: details?.binding,
        params: call.arguments || {},
        status: 'executing',
        userMessage: args.userMessage,
      });
      const result = await toolService.execute(call, context);
      await toolExecutionService.setStatus(execution._id!, result.success ? 'executed' : 'failed', result.data ?? result.message);
      trackActivitySafely({
        projectId: args.conversation.projectId,
        type: 'tool_executed',
        title: 'Herramienta ejecutada',
        detail: call.name,
        icon: 'Wrench',
        color: result.success ? 'lime' : 'butter',
        metadata: { toolName: call.name, conversationId: args.conversationId, success: result.success },
      });
      results.push({ name: call.name, success: result.success, message: result.message });

      await this.createToolMessage({
        conversationId: args.conversationId,
        sender: 'tool',
        senderName: 'Herramienta',
        content: result.message,
        contentType: 'tool_result',
        toolData: {
          toolName: call.name,
          params: call.arguments || {},
          result: result.data ?? result.message,
          status: result.success ? 'success' : 'error',
        },
      });
    }

    await this.generateFinalToolResponse({
      conversationId: args.conversationId,
      projectId: args.projectId,
      userMessage: args.userMessage,
      agent: args.agent,
      systemPrompt: args.systemPrompt,
      placeholderMsgId: args.placeholderMsgId,
      results,
    });

    return { awaitingConfirmation: false };
  },

  async resolveToolApproval(executionId: string, projectId: string, userId: string, decision: 'approved' | 'rejected') {
    const execution = await toolExecutionService.findInProject(executionId, projectId);
    if (!execution || execution.status !== 'pending_approval') return null;

    const claimed = await toolExecutionService.claimApproval(executionId, projectId, userId, decision);
    if (!claimed) return null;
    const conversationId = execution.conversationId.toString();
    const conversation = await getConversationsCollection().findOne({ _id: execution.conversationId, projectId: new ObjectId(projectId) });
    if (!conversation) {
      await toolExecutionService.setStatus(execution._id!, 'failed', { error: 'Conversación no encontrada' });
      return { status: 'failed' as const };
    }
    const agent = await agentService.getActiveAgent(projectId);

    if (decision === 'rejected') {
      const result = { decision: 'rejected', message: 'La operación fue rechazada por un operador.' };
      await toolExecutionService.setStatus(execution._id!, 'rejected', result, userId, userId);
      await this.updateConfirmationMessage(conversationId, execution.messageId, 'rejected', { content: result.message });
      await this.createToolMessage({
        conversationId, sender: 'tool', senderName: 'Sistema', content: result.message,
        contentType: 'tool_result', toolData: { toolName: execution.toolName, executionId, status: 'rejected' },
      });
      await this.sendMessage(conversationId, result.message, 'ai_agent', agent?.name || 'Mitchbot');
      return { status: 'rejected' as const };
    }

    const context = this.buildToolContext(conversation, projectId, execution.userMessage || '', agent);
    const result = await toolService.execute(
      { name: execution.toolName, arguments: execution.params || {} }, context,
      { allowDisabled: true, authorization: 'operator_approved' },
    );
    trackActivitySafely({
      projectId: execution.projectId || conversation.projectId,
      type: 'tool_executed',
      title: 'Herramienta ejecutada',
      detail: execution.toolName,
      icon: 'Wrench',
      color: result.success ? 'lime' : 'butter',
      metadata: { toolName: execution.toolName, conversationId, success: result.success },
    });
    const status = result.success ? 'approved' : 'failed';
    await toolExecutionService.setStatus(execution._id!, status, result.data ?? result.message, userId, userId);
    await this.updateConfirmationMessage(conversationId, execution.messageId, result.success ? 'success' : 'error', { content: result.message });
    await this.createToolMessage({
      conversationId, sender: 'tool', senderName: 'Herramienta', content: result.message,
      contentType: 'tool_result', toolData: {
        toolName: execution.toolName, params: execution.params, result: result.data ?? result.message,
        status: result.success ? 'success' : 'error', executionId,
      },
    });
    await this.sendMessage(conversationId, result.message, 'ai_agent', agent?.name || 'Mitchbot');
    return { status };
  },

  /** Genera la respuesta final del bot usando los resultados de herramientas */
  async generateFinalToolResponse(args: {
    conversationId: string;
    projectId: string;
    userMessage: string;
    agent: any;
    systemPrompt: string;
    placeholderMsgId: ObjectId;
    results: { name: string; success: boolean; message: string }[];
  }) {
    const messagesColl = getMessagesCollection();

    let finalText = '';
    try {
      const history = await this.buildConversationHistory(args.conversationId, args.userMessage);
      const run = await aiService.generateResponseStreamWithTools({
        systemPrompt: args.systemPrompt,
        userMessage: args.userMessage || 'Continúa con la acción confirmada.',
        context: '',
        projectId: args.projectId,
        toolsEnabled: false,
        toolResults: args.results,
        history,
      });
      finalText = (run.text || '').trim();
    } catch (error: any) {
      logger.error(`[Bot] Final tool response failed: ${error?.message || error}`);
    }

    if (!finalText) {
      finalText = args.results.map(r => r.message).filter(Boolean).join('\n') || 'Acción completada.';
    }

    await messagesColl.updateOne({ _id: args.placeholderMsgId }, { $set: { content: finalText } });
    const placeholder = await messagesColl.findOne({ _id: args.placeholderMsgId });
    if (placeholder) {
      const target = await getConversationsCollection().findOne(
        { _id: new ObjectId(args.conversationId) },
        { projection: { platform: 1, projectId: 1, channelAccount: 1 } },
      );
      await dispatch(placeholder, target);
    }
    await getConversationsCollection().updateOne(
      { _id: new ObjectId(args.conversationId) },
      {
        $set: { lastMessage: finalText, lastMessageAt: new Date(), updatedAt: new Date() },
      }
    );

    try {
      emitToRoom(args.conversationId, 'chat:message_chunk', {
        messageId: args.placeholderMsgId.toString(),
        conversationId: args.conversationId,
        content: finalText,
        isDone: true,
      });
    } catch (e) {
      // ignore
    }

  },

  /** Actualiza el estado de un mensaje de confirmation_request y notifica al cliente */
  async updateConfirmationMessage(
    conversationId: string,
    messageId: ObjectId | undefined,
    status: 'success' | 'error' | 'cancelled' | 'rejected' | 'pending_approval' | 'needs_confirmation',
    extra?: { params?: Record<string, any>; content?: string },
  ) {
    if (!messageId) return;
    const update: any = { 'toolData.status': status };
    if (extra?.params) update['toolData.params'] = extra.params;
    if (extra?.content !== undefined) update.content = extra.content;

    await getMessagesCollection().updateOne({ _id: messageId }, { $set: update });

    try {
      emitToRoom(conversationId, 'chat:message_updated', {
        messageId: messageId.toString(),
        status,
        params: extra?.params,
        content: extra?.content,
      });
    } catch (e) {
      // ignore
    }
  },

  /**
   * Procesa la confirmación/cancelación/modificación de una herramienta.
   * Invocado desde el evento WebSocket `tool:confirm`.
   */
  async handleToolConfirmation(args: {
    conversationId: string;
    executionId: string;
    action: 'confirm' | 'cancel' | 'modify';
    params?: Record<string, any>;
    userId?: string;
  }) {
    const execution = await toolExecutionService.findById(args.executionId);
    if (!execution) throw new Error('Ejecución de herramienta no encontrada');
    if (execution.status !== 'pending_confirmation') {
      throw new Error('La acción ya no está pendiente de confirmación');
    }

    const conversationId = execution.conversationId.toString();
    if (args.conversationId && args.conversationId !== conversationId) {
      throw new Error('La ejecución no pertenece a esta conversación');
    }

    const conversation = await getConversationsCollection().findOne({ _id: execution.conversationId });
    if (!conversation) throw new Error('Conversación no encontrada');

    const projectId = execution.projectId?.toString() || conversation.projectId?.toString() || '';
    const agent = await agentService.getActiveAgent(projectId);

    if (args.action === 'cancel') {
      await toolExecutionService.setStatus(execution._id!, 'cancelled', undefined, args.userId);
      await this.updateConfirmationMessage(conversationId, execution.messageId, 'cancelled');
      await this.createToolMessage({
        conversationId,
        sender: 'tool',
        senderName: 'Herramienta',
        content: 'Acción cancelada por el usuario.',
        contentType: 'tool_result',
        toolData: {
          toolName: execution.toolName,
          status: 'cancelled',
          executionId: execution._id!.toString(),
        },
      });
      await this.sendMessage(
        conversationId,
        'Entendido, cancelé esa acción. ¿Puedo ayudarte con algo más?',
        'ai_agent',
        agent?.name || 'Mitchbot'
      );
      return { status: 'cancelled' as const };
    }

    if (args.action === 'modify' && args.params && Object.keys(args.params).length > 0) {
      const merged = { ...(execution.params || {}), ...args.params };
      await toolExecutionService.updateParams(execution._id!, merged);
      const call: ParsedToolCall = { name: execution.toolName, arguments: merged };
      await this.updateConfirmationMessage(conversationId, execution.messageId, 'needs_confirmation', {
        params: merged,
        content: `Actualicé los datos: voy a ${toolService.describeCall(call)}. ¿Confirmas?`,
      });
      return { status: 'pending_confirmation' as const };
    }

    const call: ParsedToolCall = { name: execution.toolName, arguments: execution.params || {} };
    const context = this.buildToolContext(conversation, projectId, execution.userMessage || '', agent);
    const result = await toolService.execute(call, context, { authorization: 'client_confirmed' });

    trackActivitySafely({
      projectId: execution.projectId || conversation.projectId,
      type: 'tool_executed',
      title: 'Herramienta ejecutada',
      detail: execution.toolName,
      icon: 'Wrench',
      color: result.success ? 'lime' : 'butter',
      metadata: { toolName: execution.toolName, conversationId, success: result.success },
    });

    await toolExecutionService.setStatus(
      execution._id!,
      result.success ? 'executed' : 'failed',
      result.data ?? result.message,
      args.userId
    );
    await this.updateConfirmationMessage(conversationId, execution.messageId, result.success ? 'success' : 'error');

    await this.createToolMessage({
      conversationId,
      sender: 'tool',
      senderName: 'Herramienta',
      content: result.message,
      contentType: 'tool_result',
      toolData: {
        toolName: execution.toolName,
        params: execution.params,
        result: result.data ?? result.message,
        status: result.success ? 'success' : 'error',
        executionId: execution._id!.toString(),
      },
    });

    const personality = agent?.personality || getDefaultPersonality();
    const systemPrompt = buildSystemPrompt(personality, {
      agentName: agent?.name,
      agentDescription: agent?.description,
      enableFallbackAdvisor: agent?.config?.enableFallbackAdvisor ?? false,
      enableWelcomeGreeting: agent?.config?.enableWelcomeGreeting ?? false,
      enableGoodbyeMessage: agent?.config?.enableGoodbyeMessage ?? false,
      goodbyeKeywords: agent?.config?.goodbyeKeywords ?? [],
    });

    const placeholderId = new ObjectId();
    const placeholder: Message = {
      _id: placeholderId,
      conversationId: new ObjectId(conversationId),
      sender: 'ai_agent',
      senderName: agent?.name || 'Mitchbot',
      content: '',
      contentType: 'text',
      isBot: true,
      createdAt: new Date(),
    };
    await getMessagesCollection().insertOne(placeholder);
    try {
      emitToRoom(conversationId, 'chat:message', placeholder);
    } catch (e) {
      // ignore
    }

    await this.generateFinalToolResponse({
      conversationId,
      projectId,
      userMessage: execution.userMessage || '',
      agent,
      systemPrompt,
      placeholderMsgId: placeholderId,
      results: [{ name: execution.toolName, success: result.success, message: result.message }],
    });

    return { status: result.success ? ('executed' as const) : ('failed' as const), result };
  },

  async getMessages(conversationId: string) {
    return getMessagesCollection()
      .find({ conversationId: new ObjectId(conversationId) })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
  },

  async getRecentMessages(conversationId: string, limit: number) {
    return getMessagesCollection()
      .find({
        conversationId: new ObjectId(conversationId),
        sender: { $ne: 'tool' },
        contentType: { $nin: ['tool_call', 'tool_result', 'confirmation_request'] },
        content: { $regex: /\S/ },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray()
      .then((messages) => messages.reverse());
  },

  async getMessagesPage(conversationId: string, limit: number, before?: string) {
    const collection = getMessagesCollection();
    const conversationObjectId = new ObjectId(conversationId);
    const filter: Record<string, any> = { conversationId: conversationObjectId };

    if (before) {
      const cursor = await collection.findOne(
        { _id: new ObjectId(before), conversationId: conversationObjectId },
        { projection: { createdAt: 1 } },
      );
      if (!cursor) return { messages: [], hasMore: false };
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ];
    }

    const results = await collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    return {
      messages: results.slice(0, limit).reverse(),
      hasMore: results.length > limit,
    };
  },
};
