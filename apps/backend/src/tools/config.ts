import { agendaModule } from './modules/agenda';
import { inventoryModule } from './modules/inventory';
import { knowledgeModule } from './modules/knowledge';
import { paymentsModule } from './modules/payments';
import { ToolModule, ToolOperation, ToolProjectConfig } from './types';

export const toolModules: ToolModule[] = [agendaModule, knowledgeModule, inventoryModule, paymentsModule];
export const LEGACY_ENABLED_OPERATIONS: Record<string, ToolOperation[]> = {
  agenda: ['crear'],
  conocimiento: ['leer'],
  inventario: ['crear'],
};

export function createDefaultToolConfig(profile: 'legacy' | 'new' = 'legacy'): ToolProjectConfig {
  return Object.fromEntries(toolModules.map(module => {
    const enabledOperations = profile === 'new'
      ? Object.keys(module.operations) as ToolOperation[]
      : LEGACY_ENABLED_OPERATIONS[module.id] || [];
    const operations = Object.fromEntries(Object.entries(module.operations).map(([operation, tool]) => [operation, {
      enabled: enabledOperations.includes(operation as ToolOperation),
      binding: tool.bindingId || 'internal',
    }]));
    return [module.id, { enabled: true, operations }];
  }));
}

export function normalizeToolConfig(config?: ToolProjectConfig | null): ToolProjectConfig {
  const defaults = createDefaultToolConfig('legacy');
  if (!config) return defaults;
  return Object.fromEntries(toolModules.map(module => {
    const configured = config[module.id];
    const fallback = defaults[module.id];
    const operations = Object.fromEntries(Object.entries(module.operations).map(([operation, tool]) => {
      const setting = configured?.operations?.[operation as ToolOperation] || fallback.operations[operation as ToolOperation];
      const bindingSupported = module.bindings.some(binding => binding.id === setting?.binding && binding.operations.includes(operation as ToolOperation));
      return [operation, {
        enabled: Boolean(configured?.enabled && setting?.enabled && bindingSupported),
        binding: bindingSupported ? setting!.binding : tool.bindingId || 'internal',
      }];
    }));
    return [module.id, { enabled: configured?.enabled ?? fallback.enabled, operations }];
  }));
}

export function resolveConfiguredTools(config?: ToolProjectConfig | null) {
  const normalized = normalizeToolConfig(config);
  return toolModules.flatMap(module => {
    const moduleConfig = normalized[module.id];
    if (!moduleConfig.enabled) return [];
    return Object.entries(module.operations).flatMap(([operation, tool]) => {
      const setting = moduleConfig.operations[operation as ToolOperation];
      return setting?.enabled && setting.binding === tool.bindingId ? [tool] : [];
    });
  });
}
