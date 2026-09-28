import { Tool, ToolControl, ToolOperation, ToolParameters, ToolResult, ToolContext } from './types';

export function defineToolOperation(
  toolId: string,
  operation: ToolOperation,
  control: ToolControl,
  description: string,
  parameters: ToolParameters,
  execute: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>,
): Tool {
  return {
    name: `${toolId}_${operation}`,
    toolId,
    operation,
    bindingId: 'internal',
    control,
    description,
    parameters,
    execute,
  };
}

export const idParameter = {
  type: 'string' as const,
  description: 'Identificador del registro.',
};
