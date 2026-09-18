import { Tool, ToolSchema, toToolSchema } from './types';
import { createAppointmentTool } from './create-appointment.tool';
import { createOrderTool } from './create-order.tool';
import { getProductInfoTool } from './get-product-info.tool';
import { getBusinessHoursTool } from './get-business-hours.tool';
import { getServiceAvailabilityTool } from './get-service-availability.tool';
import { transferToHumanTool } from './transfer-to-human.tool';
import { sendNotificationTool } from './send-notification.tool';
import { getFaqAnswerTool } from './get-faq-answer.tool';

/**
 * Registro central de herramientas del agente.
 * Para añadir una herramienta nueva basta con importarla y agregarla a este arreglo.
 */
export const tools: Tool[] = [
  createAppointmentTool,
  createOrderTool,
  getProductInfoTool,
  getBusinessHoursTool,
  getServiceAvailabilityTool,
  transferToHumanTool,
  sendNotificationTool,
  getFaqAnswerTool,
];

export function getTools(): Tool[] {
  return tools;
}

export function getTool(name: string): Tool | undefined {
  return tools.find(tool => tool.name === name);
}

export function getToolSchemas(): ToolSchema[] {
  return tools.map(toToolSchema);
}

/**
 * Descripción textual de herramientas para LLMs sin soporte nativo de tool calling.
 * El modelo debe responder con `{"tool":"...","parameters":{...}}` para invocarlas.
 */
export function getToolInstructionsText(): string {
  if (tools.length === 0) return '';

  const lines = tools.map(tool => {
    const params = tool.parameters?.properties
      ? Object.entries(tool.parameters.properties)
          .map(([key, value]) => `${key}: ${value.description || value.type}`)
          .join(', ')
      : '';
    const required = tool.parameters?.required?.length ? ` (requeridos: ${tool.parameters.required.join(', ')})` : '';
    const confirmation = tool.requiresConfirmation ? ' [requiere confirmación del usuario]' : '';
    return `- ${tool.name}(${params})${required}${confirmation}: ${tool.description}`;
  });

  return [
    'Herramientas disponibles:',
    ...lines,
    '',
    'Si el usuario pide una acción que requiere una herramienta, responde ÚNICAMENTE con un objeto JSON en una sola línea con el formato:',
    '{"tool":"<nombre_de_la_herramienta>","parameters":{...}}',
    'No incluyas texto adicional cuando invoques una herramienta.',
    'Si no necesitas ninguna herramienta, responde normalmente en lenguaje natural.',
  ].join('\n');
}

export type { Tool, ToolContext, ToolResult, ToolSchema } from './types';
