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

type Handler = (...args: any[]) => void;

/**
 * Manejadores registrados por evento. Sobreviven a los cambios de socket
 * (inicio de sesión, cambio de proyecto, reconexión): cada socket nuevo los
 * recibe todos, así ningún componente se queda escuchando un socket muerto.
 */
const handlers = new Map<string, Set<Handler>>();

export const socketService = {
  socket: null as Socket | null,
  isPublic: false,
  /** Sesión con la que se abrió el socket actual: si cambia, hay que reconectar. */
  session: { token: null as string | null, projectId: null as string | null, slug: undefined as string | undefined },
  /** Última sala abierta: se vuelve a pedir al reconectar (el servidor no recuerda las salas). */
  lastRoom: null as { roomId: string; clientToken?: string } | null,

  connect(options?: { isPublic?: boolean; slug?: string; projectId?: string }) {
    const isPublic = options?.isPublic || false;
    const token = isPublic ? null : getAuthToken();
    const slug = isPublic ? options?.slug : undefined;
    const projectId = isPublic ? null : options?.projectId || getActiveProjectId();

    // Sin sesión no hay socket del panel: el servidor lo rechazaría y quedaría muerto.
    if (!isPublic && !token) {
      this.disconnect();
      return;
    }

    const alive = !!this.socket && (this.socket.connected || this.socket.active);
    const sameSession = this.isPublic === isPublic && this.session.token === token
      && this.session.projectId === projectId && this.session.slug === slug;
    if (alive && sameSession) return;

    this.disconnect();
    this.isPublic = isPublic;
    this.session = { token, projectId, slug };

    const socket = io(baseUrl, {
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
    this.socket = socket;

    for (const [event, set] of handlers) for (const handler of set) socket.on(event, handler);
    socket.on('connect', () => {
      // Tras un corte el socket es otro para el servidor: se vuelve a la sala abierta.
      const room = this.lastRoom;
      if (room) socket.emit('join:room', room.clientToken ? room : room.roomId);
    });
    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  },

  /**
   * Conecta si no hay socket vivo o si la sesión cambió (p. ej. tras iniciar
   * sesión). Mientras el chat público está abierto, se mantiene en ese modo.
   */
  ensure() {
    if (this.isPublic) this.connect({ isPublic: true, slug: this.session.slug });
    else this.connect();
  },

  /** Al salir del chat público el panel vuelve a su propio socket. */
  leavePublic() {
    if (!this.isPublic) return;
    this.disconnect();
    this.isPublic = false;
    this.lastRoom = null;
    this.session = { token: null, projectId: null, slug: undefined };
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
    this.lastRoom = null;
    this.connect({ projectId });
  },

  on(event: string, handler: Handler) {
    let set = handlers.get(event);
    if (!set) handlers.set(event, (set = new Set()));
    const added = !set.has(handler);
    set.add(handler);
    const before = this.socket;
    this.ensure();
    // Un socket recién creado ya recibió todos los manejadores.
    if (added && this.socket && this.socket === before) this.socket.on(event, handler);
  },

  off(event: string, handler?: Handler) {
    if (handler) handlers.get(event)?.delete(handler);
    else handlers.delete(event);
    this.socket?.off(event, handler);
  },

  emit(event: string, payload: unknown) {
    this.ensure();
    this.socket?.emit(event, payload);
  },

  /** El panel se une con el id; el cliente público además envía el token de su conversación. */
  joinRoom(roomId: string, clientToken?: string) {
    this.lastRoom = { roomId, clientToken };
    this.emit('join:room', clientToken ? { roomId, clientToken } : roomId);
  },

  onMessage(callback: (message: ChatMessage) => void) { this.on('chat:message', callback); },
  offMessage(callback?: (message: ChatMessage) => void) { this.off('chat:message', callback); },

  onMessageChunk(callback: (data: { messageId: string, conversationId: string, content: string, isDone: boolean }) => void) {
    this.on('chat:message_chunk', callback);
  },
  offMessageChunk(callback?: (data: any) => void) { this.off('chat:message_chunk', callback); },

  onMessageUpdated(callback: (data: MessageUpdate) => void) { this.on('chat:message_updated', callback); },
  offMessageUpdated(callback?: (data: any) => void) { this.off('chat:message_updated', callback); },

  onToolConfirmed(callback: (data: { executionId: string; status: string }) => void) { this.on('tool:confirmed', callback); },
  offToolConfirmed(callback?: (data: any) => void) { this.off('tool:confirmed', callback); },

  /** Escucha cambios de modo/estado de la conversación (chat:status) */
  onConversationStatus(callback: (data: { mode?: string; status?: string; tag?: string; tagColor?: string }) => void) {
    this.on('chat:status', callback);
  },
  offConversationStatus(callback?: (data: any) => void) { this.off('chat:status', callback); },

  /** Escucha la actualización de insights de una conversación (chat:insights) */
  onInsights(callback: (data: { conversationId: string; insights: any }) => void) { this.on('chat:insights', callback); },
  offInsights(callback?: (data: any) => void) { this.off('chat:insights', callback); },

  /** Escucha cuando una sesión del proyecto marca una conversación como leída (chat:read) */
  onConversationRead(callback: (data: { conversationId: string }) => void) { this.on('chat:read', callback); },
  offConversationRead(callback?: (data: any) => void) { this.off('chat:read', callback); },

  /** Confirma, cancela o modifica una ejecución de herramienta */
  confirmTool(payload: {
    conversationId: string;
    executionId: string;
    action: 'confirm' | 'cancel' | 'modify';
    params?: Record<string, any>;
  }) {
    this.emit('tool:confirm', payload);
  },

  onNotification(callback: (data: any) => void) { this.on('admin:notification', callback); },
  offNotification(callback?: (data: any) => void) { this.off('admin:notification', callback); },
};
