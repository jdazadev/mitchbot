import { io, Socket } from 'socket.io-client';
import type { ChatMessage, MessageDelivery } from './messaging.service';

/**
 * `chat:message_updated`: `status` es el estado de la herramienta en una
 * confirmación; `delivery`, la entrega en un canal externo. Llegan por separado.
 */
export interface MessageUpdate {
  messageId: string;
  status?: string;
  params?: any;
  content?: string;
  delivery?: MessageDelivery;
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// Adjust if API_URL includes /api and socket is on root
const baseUrl = SOCKET_URL.replace('/api', '');

// Get auth token from localStorage
const getAuthToken = () => {
  try {
    return localStorage.getItem('mitchbot_token');
  } catch {
    return null;
  }
};

// Get active project id from localStorage
const getActiveProjectId = () => {
  try {
    const stored = localStorage.getItem('mitchbot_active_project');
    if (stored) return stored;
    const user = localStorage.getItem('mitchbot_user');
    if (user) {
      const parsed = JSON.parse(user);
      return parsed.activeProjectId || null;
    }
  } catch {
    return null;
  }
  return null;
};

export const socketService = {
  socket: null as Socket | null,
  isPublic: false,

  connect(options?: { isPublic?: boolean; slug?: string; projectId?: string }) {
    const isPublic = options?.isPublic || false;
    // Ya conectado en el mismo modo: no hacer nada.
    if (this.socket?.connected && this.isPublic === isPublic) return;
    // Cambio de modo (dashboard <-> público): reconectar para no reusar la sesión equivocada.
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isPublic = isPublic;

    const token = getAuthToken();
    const slug = options?.slug;
    const projectId = options?.projectId || getActiveProjectId();

    this.socket = io(baseUrl, {
      transports: ['websocket'],
      autoConnect: true,
      auth: {
        token: token || undefined,
        projectId: projectId || undefined,
      },
      query: {
        isPublic: isPublic ? 'true' : undefined,
        slug: slug || undefined,
      },
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  },

  /** Reconectar el socket a otro proyecto (sale de las salas previas) */
  reconnect(projectId: string) {
    this.disconnect();
    this.connect({ projectId });
  },

  joinRoom(roomId: string) {
    if (!this.socket) this.connect();
    this.socket?.emit('join:room', roomId);
  },

  onMessage(callback: (message: ChatMessage) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('chat:message', callback);
  },

  offMessage(callback?: (message: ChatMessage) => void) {
    if (this.socket) {
      this.socket.off('chat:message', callback);
    }
  },

  onMessageChunk(callback: (data: { messageId: string, conversationId: string, content: string, isDone: boolean }) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('chat:message_chunk', callback);
  },

  offMessageChunk(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('chat:message_chunk', callback);
    }
  },

  onMessageUpdated(callback: (data: MessageUpdate) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('chat:message_updated', callback);
  },

  offMessageUpdated(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('chat:message_updated', callback);
    }
  },

  onToolConfirmed(callback: (data: { executionId: string; status: string }) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('tool:confirmed', callback);
  },

  offToolConfirmed(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('tool:confirmed', callback);
    }
  },

  /** Escucha cambios de modo/estado de la conversación (chat:status) */
  onConversationStatus(callback: (data: { mode?: string; status?: string; tag?: string; tagColor?: string }) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('chat:status', callback);
  },

  offConversationStatus(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('chat:status', callback);
    }
  },

  /** Escucha la actualización de insights de una conversación (chat:insights) */
  onInsights(callback: (data: { conversationId: string; insights: any }) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('chat:insights', callback);
  },

  offInsights(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('chat:insights', callback);
    }
  },

  /** Escucha cuando una sesión del proyecto marca una conversación como leída (chat:read) */
  onConversationRead(callback: (data: { conversationId: string }) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('chat:read', callback);
  },

  offConversationRead(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('chat:read', callback);
    }
  },

  /** Confirma, cancela o modifica una ejecución de herramienta */
  confirmTool(payload: {
    conversationId: string;
    executionId: string;
    action: 'confirm' | 'cancel' | 'modify';
    params?: Record<string, any>;
  }) {
    if (!this.socket) this.connect();
    this.socket?.emit('tool:confirm', payload);
  },

  onNotification(callback: (data: any) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('admin:notification', callback);
  },

  offNotification(callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off('admin:notification', callback);
    }
  }
};
