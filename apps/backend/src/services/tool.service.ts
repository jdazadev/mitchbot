import { getTool, getTools, getToolSchemas, getToolInstructionsText } from '../tools';
import { Tool, ToolContext, ToolResult } from '../tools/types';
import { logger } from '../utils/logger';

export interface ParsedToolCall {
  id?: string;
  name: string;
  arguments: Record<string, any>;
}

function coerceArguments(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export const toolService = {
  list(): Tool[] {
    return getTools();
  },

  get(name: string): Tool | undefined {
    return getTool(name);
  },

  schemas() {
    return getToolSchemas();
  },

  instructionsText(): string {
    return getToolInstructionsText();
  },

  requiresConfirmation(name: string): boolean {
    return !!getTool(name)?.requiresConfirmation;
  },

  /** Descripción legible de una invocación (para pedir confirmación al usuario) */
  describeCall(call: ParsedToolCall): string {
    const args = call.arguments || {};
    switch (call.name) {
      case 'create_appointment':
        return `agendar una cita para ${args.service || 'un servicio'} el ${args.date || 'la fecha indicada'}${args.time ? ` a las ${args.time}` : ''}`;
      case 'create_order': {
        const items = Array.isArray(args.items)
          ? args.items.map((item: any) => `${item?.quantity || 1}x ${item?.name || 'artículo'}`).join(', ')
          : 'los artículos indicados';
        return `crear un pedido con ${items}`;
      }
      default: {
        const params = Object.entries(args)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join(', ');
        return `ejecutar la acción "${call.name}"${params ? ` (${params})` : ''}`;
      }
    }
  },

  /**
   * Detecta una invocación de herramienta en texto libre.
   * Se usa para LLMs sin soporte nativo de tool calling.
   */
  parseToolCallFromText(text: string): ParsedToolCall | null {
    if (!text) return null;

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [fenced?.[1], text.trim()];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const jsonMatch = candidate.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed.tool === 'string' && parsed.tool.trim()) {
          return {
            name: parsed.tool.trim(),
            arguments: coerceArguments(parsed.parameters ?? parsed.arguments),
          };
        }
      } catch {
        // intentar con el siguiente candidato
      }
    }
    return null;
  },

  /** Normaliza los tool_calls nativos que devuelve LangChain */
  normalizeNativeToolCalls(toolCalls: any[]): ParsedToolCall[] {
    if (!Array.isArray(toolCalls)) return [];
    return toolCalls
      .map(call => ({
        id: call?.id,
        name: String(call?.name || call?.function?.name || '').trim(),
        arguments: coerceArguments(call?.args ?? call?.function?.arguments),
      }))
      .filter(call => call.name);
  },

  /** Ejecuta una herramienta y normaliza el resultado */
  async execute(call: ParsedToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = getTool(call.name);
    if (!tool) {
      return { success: false, message: `Herramienta desconocida: ${call.name}`, error: 'unknown_tool' };
    }

    try {
      const result = await tool.execute(call.arguments || {}, context);
      logger.info(`[Tool] ${call.name} ejecutada (success=${result.success})`);
      return result;
    } catch (error: any) {
      logger.error(`[Tool] ${call.name} falló: ${error?.message || error}`);
      return {
        success: false,
        message: `Error al ejecutar la herramienta ${call.name}.`,
        error: error?.message || String(error),
      };
    }
  },
};
