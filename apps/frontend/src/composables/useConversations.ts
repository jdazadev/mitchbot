import { computed, ref } from 'vue';
import type { Socket } from 'socket.io-client';
import { messagingService, type ChatConversation, type ChatMessage } from '../services/messaging.service';
import { socketService } from '../services/socket.service';

export type ChannelFilter = 'All' | 'WhatsApp' | 'Instagram' | 'Web';

/** Estado a nivel de módulo: la bandeja y el sidebar comparten la misma lista. */
const conversations = ref<ChatConversation[]>([]);
const isLoading = ref(false);
const activeChannel = ref<ChannelFilter>('All');

let hasLoaded = false;
let boundSocket: Socket | null = null;

export function formatConversationTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function decorateConversation(c: ChatConversation): ChatConversation {
  const name = c.contactName || c.clientInfo?.name || 'Cliente Nuevo';
  return {
    ...c,
    time: formatConversationTime(c.lastMessageAt),
    avatar: c.contactAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    name,
    message: c.lastMessage,
  };
}

function moveToTop(chat: ChatConversation) {
  const index = conversations.value.indexOf(chat);
  if (index <= 0) return;
  conversations.value.splice(index, 1);
  conversations.value.unshift(chat);
}

function handleSocketMessage(msg: ChatMessage) {
  const convId = msg.conversationId;
  if (!convId) return;
  const chat = conversations.value.find((c) => c._id === convId);
  if (!chat) return;
  // Ignora placeholders vacíos del streaming.
  if (!msg.content || !msg.content.trim()) return;

  chat.lastMessage = msg.content;
  chat.message = msg.content;
  chat.lastMessageAt = msg.createdAt;
  chat.time = formatConversationTime(msg.createdAt);
  if (msg.sender === 'contact') {
    chat.unreadCount = (chat.unreadCount || 0) + 1;
  }
  moveToTop(chat);
}

function handleSocketChunk(data: { conversationId: string; content: string }) {
  const chat = conversations.value.find((c) => c._id === data.conversationId);
  if (!chat || !data.content?.trim()) return;
  chat.message = data.content;
  chat.lastMessage = data.content;
}

function handleSocketNewConversation(conv: ChatConversation) {
  if (!conv?._id) return;
  if (conversations.value.some((c) => c._id === conv._id)) return;
  conversations.value.unshift(decorateConversation(conv));
}

/**
 * Conecta el socket y registra una única vez los handlers que mantienen la
 * lista y el conteo de no leídos sincronizados en vivo. Es idempotente.
 */
function bindConversationSocket() {
  socketService.connect();
  const socket = socketService.socket;
  if (!socket || socket === boundSocket) return;
  boundSocket = socket;
  socket.on('chat:message', handleSocketMessage);
  socket.on('chat:message_chunk', handleSocketChunk);
  socket.on('chat:new_conversation', handleSocketNewConversation);
}

export function useConversations() {
  const unreadTotal = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  );

  async function loadConversations(force = false): Promise<void> {
    if (hasLoaded && !force) return;
    isLoading.value = true;
    try {
      const res = await messagingService.getConversations();
      conversations.value = res.map(decorateConversation);
      hasLoaded = true;
    } finally {
      isLoading.value = false;
    }
  }

  function markConversationRead(id: string): void {
    const chat = conversations.value.find((c) => c._id === id);
    if (chat) chat.unreadCount = 0;
  }

  function setActiveChannel(channel: ChannelFilter): void {
    activeChannel.value = channel;
  }

  return {
    conversations,
    isLoading,
    activeChannel,
    unreadTotal,
    loadConversations,
    markConversationRead,
    setActiveChannel,
    bindConversationSocket,
  };
}
