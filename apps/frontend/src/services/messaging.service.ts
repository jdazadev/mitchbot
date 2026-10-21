import { authService } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface MessageToolData {
  toolName: string;
  params?: any;
  result?: any;
  status: 'pending' | 'success' | 'error' | 'needs_confirmation' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  executionId?: string;
  confirmedBy?: string;
}

/** Entrega en canales externos (WhatsApp, Instagram); los mensajes Web no la llevan. */
export interface MessageDelivery {
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  externalId?: string;
  error?: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  sender: 'contact' | 'ai_agent' | 'human_agent' | 'tool';
  senderName: string;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'emoji' | 'tool_call' | 'tool_result' | 'confirmation_request';
  isBot: boolean;
  confidence?: string;
  toolData?: MessageToolData;
  delivery?: MessageDelivery;
  createdAt: string;
  conversationId?: string;
  // Computed in frontend
  isMe?: boolean;
  time?: string; 
  avatar?: string;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export const MESSAGE_PAGE_SIZE = 50;

export interface ChatConversation {
  _id: string;
  contactId?: string;
  contactName: string; // From aggregation or clientInfo
  contactAvatar?: string;
  contactPhone?: string;
  contactEmail?: string;
  platform: "WhatsApp" | "Instagram" | "Web";
  status: "active" | "closed" | "pending_human";
  mode: "auto_pilot" | "human_takeover";
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
  aiInsights?: ConversationInsights;
  tag?: string;
  tagColor?: string;
  isContactCreated?: boolean;
  clientInfo?: {
    name?: string;
    phone?: string;
    email?: string;
    identifier: string;
  };
  // Computed
  active?: boolean;
  time?: string;
  name?: string;
  message?: string;
  avatar?: string;
}

export interface ConversationInsights {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScores: { positive: number; neutral: number; negative: number };
  urgency?: {
    level: 'low' | 'medium' | 'high';
    reason: 'none' | 'deadline' | 'incident' | 'escalation' | 'repetition';
  };
}

export const messagingService = {
  // === Funciones del DASHBOARD (admin/agente) ===
  
  async getConversations(status?: string, contactId?: string): Promise<ChatConversation[]> {
    const url = new URL(`${API_URL}/conversations`);
    if (status && status !== 'All') url.searchParams.append('status', status);
    if (contactId) url.searchParams.append('contactId', contactId);
    const res = await fetch(url.toString(), {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async getConversation(conversationId: string): Promise<ChatConversation | null> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}`, {
      headers: authService.getHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return res.json();
  },

  async getMessages(conversationId: string, before?: string): Promise<ChatMessagePage> {
     const url = new URL(`${API_URL}/conversations/${conversationId}/messages`);
     url.searchParams.set('limit', String(MESSAGE_PAGE_SIZE));
     if (before) url.searchParams.set('before', before);
     const res = await fetch(url.toString(), {
       headers: authService.getHeaders(),
     });
     if (!res.ok) throw new Error('Failed to fetch messages');
     return res.json();
  },
  
  /** Cambia el modo de la conversación (auto_pilot / human_takeover) */
  async updateConversationMode(conversationId: string, mode: ChatConversation['mode']): Promise<void> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/mode`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error('Failed to update conversation mode');
  },

  /** Marca la conversación como leída de forma persistente (unreadCount = 0). */
  async markConversationRead(conversationId: string): Promise<void> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/read`, {
      method: 'PUT',
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark conversation as read');
  },

  /**
   * Guarda al cliente como contacto de forma explícita e idempotente.
   * Funciona aunque `autoCreateContact` esté deshabilitado.
   */
  async createContact(conversationId: string): Promise<{ contactId?: string; created: boolean }> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/contact`, {
      method: 'POST',
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to create contact');
    const data = await res.json();
    return { contactId: data?.contact?._id, created: !!data?.created };
  },

  /** Lee los insights almacenados de una conversación (o null si no hay). */
  async getInsights(conversationId: string): Promise<ConversationInsights | null> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/insights`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch insights');
    return res.json();
  },

  /** Fuerza el recálculo de insights de una conversación. */
  async analyzeInsights(conversationId: string): Promise<ConversationInsights | null> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/insights`, {
      method: 'POST',
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to analyze insights');
    return res.json();
  },

  /** Envía mensaje como agente humano (auto-crea contacto en primera respuesta) */
  async sendMessage(conversationId: string, content: string, sender: 'human_agent' | 'ai_agent' = 'human_agent'): Promise<ChatMessage> {
     const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
         method: 'POST',
         headers: authService.getHeaders(),
         body: JSON.stringify({ content, sender })
     });
     if (!res.ok) throw new Error('Failed to send message');
     return res.json();
  },

  /** Reencola la entrega de un mensaje que no llegó al cliente. */
  async retryMessage(conversationId: string, messageId: string): Promise<{ messageId: string; delivery: MessageDelivery }> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/messages/${messageId}/retry`, {
      method: 'POST',
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to retry message');
    return data;
  },

  // === Funciones del CLIENTE (chatbot/widget/test) ===

  /** Configuración pública del chat (idioma del agente del proyecto) */
  async clientGetConfig(slug: string): Promise<{ language: 'es' | 'en' }> {
    const res = await fetch(`${API_URL}/public/test-chat/${slug}/config`);
    if (!res.ok) throw new Error('Failed to load public chat config');
    return res.json();
  },

  /** El cliente inicia una conversación (NO el admin) */
  async clientStartConversation(slug: string, data: {
    platform: 'WhatsApp' | 'Instagram' | 'Web';
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientIdentifier: string;
    initialMessage: string;
  }): Promise<{ conversation: ChatConversation; message: ChatMessage; isNew: boolean }> {
    const res = await fetch(`${API_URL}/public/test-chat/${slug}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to start conversation');
    return res.json();
  },

  /** El cliente envía un mensaje a una conversación existente */
  async clientSendMessage(slug: string, conversationId: string, content: string, senderName?: string): Promise<ChatMessage> {
    const res = await fetch(`${API_URL}/public/test-chat/${slug}/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, senderName })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },
};
