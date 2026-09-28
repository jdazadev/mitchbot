import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { llmProviderService, LLMProviderConfig } from './llm-provider.service';
import { agentService } from './agent.service';
import { toolService, ParsedToolCall } from './tool.service';
import { logger } from '../utils/logger';
import env from '../config/env';

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
  async generateResponse(systemPrompt: string, userMessage: string, context: string = '', projectId?: string, history: BaseMessage[] = []): Promise<string> {
    const config = await this.resolveModelConfig(projectId);
    logger.info(`[AI] Invoking: provider=${config.provider}, model=${config.model}`);

    const chatModel = llmProviderService.createChatModel(config);

    const fullSystemPrompt = context
      ? `${systemPrompt}\n\nContexto relevante:\n${context}`
      : systemPrompt;

    const messages: BaseMessage[] = [
      new SystemMessage(fullSystemPrompt),
      ...history,
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
    projectId?: string,
    history: BaseMessage[] = []
  ): Promise<string> {
    const config = await this.resolveModelConfig(projectId);
    logger.info(`[AI Streaming] Invoking: provider=${config.provider}, model=${config.model}`);

    const chatModel = llmProviderService.createChatModel(config);

    const fullSystemPrompt = context
      ? `${systemPrompt}\n\nContexto relevante:\n${context}`
      : systemPrompt;

    const messages: BaseMessage[] = [
      new SystemMessage(fullSystemPrompt),
      ...history,
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
   *  2. Si hay tools, hace streaming con `bindTools` (tool calling nativo de
   *     OpenRouter) y devuelve los tool_calls detectados.
   */
  async generateResponseStreamWithTools(params: {
    systemPrompt: string;
    userMessage: string;
    context?: string;
    onChunk?: (chunk: string) => void;
    projectId?: string;
    toolsEnabled?: boolean;
    toolResults?: ToolResultSummary[];
    history?: BaseMessage[];
  }): Promise<GenerationWithToolsResult> {
    const config = await this.resolveModelConfig(params.projectId);
    logger.info(`[AI Tools] Invoking: provider=${config.provider}, model=${config.model}, tools=${params.toolsEnabled !== false}`);

    const chatModel: any = llmProviderService.createChatModel(config);
    const detectingTools = params.toolsEnabled !== false && !params.toolResults?.length;

    const fullSystemPrompt = params.context
      ? `${params.systemPrompt}\n\nContexto relevante:\n${params.context}`
      : params.systemPrompt;

    const messages: BaseMessage[] = [
      new SystemMessage(fullSystemPrompt),
      ...(params.history ?? []),
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
      const boundModel = detectingTools ? chatModel.bindTools(await toolService.schemas(params.projectId)) : chatModel;
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
      return { text: fullContent, toolCalls: [], provider: config.provider, model: config.model, native: true };
    } catch (error: any) {
      logger.error(`[AI Tools] Error from ${config.provider}/${config.model}:`, error?.message || error);
      throw new Error(`Error del proveedor ${config.provider} (${config.model}): ${error.message}`);
    }
  },

  async resolveModelConfig(projectId?: string): Promise<LLMProviderConfig> {
    const agent = await agentService.getActiveAgent(projectId);
    if (!agent) {
      throw new Error('No hay agente activo. Ve a Settings > Agente IA para configurar uno.');
    }

    const model = env.OPENROUTER_LLM_MODEL || '';

    if (!model) {
      throw new Error('Falta el modelo de lenguaje: define OPENROUTER_LLM_MODEL en el entorno.');
    }

    if (!env.OPENROUTER_API_KEY) {
      throw new Error('Falta la credencial del proveedor: define OPENROUTER_API_KEY en el entorno.');
    }

    logger.info(`[AI] Resolved: provider=openrouter, model=${model}`);

    return {
      provider: 'openrouter',
      model,
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      temperature: agent.config?.temperature ?? 0.7,
      maxTokens: agent.config?.maxTokens ?? 300,
    };
  },
};
