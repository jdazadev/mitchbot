import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { llmProviderService, LLMProviderConfig } from './llm-provider.service';
import { agentService } from './agent.service';
import { aiModelService } from './ai-model.service';
import { toolService, ParsedToolCall } from './tool.service';
import { logger } from '../utils/logger';

export interface ToolResultSummary {
  name: string;
  success: boolean;
  message: string;
}

export interface GenerationWithToolsResult {
  text: string;
  toolCalls: ParsedToolCall[];
  provider: LLMProviderConfig['provider'];
  model: string;
  native: boolean;
}

function normalizeChunkContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part: any) => (typeof part === 'string' ? part : part?.text || '')).join('');
  }
  if (content == null) return '';
  return '';
}

function finalizeNativeToolCalls(acc: Map<number, { id?: string; name: string; args: string }>): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  for (const entry of acc.values()) {
    if (!entry.name) continue;
    let args: any = {};
    const rawArgs = (entry.args || '').trim();
    if (rawArgs) {
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = {};
      }
    }
    calls.push({ id: entry.id, name: entry.name, arguments: args });
  }
  return calls;
}

// =================== CAPA DE ABSTRACCIÓN ===================

export const aiService = {

  /**
   * FUNCIÓN INTERMEDIARIA: genera una respuesta (Non-streaming)
   */
  async generateResponse(systemPrompt: string, userMessage: string, context: string = '', projectId?: string): Promise<string> {
    const config = await this.resolveModelConfig(projectId);
    logger.info(`[AI] Invoking: provider=${config.provider}, model=${config.model}`);

    if (config.provider === 'ollama') {
      await this.validateOllamaModel(config.model);
    }

    const chatModel = llmProviderService.createChatModel(config);

    const fullSystemPrompt = context
      ? `${systemPrompt}\n\nContexto relevante:\n${context}`
      : systemPrompt;

    const messages: BaseMessage[] = [
      new SystemMessage(fullSystemPrompt),
      new HumanMessage(userMessage),
    ];

    const TIMEOUT_MS = 60_000;
    try {
      const startTime = Date.now();
      logger.info(`[AI] Prompt size: System=${fullSystemPrompt.length} chars, User=${userMessage.length} chars`);

      const response = await Promise.race([
        chatModel.invoke(messages),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(
            `Timeout: "${config.model}" no respondió en ${TIMEOUT_MS / 1000}s. Verifica que el proveedor esté configurado correctamente.`
          )), TIMEOUT_MS)
        ),
      ]);

      const elapsedMs = Date.now() - startTime;
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      logger.info(`[AI] Response OK (${content.length} chars) from ${config.provider}/${config.model} in ${elapsedMs}ms`);
      return content;
    } catch (error: any) {
      logger.error(`[AI] Error from ${config.provider}/${config.model}:`, error.message);
      throw new Error(`Error del proveedor ${config.provider} (${config.model}): ${error.message}`);
    }
  },

  /**
   * FUNCIÓN INTERMEDIARIA (STREAMING): genera una respuesta emitiendo chunks.
   */
  async generateResponseStream(
    systemPrompt: string, 
    userMessage: string, 
    context: string = '',
    onChunk: (chunk: string) => void,
    projectId?: string
  ): Promise<string> {
    const config = await this.resolveModelConfig(projectId);
    logger.info(`[AI Streaming] Invoking: provider=${config.provider}, model=${config.model}`);

    if (config.provider === 'ollama') {
      await this.validateOllamaModel(config.model);
    }

    const chatModel = llmProviderService.createChatModel(config);

    const fullSystemPrompt = context
      ? `${systemPrompt}\n\nContexto relevante:\n${context}`
      : systemPrompt;

    const messages: BaseMessage[] = [
      new SystemMessage(fullSystemPrompt),
      new HumanMessage(userMessage),
    ];

    try {
      const startTime = Date.now();
      logger.info(`[AI Streaming] Prompt size: System=${fullSystemPrompt.length} chars, User=${userMessage.length} chars`);

      let fullContent = '';
      
      // langchain stream method
      const stream = await chatModel.stream(messages);
      
      for await (const chunk of stream) {
        const chunkText = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
        if (chunkText) {
            fullContent += chunkText;
            onChunk(chunkText);
        }
      }

      const elapsedMs = Date.now() - startTime;
      logger.info(`[AI Streaming] Response OK (${fullContent.length} chars) from ${config.provider}/${config.model} in ${elapsedMs}ms`);
      return fullContent;
    } catch (error: any) {
      logger.error(`[AI Streaming] Error from ${config.provider}/${config.model}:`, error.message);
      throw new Error(`Error del proveedor ${config.provider} (${config.model}): ${error.message}`);
    }
  },

  /**
   * FUNCIÓN INTERMEDIARIA (TOOLS): genera una respuesta con soporte de herramientas.
   *
   * Flujo:
   *  1. Si `toolResults` viene, genera la respuesta final (streaming) usando los
   *     resultados ya ejecutados.
   *  2. Si hay tools y el proveedor soporta tool calling nativo (openrouter/gemini),
   *     hace streaming con `bindTools` y devuelve los tool_calls detectados.
   *  3. Si el proveedor no soporta tools nativo (ollama), inyecta la descripción de
   *     herramientas en el system prompt y detecta el JSON de invocación.
   */
  async generateResponseStreamWithTools(params: {
    systemPrompt: string;
    userMessage: string;
    context?: string;
    onChunk?: (chunk: string) => void;
    projectId?: string;
    toolsEnabled?: boolean;
    toolResults?: ToolResultSummary[];
  }): Promise<GenerationWithToolsResult> {
    const config = await this.resolveModelConfig(params.projectId);
    logger.info(`[AI Tools] Invoking: provider=${config.provider}, model=${config.model}, tools=${params.toolsEnabled !== false}`);
    if (config.provider === 'ollama') {
      await this.validateOllamaModel(config.model);
    }

    const chatModel: any = llmProviderService.createChatModel(config);
    const supportsNative = config.provider === 'openrouter' || config.provider === 'gemini';
    const detectingTools = params.toolsEnabled !== false && !params.toolResults?.length;
    const nativeTools = detectingTools && supportsNative;

    let fullSystemPrompt = params.context
      ? `${params.systemPrompt}\n\nContexto relevante:\n${params.context}`
      : params.systemPrompt;

    if (detectingTools && !nativeTools) {
      fullSystemPrompt += `\n\n${toolService.instructionsText()}`;
    }

    const messages: BaseMessage[] = [
      new SystemMessage(fullSystemPrompt),
      new HumanMessage(params.userMessage),
    ];

    if (params.toolResults?.length) {
      const summary = params.toolResults
        .map(r => `- ${r.name}: ${r.success ? 'OK' : 'ERROR'} — ${r.message}`)
        .join('\n');
      messages.push(new HumanMessage(
        `Resultados de las herramientas ejecutadas:\n${summary}\n\n` +
        'Usa estos resultados para responder al cliente de forma natural y breve. ' +
        'No menciones nombres internos de herramientas ni devuelvas JSON.'
      ));
    }

    const startTime = Date.now();
    try {
      // Proveedor sin tools nativo en fase de detección: una sola invocación sin streaming
      if (detectingTools && !nativeTools) {
        const response = await chatModel.invoke(messages);
        const content = normalizeChunkContent(response?.content).trim();
        const parsed = toolService.parseToolCallFromText(content);
        if (parsed) {
          logger.info(`[AI Tools] Tool call detectado (heurístico): ${parsed.name}`);
          return { text: '', toolCalls: [parsed], provider: config.provider, model: config.model, native: false };
        }
        if (content) params.onChunk?.(content);
        return { text: content, toolCalls: [], provider: config.provider, model: config.model, native: false };
      }

      const boundModel = nativeTools ? chatModel.bindTools(toolService.schemas()) : chatModel;
      const stream = await boundModel.stream(messages);

      let fullContent = '';
      const toolCallAcc = new Map<number, { id?: string; name: string; args: string }>();

      for await (const chunk of stream as any) {
        const chunkText = normalizeChunkContent(chunk?.content);
        if (chunkText) {
          fullContent += chunkText;
          params.onChunk?.(chunkText);
        }

        const toolCallChunks = (chunk as any)?.tool_call_chunks;
        if (Array.isArray(toolCallChunks)) {
          for (const tc of toolCallChunks) {
            const index = typeof tc?.index === 'number' ? tc.index : 0;
            const existing = toolCallAcc.get(index) || { id: tc?.id, name: '', args: '' };
            if (tc?.id) existing.id = tc.id;
            if (tc?.name) existing.name = existing.name ? `${existing.name}${tc.name}` : tc.name;
            if (typeof tc?.args === 'string') existing.args += tc.args;
            toolCallAcc.set(index, existing);
          }
        }

        const fullToolCalls = (chunk as any)?.tool_calls;
        if (Array.isArray(fullToolCalls) && fullToolCalls.length > 0) {
          const normalized = toolService.normalizeNativeToolCalls(fullToolCalls);
          normalized.forEach((call, idx) => {
            if (!call.name) return;
            const existing = toolCallAcc.get(idx) || { id: call.id, name: '', args: '' };
            existing.id = call.id || existing.id;
            existing.name = call.name;
            existing.args = JSON.stringify(call.arguments || {});
            toolCallAcc.set(idx, existing);
          });
        }
      }

      const toolCalls = finalizeNativeToolCalls(toolCallAcc);
      if (toolCalls.length > 0) {
        logger.info(`[AI Tools] ${toolCalls.length} tool call(s) detectados (nativo)`);
        return { text: fullContent, toolCalls, provider: config.provider, model: config.model, native: true };
      }

      logger.info(`[AI Tools] Respuesta OK (${fullContent.length} chars) en ${Date.now() - startTime}ms`);
      return { text: fullContent, toolCalls: [], provider: config.provider, model: config.model, native: nativeTools };
    } catch (error: any) {
      logger.error(`[AI Tools] Error from ${config.provider}/${config.model}:`, error?.message || error);
      throw new Error(`Error del proveedor ${config.provider} (${config.model}): ${error.message}`);
    }
  },

  async resolveModelConfig(projectId?: string): Promise<LLMProviderConfig> {
    const providerConfig = await aiModelService.getActiveProviderConfig('llm', projectId);
    if (!providerConfig) {
      throw new Error('No hay proveedor LLM configurado. Ve a Settings > Proveedor LLM para configurar uno.');
    }

    const agent = await agentService.getActiveAgent();
    if (!agent) {
      throw new Error('No hay agente activo. Ve a Settings > Agente IA para configurar uno.');
    }

    const provider = providerConfig.provider as LLMProviderConfig['provider'];
    const model = agent.modelValue || providerConfig.selectedModel || '';

    if (!model) {
      throw new Error(`No hay modelo seleccionado para el agente "${agent.name}". Ve a Settings > Agente IA y selecciona un modelo.`);
    }

    logger.info(`[AI] Resolved: provider=${provider}, model=${model}, hasApiKey=${!!providerConfig.apiKey}`);

    return {
      provider,
      model,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
      temperature: agent.config?.temperature ?? 0.7,
      maxTokens: agent.config?.maxTokens ?? 300,
    };
  },

  async validateOllamaModel(model: string): Promise<void> {
    try {
      const models = await llmProviderService.fetchOllamaModels();
      const names = models.map(m => m.name || m.model);

      if (names.length === 0) {
        throw new Error(`Ollama no tiene modelos descargados. Ejecuta: ollama pull ${model}`);
      }
      if (!names.includes(model)) {
        throw new Error(`Modelo "${model}" no encontrado en Ollama. Disponibles: ${names.join(', ')}. Descárgalo con: ollama pull ${model}`);
      }
    } catch (error: any) {
      if (error.message.includes('Ollama') || error.message.includes('Modelo')) throw error;
      throw new Error(`No se pudo conectar a Ollama. ¿Está corriendo?`);
    }
  },
};
