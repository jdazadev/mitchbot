<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import {
  messagingService,
  type ChatConversation,
  type ChatMessage,
  type ConversationInsights,
} from "../services/messaging.service";
import { socketService } from "../services/socket.service";
import { projectService } from "../services/project.service";
import { useConversations, type ChannelFilter } from "../composables/useConversations";

const {
  conversations: chats,
  isLoading: isLoadingChats,
  activeChannel,
  loadConversations,
  markConversationRead,
  setActiveChannel,
  bindConversationSocket,
} = useConversations();

const messages = ref<ChatMessage[]>([]);
const selectedChat = ref<ChatConversation | null>(null);
const isLoadingMessages = ref(false);
const newMessage = ref("");

const searchQuery = ref("");

// === Filtros de canal derivados de la configuración del proyecto ===
const channelMeta: Record<Exclude<ChannelFilter, "All">, { label: string; dot: string }> = {
  WhatsApp: { label: "WhatsApp", dot: "bg-green-500" },
  Instagram: { label: "Instagram", dot: "bg-purple-500" },
  Web: { label: "Web", dot: "bg-blue-500" },
};
const enabledChannels = ref<ChannelFilter[]>(["All"]);

async function loadChannels() {
  try {
    const project = await projectService.getProject();
    const channels = project?.config?.channels;
    const list: ChannelFilter[] = ["All"];
    if (channels?.whatsapp) list.push("WhatsApp");
    if (channels?.instagram) list.push("Instagram");
    if (channels?.web) list.push("Web");
    enabledChannels.value = list;
  } catch (error) {
    console.error("Failed to load project channels", error);
    enabledChannels.value = ["All", "WhatsApp", "Instagram", "Web"];
  }
}

const filteredChats = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return chats.value.filter((chat) => {
    if (activeChannel.value !== "All" && chat.platform !== activeChannel.value) return false;
    if (!query) return true;
    return (
      (chat.name || "").toLowerCase().includes(query) ||
      (chat.message || "").toLowerCase().includes(query)
    );
  });
});

async function fetchChats() {
  try {
    await loadConversations(true);
    const first = filteredChats.value[0] || chats.value[0];
    if (first) selectChat(first);
  } catch (error) {
    console.error("Failed to fetch chats", error);
  }
}

async function selectChat(chat: ChatConversation) {
  selectedChat.value = chat;
  socketService.joinRoom(chat._id); // Join room
  markConversationRead(chat._id);

  // Mark as active visually
  chats.value.forEach((c) => (c.active = c._id === chat._id));

  await Promise.all([fetchMessages(chat), loadInsights(chat._id)]);
}

async function fetchMessages(chat: ChatConversation) {
  try {
    isLoadingMessages.value = true;
    const res = await messagingService.getMessages(chat._id);
    messages.value = res.map((m) => processMessage(m, chat));
    scrollToBottom();
  } catch (error) {
    console.error("Failed to fetch messages", error);
  } finally {
    isLoadingMessages.value = false;
  }
}

function processMessage(m: ChatMessage, chat: ChatConversation) {
  return {
    ...m,
    isMe: m.sender !== "contact",
    time: new Date(m.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    avatar:
      m.sender === "contact"
        ? chat.contactAvatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            chat.contactName || chat.clientInfo?.name || 'C',
          )}`
        : undefined,
  };
}

// === Agrupación de mensajes por día ===
const messageGroups = computed(() => {
  const groups: { key: string; label: string; messages: ChatMessage[] }[] = [];
  for (const message of messages.value) {
    const date = new Date(message.createdAt);
    const key = date.toDateString();
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: formatDayLabel(date), messages: [] };
      groups.push(group);
    }
    group.messages.push(message);
  }
  return groups;
});

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function renderMarkdown(content: string) {
  if (!content) return '';
  // Basic markdown rendering, you could use marked.js here
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

/**
 * Envía mensaje como agente humano.
 * Si es la primera respuesta, automáticamente se crea el contacto en el backend.
 */
async function handleSendMessage() {
  if (!newMessage.value.trim() || !selectedChat.value) return;

  const content = newMessage.value;
  newMessage.value = ""; // Optimistic clear

  try {
    const sentMsg = await messagingService.sendMessage(
      selectedChat.value._id,
      content,
      "human_agent",
    );
    const processed = processMessage(sentMsg, selectedChat.value!);
    if (!messages.value.find((m) => m._id === processed._id)) {
      messages.value.push(processed);
      scrollToBottom();
    }

    // Si el contacto no estaba creado, refrescar la lista para actualizar los datos
    if (selectedChat.value && !selectedChat.value.isContactCreated) {
      setTimeout(refreshSelectedConversation, 500); // Pequeño delay para que el backend termine
    }
  } catch (error) {
    console.error("Failed to send message", error);
  }
}

async function refreshSelectedConversation() {
  const currentId = selectedChat.value?._id;
  if (!currentId) return;
  await loadConversations(true);
  const refreshed = chats.value.find((c) => c._id === currentId);
  if (refreshed) {
    selectedChat.value = refreshed;
    chats.value.forEach((c) => (c.active = c._id === currentId));
  }
}

// === Toma de control manual (auto_pilot <-> human_takeover) ===
const isUpdatingMode = ref(false);

async function toggleMode() {
  if (!selectedChat.value || isUpdatingMode.value) return;
  const next = selectedChat.value.mode === "auto_pilot" ? "human_takeover" : "auto_pilot";
  isUpdatingMode.value = true;
  try {
    await messagingService.updateConversationMode(selectedChat.value._id, next);
    applyMode(selectedChat.value._id, next);
  } catch (error) {
    console.error("Failed to update conversation mode", error);
  } finally {
    isUpdatingMode.value = false;
  }
}

function applyMode(id: string, mode: ChatConversation["mode"]) {
  chats.value.forEach((c) => {
    if (c._id === id) c.mode = mode;
  });
  if (selectedChat.value?._id === id) selectedChat.value.mode = mode;
}

// === Guardar cliente como contacto ===
const isSavingContact = ref(false);

async function saveAsContact() {
  if (!selectedChat.value || isSavingContact.value || selectedChat.value.isContactCreated) return;
  isSavingContact.value = true;
  try {
    await messagingService.createContact(selectedChat.value._id);
    applyContactCreated(selectedChat.value._id);
  } catch (error) {
    console.error("Failed to save contact", error);
  } finally {
    isSavingContact.value = false;
  }
}

function applyContactCreated(id: string) {
  chats.value.forEach((c) => {
    if (c._id === id) c.isContactCreated = true;
  });
  if (selectedChat.value?._id === id) selectedChat.value.isContactCreated = true;
}

// === AI Insights ===
const insights = ref<ConversationInsights | null>(null);
const isLoadingInsights = ref(false);
const isAnalyzingInsights = ref(false);

async function loadInsights(conversationId: string) {
  isLoadingInsights.value = true;
  insights.value = null;
  try {
    insights.value = await messagingService.getInsights(conversationId);
  } catch (error) {
    console.error("Failed to load insights", error);
    insights.value = null;
  } finally {
    isLoadingInsights.value = false;
  }
}

async function analyzeInsights() {
  if (!selectedChat.value || isAnalyzingInsights.value) return;
  isAnalyzingInsights.value = true;
  try {
    insights.value = await messagingService.analyzeInsights(selectedChat.value._id);
  } catch (error) {
    console.error("Failed to analyze insights", error);
  } finally {
    isAnalyzingInsights.value = false;
  }
}

function onInsights(data: { conversationId: string; insights: ConversationInsights }) {
  if (selectedChat.value?._id === data.conversationId) {
    insights.value = data.insights;
  }
}

const sentimentMeta = computed(() => {
  const sentiment = insights.value?.sentiment || "neutral";
  if (sentiment === "positive") {
    return { label: "Positivo", class: "text-green-600 bg-green-50 border-green-100" };
  }
  if (sentiment === "negative") {
    return { label: "Negativo", class: "text-red-600 bg-red-50 border-red-100" };
  }
  return { label: "Neutral", class: "text-amber-600 bg-amber-50 border-amber-100" };
});

const sentimentBars = computed(() => {
  const scores = insights.value?.sentimentScores;
  if (!scores) return [] as { key: string; class: string; width: string }[];
  return [
    { key: "negative", class: "bg-red-300", width: `${Math.round(scores.negative * 100)}%` },
    { key: "neutral", class: "bg-yellow-300", width: `${Math.round(scores.neutral * 100)}%` },
    { key: "positive", class: "bg-green-500", width: `${Math.round(scores.positive * 100)}%` },
  ];
});

function formatTime(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  if (now.getDate() === date.getDate()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function onNewMessage(msg: ChatMessage) {
  const convId = msg.conversationId;
  if (!convId) return;
  // La lista y el conteo de no leídos los mantiene el composable.
  if (selectedChat.value && selectedChat.value._id === convId) {
    const processed = processMessage(msg, selectedChat.value);
    const existingMsg = messages.value.find((m) => m._id === processed._id);
    if (!existingMsg) {
      messages.value.push(processed);
      scrollToBottom();
    } else {
      // Update existing message if needed
      existingMsg.content = processed.content;
    }
  }
}

function onMessageChunk(data: { messageId: string, conversationId: string, content: string, isDone: boolean }) {
  // Only update UI if we are in the correct chat
  if (selectedChat.value && selectedChat.value._id === data.conversationId) {
    const existingMsg = messages.value.find((m) => m._id === data.messageId);
    if (existingMsg) {
      existingMsg.content = data.content;
      scrollToBottom();
    }
  }
}

function isToolMessage(msg: ChatMessage) {
  return msg.sender === 'tool'
    || msg.contentType === 'confirmation_request'
    || msg.contentType === 'tool_result'
    || msg.contentType === 'tool_call';
}

function toolIcon(msg: ChatMessage) {
  if (msg.contentType === 'confirmation_request') return 'help';
  if (msg.toolData?.status === 'error') return 'error';
  return 'build';
}

function toolLabel(msg: ChatMessage) {
  if (msg.contentType === 'confirmation_request') return 'Confirmación requerida';
  return msg.toolData?.toolName || 'Herramienta';
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    needs_confirmation: 'Pendiente',
    success: 'Completado',
    error: 'Error',
    cancelled: 'Cancelado',
  };
  return status ? (map[status] || status) : '';
}

function statusClass(status?: string) {
  const map: Record<string, string> = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    cancelled: 'text-slate-400',
    needs_confirmation: 'text-amber-600',
    pending: 'text-amber-600',
  };
  return status ? (map[status] || 'text-slate-500') : 'text-slate-500';
}

function confirmTool(msg: ChatMessage, action: 'confirm' | 'cancel') {
  if (!selectedChat.value || !msg.toolData?.executionId) return;
  socketService.confirmTool({
    conversationId: selectedChat.value._id,
    executionId: msg.toolData.executionId,
    action,
  });
}

function modifyTool(msg: ChatMessage) {
  if (!selectedChat.value || !msg.toolData?.executionId) return;
  const current = JSON.stringify(msg.toolData.params || {}, null, 0);
  const input = window.prompt('Edita los datos de la acción (JSON):', current);
  if (!input) return;
  try {
    const params = JSON.parse(input);
    socketService.confirmTool({
      conversationId: selectedChat.value._id,
      executionId: msg.toolData.executionId,
      action: 'modify',
      params,
    });
  } catch {
    window.alert('JSON inválido');
  }
}

function onMessageUpdated(data: { messageId: string; status: string; params?: any; content?: string }) {
  const existing = messages.value.find((m) => m._id === data.messageId);
  if (!existing) return;
  if (existing.toolData) {
    existing.toolData.status = data.status as any;
    if (data.params) existing.toolData.params = data.params;
  }
  if (data.content) existing.content = data.content;
}

/**
 * Refleja en vivo los cambios de modo/estado de la conversación (p. ej. la
 * transferencia a un asesor humano) sin recargar la lista.
 */
function onConversationStatus(data: { mode?: string; status?: string; tag?: string; tagColor?: string }) {
  const target = selectedChat.value;
  if (!target) return;

  const applyTo = (chat: ChatConversation) => {
    if (data.mode) chat.mode = data.mode as ChatConversation['mode'];
    if (data.status) chat.status = data.status as ChatConversation['status'];
    if (data.tag !== undefined) chat.tag = data.tag;
    if (data.tagColor !== undefined) chat.tagColor = data.tagColor;
  };

  applyTo(target);
  const item = chats.value.find((c) => c._id === target._id);
  if (item && item !== target) applyTo(item);
}

function scrollToBottom() {
  nextTick(() => {
    const el = document.getElementById("chat-messages-container");
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

function onSocketError(error: any) {
  console.error("WebSocket error:", error);
  // Mostrar toast o notificación de error
}

function onNotification(data: any) {
  console.log("Admin notification:", data);
}

onMounted(async () => {
  // Conectar el socket y registrar los handlers de lista/no leídos una sola vez.
  try {
    bindConversationSocket();
    socketService.onMessage(onNewMessage);
    socketService.onMessageChunk(onMessageChunk);
    socketService.onMessageUpdated(onMessageUpdated);
    socketService.onConversationStatus(onConversationStatus);
    socketService.onInsights(onInsights);

    if (socketService.socket) {
      socketService.socket.on('error', onSocketError);
      socketService.socket.on('admin:notification', onNotification);
    }
  } catch (error) {
    console.error("Failed to initialize socket service", error);
  }

  // Cargar canales del proyecto y conversaciones (no dependen del socket).
  await Promise.all([loadChannels(), fetchChats()]);
});

onUnmounted(() => {
  socketService.offMessage(onNewMessage);
  socketService.offMessageChunk(onMessageChunk);
  socketService.offMessageUpdated(onMessageUpdated);
  socketService.offConversationStatus(onConversationStatus);
  socketService.offInsights(onInsights);
  if (socketService.socket) {
    socketService.socket.off('error', onSocketError);
    socketService.socket.off('admin:notification', onNotification);
  }
  // No desconectar: el sidebar mantiene el socket para el conteo en vivo.
});
</script>

<template>
  <div class="flex h-full bg-white overflow-hidden">
    <!-- Inbox Column -->
    <aside
      class="w-80 flex-none bg-white border-r border-slate-200 flex flex-col"
    >
      <div class="p-4 border-b border-slate-100">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold tracking-tight text-slate-900">Inbox</h2>
        </div>
        <div class="relative mb-3 group">
          <span class="absolute left-3 top-2.5 text-slate-400">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            v-model="searchQuery"
            class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            placeholder="Buscar chats..."
            type="text"
          />
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            v-for="channel in enabledChannels"
            :key="channel"
            @click="setActiveChannel(channel)"
            :class="[
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5',
              activeChannel === channel
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
            ]"
          >
            <span
              v-if="channel !== 'All'"
              class="w-1.5 h-1.5 rounded-full"
              :class="channelMeta[channel as Exclude<ChannelFilter, 'All'>].dot"
            ></span>
            {{ channel === "All" ? "Todos" : channelMeta[channel as Exclude<ChannelFilter, 'All'>].label }}
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div v-if="isLoadingChats" class="p-4 text-center text-slate-400 text-sm">
          Cargando conversaciones...
        </div>
        <div v-else-if="chats.length === 0" class="p-4 text-center text-slate-400 text-sm">
          No hay conversaciones aún. Los clientes las iniciarán.
        </div>
        <div v-else-if="filteredChats.length === 0" class="p-4 text-center text-slate-400 text-sm">
          No hay conversaciones que coincidan con el filtro.
        </div>
        <div
          v-for="chat in filteredChats"
          :key="chat._id"
          :class="[
            'group flex items-start gap-3 p-4 cursor-pointer transition-colors border-b border-slate-50 border-l-4',
            chat.active
              ? 'bg-blue-50/50 border-blue-600'
              : 'hover:bg-slate-50 border-transparent',
          ]"
          @click="selectChat(chat)"
        >
          <div class="relative flex-none">
            <div
              class="w-10 h-10 rounded-full bg-cover bg-center"
              :style="{ backgroundImage: `url(${chat.avatar})` }"
            ></div>
            <div
              class="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-100"
            >
              <span
                :class="[
                  'material-symbols-outlined text-[12px] rounded-full p-0.5',
                  chat.platform === 'WhatsApp'
                    ? 'text-green-600 bg-green-100'
                    : chat.platform === 'Instagram'
                      ? 'text-purple-600 bg-purple-100'
                      : 'text-blue-600 bg-blue-100',
                ]"
                >{{
                  chat.platform === "WhatsApp" ? "call" : chat.platform === "Instagram" ? "photo_camera" : "language"
                }}</span
              >
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start mb-0.5">
              <h3
                :class="[
                  'text-sm line-clamp-1',
                  chat.active
                    ? 'font-bold text-slate-900'
                    : 'font-semibold text-slate-900',
                ]"
              >
                {{ chat.name }}
              </h3>
              <span
                :class="[
                  'text-[11px] whitespace-nowrap',
                  chat.active ? 'text-slate-500 font-medium' : 'text-slate-400',
                ]"
                >{{ chat.time }}</span
              >
            </div>
            <p
              :class="[
                'text-xs line-clamp-1',
                chat.active ? 'text-slate-600 font-medium' : 'text-slate-500',
              ]"
            >
              {{ chat.message }}
            </p>
            <div class="mt-2 flex items-center gap-2">
              <span
                v-if="chat.tag"
                :class="[
                  'px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border',
                  chat.tagColor === 'blue'
                    ? 'bg-blue-100 text-blue-700 font-bold border-transparent'
                    : 'bg-slate-100 text-slate-500 border-slate-200 font-medium',
                ]"
                >{{ chat.tag }}</span
              >
              <span
                v-if="!chat.isContactCreated"
                class="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-100 font-bold"
              >
                Sin contacto
              </span>
              <span
                v-if="chat.unreadCount"
                class="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              >
                {{ chat.unreadCount }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Chat Main -->
    <main class="flex-1 flex flex-col min-w-[400px] bg-white relative">
      <div
        v-if="!selectedChat"
        class="flex-1 flex items-center justify-center text-slate-400"
      >
        Selecciona un chat para empezar a responder
      </div>
      <template v-else>
        <header
          class="h-16 flex-none border-b border-slate-200 flex items-center justify-between px-6 bg-white z-10 sticky top-0"
        >
          <div class="flex items-center gap-3">
            <div class="flex flex-col">
              <h1
                class="text-base font-bold text-slate-900 flex items-center gap-2"
              >
                {{ selectedChat.name }}
              </h1>
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  class="material-symbols-outlined text-[14px] text-green-600"
                  >{{
                    selectedChat.platform === "WhatsApp"
                      ? "call"
                      : selectedChat.platform === "Instagram"
                        ? "photo_camera"
                        : "language"
                  }}</span
                >
                <span>{{ selectedChat.platform }}</span>
                <span v-if="!selectedChat.isContactCreated" class="text-amber-500 font-bold ml-2">
                  • Sin contacto
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div
              v-if="selectedChat.mode === 'auto_pilot'"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100"
            >
              <span class="material-symbols-outlined text-blue-600 text-[18px]"
                >smart_toy</span
              >
              <span
                class="text-xs font-bold text-blue-700 uppercase tracking-wider"
                >Auto-Pilot On</span
              >
            </div>
            <div
              v-else
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200"
            >
              <span class="material-symbols-outlined text-amber-600 text-[18px]"
                >support_agent</span
              >
              <span
                class="text-xs font-bold text-amber-700 uppercase tracking-wider"
                >Human Takeover</span
              >
            </div>
          </div>
        </header>
        <div
          id="chat-messages-container"
          class="flex-1 overflow-y-auto p-6 flex flex-col scroll-smooth bg-slate-50/50"
        >
          <div v-if="isLoadingMessages" class="text-center text-slate-400 py-4">
            Cargando mensajes...
          </div>
          <template v-else>
            <div
              v-for="group in messageGroups"
              :key="group.key"
              class="flex flex-col gap-6 mb-6 last:mb-0"
            >
              <div class="flex justify-center">
                <span
                  class="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-500"
                  >{{ group.label }}</span
                >
              </div>
              <div
                v-for="(msg, i) in group.messages"
                :key="msg._id || i"
                :class="[
                  'flex gap-4 max-w-[85%]',
                  isToolMessage(msg) ? 'max-w-full !flex-col' : '',
                  !isToolMessage(msg) && msg.isMe ? 'flex-row-reverse ml-auto' : '',
                ]"
              >
                <template v-if="isToolMessage(msg)">
                  <div class="w-full flex justify-center">
                    <div
                      class="max-w-[560px] w-full rounded-xl border p-4 shadow-sm"
                      :class="msg.contentType === 'confirmation_request'
                        ? 'bg-amber-50 border-amber-200'
                        : (msg.toolData?.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-slate-100 border-slate-200')"
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <span class="material-symbols-outlined text-[16px] text-slate-500">{{ toolIcon(msg) }}</span>
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ toolLabel(msg) }}</span>
                        <span v-if="msg.toolData?.status" class="ml-auto text-[10px] font-bold uppercase" :class="statusClass(msg.toolData.status)">{{ statusLabel(msg.toolData.status) }}</span>
                      </div>
                      <p class="text-sm text-slate-700 leading-relaxed" v-html="renderMarkdown(msg.content)"></p>

                      <div v-if="msg.contentType === 'confirmation_request' && msg.toolData?.status === 'needs_confirmation'" class="flex flex-wrap gap-2 mt-3">
                        <button @click="confirmTool(msg, 'confirm')" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">Confirmar</button>
                        <button @click="confirmTool(msg, 'cancel')" class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-white transition-colors">Cancelar</button>
                        <button @click="modifyTool(msg)" class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-white transition-colors">Modificar</button>
                      </div>
                      <div class="text-[10px] text-slate-400 mt-2">{{ msg.time }}</div>
                    </div>
                  </div>
                </template>
                <template v-else>
                <div
                  v-if="!msg.isMe"
                  class="w-8 h-8 flex-none rounded-full bg-cover bg-center mt-auto"
                  :style="{ backgroundImage: `url(${msg.avatar})` }"
                ></div>
                <div
                  v-else
                  class="w-8 h-8 flex-none rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 mt-auto"
                >
                  <span
                    class="material-symbols-outlined text-slate-500 text-[18px]"
                    >{{ msg.isBot ? "smart_toy" : "person" }}</span
                  >
                </div>

                <div
                  :class="[
                    'flex flex-col gap-1',
                    msg.isMe ? 'items-end' : 'items-start',
                  ]"
                >
                  <div
                    :class="[
                      'rounded-2xl px-5 py-3 shadow-sm border relative',
                      msg.isMe
                        ? 'bg-slate-100 border-slate-200 rounded-br-none'
                        : 'bg-blue-600 border-transparent text-white rounded-bl-none',
                    ]"
                  >
                    <div v-if="!msg.content" class="flex items-center gap-1 h-5">
                      <div class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                      <div class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                      <div class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <p v-else class="text-sm leading-relaxed" v-html="renderMarkdown(msg.content)"></p>
                  </div>
                  <div
                    :class="[
                      'flex items-center gap-2 pr-1',
                      msg.isMe ? 'flex-row-reverse' : 'pl-1',
                    ]"
                  >
                    <span
                      :class="[
                        'text-xs font-semibold',
                        msg.isMe ? 'text-blue-600' : 'text-slate-600',
                      ]"
                      >{{ msg.senderName || msg.sender }}</span
                    >
                    <span class="text-[10px] text-slate-400">{{ msg.time }}</span>
                  </div>
                </div>
                </template>
              </div>
            </div>
          </template>
        </div>

        <!-- Input Area -->
        <footer class="p-6 bg-white border-t border-slate-200 flex-none">
          <div
            class="relative bg-white rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm p-2"
          >
            <textarea
              v-model="newMessage"
              @keydown.enter.prevent="handleSendMessage"
              class="w-full bg-transparent border-none focus:ring-0 resize-none h-14 text-sm text-slate-800 placeholder:text-slate-400 p-2"
              placeholder="Escribe un mensaje..."
            ></textarea>
            <div class="flex justify-end items-center mt-1 px-1 pb-1 gap-2">
              <button
                @click="toggleMode"
                :disabled="isUpdatingMode"
                class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 uppercase disabled:opacity-50"
              >
                <span class="material-symbols-outlined text-[16px]">{{
                  selectedChat.mode === "auto_pilot" ? "person" : "smart_toy"
                }}</span>
                {{ selectedChat.mode === "auto_pilot" ? "Take Over" : "Auto-Pilot" }}
              </button>
              <button
                @click="handleSendMessage"
                class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 uppercase"
              >
                <span class="material-symbols-outlined text-[16px]"
                  >send</span
                >
                Enviar
              </button>
            </div>
          </div>
        </footer>
      </template>
    </main>

    <!-- Details Column -->
    <aside
      v-if="selectedChat"
      class="hidden lg:flex w-80 flex-none bg-slate-50 border-l border-slate-200 flex flex-col overflow-y-auto"
    >
      <div
        class="p-6 border-b border-slate-200 flex flex-col items-center relative overflow-hidden bg-white"
      >
        <div
          class="absolute inset-0 opacity-5"
          style="
            background-image: radial-gradient(#2563eb 1px, transparent 1px);
            background-size: 20px 20px;
          "
        ></div>
        <div
          class="relative z-10 w-20 h-20 rounded-full p-1 border border-slate-200 mb-3 bg-white shadow-sm"
        >
          <div
            class="w-full h-full rounded-full bg-cover bg-center"
            :style="{ backgroundImage: `url('${selectedChat.avatar}')` }"
          ></div>
          <div
            class="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow-sm border border-slate-100"
          >
            <div
              :class="`w-5 h-5 rounded-full bg-${selectedChat.platform === 'WhatsApp' ? 'green' : selectedChat.platform === 'Instagram' ? 'purple' : 'blue'}-500 flex items-center justify-center text-white`"
            >
              <span class="material-symbols-outlined text-[12px]">{{
                selectedChat.platform === "WhatsApp" ? "call" : selectedChat.platform === "Instagram" ? "photo_camera" : "language"
              }}</span>
            </div>
          </div>
        </div>
        <h2 class="text-lg font-bold text-slate-900 relative z-10">
          {{ selectedChat.name }}
        </h2>
        <p class="text-sm text-slate-500 relative z-10 mb-3">
          {{ selectedChat.clientInfo?.identifier || selectedChat.contactPhone || '' }}
        </p>
        <div class="flex flex-col gap-2 relative z-10 w-full">
          <div class="flex justify-center">
            <span
              v-if="selectedChat.isContactCreated"
              class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wide border border-emerald-200"
            >Contacto Creado</span>
            <span
              v-else
              class="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wide border border-amber-200"
            >Sin contacto</span>
          </div>
          <button
            v-if="!selectedChat.isContactCreated"
            @click="saveAsContact"
            :disabled="isSavingContact"
            class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[16px]">person_add</span>
            {{ isSavingContact ? "Guardando..." : "Guardar como contacto" }}
          </button>
        </div>
      </div>
      <div class="p-5 border-b border-slate-200">
        <div class="flex items-center justify-between mb-4">
          <h3
            class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"
          >
            <span class="material-symbols-outlined text-[16px]">psychology</span>
            AI Insights
          </h3>
          <button
            @click="analyzeInsights"
            :disabled="isAnalyzingInsights"
            class="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[14px]">refresh</span>
            {{ isAnalyzingInsights ? "Analizando" : "Analizar" }}
          </button>
        </div>

        <div v-if="isLoadingInsights" class="text-xs text-slate-400">Cargando insights...</div>
        <div
          v-else-if="!insights"
          class="bg-white rounded-lg p-4 border border-dashed border-slate-300 text-center"
        >
          <span class="material-symbols-outlined text-slate-300 text-[28px]">psychology_alt</span>
          <p class="text-xs text-slate-400 mt-1">
            Todavía no hay insights para esta conversación.
          </p>
        </div>
        <div v-else class="space-y-3">
          <div class="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-medium text-slate-600">Sentimiento</span>
              <span
                class="text-xs font-bold px-2 py-0.5 rounded border"
                :class="sentimentMeta.class"
                >{{ sentimentMeta.label }}</span
              >
            </div>
            <div
              class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex"
            >
              <div
                v-for="bar in sentimentBars"
                :key="bar.key"
                class="h-full"
                :class="bar.class"
                :style="{ width: bar.width }"
              ></div>
            </div>
          </div>
          <div class="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >Resumen</span
            >
            <p class="text-xs text-slate-600 leading-relaxed mt-1">{{ insights.summary }}</p>
          </div>
        </div>
      </div>
      <div class="p-5 flex-1">
        <h3
          class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[16px]">database</span>
          Detalles
        </h3>
        <div class="grid grid-cols-1 gap-2">
          <div
            v-for="det in [
              {
                label: 'Email',
                value: selectedChat.contactEmail || selectedChat.clientInfo?.email || 'No disponible',
                icon: 'mail',
              },
              {
                label: 'Teléfono',
                value: selectedChat.contactPhone || selectedChat.clientInfo?.phone || 'No disponible',
                icon: 'smartphone',
              },
              {
                label: 'Plataforma',
                value: selectedChat.platform,
                icon: 'language',
              },
              {
                label: 'Estado',
                value: selectedChat.status,
                icon: 'info',
              },
            ]"
            :key="det.label"
            class="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200 shadow-sm"
          >
            <div
              class="w-8 h-8 rounded-md bg-slate-50 flex items-center justify-center text-slate-400"
            >
              <span class="material-symbols-outlined text-[18px]">{{
                det.icon
              }}</span>
            </div>
            <div class="flex flex-col overflow-hidden">
              <span class="text-[10px] text-slate-400 font-medium uppercase">{{
                det.label
              }}</span>
              <span class="text-sm text-slate-800 truncate font-medium">{{
                det.value
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
