import { authService } from './auth.service';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// =================== SERVICE ===================
class SettingsService {
    // =================== CONFIG ===================
    async getAllConfig() {
        const res = await fetch(`${API_BASE}/config`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener configuración');
        return data;
    }
    async setConfig(key, value) {
        const res = await fetch(`${API_BASE}/config/${key}`, {
            method: 'PUT',
            headers: authService.getHeaders(),
            body: JSON.stringify({ value }),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al guardar configuración');
        return data;
    }
    async getConfig(key) {
        const res = await fetch(`${API_BASE}/config/${key}`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener configuración');
        return (data === null || data === void 0 ? void 0 : data.value) ?? null;
    }
    // =================== AGENTS ===================
    async getAgents() {
        const res = await fetch(`${API_BASE}/agents`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener agentes');
        return data;
    }
    async getAgent(id) {
        const res = await fetch(`${API_BASE}/agents/${id}`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener agente');
        return data;
    }
    async updateAgent(id, agentData) {
        const res = await fetch(`${API_BASE}/agents/${id}`, {
            method: 'PUT',
            headers: authService.getHeaders(),
            body: JSON.stringify(agentData),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al actualizar agente');
        return data;
    }
    // =================== AI MODELS ===================
    async getAIModels() {
        const res = await fetch(`${API_BASE}/ai-models`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener modelos IA');
        return data;
    }
    // =================== OLLAMA MODELS ===================
    async getOllamaModels() {
        const res = await fetch(`${API_BASE}/ai-models/ollama/models`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener modelos de Ollama');
        return data;
    }
    // =================== REMOTE MODELS ===================
    async getOpenRouterModels(apiKey) {
        const url = new URL(`${API_BASE}/ai-models/remote/openrouter`);
        if (apiKey)
            url.searchParams.set('apiKey', apiKey);
        const res = await fetch(url.toString(), {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener modelos OpenRouter');
        return data;
    }
    async getOpenRouterEmbeddings(apiKey) {
        const url = new URL(`${API_BASE}/ai-models/remote/openrouter/embeddings`);
        if (apiKey)
            url.searchParams.set('apiKey', apiKey);
        const res = await fetch(url.toString(), {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener embeddings OpenRouter');
        return data;
    }
    async getGeminiModels(apiKey) {
        const url = new URL(`${API_BASE}/ai-models/remote/gemini`);
        if (apiKey)
            url.searchParams.set('apiKey', apiKey);
        const res = await fetch(url.toString(), {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener modelos Gemini');
        return data;
    }
    // =================== PROVIDER CONFIGS ===================
    async getProviderConfigs() {
        const res = await fetch(`${API_BASE}/ai-models/providers/configs`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener configuraciones');
        return data;
    }
    async getActiveProvider(type) {
        const res = await fetch(`${API_BASE}/ai-models/providers/active/${type}`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener proveedor activo');
        return data;
    }
    async saveProviderConfig(data) {
        const res = await fetch(`${API_BASE}/ai-models/providers/config`, {
            method: 'POST',
            headers: authService.getHeaders(),
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Error al guardar configuración');
        return result;
    }
    async deleteProviderConfig(type, provider) {
        const res = await fetch(`${API_BASE}/ai-models/providers/config/${type}/${provider}`, {
            method: 'DELETE',
            headers: authService.getHeaders(),
        });
        if (!res.ok && res.status !== 204) {
            const data = await res.json();
            throw new Error(data.error || 'Error al eliminar');
        }
    }
    async testLLMConnection(provider, apiKey, model) {
        const res = await fetch(`${API_BASE}/ai-models/providers/test`, {
            method: 'POST',
            headers: authService.getHeaders(),
            body: JSON.stringify({ provider, apiKey, model }),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al probar conexión');
        return data;
    }
    // =================== AGENT MODELS ===================
    async getModelsForAgent() {
        const res = await fetch(`${API_BASE}/ai-models/agent/models`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener modelos');
        return data;
    }
    // =================== PROJECT ===================
    async updateProject(projectData) {
        const res = await fetch(`${API_BASE}/project`, {
            method: 'PUT',
            headers: authService.getHeaders(),
            body: JSON.stringify(projectData),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al actualizar proyecto');
        return data;
    }
}
export const settingsService = new SettingsService();
//# sourceMappingURL=settings.service.js.map
