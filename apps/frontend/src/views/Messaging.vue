<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import {
  messagingService,
  type ChatConversation,
  type ChatMessage,
  type ConversationInsights,
} from "../services/messaging.service";
import { socketService } from "../services/socket.service";
import { projectService } from "../services/project.service";
import {
  useConversations,
  decorateConversation,
  type ChannelFilter,
} from "../composables/useConversations";

const { t } = useI18n();
const route = useRoute();

const {
  conversations: chats,
  isLoading: isLoadingChats,
  activeChannel,
  loadConversations,
  markConversationRead,
  setOpenConversation,
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

/**
 * Resuelve la conversación indicada por la ruta: la busca en la lista cargada
 * y, si no está (por estar fuera del límite del listado), la trae del servidor.
 * Devuelve `null` si no existe o no pertenece al proyecto activo.
 */
async function resolveRequestedChat(id: string): Promise<ChatConversation | null> {
  const existing = chats.value.find((c) => c._id === id);
  if (existing) return existing;
  try {
    const fetched = await messagingService.getConversation(id);
    if (!fetched) return null;
    const decorated = decorateConversation(fetched);
    chats.value.unshift(decorated);
    return decorated;
  } catch {
    return null;
  }
}

async function fetchChats() {
  try {
    await loadConversations(true);
    const requestedId = typeof route.query.conversation === "string"
      ? route.query.conversation
      : undefined;
    if (requestedId) {
      const requested = await resolveRequestedChat(requestedId);
      if (requested) {
        await selectChat(requested);
      }
    }
  } catch (error) {
    console.error("Failed to fetch chats", error);
  }
}

async function selectChat(chat: ChatConversation) {
  selectedChat.value = chat;
  setOpenConversation(chat._id);
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
  if (sameDay(date, today)) return t("common.today");
  if (sameDay(date, yesterday)) return t("common.yesterday");
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
    return { label: t("messaging.insights.sentiment.positive"), class: "stamp", style: "color: var(--ok); background: var(--ok-soft)" };
  }
  if (sentiment === "negative") {
    return { label: t("messaging.insights.sentiment.negative"), class: "stamp", style: "color: var(--danger); background: var(--danger-soft)" };
  }
  return { label: t("messaging.insights.sentiment.neutral"), class: "stamp", style: "color: var(--warn); background: var(--warn-soft)" };
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

const details = computed(() => {
  const chat = selectedChat.value;
  if (!chat) return [];
  return [
    {
      label: t("common.email"),
      value: chat.contactEmail || chat.clientInfo?.email || t("messaging.details.notAvailable"),
      icon: "mail",
    },
    {
      label: t("common.phone"),
      value: chat.contactPhone || chat.clientInfo?.phone || t("messaging.details.notAvailable"),
      icon: "smartphone",
    },
    {
      label: t("messaging.details.platform"),
      value: chat.platform,
      icon: "language",
    },
    {
      label: t("common.status"),
      value: chat.status,
      icon: "info",
    },
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
  // El bot no emite fragmentos parciales: solo se aplica el mensaje final.
  if (!data.isDone) return;
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
  if (msg.contentType === 'confirmation_request') return t('messaging.tools.confirmationRequired');
  return msg.toolData?.toolName || t('messaging.tools.defaultName');
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: t('messaging.tools.status.pending'),
    needs_confirmation: t('messaging.tools.status.pending'),
    success: t('messaging.tools.status.success'),
    error: t('common.error'),
    cancelled: t('messaging.tools.status.cancelled'),
  };
  return status ? (map[status] || status) : '';
}

function statusClass(status?: string) {
  const map: Record<string, string> = {
    success: 'text-[color:var(--ok)]',
    error: 'text-[color:var(--danger)]',
    cancelled: 'text-warm-ink3',
    needs_confirmation: 'text-[color:var(--warn)]',
    pending: 'text-[color:var(--warn)]',
  };
  return status ? (map[status] || 'text-warm-ink2') : 'text-warm-ink2';
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
  const input = window.prompt(t('messaging.tools.modifyPrompt'), current);
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
    window.alert(t('messaging.tools.invalidJson'));
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
  setOpenConversation(null);
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
  <div class="flex h-full overflow-hidden">
    <!-- Inbox Column -->
    <aside
      class="w-80 flex-none bg-warm-surface border-r border-warm-line flex flex-col"
    >
      <div class="p-4 border-b border-warm-line">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold tracking-tight text-warm-ink">{{ t("messaging.inbox.title") }}</h2>
        </div>
        <div class="relative mb-3 group">
          <span class="absolute left-3 top-2.5 text-warm-ink3">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            v-model="searchQuery"
            class="field pl-9 pr-4 py-2.5 transition-all" style="background: var(--ground)" 
            :placeholder="t('messaging.inbox.searchPlaceholder')"
            type="text"
          />
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            v-for="channel in enabledChannels"
            :key="channel"
            @click="setActiveChannel(channel)"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5',
              activeChannel === channel
                ? 'bg-[color:var(--brand)] text-[color:var(--brand-contrast)]'
                : 'bg-warm-surface border border-warm-line text-warm-ink2 hover:bg-warm-deep',
            ]"
          >
            <span
              v-if="channel !== 'All'"
              class="w-1.5 h-1.5 rounded-full"
              :class="channelMeta[channel as Exclude<ChannelFilter, 'All'>].dot"
            ></span>
            {{ channel === "All" ? t("messaging.filters.all") : channelMeta[channel as Exclude<ChannelFilter, 'All'>].label }}
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div v-if="isLoadingChats" class="p-4 text-center text-warm-ink3 text-sm font-bold">
          {{ t("messaging.inbox.loading") }}
        </div>
        <div v-else-if="chats.length === 0" class="p-4 text-center text-warm-ink3 text-sm font-bold">
          {{ t("messaging.inbox.empty") }}
        </div>
        <div v-else-if="filteredChats.length === 0" class="p-4 text-center text-warm-ink3 text-sm font-bold">
          {{ t("messaging.inbox.noMatches") }}
        </div>
        <div
          v-for="chat in filteredChats"
          :key="chat._id"
          :class="[
            'group flex items-start gap-3 p-4 cursor-pointer transition-colors border-b border-warm-line',
            chat.active
              ? 'bg-[color:var(--brand-softer)] active-row'
              : 'hover:bg-warm-ground',
          ]"
          @click="selectChat(chat)"
        >
          <div class="relative flex-none">
            <div
              class="w-10 h-10 rounded-full bg-cover bg-center"
              :style="{ backgroundImage: `url(${chat.avatar})` }"
            ></div>
            <div
              class="absolute -bottom-1 -right-1 rounded-full p-0.5 border border-warm-line" style="background: var(--surface)"
            >
              <span
                :class="[
                  'material-symbols-outlined text-[12px] rounded-full p-0.5',
                  chat.platform === 'WhatsApp'
                    ? 'text-[color:var(--ok)]'
                    : chat.platform === 'Instagram'
                      ? 'text-[color:var(--brand-ink)]'
                      : 'text-[color:var(--ok)]',
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
                    ? 'font-extrabold text-warm-ink'
                    : 'font-bold text-warm-ink',
                ]"
              >
                {{ chat.name }}
              </h3>
              <span
                :class="[
                  'text-[11px] whitespace-nowrap',
                  chat.active ? 'text-warm-ink2 font-bold' : 'text-warm-ink3 font-bold',
                ]"
                >{{ chat.time }}</span
              >
            </div>
            <p
              :class="[
                'text-xs line-clamp-1',
                chat.active ? 'text-warm-ink2 font-medium' : 'text-warm-ink2',
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
                    ? 'bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] font-extrabold border-transparent'
                    : 'bg-warm-deep text-warm-ink2 border-warm-line font-bold',
                ]"
                >{{ chat.tag }}</span
              >
              <span
                v-if="!chat.isContactCreated"
                class="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-[color:var(--warn-soft)] text-[color:var(--warn)] border border-transparent font-extrabold"
              >
                {{ t("messaging.contact.noContact") }}
              </span>
              <span
                v-if="chat.unreadCount"
                class="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded-full" :style="{ background: 'var(--brand)', color: 'var(--brand-contrast)' }" 
              >
                {{ chat.unreadCount }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Chat Main -->
    <main class="flex-1 flex flex-col min-w-[400px] relative">
      <div
        v-if="!selectedChat"
        class="flex-1 flex items-center justify-center text-warm-ink3 font-bold"
      >
        {{ t("messaging.chat.selectPrompt") }}
      </div>
      <template v-else>
        <header
          class="h-16 flex-none border-b border-warm-line flex items-center justify-between px-6 bg-warm-surface z-10 sticky top-0"
        >
          <div class="flex items-center gap-3">
            <div class="flex flex-col">
              <h1
                class="text-base font-extrabold text-warm-ink flex items-center gap-2"
              >
                {{ selectedChat.name }}
              </h1>
              <div class="flex items-center gap-1.5 text-xs text-warm-ink2 font-bold">
                <span
                  class="material-symbols-outlined text-[14px]" :style="{ color: 'var(--ok)' }"
                  >{{
                    selectedChat.platform === "WhatsApp"
                      ? "call"
                      : selectedChat.platform === "Instagram"
                        ? "photo_camera"
                        : "language"
                  }}</span
                >
                <span>{{ selectedChat.platform }}</span>
                <span v-if="!selectedChat.isContactCreated" class="ml-2 font-extrabold" :style="{ color: 'var(--warn)' }">
                  • {{ t("messaging.contact.noContact") }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div
              v-if="selectedChat.mode === 'auto_pilot'"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--brand-softer)]"
            >
              <span class="material-symbols-outlined text-[18px]" :style="{ color: 'var(--brand-ink)' }"
                >smart_toy</span
              >
              <span
                class="text-xs font-extrabold uppercase tracking-wider" :style="{ color: 'var(--brand-ink)' }"
                >{{ t("messaging.mode.autoPilotOn") }}</span
              >
            </div>
            <div
              v-else
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--warn-soft)]"
            >
              <span class="material-symbols-outlined text-[18px]" :style="{ color: 'var(--warn)' }"
                >support_agent</span
              >
              <span
                class="text-xs font-extrabold uppercase tracking-wider" :style="{ color: 'var(--warn)' }"
                >{{ t("messaging.mode.humanTakeover") }}</span
              >
            </div>
          </div>
        </header>
        <div
          id="chat-messages-container"
          class="flex-1 overflow-y-auto p-6 flex flex-col scroll-smooth bg-warm-ground"
        >
          <div v-if="isLoadingMessages" class="text-center text-warm-ink3 font-bold py-4">
            {{ t("messaging.chat.loadingMessages") }}
          </div>
          <template v-else>
            <div
              v-for="group in messageGroups"
              :key="group.key"
              class="flex flex-col gap-6 mb-6 last:mb-0"
            >
              <div class="flex justify-center">
                <span
                  class="px-3 py-1 rounded-full bg-warm-deep border border-warm-line text-[10px] font-extrabold text-warm-ink2"
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
                      class="max-w-[560px] w-full rounded-2xl border p-4 shadow-[var(--shadow-card)]"
                      :class="msg.contentType === 'confirmation_request'
                        ? 'bg-[color:var(--warn-soft)] border-[color:var(--warn-soft)]'
                        : (msg.toolData?.status === 'error' ? 'bg-[color:var(--danger-soft)] border-[color:var(--danger-soft)]' : 'bg-warm-deep border-warm-line')"
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <span class="material-symbols-outlined text-[16px] text-warm-ink2">{{ toolIcon(msg) }}</span>
                        <span class="text-[11px] font-extrabold uppercase tracking-wider text-warm-ink2">{{ toolLabel(msg) }}</span>
                        <span v-if="msg.toolData?.status" class="ml-auto text-[10px] font-bold uppercase" :class="statusClass(msg.toolData.status)">{{ statusLabel(msg.toolData.status) }}</span>
                      </div>
                      <p class="text-sm font-medium text-warm-ink leading-relaxed" v-html="renderMarkdown(msg.content)"></p>

                      <div v-if="msg.contentType === 'confirmation_request' && msg.toolData?.status === 'needs_confirmation'" class="flex flex-wrap gap-2 mt-3">
                        <button @click="confirmTool(msg, 'confirm')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors" style="background: var(--ok); color: #fff">{{ t("common.confirm") }}</button>
                        <button @click="confirmTool(msg, 'cancel')" class="px-3 py-1.5 rounded-xl border border-warm-line text-warm-ink2 text-xs font-extrabold hover:bg-warm-ground transition-colors">{{ t("common.cancel") }}</button>
                        <button @click="modifyTool(msg)" class="px-3 py-1.5 rounded-xl border border-warm-line text-warm-ink2 text-xs font-extrabold hover:bg-warm-ground transition-colors">{{ t("messaging.tools.modify") }}</button>
                      </div>
                      <div class="text-[10px] text-warm-ink3 mt-2">{{ msg.time }}</div>
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
                  class="w-8 h-8 flex-none rounded-full flex items-center justify-center border border-warm-line mt-auto" style="background: var(--ground)"
                >
                  <span
                    class="material-symbols-outlined text-[18px]" style="color: var(--ink-2)"
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
                      'rounded-[18px] px-5 py-3 shadow-[var(--shadow-card)] relative',
                      msg.isMe
                        ? 'rounded-br-[6px]'
                        : 'bg-warm-surface rounded-bl-[6px]',
                    ]"
                    :style="msg.isMe
                      ? { background: 'var(--brand)', color: 'var(--brand-contrast)' }
                      : undefined"
                  >
                    <div v-if="!msg.content" class="flex items-center gap-1 h-5">
                      <div class="w-1.5 h-1.5 bg-current rounded-full dot-pulse" style="animation-delay: 0ms"></div>
                      <div class="w-1.5 h-1.5 bg-current rounded-full dot-pulse" style="animation-delay: 150ms"></div>
                      <div class="w-1.5 h-1.5 bg-current rounded-full dot-pulse" style="animation-delay: 300ms"></div>
                    </div>
                    <p v-else class="text-sm leading-relaxed" v-html="renderMarkdown(msg.content)"></p>
                  </div>
                  <div
                    :class="[
                      'flex items-center gap-2 pr-1',
                      msg.isMe ? 'flex-row-reverse pr-1' : 'pl-1',
                    ]"
                  >
                    <span
                      :class="[
                        'text-xs font-semibold',
                        msg.isMe ? 'text-warm-ink2' : 'text-warm-ink2',
                      ]"
                      >{{ msg.senderName || msg.sender }}</span
                    >
                    <span class="text-[10px] text-warm-ink3">{{ msg.time }}</span>
                  </div>
                </div>
                </template>
              </div>
            </div>
          </template>
        </div>

        <!-- Input Area -->
        <footer class="p-6 bg-warm-surface border-t border-warm-line flex-none">
          <div
            class="relative rounded-2xl border transition-all p-2" :style="{ background: 'var(--surface)', borderColor: 'var(--hairline)' }"
          >
            <textarea
              v-model="newMessage"
              @keydown.enter.prevent="handleSendMessage"
              class="w-full bg-transparent border-none focus:ring-0 resize-none h-14 text-sm font-medium p-2" :style="{ color: 'var(--ink-1)' }"
              :placeholder="t('messaging.composer.sendPlaceholder')"
            ></textarea>
            <div class="flex justify-end items-center mt-1 px-1 pb-1 gap-2">
              <button
                @click="toggleMode"
                :disabled="isUpdatingMode"
                class="px-3 py-1.5 rounded-xl border border-warm-line text-warm-ink2 text-xs font-extrabold hover:bg-warm-ground transition-colors flex items-center gap-1.5 uppercase disabled:opacity-50"
              >
                <span class="material-symbols-outlined text-[16px]">{{
                  selectedChat.mode === "auto_pilot" ? "person" : "smart_toy"
                }}</span>
                {{ selectedChat.mode === "auto_pilot" ? t("messaging.composer.takeOver") : t("messaging.composer.autoPilot") }}
              </button>
              <button
                @click="handleSendMessage"
                class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold hover:bg-[color:var(--brand-hover)] transition-all flex items-center gap-1.5 uppercase disabled:opacity-50" :style="{ background: 'var(--brand)', color: 'var(--brand-contrast)' }"
              >
                <span class="material-symbols-outlined text-[16px]"
                  >send</span
                >
                {{ t("common.send") }}
              </button>
            </div>
          </div>
        </footer>
      </template>
    </main>

    <!-- Details Column -->
    <aside
      v-if="selectedChat"
      class="hidden lg:flex w-80 flex-none bg-warm-ground border-l border-warm-line flex flex-col overflow-y-auto"
    >
      <div
        class="p-6 border-b border-warm-line flex flex-col items-center relative overflow-hidden bg-warm-surface"
      >
        <div
          class="absolute inset-0 opacity-5"
          style="
            background-image: radial-gradient(var(--brand-soft) 1px, transparent 1px);
            background-size: 20px 20px;
          "
        ></div>
        <div
          class="relative z-10 w-20 h-20 rounded-full p-1 mb-3 shadow-[var(--shadow-card)]" style="border: 1px solid var(--hairline); background: var(--surface)"
        >
          <div
            class="w-full h-full rounded-full bg-cover bg-center"
            :style="{ backgroundImage: `url('${selectedChat.avatar}')` }"
          ></div>
          <div
            class="absolute bottom-0 right-0 p-1 rounded-full border border-warm-line" style="background: var(--surface); box-shadow: var(--shadow-card)"
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
        <h2 class="text-lg font-extrabold text-warm-ink relative z-10">
          {{ selectedChat.name }}
        </h2>
        <p class="text-sm font-bold text-warm-ink2 relative z-10 mb-3">
          {{ selectedChat.clientInfo?.identifier || selectedChat.contactPhone || '' }}
        </p>
        <div class="flex flex-col gap-2 relative z-10 w-full">
          <div class="flex justify-center">
            <span
              v-if="selectedChat.isContactCreated"
              class="px-2 py-0.5 stamp" style="background: var(--ok-soft); color: var(--ok)"
            >{{ t("messaging.contact.contactCreated") }}</span>
            <span
              v-else
              class="px-2 py-0.5 stamp" style="background: var(--warn-soft); color: var(--warn)"
            >{{ t("messaging.contact.noContact") }}</span>
          </div>
          <button
            v-if="!selectedChat.isContactCreated"
            @click="saveAsContact"
            :disabled="isSavingContact"
            class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50" :style="{ background: 'var(--brand)', color: 'var(--brand-contrast)' }" 
          >
            <span class="material-symbols-outlined text-[16px]">person_add</span>
            {{ isSavingContact ? t("common.saving") : t("messaging.contact.saveAsContact") }}
          </button>
        </div>
      </div>
      <div class="p-5 border-b border-warm-line">
        <div class="flex items-center justify-between mb-4">
          <h3
            class="text-xs font-extrabold text-warm-ink3 uppercase tracking-[0.14em] flex items-center gap-2"
          >
            <span class="material-symbols-outlined text-[16px]">psychology</span>
            {{ t("messaging.insights.title") }}
          </h3>
          <button
            @click="analyzeInsights"
            :disabled="isAnalyzingInsights"
            class="text-[10px] font-extrabold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1" style="color: var(--brand-ink)"
          >
            <span class="material-symbols-outlined text-[14px]">refresh</span>
            {{ isAnalyzingInsights ? t("messaging.insights.analyzing") : t("messaging.insights.analyze") }}
          </button>
        </div>

        <div v-if="isLoadingInsights" class="text-xs text-warm-ink3 font-bold">{{ t("messaging.insights.loading") }}</div>
        <div
          v-else-if="!insights"
          class="rounded-2xl p-4 text-center" style="border: 1.5px dashed var(--hairline); background: var(--surface)"
        >
          <span class="material-symbols-outlined text-[28px]" :style="{ color: 'var(--hairline)' }">psychology_alt</span>
          <p class="text-xs text-warm-ink3 mt-1">
            {{ t("messaging.insights.empty") }}
          </p>
        </div>
        <div v-else class="space-y-3">
          <div class="rounded-2xl p-4 border border-warm-line shadow-[var(--shadow-card)]" style="background: var(--surface)">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold text-warm-ink2">{{ t("messaging.insights.sentimentLabel") }}</span>
              <span
                class="text-xs font-extrabold px-2 py-0.5 rounded-full"
                :class="sentimentMeta.class"
                >{{ sentimentMeta.label }}</span
              >
            </div>
            <div
              class="h-1.5 w-full rounded-full overflow-hidden flex" style="background: var(--ground-deep)"
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
        </div>
      </div>
      <div class="p-5 flex-1">
        <h3
          class="text-xs font-extrabold text-warm-ink3 uppercase tracking-[0.14em] mb-4 flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[16px]">database</span>
          {{ t("messaging.details.title") }}
        </h3>
        <div class="grid grid-cols-1 gap-2">
          <div
            v-for="det in details"
            :key="det.label"
            class="flex items-center gap-3 p-3 rounded-xl border border-warm-line shadow-[var(--shadow-card)]" style="background: var(--surface)"
          >
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: var(--ground); color: var(--ink-3)"
            >
              <span class="material-symbols-outlined text-[18px]">{{
                det.icon
              }}</span>
            </div>
            <div class="flex flex-col overflow-hidden">
              <span class="text-[10px] text-warm-ink3 font-bold uppercase">{{
                det.label
              }}</span>
              <span class="text-sm text-warm-ink truncate font-bold">{{
                det.value
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
<style>
.dot-pulse {
  animation: dotPulse 1.1s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}
@keyframes dotPulse {
  0%, 60%, 100% { transform: none; opacity: 0.35; }
  30% { transform: translateY(-3px); opacity: 1; }
}
.active-row {
  box-shadow: inset 3px 0 0 var(--brand);
}
</style>
