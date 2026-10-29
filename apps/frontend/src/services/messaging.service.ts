import { authService } from './auth.service';
import { fileNameFromDisposition } from '../lib/download';
import type { TemplateParameters, WhatsAppTemplate } from '../lib/templates';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface MessageToolData {
  toolName: string;
  params?: any;
  result?: any;
  status: 'pending' | 'success' | 'error' | 'needs_confirmation' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  executionId?: string;
  confirmedBy?: string;
}

export type ExportFormat = 'csv' | 'json';

export interface ExportRequest {
  format: ExportFormat;
  /** Últimos N días; se ignora si llegan `from`/`to` (YYYY-MM-DD). */
  days?: number;
  from?: string;
  to?: string;
  platform?: string;
}

export interface ExportedFile {
  blob: Blob;
  fileName: string;
}

async function downloadExport(url: string, fallbackName: string): Promise<ExportedFile> {
  const res = await fetch(url, { headers: authService.getHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo exportar');
  }
  return { blob: await res.blob(), fileName: fileNameFromDisposition(res.headers.get('content-disposition'), fallbackName) };
}

/** Entrega en canales externos (WhatsApp, Instagram); los mensajes Web no la llevan. */
export interface MessageDelivery {
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
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
  contentType: 'text' | 'image' | 'file' | 'emoji' | 'tool_call' | 'tool_result' | 'confirmation_request' | 'template';
  template?: { name: string; language: string };
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

export interface ConversationPage {
  conversations: ChatConversation[];
  hasMore: boolean;
  nextCursor: string | null;
  unreadTotal: number;
}

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
  /** Cuenta del canal externo; sin ella la conversación es del simulador. */
  channelAccount?: string;
  /** Último mensaje del cliente (ventana de 24 h de WhatsApp). */
  lastInboundAt?: string;
  /** Primer mensaje del cliente sin responder (SLA). */
  awaitingReplySince?: string | null;
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

  /** Página de la bandeja (más recientes primero) con búsqueda y canal resueltos en el servidor. */
  async getConversationPage(params: { limit: number; before?: string | null; q?: string; platform?: string }): Promise<ConversationPage> {
    const url = new URL(`${API_URL}/conversations`);
    url.searchParams.set('limit', String(params.limit));
    if (params.before) url.searchParams.set('before', params.before);
    if (params.q?.trim()) url.searchParams.set('q', params.q.trim());
    if (params.platform && params.platform !== 'All') url.searchParams.set('platform', params.platform);
    const res = await fetch(url.toString(), { headers: authService.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  /** No leídos de todo el proyecto (no solo de lo cargado). */
  async getUnreadTotal(): Promise<number> {
    const res = await fetch(`${API_URL}/conversations/unread`, { headers: authService.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch unread total');
    return (await res.json()).unreadTotal;
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

  /** Plantillas aprobadas de la WABA del proyecto. */
  async listTemplates(refresh = false): Promise<WhatsAppTemplate[]> {
    const res = await fetch(`${API_URL}/project/whatsapp/templates${refresh ? '?refresh=1' : ''}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las plantillas');
    return data;
  },

  /** Envía una plantilla a la conversación; devuelve el mensaje creado. */
  async sendTemplate(
    conversationId: string,
    template: { name: string; language: string; parameters: TemplateParameters },
  ): Promise<ChatMessage> {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/template`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify(template),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo enviar la plantilla');
    return data;
  },

  /** Historial completo de una conversación como archivo. */
  exportConversation(conversationId: string, format: ExportFormat): Promise<ExportedFile> {
    return downloadExport(
      `${API_URL}/conversations/${conversationId}/export?format=${format}`,
      `mitchbot-conversacion.${format}`,
    );
  },

  /** Mensajes de un rango de todas las conversaciones del proyecto. */
  exportConversations(request: ExportRequest): Promise<ExportedFile> {
    const params = new URLSearchParams({ format: request.format });
    if (request.from || request.to) {
      if (request.from) params.set('from', request.from);
      if (request.to) params.set('to', request.to);
    } else if (request.days) {
      params.set('days', String(request.days));
    }
    if (request.platform && request.platform !== 'All') params.set('platform', request.platform);
    return downloadExport(`${API_URL}/conversations/export?${params}`, `mitchbot-conversaciones.${request.format}`);
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
  }): Promise<{ conversation: ChatConversation; message: ChatMessage; isNew: boolean; clientToken?: string }> {
    const res = await fetch(`${API_URL}/public/test-chat/${slug}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to start conversation');
    return res.json();
  },

  /** El cliente envía un mensaje a una conversación existente */
  /** Historial visible de la conversación del cliente; el token prueba que es suya. */
  async clientGetHistory(slug: string, conversationId: string, clientToken: string): Promise<ChatMessage[]> {
    const res = await fetch(`${API_URL}/public/widget/${encodeURIComponent(slug)}/conversations/${conversationId}/messages`, {
      headers: { 'X-Client-Token': clientToken },
    });
    if (!res.ok) throw new Error('Failed to load conversation history');
    return res.json();
  },

  async clientSendMessage(slug: string, conversationId: string, content: string, clientToken?: string, senderName?: string): Promise<ChatMessage> {
    const res = await fetch(`${API_URL}/public/test-chat/${slug}/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, senderName, clientToken })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },
};
