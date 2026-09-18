/**
 * Tipos base del sistema de herramientas (tool use).
 *
 * Cada tool exporta un objeto `Tool` con:
 *  - name/description/parameters (schema compatible con OpenAI functions)
 *  - execute(params, context)
 *  - requiresConfirmation (acciones que modifican estado piden confirmación)
 */

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty | { type: string; properties?: Record<string, ToolParameterProperty>; required?: string[] };
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolContext {
  conversationId: string;
  projectId: string;
  contactId?: string;
  userMessage: string;
  agent?: any;
}

export interface ToolResult {
  success: boolean;
  /** Resumen legible para el LLM / usuario */
  message: string;
  data?: any;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  requiresConfirmation?: boolean;
  execute: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>;
}

/** Formato OpenAI-compatible para bindTools() */
export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}

export function toToolSchema(tool: Tool): ToolSchema {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
