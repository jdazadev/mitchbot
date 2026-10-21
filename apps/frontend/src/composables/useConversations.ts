import { computed, ref } from 'vue';
import { messagingService, type ChatConversation, type ChatMessage } from '../services/messaging.service';
import { socketService } from '../services/socket.service';
import i18n from '../i18n';

export type ChannelFilter = 'All' | 'WhatsApp' | 'Instagram' | 'Web';

/** Estado a nivel de módulo: la bandeja y el sidebar comparten la misma lista. */
const conversations = ref<ChatConversation[]>([]);
const isLoading = ref(false);
const activeChannel = ref<ChannelFilter>('All');
/** Búsqueda de la bandeja; junto al canal se resuelve en el servidor para alcanzar lo no cargado. */
const searchQuery = ref('');
/** Paginación por cursor: la bandeja carga de 30 en 30. */
export const INBOX_PAGE_SIZE = 30;
const hasMore = ref(false);
const nextCursor = ref<string | null>(null);
const isLoadingMore = ref(false);
/** No leídos de todo el proyecto: la lista cargada es solo una parte. */
const unreadTotal = ref(0);
let loadSeq = 0;
/** Conversación actualmente abierta por el agente (para el re-marcado estilo WhatsApp). */
const openConversationId = ref<string | null>(null);

let hasLoaded = false;
let bound = false;

export function formatConversationTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const locale = i18n.global.locale.value;
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
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

/** Pone el contador local de una conversación a cero (sin persistir). */
function setConversationRead(id: string) {
  const chat = conversations.value.find((c) => c._id === id);
  if (!chat) return false;
  unreadTotal.value = Math.max(0, unreadTotal.value - (chat.unreadCount || 0));
  chat.unreadCount = 0;
  return true;
}

function refreshUnreadTotal() {
  messagingService.getUnreadTotal().then((total) => (unreadTotal.value = total)).catch(() => {});
}

const filtersActive = () => activeChannel.value !== 'All' || !!searchQuery.value.trim();

/** Una conversación con actividad que aún no está en la lista (más antigua que lo cargado). */
async function insertUnknown(id: string) {
  if (filtersActive()) return;
  try {
    const fetched = await messagingService.getConversation(id);
    if (fetched && !conversations.value.some((c) => c._id === fetched._id)) {
      conversations.value.unshift(decorateConversation(fetched));
    }
  } catch {
    // Se verá al recargar la bandeja.
  }
}

/** Persiste la lectura en el servidor en segundo plano (no bloquea ni rompe la UI). */
function persistConversationRead(id: string) {
  messagingService.markConversationRead(id).catch((error) => {
    console.warn('Failed to persist conversation read', error);
  });
}

function handleSocketMessage(msg: ChatMessage) {
  const convId = msg.conversationId;
  if (!convId) return;
  // Ignora placeholders vacíos del streaming.
  if (!msg.content || !msg.content.trim()) return;
  const isOpen = convId === openConversationId.value;
  const chat = conversations.value.find((c) => c._id === convId);

  if (msg.sender === 'contact') {
    if (isOpen) {
      // Mensaje entrante en la conversación abierta: se re-marca como leída (estilo WhatsApp).
      persistConversationRead(convId);
    } else {
      unreadTotal.value += 1;
    }
  }
  if (!chat) {
    void insertUnknown(convId);
    return;
  }

  chat.lastMessage = msg.content;
  chat.message = msg.content;
  chat.lastMessageAt = msg.createdAt;
  chat.time = formatConversationTime(msg.createdAt);
  if (msg.sender === 'contact') {
    if (isOpen) chat.unreadCount = 0;
    else chat.unreadCount = (chat.unreadCount || 0) + 1;
  }
  moveToTop(chat);
}

function handleConversationRead(data: { conversationId: string }) {
  if (!data?.conversationId) return;
  // Leída en otra sesión: si no está cargada no sabemos cuánto restar, se pregunta al servidor.
  if (!setConversationRead(data.conversationId)) refreshUnreadTotal();
}

function handleSocketInsights(data: { conversationId: string; insights: ChatConversation['aiInsights'] }) {
  if (!data?.conversationId || !data.insights) return;
  const chat = conversations.value.find((c) => c._id === data.conversationId);
  if (chat) chat.aiInsights = data.insights;
}

function handleSocketChunk(data: { conversationId: string; content: string; isDone?: boolean }) {
  // El bot no emite fragmentos parciales: solo se aplica el mensaje final.
  if (!data.isDone) return;
  const chat = conversations.value.find((c) => c._id === data.conversationId);
  if (!chat || !data.content?.trim()) return;
  chat.message = data.content;
  chat.lastMessage = data.content;
}

/** El servidor abre o cierra la espera del cliente (SLA). */
function handleSocketSla(data: { conversationId: string; awaitingReplySince: string | null }) {
  const chat = conversations.value.find((c) => c._id === data?.conversationId);
  if (chat) chat.awaitingReplySince = data.awaitingReplySince;
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
  if (bound) return;
  bound = true;
  // El registro de socketService los mantiene en cada socket nuevo (sesión, proyecto, reconexión).
  socketService.on('chat:message', handleSocketMessage);
  socketService.on('chat:message_chunk', handleSocketChunk);
  socketService.on('chat:new_conversation', handleSocketNewConversation);
  socketService.on('chat:read', handleConversationRead);
  socketService.on('chat:insights', handleSocketInsights);
  socketService.on('chat:sla', handleSocketSla);
}

export function useConversations() {
  /** Primera página con los filtros actuales; las respuestas viejas se descartan. */
  async function loadConversations(force = false): Promise<void> {
    if (hasLoaded && !force) return;
    const seq = ++loadSeq;
    isLoading.value = true;
    try {
      const page = await messagingService.getConversationPage({
        limit: INBOX_PAGE_SIZE,
        q: searchQuery.value,
        platform: activeChannel.value,
      });
      if (seq !== loadSeq) return;
      conversations.value = page.conversations.map(decorateConversation);
      hasMore.value = page.hasMore;
      nextCursor.value = page.nextCursor;
      unreadTotal.value = page.unreadTotal;
      hasLoaded = true;
    } finally {
      if (seq === loadSeq) isLoading.value = false;
    }
  }

  /** Siguiente página: se añade al final sin repetir las que ya llegaron por socket. */
  async function loadMore(): Promise<void> {
    if (!hasMore.value || !nextCursor.value || isLoadingMore.value) return;
    const seq = loadSeq;
    isLoadingMore.value = true;
    try {
      const page = await messagingService.getConversationPage({
        limit: INBOX_PAGE_SIZE,
        before: nextCursor.value,
        q: searchQuery.value,
        platform: activeChannel.value,
      });
      if (seq !== loadSeq) return;
      const known = new Set(conversations.value.map((c) => c._id));
      conversations.value.push(...page.conversations.filter((c) => !known.has(c._id)).map(decorateConversation));
      hasMore.value = page.hasMore;
      nextCursor.value = page.nextCursor;
      unreadTotal.value = page.unreadTotal;
    } finally {
      isLoadingMore.value = false;
    }
  }

  function markConversationRead(id: string): void {
    setConversationRead(id);
    persistConversationRead(id);
  }

  function setOpenConversation(id: string | null): void {
    openConversationId.value = id;
  }

  function setActiveChannel(channel: ChannelFilter): void {
    activeChannel.value = channel;
  }

  /** Para el menú: el total de no leídos sin cargar la bandeja, y en vivo. */
  function watchUnreadTotal(): void {
    bindConversationSocket();
    if (!hasLoaded) refreshUnreadTotal();
  }

  function setSearchQuery(value: string): void {
    searchQuery.value = value;
  }

  return {
    conversations,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    watchUnreadTotal,
    activeChannel,
    openConversationId,
    unreadTotal,
    loadConversations,
    markConversationRead,
    setOpenConversation,
    setActiveChannel,
    bindConversationSocket,
  };
}
