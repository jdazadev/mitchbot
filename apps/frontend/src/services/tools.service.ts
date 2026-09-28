import { authService } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export type ToolOperation = 'leer' | 'crear' | 'editar' | 'eliminar';
export type ToolExecutionStatus = 'pending_confirmation' | 'pending_approval' | 'executing' | 'approving' | 'executed' | 'approved' | 'rejected' | 'failed' | 'cancelled';

export interface ToolOperationConfig {
  enabled: boolean;
  binding: string;
}

export interface ToolModuleConfig {
  enabled: boolean;
  operations: Partial<Record<ToolOperation, ToolOperationConfig>>;
}

export type ToolConfig = Record<string, ToolModuleConfig>;

export interface ToolCatalogOperation {
  id: ToolOperation;
  name: string;
  description: string;
  control: 'ninguna' | 'confirmacion_cliente' | 'aprobacion_operador';
  enabled: boolean;
  binding: string;
  bindings: { id: string; label: string; operations: ToolOperation[] }[];
}

export interface ToolCatalogModule {
  id: string;
  label: string;
  enabled: boolean;
  operations: ToolCatalogOperation[];
}

export interface ToolExecution {
  _id: string;
  conversationId: string;
  projectId: string;
  contactId?: string;
  messageId?: string;
  toolName: string;
  toolId?: string;
  operation?: ToolOperation;
  binding?: string;
  params: Record<string, any>;
  result?: any;
  status: ToolExecutionStatus;
  userMessage?: string;
  executedBy?: string;
  decisionBy?: string;
  decisionAt?: string;
  approvalDecision?: 'approved' | 'rejected';
  createdAt: string;
}

export interface PaginatedToolExecutions {
  items: ToolExecution[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authService.getHeaders(), ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Error al consultar herramientas');
  return data;
}

export const toolsService = {
  getCatalog() {
    return request<{ catalog: ToolCatalogModule[]; config: ToolConfig }>('/tools');
  },

  saveConfig(config: ToolConfig) {
    return request<{ catalog: ToolCatalogModule[]; config: ToolConfig }>('/tools/config', {
      method: 'PUT', body: JSON.stringify({ tools: config }),
    });
  },

  listExecutions(params: {
    tool?: string; operation?: ToolOperation | ''; binding?: string; status?: ToolExecutionStatus | '';
    from?: string; to?: string; page?: number; limit?: number;
  } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
    return request<PaginatedToolExecutions>(`/tool-executions?${query}`);
  },

  listPending() {
    return request<{ items: ToolExecution[]; total: number }>('/tool-executions/pending');
  },

  approve(id: string) {
    return request<{ status: string }>(`/tool-executions/${id}/approve`, { method: 'POST' });
  },

  reject(id: string) {
    return request<{ status: string }>(`/tool-executions/${id}/reject`, { method: 'POST' });
  },
};
