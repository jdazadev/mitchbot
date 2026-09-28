import { getTool, getTools, getToolSchemas, getToolInstructionsText } from '../tools';
import { normalizeToolConfig } from '../tools/config';
import { Tool, ToolContext, ToolResult } from '../tools/types';
import { ObjectId } from 'mongodb';
import { getProjectsCollection } from '../models/project.model';
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
  async projectConfig(projectId?: string) {
    if (!projectId || !ObjectId.isValid(projectId)) return normalizeToolConfig();
    const project = await getProjectsCollection().findOne({ _id: new ObjectId(projectId) }, { projection: { 'config.tools': 1 } });
    return normalizeToolConfig(project?.config?.tools);
  },

  async list(projectId?: string): Promise<Tool[]> {
    return getTools(await this.projectConfig(projectId));
  },

  async schemas(projectId?: string) {
    return getToolSchemas(await this.projectConfig(projectId));
  },

  async instructionsText(projectId?: string): Promise<string> {
    return getToolInstructionsText(await this.projectConfig(projectId));
  },

  requiresConfirmation(name: string): boolean {
    return getTool(name)?.control === 'confirmacion_cliente' || !!getTool(name)?.requiresConfirmation;
  },

  requiresApproval(name: string): boolean {
    return getTool(name)?.control === 'aprobacion_operador';
  },

  control(name: string) {
    return getTool(name)?.control || (getTool(name)?.requiresConfirmation ? 'confirmacion_cliente' : 'ninguna');
  },

  details(name: string) {
    const tool = getTool(name);
    return tool ? { toolId: tool.toolId, operation: tool.operation, binding: tool.bindingId || 'internal' } : undefined;
  },

  /** Descripción legible de una invocación (para pedir confirmación al usuario) */
  describeCall(call: ParsedToolCall): string {
    const args = call.arguments || {};
    switch (call.name) {
      case 'agenda_crear':
        return `agendar una cita para ${args.service || 'un servicio'} el ${args.date || 'la fecha indicada'}${args.time ? ` a las ${args.time}` : ''}`;
      case 'inventario_crear': {
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
  async execute(
    call: ParsedToolCall,
    context: ToolContext,
    options: { allowDisabled?: boolean; authorization?: 'client_confirmed' | 'operator_approved' } = {},
  ): Promise<ToolResult> {
    const tool = getTool(call.name);
    if (!tool) {
      return { success: false, message: `Herramienta desconocida: ${call.name}`, error: 'unknown_tool' };
    }

    if (tool.control === 'confirmacion_cliente' && options.authorization !== 'client_confirmed') {
      return { success: false, message: 'Esta operación requiere confirmación del cliente.', error: 'confirmation_required' };
    }
    if (tool.control === 'aprobacion_operador' && options.authorization !== 'operator_approved') {
      return { success: false, message: 'Esta operación requiere aprobación de un operador.', error: 'approval_required' };
    }

    if (!options.allowDisabled && tool.toolId) {
      const config = await this.projectConfig(context.projectId);
      const moduleConfig = config[tool.toolId];
      const operationConfig = tool.operation && moduleConfig?.operations[tool.operation];
      if (!moduleConfig?.enabled || !operationConfig?.enabled || operationConfig.binding !== tool.bindingId) {
        return { success: false, message: 'La operación no está habilitada para este proyecto.', error: 'tool_disabled' };
      }
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
