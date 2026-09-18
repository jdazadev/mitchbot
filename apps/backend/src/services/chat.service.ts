import { ObjectId } from 'mongodb';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { getConversationsCollection, Conversation } from '../models/conversation.model';
import { getMessagesCollection, Message } from '../models/message.model';
import { getContactsCollection, Contact } from '../models/contact.model';
import { getProjectsCollection } from '../models/project.model';
import { ragService } from './rag.service';
import { aiService } from './ai.service';
import { agentService } from './agent.service';
import { aiModelService } from './ai-model.service';
import { toolService, ParsedToolCall } from './tool.service';
import { toolExecutionService } from './tool-execution.service';
import { buildSystemPrompt, getDefaultPersonality } from './prompt-builder.service';
import { emitToRoom, emitToProject } from '../websocket/socket';
import { ToolContext } from '../tools/types';
import { logger } from '../utils/logger';

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
    const messages = await this.getMessages(conversationId);
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
      await getConversationsCollection().updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { status: 'closed', updatedAt: new Date() } }
      );
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
  }) {
    const conversationsColl = getConversationsCollection();

    const existingQuery: any = {
      'clientInfo.identifier': data.clientIdentifier,
      status: 'active',
    };
    if (data.projectId && ObjectId.isValid(data.projectId)) {
      existingQuery.projectId = new ObjectId(data.projectId);
    }
    const existingConversation = await conversationsColl.findOne(existingQuery);

    if (existingConversation) {
      const message = await this.sendMessage(
        existingConversation._id!.toString(),
        data.initialMessage,
        'contact',
        data.clientName || 'Cliente'
      );
      return { conversation: existingConversation, message, isNew: false };
    }

    const conversation: Conversation = {
      _id: new ObjectId(),
      projectId: data.projectId && ObjectId.isValid(data.projectId) ? new ObjectId(data.projectId) : undefined,
      platform: data.platform,
      status: 'active',
      mode: 'auto_pilot',
      unreadCount: 1,
      clientInfo: {
        name: data.clientName,
        phone: data.clientPhone,
        email: data.clientEmail,
        identifier: data.clientIdentifier,
      },
      isContactCreated: false,
      lastMessage: data.initialMessage,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await conversationsColl.insertOne(conversation);

    const message = await this.sendMessage(
      conversation._id!.toString(),
      data.initialMessage,
      'contact',
      data.clientName || 'Cliente'
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
    senderName?: string
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
      createdAt: new Date(),
    };

    await messagesColl.insertOne(newMessage);
    
    const updateSet: any = {
      lastMessage: content,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    };
    if (sender === 'ai_agent') {
      updateSet.lastBotMessageAt = new Date();
    }

    await conversationsColl.updateOne(
      { _id: new ObjectId(conversationId) },
      { 
        $set: updateSet,
        $inc: { unreadCount: 1 }
      }
    );

    try {
      emitToRoom(conversationId, 'chat:message', newMessage);
    } catch (e) {
      logger.warn('Socket emit failed', e);
    }

    if (sender === 'human_agent') {
      await this.ensureContactCreated(conversationId);
    }

    if (sender === 'contact') {
      const conv = await conversationsColl.findOne({ _id: new ObjectId(conversationId) });
      const agent = await agentService.getActiveAgent(conv?.projectId?.toString());
      const closeAfter = !!agent && this.isGoodbyeMessage(content, agent.config?.goodbyeKeywords || []);

      logger.info(`[Chat] Sender=contact, conv mode=${conv?.mode}, will trigger bot: ${conv?.mode === 'auto_pilot'}`);
      if (conv?.mode === 'auto_pilot') {
        logger.info(`[Chat] >>> Triggering generateBotResponse for ${conversationId}`);
        chatService.generateBotResponse(conversationId, content, { closeAfter }).catch(err => 
          logger.error('[Chat] Bot response CATCH:', err?.message || err)
        );
      }
    }

    return newMessage;
  },

  async ensureContactCreated(conversationId: string) {
    const conversationsColl = getConversationsCollection();
    const contactsColl = getContactsCollection();

    const conversation = await conversationsColl.findOne({ 
      _id: new ObjectId(conversationId) 
    });

    if (!conversation || conversation.isContactCreated) {
      return; 
    }

    if (conversation.projectId) {
      const project = await getProjectsCollection().findOne({ _id: conversation.projectId });
      const autoCreateContact = project?.config?.options?.autoCreateContact ?? true;
      if (!autoCreateContact) {
        logger.info(`[Chat] Auto-create contact disabled for project ${conversation.projectId.toString()}`);
        return;
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

    let contactId: ObjectId;

    if (existingContact) {
      contactId = existingContact._id!;
      logger.info(`Contact already exists: ${contactId}, linking to conversation`);
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
      contactId = result.insertedId;
      logger.info(`New contact created: ${contactId} for conversation ${conversationId}`);
    }

    await conversationsColl.updateOne(
      { _id: new ObjectId(conversationId) },
      { 
        $set: { 
          contactId,
          isContactCreated: true,
          updatedAt: new Date(),
        } 
      }
    );
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

      // STREAMING IMPLEMENTATION (con soporte de herramientas)
      logger.info('[Bot] Calling aiService.generateResponseStreamWithTools...');

      let accumulatedResponse = '';

      const onChunk = (chunk: string) => {
        accumulatedResponse += chunk;
        try {
          emitToRoom(conversationId, 'chat:message_chunk', {
            messageId: placeholderMsgId.toString(),
            conversationId,
            content: accumulatedResponse,
            isDone: false,
          });
        } catch (e) {
          // Ignore socket errors for individual chunks
        }
      };

      // 2. Call generateResponseStreamWithTools with chunk callback
      const toolRun = await aiService.generateResponseStreamWithTools({
        systemPrompt,
        userMessage,
        context: contextText,
        onChunk,
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
          emittedText: accumulatedResponse,
        });
        if (options?.closeAfter && !toolOutcome?.awaitingConfirmation) {
          await this.markConversationClosed(conversationId);
        }
        logger.info(`[Bot] ===== END generateBotResponse (tool flow) =====`);
        return;
      }

      const responseText = toolRun.text || accumulatedResponse;

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
      
      // Update the conversation's last message
      const conversationsColl = getConversationsCollection();
      await conversationsColl.updateOne(
        { _id: new ObjectId(conversationId) },
        { 
          $set: { 
            lastMessage: content, 
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          },
          $inc: { unreadCount: 1 } // Since bot responded
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
    emittedText?: string;
  }): Promise<{ awaitingConfirmation: boolean }> {
    const context = this.buildToolContext(args.conversation, args.projectId, args.userMessage, args.agent);
    const confirmationCall = args.toolCalls.find(call => toolService.requiresConfirmation(call.name));

    if (confirmationCall) {
      // El placeholder de streaming no se usará como respuesta final
      try {
        await getMessagesCollection().deleteOne({ _id: args.placeholderMsgId });
      } catch (e) {
        logger.warn('Could not delete streaming placeholder', e as any);
      }

      const execution = await toolExecutionService.create({
        conversationId: args.conversationId,
        projectId: args.projectId,
        contactId: args.conversation.contactId?.toString(),
        toolName: confirmationCall.name,
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
      const result = await toolService.execute(call, context);
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

  /** Genera (streaming) la respuesta final del bot usando los resultados de herramientas */
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
    let accumulated = '';

    const onChunk = (chunk: string) => {
      accumulated += chunk;
      try {
        emitToRoom(args.conversationId, 'chat:message_chunk', {
          messageId: args.placeholderMsgId.toString(),
          conversationId: args.conversationId,
          content: accumulated,
          isDone: false,
        });
      } catch (e) {
        // ignore
      }
    };

    let finalText = '';
    try {
      const history = await this.buildConversationHistory(args.conversationId, args.userMessage);
      const run = await aiService.generateResponseStreamWithTools({
        systemPrompt: args.systemPrompt,
        userMessage: args.userMessage || 'Continúa con la acción confirmada.',
        context: '',
        onChunk,
        projectId: args.projectId,
        toolsEnabled: false,
        toolResults: args.results,
        history,
      });
      finalText = (run.text || accumulated).trim();
    } catch (error: any) {
      logger.error(`[Bot] Final tool response failed: ${error?.message || error}`);
    }

    if (!finalText) {
      finalText = args.results.map(r => r.message).filter(Boolean).join('\n') || 'Acción completada.';
    }

    await messagesColl.updateOne({ _id: args.placeholderMsgId }, { $set: { content: finalText } });
    await getConversationsCollection().updateOne(
      { _id: new ObjectId(args.conversationId) },
      {
        $set: { lastMessage: finalText, lastMessageAt: new Date(), updatedAt: new Date() },
        $inc: { unreadCount: 1 },
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
    status: 'success' | 'error' | 'cancelled' | 'needs_confirmation',
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
    const result = await toolService.execute(call, context);

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
      .sort({ createdAt: 1 })
      .toArray();
  },
};
