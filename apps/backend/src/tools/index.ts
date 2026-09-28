import { sendNotificationTool } from './send-notification.tool';
import { transferToHumanTool } from './transfer-to-human.tool';
import { normalizeToolConfig, resolveConfiguredTools, toolModules } from './config';
import { Tool, ToolProjectConfig, ToolSchema, toToolSchema } from './types';

export const systemTools: Tool[] = [transferToHumanTool, sendNotificationTool];

export function getTools(config?: ToolProjectConfig | null): Tool[] {
  return [...systemTools, ...resolveConfiguredTools(config)];
}

export function getTool(name: string): Tool | undefined {
  return [...systemTools, ...toolModules.flatMap(module => Object.values(module.operations))]
    .find(tool => tool.name === name);
}

export function getToolSchemas(config?: ToolProjectConfig | null): ToolSchema[] {
  return getTools(config).map(toToolSchema);
}

export function getToolInstructionsText(config?: ToolProjectConfig | null): string {
  const tools = getTools(config);
  if (tools.length === 0) return '';
  const lines = tools.map(tool => {
    const params = Object.entries(tool.parameters.properties || {})
      .map(([key, value]) => `${key}: ${value.description || value.type}`).join(', ');
    const required = tool.parameters.required?.length ? ` (requeridos: ${tool.parameters.required.join(', ')})` : '';
    const control = tool.control === 'confirmacion_cliente'
      ? ' [requiere confirmación del cliente]'
      : tool.control === 'aprobacion_operador' ? ' [requiere aprobación del operador]' : '';
    return `- ${tool.name}(${params})${required}${control}: ${tool.description}`;
  });
  return [
    'Herramientas disponibles:', ...lines, '',
    'Si necesitas una herramienta, responde únicamente con un objeto JSON en una línea:',
    '{"tool":"<nombre_de_la_herramienta>","parameters":{...}}',
    'Si no necesitas una herramienta, responde normalmente en lenguaje natural.',
  ].join('\n');
}

export function getToolCatalog(config?: ToolProjectConfig | null) {
  const effectiveConfig = normalizeToolConfig(config);
  return toolModules.map(module => ({
    id: module.id,
    label: module.label,
    enabled: effectiveConfig[module.id]?.enabled ?? true,
    operations: Object.entries(module.operations).map(([operation, tool]) => ({
      id: operation,
      name: tool.name,
      description: tool.description,
      control: tool.control,
      enabled: effectiveConfig[module.id]?.operations[operation as keyof typeof module.operations]?.enabled ?? false,
      binding: effectiveConfig[module.id]?.operations[operation as keyof typeof module.operations]?.binding ?? 'internal',
      bindings: module.bindings.filter(binding => binding.operations.includes(operation as any)),
    })),
  }));
}

export type { Tool, ToolContext, ToolResult, ToolSchema, ToolProjectConfig } from './types';
