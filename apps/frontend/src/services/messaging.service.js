import { authService } from './auth.service';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const messagingService = {
    // === Funciones del DASHBOARD (admin/agente) ===
    async getConversations(status) {
        const url = new URL(`${API_URL}/conversations`);
        if (status && status !== 'All')
            url.searchParams.append('status', status);
        const res = await fetch(url.toString(), {
            headers: authService.getHeaders(),
        });
        if (!res.ok)
            throw new Error('Failed to fetch conversations');
        return res.json();
    },
    async getMessages(conversationId) {
        const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
            headers: authService.getHeaders(),
        });
        if (!res.ok)
            throw new Error('Failed to fetch messages');
        return res.json();
    },
    /** Envía mensaje como agente humano (auto-crea contacto en primera respuesta) */
    async sendMessage(conversationId, content, sender = 'human_agent') {
        const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: authService.getHeaders(),
            body: JSON.stringify({ content, sender })
        });
        if (!res.ok)
            throw new Error('Failed to send message');
        return res.json();
    },
    // === Funciones del CLIENTE (chatbot/widget/test) ===
    /** El cliente inicia una conversación (NO el admin) */
    async clientStartConversation(slug, data) {
        const res = await fetch(`${API_URL}/public/test-chat/${slug}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok)
            throw new Error('Failed to start conversation');
        return res.json();
    },
    /** El cliente envía un mensaje a una conversación existente */
    async clientSendMessage(slug, conversationId, content, senderName) {
        const res = await fetch(`${API_URL}/public/test-chat/${slug}/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, senderName })
        });
        if (!res.ok)
            throw new Error('Failed to send message');
        return res.json();
    },
};
//# sourceMappingURL=messaging.service.js.map