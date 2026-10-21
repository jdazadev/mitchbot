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
import { socketService, type MessageUpdate } from "../services/socket.service";
import { projectService } from "../services/project.service";
import {
  useConversations,
  decorateConversation,
  type ChannelFilter,
} from "../composables/useConversations";
import AIcon from "../components/ui/AIcon.vue";
import AAvatar from "../components/ui/AAvatar.vue";
import APill from "../components/ui/APill.vue";
import ABubble from "../components/ui/ABubble.vue";
import DeliveryStatus from "../components/messaging/DeliveryStatus.vue";
import AButton from "../components/ui/AButton.vue";
import AModal from "../components/ui/AModal.vue";
import ADropdown from "../components/ui/ADropdown.vue";
import ExportDialog from "../components/messaging/ExportDialog.vue";
import { authService } from "../services/auth.service";
import AEmptyState from "../components/ui/AEmptyState.vue";
import { renderMarkdown } from "../lib/markdown";
import { channelMeta, channelIcon, channelTone } from "../lib/channels";
import { latestDelivery } from "../lib/delivery";
import { downloadBlob } from "../lib/download";

const { t, locale } = useI18n();
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
const hasOlderMessages = ref(false);
const isLoadingOlderMessages = ref(false);
const olderMessagesLoadError = ref(false);
const messageLoadError = ref(false);
const inboxLoadError = ref(false);
const newMessage = ref("");
const isSending = ref(false);
const actionError = ref<string | null>(null);

// Exportación: contiene datos personales, solo para admin y support (el backend lo exige igual).
const canExport = computed(() => ["admin", "support"].includes(authService.getUser()?.role || ""));
const showExportDialog = ref(false);
const exportingConversation = ref(false);

async function exportCurrentConversation(format: "csv" | "json") {
  const conversationId = selectedChat.value?._id;
  if (!conversationId || exportingConversation.value) return;
  exportingConversation.value = true;
  actionError.value = null;
  try {
    const file = await messagingService.exportConversation(conversationId, format);
    downloadBlob(file.blob, file.fileName);
  } catch {
    actionError.value = t("messaging.errors.export");
  } finally {
    exportingConversation.value = false;
  }
}
const liveAnnouncement = ref("");
let messagesRequestId = 0;

const searchQuery = ref("");

// === Filtros de canal derivados de la configuración del proyecto ===
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
  inboxLoadError.value = false;
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
    inboxLoadError.value = true;
  }
}

async function selectChat(chat: ChatConversation) {
  selectedChat.value = chat;
  messages.value = [];
  hasOlderMessages.value = false;
  olderMessagesLoadError.value = false;
  isLoadingOlderMessages.value = false;
  messageLoadError.value = false;
  actionError.value = null;
  setOpenConversation(chat._id);
  socketService.joinRoom(chat._id);
  markConversationRead(chat._id);

  chats.value.forEach((c) => (c.active = c._id === chat._id));

  await Promise.all([fetchMessages(chat), loadInsights(chat._id)]);
}

/** En móvil vuelve de la conversación a la bandeja (sin selección). */
function closeChat() {
  selectedChat.value = null;
  setOpenConversation(null);
  chats.value.forEach((c) => (c.active = false));
}

// === Modo enfoque: colapsa las laterales a carriles de iconos (solo escritorio) ===
const FOCUS_STORAGE_KEY = "mitchbot.messaging.focus";
const isFocusMode = ref(localStorage.getItem(FOCUS_STORAGE_KEY) === "1");

/** En móvil las laterales ya se ocultan, así que el colapso solo aplica desde `lg`. */
const isDesktop = ref(
  typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
);
const focusCollapsed = computed(() => isFocusMode.value && isDesktop.value);
let focusMedia: MediaQueryList | undefined;

function onFocusMediaChange(event: MediaQueryListEvent) {
  isDesktop.value = event.matches;
}

function toggleFocusMode() {
  isFocusMode.value = !isFocusMode.value;
  localStorage.setItem(FOCUS_STORAGE_KEY, isFocusMode.value ? "1" : "0");
}

/** Reparte el ancho de las tres columnas según el modo enfoque. */
const gridColumns = computed(() => {
  if (selectedChat.value) {
    return focusCollapsed.value
      ? "lg:grid-cols-[74px_1fr_74px]"
      : "lg:grid-cols-[minmax(320px,30%)_1fr_300px]";
  }
  return focusCollapsed.value
    ? "lg:grid-cols-[74px_1fr]"
    : "lg:grid-cols-[minmax(320px,30%)_1fr]";
});

/** Fondo pastel de los indicadores del carril (sentimiento y urgencia). */
const TONE_BOX: Record<"lime" | "butter" | "danger", string> = {
  lime: "bg-lime-soft text-lime-ink",
  butter: "bg-butter-soft text-butter-ink",
  danger: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
};

function collapsedChatTitle(chat: ChatConversation) {
  const parts = [chat.name, chat.platform];
  if (chat.unreadCount) parts.push(t("messaging.inbox.unread", { count: chat.unreadCount }));
  if (!chat.isContactCreated) parts.push(t("messaging.contact.noContact"));
  return parts.filter(Boolean).join(" · ");
}

function inboxUrgency(chat: ChatConversation) {
  const level = chat.aiInsights?.urgency?.level;
  if (level !== "medium" && level !== "high") return null;
  return {
    label: t(`messaging.urgency.level.${level}`),
    tone: level === "high" ? "danger" as const : "butter" as const,
  };
}

const sentimentPct = computed(() => {
  const sentiment = insights.value?.sentiment;
  const scores = insights.value?.sentimentScores;
  if (!sentiment || !scores) return null;
  return Math.round((scores[sentiment] ?? 0) * 100);
});

const sentimentTitle = computed(() => {
  if (isLoadingInsights.value) return t("messaging.insights.loading");
  if (sentimentPct.value === null) return t("messaging.insights.empty");
  return `${t("messaging.insights.sentimentLabel")}: ${sentimentLabel.value} (${sentimentPct.value}%)`;
});

const urgencyTitle = computed(
  () => `${t("messaging.urgency.title")}: ${urgency.value.level} — ${urgency.value.reason}`,
);

async function fetchMessages(chat: ChatConversation) {
  const requestId = ++messagesRequestId;
  messageLoadError.value = false;
  isLoadingMessages.value = true;
  try {
    const res = await messagingService.getMessages(chat._id);
    if (requestId !== messagesRequestId || selectedChat.value?._id !== chat._id) return;
    messages.value = res.messages.map((m) => processMessage(m, chat));
    hasOlderMessages.value = res.hasMore;
    olderMessagesLoadError.value = false;
    scrollToBottom();
  } catch (error) {
    console.error("Failed to fetch messages", error);
    if (requestId === messagesRequestId && selectedChat.value?._id === chat._id) {
      messageLoadError.value = true;
    }
  } finally {
    if (requestId === messagesRequestId) isLoadingMessages.value = false;
  }
}

async function loadOlderMessages() {
  const chat = selectedChat.value;
  const before = messages.value[0]?._id;
  if (!chat || !before || !hasOlderMessages.value || isLoadingOlderMessages.value) return;

  const requestId = messagesRequestId;
  isLoadingOlderMessages.value = true;
  olderMessagesLoadError.value = false;
  try {
    const page = await messagingService.getMessages(chat._id, before);
    if (requestId !== messagesRequestId || selectedChat.value?._id !== chat._id) return;

    const container = document.getElementById("chat-messages-container");
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    const olderMessages = page.messages.map((message) => processMessage(message, chat));
    messages.value = [...olderMessages, ...messages.value];
    hasOlderMessages.value = page.hasMore;
    await nextTick();
    if (container) container.scrollTop = previousTop + container.scrollHeight - previousHeight;
  } catch (error) {
    console.error("Failed to fetch older messages", error);
    if (requestId === messagesRequestId && selectedChat.value?._id === chat._id) {
      olderMessagesLoadError.value = true;
    }
  } finally {
    if (requestId === messagesRequestId) isLoadingOlderMessages.value = false;
  }
}

function retryMessagesLoad() {
  if (selectedChat.value) void fetchMessages(selectedChat.value);
}

function retryInboxLoad() {
  void fetchChats();
}

function processMessage(m: ChatMessage, chat: ChatConversation) {
  return {
    ...m,
    isMe: m.sender !== "contact",
    time: new Date(m.createdAt).toLocaleTimeString(locale.value, {
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
  return date.toLocaleDateString(locale.value, {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

async function handleSendMessage() {
  if (!newMessage.value.trim() || !selectedChat.value || isSending.value) return;

  const content = newMessage.value;
  newMessage.value = "";
  isSending.value = true;
  actionError.value = null;

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

    if (selectedChat.value && !selectedChat.value.isContactCreated) {
      setTimeout(refreshSelectedConversation, 500);
    }
  } catch (error) {
    console.error("Failed to send message", error);
    if (!newMessage.value.trim()) newMessage.value = content;
    actionError.value = t("messaging.errors.send");
  } finally {
    isSending.value = false;
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
const modeConfirmOpen = ref(false);
const modeNotice = ref<{ text: string; tone: "lilac" | "lime" } | null>(null);
let modeNoticeTimer: ReturnType<typeof setTimeout> | undefined;

function requestModeChange() {
  if (!selectedChat.value || isUpdatingMode.value) return;
  modeConfirmOpen.value = true;
}

function closeModeConfirm() {
  modeConfirmOpen.value = false;
}

function showModeNotice(key: string, tone: "lilac" | "lime") {
  modeNotice.value = { text: t(key), tone };
  if (modeNoticeTimer) clearTimeout(modeNoticeTimer);
  modeNoticeTimer = setTimeout(() => (modeNotice.value = null), 4000);
}

async function confirmModeChange() {
  if (!selectedChat.value || isUpdatingMode.value) return;
  const next = selectedChat.value.mode === "auto_pilot" ? "human_takeover" : "auto_pilot";
  isUpdatingMode.value = true;
  actionError.value = null;
  try {
    await messagingService.updateConversationMode(selectedChat.value._id, next);
    applyMode(selectedChat.value._id, next);
    modeConfirmOpen.value = false;
    showModeNotice(
      next === "human_takeover" ? "messaging.mode.takenOver" : "messaging.mode.autoPilotRestored",
      next === "human_takeover" ? "lilac" : "lime",
    );
  } catch (error) {
    console.error("Failed to update conversation mode", error);
    actionError.value = t("messaging.errors.mode");
    modeConfirmOpen.value = false;
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
  actionError.value = null;
  try {
    await messagingService.createContact(selectedChat.value._id);
    applyContactCreated(selectedChat.value._id);
  } catch (error) {
    console.error("Failed to save contact", error);
    actionError.value = t("messaging.errors.contact");
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
  actionError.value = null;
  try {
    insights.value = await messagingService.analyzeInsights(selectedChat.value._id);
  } catch (error) {
    console.error("Failed to analyze insights", error);
    actionError.value = t("messaging.errors.insights");
  } finally {
    isAnalyzingInsights.value = false;
  }
}

function onInsights(data: { conversationId: string; insights: ConversationInsights }) {
  if (selectedChat.value?._id === data.conversationId) {
    insights.value = data.insights;
  }
}

const sentimentTone = computed<'lime' | 'butter' | 'danger'>(() => {
  const sentiment = insights.value?.sentiment || "neutral";
  if (sentiment === "positive") return "lime";
  if (sentiment === "negative") return "danger";
  return "butter";
});

const sentimentLabel = computed(() => {
  const sentiment = insights.value?.sentiment || "neutral";
  if (sentiment === "positive") return t("messaging.insights.sentiment.positive");
  if (sentiment === "negative") return t("messaging.insights.sentiment.negative");
  return t("messaging.insights.sentiment.neutral");
});

const sentimentBars = computed(() => {
  const scores = insights.value?.sentimentScores;
  if (!scores) return [] as { key: string; color: string; width: string; pct: number }[];
  return [
    { key: "negative", color: "var(--butter)", pct: Math.round(scores.negative * 100) },
    { key: "neutral", color: "var(--line-2)", pct: Math.round(scores.neutral * 100) },
    { key: "positive", color: "var(--lime)", pct: Math.round(scores.positive * 100) },
  ].map((b) => ({ ...b, width: `${b.pct}%` }));
});

function sentimentBarLabel(key: string) {
  return t(`messaging.insights.sentiment.${key}`);
}

// Último mensaje real del cliente sin respuesta posterior del bot o de un humano.
const lastCustomerMessageUnanswered = computed(() => {
  const list = messages.value.filter(
    (m) =>
      (m.content || "").trim() &&
      m.contentType !== "tool_call" &&
      m.contentType !== "tool_result" &&
      m.contentType !== "confirmation_request",
  );
  const last = list[list.length - 1];
  return !!last && last.sender === "contact";
});

// El análisis manda; una confirmación pendiente solo puede elevarlo a Media.
const urgency = computed(() => {
  const chat = selectedChat.value;
  if (!chat) return { level: t("messaging.urgency.level.low"), tone: "lime" as const, step: 1, reason: "" };

  const pending = messages.value.some(
    (m) => m.contentType === "confirmation_request" && m.toolData?.status === "needs_confirmation",
  );
  const analyzed = insights.value?.urgency;
  if (analyzed) {
    const level = pending && analyzed.level === "low" ? "medium" : analyzed.level;
    const step = level === "high" ? 3 : level === "medium" ? 2 : 1;
    const reason = pending && analyzed.level === "low"
      ? t("messaging.urgency.reasonPending")
      : t(`messaging.urgency.motive.${analyzed.reason}`);
    return {
      level: t(`messaging.urgency.level.${level}`),
      tone: level === "high" ? "danger" as const : level === "medium" ? "butter" as const : "lime" as const,
      step,
      reason,
    };
  }

  const negativeSentiment = insights.value?.sentiment === "negative";
  if (negativeSentiment && lastCustomerMessageUnanswered.value) {
    return {
      level: t("messaging.urgency.level.high"),
      tone: "danger" as const,
      step: 3,
      reason: t("messaging.urgency.reasonEscalated"),
    };
  }

  if (pending) {
    return { level: t("messaging.urgency.level.medium"), tone: "butter" as const, step: 2, reason: t("messaging.urgency.reasonPending") };
  }

  const open = chat.status !== "closed";
  return {
    level: t("messaging.urgency.level.low"),
    tone: "lime" as const,
    step: 1,
    reason: open ? t("messaging.urgency.reasonOpen") : t("messaging.urgency.reasonClosed"),
  };
});

function conversationStatusLabel(status: ChatConversation["status"]) {
  const map: Record<string, string> = {
    active: t("messaging.details.status.active"),
    closed: t("messaging.details.status.closed"),
    pending_human: t("messaging.details.status.pendingHuman"),
  };
  return map[status] || status;
}

const details = computed(() => {
  const chat = selectedChat.value;
  if (!chat) return [];
  return [
    { label: t("common.email"), value: chat.contactEmail || chat.clientInfo?.email || t("messaging.details.notAvailable") },
    { label: t("common.phone"), value: chat.contactPhone || chat.clientInfo?.phone || t("messaging.details.notAvailable") },
    { label: t("messaging.details.platform"), value: chat.platform },
    { label: t("common.status"), value: conversationStatusLabel(chat.status) },
  ];
});

function formatTime(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  if (now.getDate() === date.getDate()) {
    return date.toLocaleTimeString(locale.value, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(locale.value, { month: "short", day: "numeric" });
}

function onNewMessage(msg: ChatMessage) {
  const convId = msg.conversationId;
  if (!convId) return;
  if (selectedChat.value && selectedChat.value._id === convId) {
    const processed = processMessage(msg, selectedChat.value);
    const existingMsg = messages.value.find((m) => m._id === processed._id);
    if (!existingMsg) {
      messages.value.push(processed);
      scrollToBottom();
    } else {
      existingMsg.content = processed.content;
    }
    if (msg.sender === "contact") {
      liveAnnouncement.value = t("messaging.a11y.incoming", {
        name: selectedChat.value.name || "",
        message: (msg.content || "").slice(0, 140),
      });
    }
  }
}

function onMessageChunk(data: { messageId: string, conversationId: string, content: string, isDone: boolean }) {
  if (!data.isDone) return;
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
  if (msg.contentType === 'confirmation_request') return 'Question';
  if (msg.toolData?.status === 'error') return 'WarningCircle';
  return 'Wrench';
}

function toolLabel(msg: ChatMessage) {
  if (msg.contentType === 'confirmation_request') {
    return msg.toolData?.status === 'pending_approval'
      ? t('tools.history.status.pending_approval')
      : t('messaging.tools.confirmationRequired');
  }
  return msg.toolData?.toolName || t('messaging.tools.defaultName');
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: t('messaging.tools.status.pending'),
    needs_confirmation: t('messaging.tools.status.pending'),
    pending_approval: t('tools.history.status.pending_approval'),
    approved: t('tools.history.status.approved'),
    rejected: t('tools.history.status.rejected'),
    success: t('messaging.tools.status.success'),
    error: t('common.error'),
    cancelled: t('messaging.tools.status.cancelled'),
  };
  return status ? (map[status] || status) : '';
}

function toolTone(status?: string) {
  if (status === 'error') return 'danger';
  if (status === 'needs_confirmation' || status === 'pending' || status === 'pending_approval') return 'butter';
  if (status === 'success' || status === 'approved') return 'lime';
  if (status === 'rejected') return 'danger';
  return 'ghost';
}

type ToolDecisionAction = "confirm" | "cancel" | "modify";
type ToolDecisionState = {
  action: ToolDecisionAction;
  messageId: string;
  conversationId: string;
  params?: Record<string, any>;
  status: "sending" | "error";
};

const toolDecisions = ref<Record<string, ToolDecisionState>>({});
const toolDecisionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TOOL_DECISION_TIMEOUT_MS = 15_000;

function toolDecisionState(executionId?: string) {
  return executionId ? toolDecisions.value[executionId] : undefined;
}

function clearToolDecisionTimer(executionId: string) {
  const timer = toolDecisionTimers.get(executionId);
  if (timer) clearTimeout(timer);
  toolDecisionTimers.delete(executionId);
}

function setToolDecisionError(executionId: string) {
  const decision = toolDecisions.value[executionId];
  if (!decision) return;
  clearToolDecisionTimer(executionId);
  toolDecisions.value = {
    ...toolDecisions.value,
    [executionId]: { ...decision, status: "error" },
  };
  liveAnnouncement.value = t("messaging.tools.decisionError");
}

function submitToolDecision(
  msg: ChatMessage,
  action: ToolDecisionAction,
  params?: Record<string, any>,
) {
  const executionId = msg.toolData?.executionId;
  if (!selectedChat.value || !executionId || toolDecisions.value[executionId]?.status === "sending") return;

  const decision: ToolDecisionState = {
    action,
    messageId: msg._id,
    conversationId: selectedChat.value._id,
    params,
    status: "sending",
  };
  toolDecisions.value = { ...toolDecisions.value, [executionId]: decision };

  if (!socketService.socket?.connected) {
    setToolDecisionError(executionId);
    return;
  }

  socketService.confirmTool({
    conversationId: decision.conversationId,
    executionId,
    action,
    params,
  });
  liveAnnouncement.value = t("messaging.tools.decisionSending");
  clearToolDecisionTimer(executionId);
  toolDecisionTimers.set(
    executionId,
    setTimeout(() => setToolDecisionError(executionId), TOOL_DECISION_TIMEOUT_MS),
  );
}

function confirmTool(msg: ChatMessage, action: "confirm" | "cancel") {
  submitToolDecision(msg, action);
}

function retryToolDecision(executionId: string) {
  const decision = toolDecisions.value[executionId];
  const msg = messages.value.find((message) => message._id === decision?.messageId);
  if (!decision || !msg || selectedChat.value?._id !== decision.conversationId) return;
  submitToolDecision(msg, decision.action, decision.params);
}

function resolveToolDecision(executionId: string, status: string) {
  const decision = toolDecisions.value[executionId];
  if (!decision) return;
  clearToolDecisionTimer(executionId);
  const nextStatus = status === "executed"
    ? "success"
    : status === "failed"
      ? "error"
      : status === "pending_confirmation"
        ? "needs_confirmation"
        : status;
  const msg = messages.value.find((message) => message._id === decision.messageId);
  if (msg?.toolData && ["success", "error", "cancelled", "needs_confirmation"].includes(nextStatus)) {
    msg.toolData.status = nextStatus as NonNullable<ChatMessage["toolData"]>["status"];
  }
  const { [executionId]: _resolved, ...remaining } = toolDecisions.value;
  toolDecisions.value = remaining;

  if (decision.action === "modify") {
    liveAnnouncement.value = t("messaging.tools.decisionModified");
  } else if (nextStatus === "success") {
    liveAnnouncement.value = t("messaging.tools.decisionSucceeded");
  } else if (nextStatus === "cancelled") {
    liveAnnouncement.value = t("messaging.tools.decisionCancelled");
  } else if (nextStatus === "error") {
    liveAnnouncement.value = t("messaging.tools.decisionFailed");
  }
}

// === Edición de parámetros de una herramienta (reemplaza window.prompt) ===
const modifyTarget = ref<ChatMessage | null>(null);
const modifyInput = ref("");
const modifyError = ref<string | null>(null);

function modifyTool(msg: ChatMessage) {
  if (!selectedChat.value || !msg.toolData?.executionId) return;
  modifyTarget.value = msg;
  modifyInput.value = JSON.stringify(msg.toolData.params || {}, null, 2);
  modifyError.value = null;
}

function closeModifyModal() {
  modifyTarget.value = null;
  modifyInput.value = "";
  modifyError.value = null;
}

function confirmModifyTool() {
  const msg = modifyTarget.value;
  if (!msg?.toolData?.executionId || !selectedChat.value) return;
  try {
    const params = JSON.parse(modifyInput.value);
    submitToolDecision(msg, "modify", params);
    closeModifyModal();
  } catch {
    modifyError.value = t("messaging.tools.invalidJson");
  }
}

/** Reintentos de entrega en curso o fallidos, por mensaje. */
const deliveryRetries = ref<Record<string, "pending" | "error">>({});

async function retryDelivery(msg: ChatMessage) {
  const conversationId = selectedChat.value?._id;
  if (!conversationId || deliveryRetries.value[msg._id] === "pending") return;
  deliveryRetries.value = { ...deliveryRetries.value, [msg._id]: "pending" };
  try {
    const { delivery } = await messagingService.retryMessage(conversationId, msg._id);
    // El worker puede entregar antes de que llegue esta respuesta: no se pisa un `sent` con `queued`.
    msg.delivery = latestDelivery(msg.delivery, delivery);
    const { [msg._id]: _done, ...rest } = deliveryRetries.value;
    deliveryRetries.value = rest;
  } catch {
    deliveryRetries.value = { ...deliveryRetries.value, [msg._id]: "error" };
  }
}

function onMessageUpdated(data: MessageUpdate) {
  const existing = messages.value.find((m) => m._id === data.messageId);
  if (!existing) return;
  if (data.delivery) {
    existing.delivery = latestDelivery(existing.delivery, data.delivery);
    return;
  }
  if (!data.status) return;
  if (existing.toolData) {
    existing.toolData.status = data.status as any;
    if (data.params) existing.toolData.params = data.params;
  }
  if (data.content) existing.content = data.content;
  const executionId = existing.toolData?.executionId;
  const decision = executionId ? toolDecisions.value[executionId] : undefined;
  if (executionId && decision && (data.status !== "needs_confirmation" || decision.action === "modify")) {
    resolveToolDecision(executionId, data.status);
  }
}

function onToolConfirmed(data: { executionId: string; status: string }) {
  resolveToolDecision(data.executionId, data.status);
}

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

function onSocketError(error: { executionId?: string; message?: string; code?: string }) {
  if (error.executionId && toolDecisions.value[error.executionId]) {
    setToolDecisionError(error.executionId);
    return;
  }
  console.error("WebSocket error:", error);
}

function onSocketDisconnect() {
  for (const [executionId, decision] of Object.entries(toolDecisions.value)) {
    if (decision.status === "sending") setToolDecisionError(executionId);
  }
}

onMounted(async () => {
  focusMedia = window.matchMedia("(min-width: 1024px)");
  isDesktop.value = focusMedia.matches;
  focusMedia.addEventListener("change", onFocusMediaChange);

  try {
    bindConversationSocket();
    socketService.onMessage(onNewMessage);
    socketService.onMessageChunk(onMessageChunk);
    socketService.onMessageUpdated(onMessageUpdated);
    socketService.onToolConfirmed(onToolConfirmed);
    socketService.onConversationStatus(onConversationStatus);
    socketService.onInsights(onInsights);

    if (socketService.socket) {
      socketService.socket.on('error', onSocketError);
      socketService.socket.on('disconnect', onSocketDisconnect);
    }
  } catch (error) {
    console.error("Failed to initialize socket service", error);
  }

  await Promise.all([loadChannels(), fetchChats()]);
});

onUnmounted(() => {
  setOpenConversation(null);
  if (modeNoticeTimer) clearTimeout(modeNoticeTimer);
  focusMedia?.removeEventListener("change", onFocusMediaChange);
  socketService.offMessage(onNewMessage);
  socketService.offMessageChunk(onMessageChunk);
  socketService.offMessageUpdated(onMessageUpdated);
  socketService.offToolConfirmed(onToolConfirmed);
  socketService.offConversationStatus(onConversationStatus);
  socketService.offInsights(onInsights);
  if (socketService.socket) {
    socketService.socket.off('error', onSocketError);
    socketService.socket.off('disconnect', onSocketDisconnect);
  }
  for (const timer of toolDecisionTimers.values()) clearTimeout(timer);
  toolDecisionTimers.clear();
});
</script>

<template>
  <div
    class="grid h-full min-h-0 grid-cols-1 gap-3.5 overflow-hidden transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
    :class="gridColumns"
  >
    <!-- Bandeja de entrada -->
    <aside
      class="h-full min-h-0 flex-col rounded-big bg-surface shadow-card"
      :class="[
        focusCollapsed ? 'overflow-visible' : 'overflow-hidden',
        selectedChat ? 'hidden lg:flex' : 'flex',
      ]"
    >
      <template v-if="!focusCollapsed">
        <div class="px-4.5 pb-2.5 pt-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display text-[15.5px] font-bold tracking-[-0.01em]">
              {{ t("messaging.inbox.title") }}
            </h2>
            <button
              v-if="canExport"
              type="button"
              data-testid="export-conversations"
              class="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
              :title="t('messaging.export.title')"
              @click="showExportDialog = true"
            >
              <AIcon name="DownloadSimple" :size="14" />
              {{ t("messaging.export.button") }}
            </button>
          </div>
          <div class="mt-3 flex items-center gap-2.5 rounded-full bg-canvas px-4 py-2.5 transition-shadow focus-within:shadow-[0_0_0_2px_var(--focus)]">
            <AIcon name="MagnifyingGlass" :size="17" class="shrink-0 text-ink-3" />
            <input
              v-model="searchQuery"
              class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:shadow-none"
              :placeholder="t('messaging.inbox.searchPlaceholder')"
              type="text"
            />
          </div>
          <div class="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              v-for="channel in enabledChannels"
              :key="channel"
              type="button"
              :class="[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                activeChannel === channel
                  ? 'bg-ink-solid text-ink-contrast'
                  : 'bg-canvas text-ink-2 hover:bg-sunken hover:text-ink',
              ]"
              @click="setActiveChannel(channel)"
            >
              <span
                v-if="channel !== 'All'"
                class="h-1.5 w-1.5 rounded-full bg-current"
              />
              {{ channel === "All" ? t("messaging.filters.all") : channelMeta(channel).label }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-1.5">
          <div v-if="isLoadingChats" role="status" class="px-3 py-8 text-center text-sm font-semibold text-ink-3">
            {{ t("messaging.inbox.loading") }}
          </div>
          <div
            v-else-if="inboxLoadError"
            role="alert"
            class="mx-2 my-3 flex flex-col items-center gap-2 rounded-card bg-[color:var(--danger-soft)] p-4 text-center text-[13px] text-[color:var(--danger)]"
          >
            <AIcon name="WarningCircle" :size="20" />
            <span>{{ t("messaging.errors.inboxLoad") }}</span>
            <button
              type="button"
              class="rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-ink-1 shadow-card transition-shadow hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              @click="retryInboxLoad"
            >
              {{ t("common.retry") }}
            </button>
          </div>
          <AEmptyState
            v-else-if="chats.length === 0"
            icon="ChatCircleDots"
            :title="t('messaging.inbox.empty')"
          />
          <div
            v-else-if="filteredChats.length === 0"
            class="px-3 py-8 text-center text-sm font-semibold text-ink-3"
          >
            {{ t("messaging.inbox.noMatches") }}
          </div>
          <button
            v-for="chat in filteredChats"
            v-else
            :key="chat._id"
            type="button"
            :class="[
              'grid w-full grid-cols-[38px_1fr_auto] items-center gap-3 rounded-card border-[1.5px] border-transparent p-3 text-left transition-colors',
              chat.active ? 'border-lilac bg-lilac-soft' : 'hover:bg-canvas',
            ]"
            @click="selectChat(chat)"
          >
            <span class="relative flex-none">
              <AAvatar
                :initials="(chat.name || 'C').slice(0, 2).toUpperCase()"
                :tone="channelTone(chat.platform)"
              />
              <span class="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-surface text-ink-3 ring-1 ring-line">
                <AIcon :name="channelIcon(chat.platform)" :size="10" weight="fill" />
              </span>
            </span>
            <span class="min-w-0">
              <span class="flex items-center gap-2">
                <span class="truncate text-[13.5px] font-semibold">{{ chat.name }}</span>
                <span
                  v-if="inboxUrgency(chat)"
                  role="img"
                  :aria-label="`${t('messaging.urgency.title')}: ${inboxUrgency(chat)?.label}`"
                  :title="`${t('messaging.urgency.title')}: ${inboxUrgency(chat)?.label}`"
                  class="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                  :class="TONE_BOX[inboxUrgency(chat)!.tone]"
                >
                  <AIcon name="WarningCircle" :size="13" weight="fill" />
                </span>
                <APill v-if="!chat.isContactCreated" tone="butter" size="sm">
                  {{ t("messaging.contact.noContact") }}
                </APill>
              </span>
              <span class="mt-0.5 block truncate text-xs text-ink-3">{{ chat.message }}</span>
            </span>
            <span class="flex flex-col items-end gap-1.5">
              <span class="text-[11px] text-ink-3">{{ chat.time }}</span>
              <span
                v-if="chat.unreadCount"
                data-testid="conversation-unread"
                class="grid h-5 min-w-5 place-items-center rounded-full bg-ink-solid px-1.5 text-[11px] font-bold text-ink-contrast [font-variant-numeric:tabular-nums]"
              >
                {{ chat.unreadCount }}
              </span>
            </span>
          </button>
        </div>
      </template>

      <!-- Enfoque: carril de iconos -->
      <template v-else>
        <div class="flex flex-none flex-col items-center gap-1.5 px-2 pb-1 pt-3">
          <ADropdown
            role="dialog"
            align="left"
            :label="t('messaging.inbox.search')"
            :title="t('messaging.inbox.search')"
            trigger-class="grid h-10 w-10 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            panel-class="w-64"
          >
            <template #trigger>
              <AIcon name="MagnifyingGlass" :size="17" />
            </template>
            <template #content>
              <div class="flex items-center gap-2.5 px-4 py-3">
                <AIcon name="MagnifyingGlass" :size="16" class="shrink-0 text-ink-3" />
                <input
                  v-model="searchQuery"
                  type="text"
                  class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                  :placeholder="t('messaging.inbox.searchPlaceholder')"
                  :aria-label="t('messaging.inbox.search')"
                />
              </div>
            </template>
          </ADropdown>

          <ADropdown
            role="listbox"
            align="left"
            :label="t('messaging.inbox.filter')"
            :title="t('messaging.inbox.filter')"
            trigger-class="relative grid h-10 w-10 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            panel-class="w-44 p-1.5"
          >
            <template #trigger>
              <AIcon name="Funnel" :size="17" />
              <span
                v-if="activeChannel !== 'All'"
                class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lilac ring-2 ring-surface"
              />
            </template>
            <template #content="{ close }">
              <button
                v-for="channel in enabledChannels"
                :key="channel"
                type="button"
                role="option"
                :aria-selected="activeChannel === channel"
                :class="[
                  'inline-flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-xs font-semibold transition-colors',
                  activeChannel === channel
                    ? 'bg-lilac-soft text-lilac-ink'
                    : 'text-ink-2 hover:bg-canvas hover:text-ink',
                ]"
                @click="setActiveChannel(channel); close()"
              >
                <span v-if="channel !== 'All'" class="h-1.5 w-1.5 rounded-full bg-current" />
                {{ channel === "All" ? t("messaging.filters.all") : channelMeta(channel).label }}
                <AIcon v-if="activeChannel === channel" name="Check" :size="14" class="ml-auto" />
              </button>
            </template>
          </ADropdown>
        </div>

        <div class="flex flex-1 flex-col items-center gap-1 overflow-y-auto rounded-b-big px-2 pb-2">
          <div
            v-if="isLoadingChats"
            class="grid flex-1 place-items-center py-6 text-ink-3"
            :title="t('messaging.inbox.loading')"
          >
            <AIcon name="SpinnerGap" :size="20" class="animate-spin" />
          </div>
          <div
            v-else-if="inboxLoadError"
            role="alert"
            :title="t('messaging.errors.inboxLoad')"
            class="grid h-10 w-10 flex-none place-items-center"
          >
            <button
              type="button"
              :aria-label="`${t('messaging.errors.inboxLoad')} ${t('common.retry')}`"
              :title="t('common.retry')"
              class="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--danger-soft)] text-[color:var(--danger)] transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              @click="retryInboxLoad"
            >
              <AIcon name="WarningCircle" :size="20" />
            </button>
          </div>
          <div
            v-else-if="chats.length === 0"
            class="grid flex-1 place-items-center py-6 text-ink-3"
            :title="t('messaging.inbox.empty')"
          >
            <AIcon name="ChatCircleDots" :size="22" />
          </div>
          <div
            v-else-if="filteredChats.length === 0"
            class="grid flex-1 place-items-center py-6 text-ink-3"
            :title="t('messaging.inbox.noMatches')"
          >
            <AIcon name="ChatCircleDots" :size="22" />
          </div>
          <button
            v-for="chat in filteredChats"
            v-else
            :key="chat._id"
            type="button"
            :title="collapsedChatTitle(chat)"
            :aria-label="collapsedChatTitle(chat)"
            :class="[
              'grid w-full shrink-0 place-items-center rounded-card border-[1.5px] border-transparent py-2 transition-colors',
              chat.active ? 'border-lilac bg-lilac-soft' : 'hover:bg-canvas',
            ]"
            @click="selectChat(chat)"
          >
            <span class="relative flex-none">
              <AAvatar
                :initials="(chat.name || 'C').slice(0, 2).toUpperCase()"
                :tone="channelTone(chat.platform)"
              />
              <span class="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-surface text-ink-3 ring-1 ring-line">
                <AIcon :name="channelIcon(chat.platform)" :size="10" weight="fill" />
              </span>
              <span
                v-if="chat.unreadCount"
                data-testid="conversation-unread"
                class="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink-solid px-1 text-[10px] font-bold text-ink-contrast ring-2 ring-surface [font-variant-numeric:tabular-nums]"
              >
                {{ chat.unreadCount }}
              </span>
              <span
                v-if="!chat.isContactCreated"
                class="absolute -bottom-1 -left-1.5 grid h-[15px] w-[15px] place-items-center rounded-full bg-butter text-butter-ink ring-2 ring-surface"
                :title="t('messaging.contact.noContact')"
              >
                <AIcon name="UserPlus" :size="9" weight="fill" />
              </span>
            </span>
          </button>
        </div>
      </template>
    </aside>

    <!-- Hilo -->
    <main
      class="min-h-0 min-w-0 flex-col overflow-hidden rounded-big bg-surface shadow-card"
      :class="selectedChat ? 'flex' : 'hidden lg:flex'"
    >
      <div
        v-if="!selectedChat"
        class="flex flex-1 items-center justify-center"
      >
        <AEmptyState icon="ChatCircleDots" :title="t('messaging.chat.selectPrompt')" />
      </div>
      <template v-else>
        <header class="flex flex-none flex-wrap items-center gap-3 border-b-[1.5px] border-line px-5 py-4">
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink lg:hidden"
            :aria-label="t('common.back')"
            :title="t('common.back')"
            @click="closeChat"
          >
            <AIcon name="ArrowLeft" :size="17" />
          </button>
          <span class="flex min-w-0 items-center gap-3">
            <AAvatar :initials="(selectedChat.name || 'C').slice(0, 2).toUpperCase()" :tone="channelTone(selectedChat.platform)" />
            <span class="flex flex-col">
              <span class="font-display text-base font-semibold tracking-[-0.01em]">
                {{ selectedChat.name }}
              </span>
              <span class="flex items-center gap-1.5 text-[11.5px] text-ink-3">
                <AIcon :name="channelIcon(selectedChat.platform)" :size="13" />
                {{ selectedChat.platform }}
                <template v-if="!selectedChat.isContactCreated">
                  · {{ t("messaging.contact.noContact") }}
                </template>
              </span>
            </span>
          </span>
          <span class="ml-auto flex items-center gap-2">
            <ADropdown
              v-if="canExport"
              :label="t('messaging.export.conversation')"
              :title="t('messaging.export.conversation')"
              testid="export-conversation"
              align="right"
              panel-class="w-44"
              :disabled="exportingConversation"
              trigger-class="inline-flex items-center gap-2 rounded-full bg-canvas px-3.5 py-2 text-xs font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              <template #trigger>
                <AIcon name="DownloadSimple" :size="15" />
                <span class="hidden xl:inline">{{ t("messaging.export.button") }}</span>
              </template>
              <template #content="{ close }">
                <button
                  v-for="format in (['csv', 'json'] as const)"
                  :key="format"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-ink-2 hover:bg-canvas"
                  @click="close(); exportCurrentConversation(format)"
                >
                  {{ t(`messaging.export.formats.${format}`) }}
                </button>
              </template>
            </ADropdown>
            <button
              type="button"
              class="hidden items-center gap-2 rounded-full bg-canvas px-3.5 py-2 text-xs font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink lg:inline-flex"
              :aria-pressed="isFocusMode"
              :aria-label="t('messaging.focus.toggle')"
              :title="t('messaging.focus.hint')"
              @click="toggleFocusMode"
            >
              <AIcon :name="isFocusMode ? 'ArrowsInSimple' : 'ArrowsOutSimple'" :size="15" />
              <span class="hidden xl:inline">{{ t("messaging.focus.toggle") }}</span>
            </button>
            <APill :dot="false" :tone="selectedChat.mode === 'auto_pilot' ? 'lime' : 'butter'">
              <AIcon :name="selectedChat.mode === 'auto_pilot' ? 'Robot' : 'Headset'" :size="13" />
              {{ selectedChat.mode === "auto_pilot" ? t("messaging.mode.autoPilotOn") : t("messaging.mode.humanTakeover") }}
            </APill>
          </span>
        </header>

        <div
          v-if="modeNotice"
          role="status"
          aria-live="polite"
          class="flex flex-none items-center gap-2 border-b-[1.5px] border-line px-5 py-2.5 text-[12.5px] font-semibold"
          :class="modeNotice.tone === 'lilac' ? 'bg-lilac-soft text-lilac-ink' : 'bg-lime-soft text-lime-ink'"
        >
          <AIcon :name="modeNotice.tone === 'lilac' ? 'User' : 'Robot'" :size="15" />
          {{ modeNotice.text }}
        </div>

        <p class="sr-only" role="status" aria-live="polite">{{ liveAnnouncement }}</p>

        <div
          id="chat-messages-container"
          class="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-5 scroll-smooth"
          :aria-busy="isLoadingMessages"
        >
          <div v-if="isLoadingMessages" role="status" class="py-4 text-center text-sm font-semibold text-ink-3">
            {{ t("messaging.chat.loadingMessages") }}
          </div>
          <div
            v-else-if="messageLoadError"
            role="alert"
            class="m-auto flex max-w-sm flex-col items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-5 text-center text-[13px] text-[color:var(--danger)]"
          >
            <AIcon name="WarningCircle" :size="22" />
            <span>{{ t("messaging.errors.messagesLoad") }}</span>
            <button
              type="button"
              class="rounded-full bg-surface px-4 py-2 text-xs font-bold text-ink-1 shadow-card transition-shadow hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              @click="retryMessagesLoad"
            >
              {{ t("common.retry") }}
            </button>
          </div>
          <template v-else>
            <div v-if="olderMessagesLoadError" role="alert" class="flex items-center justify-center gap-2 text-xs text-[color:var(--danger)]">
              <span>{{ t("messaging.errors.olderMessagesLoad") }}</span>
              <button type="button" class="font-bold underline underline-offset-2" @click="loadOlderMessages">
                {{ t("common.retry") }}
              </button>
            </div>
            <button
              v-else-if="hasOlderMessages"
              type="button"
              class="mx-auto rounded-full bg-sunken px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              :disabled="isLoadingOlderMessages"
              @click="loadOlderMessages"
            >
              {{ isLoadingOlderMessages ? t("messaging.chat.loadingOlderMessages") : t("messaging.chat.loadOlderMessages") }}
            </button>
            <div
              v-for="group in messageGroups"
              :key="group.key"
              class="flex flex-col gap-2.5"
            >
              <div class="my-1 flex items-center gap-3 text-[11px] font-semibold text-ink-3">
                {{ group.label }}
                <span class="h-px flex-1 bg-line" />
              </div>
              <template v-for="(msg, i) in group.messages" :key="msg._id || i">
                <div v-if="isToolMessage(msg)" class="flex w-full flex-col items-end gap-1">
                  <div
                    class="flex max-w-[80%] flex-wrap items-center gap-2 rounded-field px-4 py-2.5 text-xs font-semibold"
                    :class="toolTone(msg.toolData?.status) === 'butter'
                      ? 'bg-butter-soft text-butter-ink'
                      : toolTone(msg.toolData?.status) === 'danger'
                        ? 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
                        : 'bg-canvas text-ink-2'"
                  >
                    <APill v-if="msg.toolData?.status" :tone="toolTone(msg.toolData.status) as any" size="sm">
                      {{ statusLabel(msg.toolData.status) || toolLabel(msg) }}
                    </APill>
                    <span>{{ toolLabel(msg) }} · {{ msg.content }}</span>
                    <span
                      v-if="msg.contentType === 'confirmation_request' && msg.toolData?.status === 'needs_confirmation' && !toolDecisionState(msg.toolData?.executionId)"
                      class="flex flex-wrap gap-2"
                    >
                      <button
                        type="button"
                        class="rounded-full bg-lime px-3 py-1 text-[11px] font-bold text-lime-ink transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        @click="confirmTool(msg, 'confirm')"
                      >
                        {{ t("common.confirm") }}
                      </button>
                      <button
                        type="button"
                        class="rounded-full bg-surface px-3 py-1 text-[11px] font-bold text-ink-2 ring-1 ring-line transition-colors hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        @click="confirmTool(msg, 'cancel')"
                      >
                        {{ t("common.cancel") }}
                      </button>
                      <button
                        type="button"
                        class="rounded-full bg-surface px-3 py-1 text-[11px] font-bold text-ink-2 ring-1 ring-line transition-colors hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        @click="modifyTool(msg)"
                      >
                        {{ t("messaging.tools.modify") }}
                      </button>
                    </span>
                    <span
                      v-if="toolDecisionState(msg.toolData?.executionId)?.status === 'sending'"
                      role="status"
                      class="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2"
                    >
                      <AIcon name="SpinnerGap" :size="13" class="animate-spin" />
                      {{ t("messaging.tools.decisionSending") }}
                    </span>
                    <span
                      v-else-if="toolDecisionState(msg.toolData?.executionId)?.status === 'error'"
                      role="alert"
                      class="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[color:var(--danger)]"
                    >
                      {{ t("messaging.tools.decisionError") }}
                      <button
                        type="button"
                        class="rounded-full bg-surface px-3 py-1 font-bold text-ink-1 shadow-card transition-shadow hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        @click="retryToolDecision(msg.toolData!.executionId!)"
                      >
                        {{ t("common.retry") }}
                      </button>
                    </span>
                  </div>
                  <DeliveryStatus
                    v-if="msg.delivery"
                    :delivery="msg.delivery"
                    :retrying="deliveryRetries[msg._id] === 'pending'"
                    :retry-error="deliveryRetries[msg._id] === 'error'"
                    @retry="retryDelivery(msg)"
                  />
                </div>

                <template v-else>
                  <ABubble
                    :variant="!msg.isMe ? 'in' : msg.isBot ? 'bot' : 'human'"
                    :who="!msg.isMe ? undefined : msg.senderName || msg.sender"
                  >
                    <span v-if="!msg.content" class="flex items-center gap-1 py-1">
                      <span class="dot-pulse h-1.5 w-1.5 rounded-full bg-current" style="animation-delay: 0ms" />
                      <span class="dot-pulse h-1.5 w-1.5 rounded-full bg-current" style="animation-delay: 150ms" />
                      <span class="dot-pulse h-1.5 w-1.5 rounded-full bg-current" style="animation-delay: 300ms" />
                    </span>
                    <span v-else v-html="renderMarkdown(msg.content)" />
                  </ABubble>
                  <DeliveryStatus
                    v-if="msg.delivery"
                    class="-mt-1 self-end"
                    :delivery="msg.delivery"
                    :retrying="deliveryRetries[msg._id] === 'pending'"
                    :retry-error="deliveryRetries[msg._id] === 'error'"
                    @retry="retryDelivery(msg)"
                  />
                </template>
              </template>
            </div>
          </template>
        </div>

        <div
          v-if="actionError"
          role="alert"
          class="flex flex-none items-center gap-3 border-t-[1.5px] border-line bg-[color:var(--danger-soft)] px-5 py-3 text-[12.5px] font-medium text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" class="shrink-0" />
          <span class="flex-1">{{ actionError }}</span>
          <button
            type="button"
            class="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-70"
            :aria-label="t('common.close')"
            :title="t('common.close')"
            @click="actionError = null"
          >
            <AIcon name="X" :size="15" />
          </button>
        </div>

        <footer class="flex flex-none items-center gap-2.5 border-t-[1.5px] border-line px-5 py-3.5">
          <label class="sr-only" for="message-composer">{{ t("messaging.composer.sendPlaceholder") }}</label>
          <input
            id="message-composer"
            v-model="newMessage"
            type="text"
            class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3"
            :placeholder="t('messaging.composer.sendPlaceholder')"
            @keydown.enter.prevent="handleSendMessage"
          />
          <button
            type="button"
            :disabled="isUpdatingMode"
            :class="[
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
              selectedChat.mode === 'auto_pilot'
                ? 'bg-lilac text-lilac-ink hover:opacity-90'
                : 'bg-canvas text-ink-2 hover:bg-sunken hover:text-ink',
            ]"
            @click="requestModeChange"
          >
            <AIcon :name="selectedChat.mode === 'auto_pilot' ? 'User' : 'Robot'" :size="15" />
            {{ selectedChat.mode === "auto_pilot" ? t("messaging.composer.takeOver") : t("messaging.composer.autoPilot") }}
          </button>
          <button
            type="button"
            :disabled="!newMessage.trim() || isSending"
            class="inline-flex items-center gap-2 rounded-full bg-ink-solid px-4 py-2 text-xs font-semibold text-ink-contrast transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(11,11,12,0.2)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            @click="handleSendMessage"
          >
            <AIcon name="PaperPlaneTilt" :size="15" />
            {{ t("common.send") }}
          </button>
        </footer>
      </template>
    </main>

    <!-- Detalles -->
    <aside
      v-if="selectedChat"
      class="hidden h-full min-h-0 flex-col overflow-y-auto rounded-big bg-surface shadow-card lg:flex"
      :class="focusCollapsed ? 'items-center gap-3 p-3' : 'gap-3.5 p-4.5'"
    >
      <template v-if="focusCollapsed">
        <AAvatar
          :initials="(selectedChat.name || 'C').slice(0, 2).toUpperCase()"
          :tone="channelTone(selectedChat.platform)"
          size="lg"
        />

        <span class="h-px w-7 flex-none rounded-full bg-line" />

        <span
          role="img"
          :aria-label="sentimentTitle"
          :title="sentimentTitle"
          class="grid h-10.5 w-10.5 flex-none place-items-center rounded-field"
          :class="sentimentPct !== null ? TONE_BOX[sentimentTone] : 'bg-canvas text-ink-3'"
        >
          <AIcon name="Brain" :size="19" weight="fill" />
        </span>

        <span
          role="img"
          :aria-label="urgencyTitle"
          :title="urgencyTitle"
          class="flex w-full flex-none flex-col items-center gap-1"
        >
          <span class="grid h-10.5 w-10.5 place-items-center rounded-field" :class="TONE_BOX[urgency.tone]">
            <AIcon name="WarningCircle" :size="19" weight="fill" />
          </span>
          <span class="flex w-7 gap-0.5">
            <span
              v-for="step in 3"
              :key="step"
              class="h-1 flex-1 rounded-full"
              :class="step <= urgency.step
                ? urgency.step >= 3 ? 'bg-[color:var(--danger)]' : urgency.step === 2 ? 'bg-butter' : 'bg-lime'
                : 'bg-sunken'"
            />
          </span>
        </span>

        <span class="h-px w-7 flex-none rounded-full bg-line" />

        <span
          v-if="selectedChat.isContactCreated"
          role="img"
          :aria-label="t('messaging.contact.contactCreated')"
          :title="t('messaging.contact.contactCreated')"
          class="grid h-10.5 w-10.5 flex-none place-items-center rounded-field bg-lime-soft text-lime-ink"
        >
          <AIcon name="CheckCircle" :size="19" weight="fill" />
        </span>
        <button
          v-else
          type="button"
          :disabled="isSavingContact"
          :aria-label="t('messaging.contact.saveAsContact')"
          :title="t('messaging.contact.saveAsContact')"
          class="relative grid h-10.5 w-10.5 flex-none place-items-center rounded-field bg-canvas text-[12px] font-extrabold text-lilac-ink transition-colors hover:bg-lilac-soft disabled:opacity-50"
          @click="saveAsContact"
        >
          {{ (selectedChat.name || 'C').slice(0, 2).toUpperCase() }}
          <span class="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-lilac-ink text-lilac ring-2 ring-surface">
            <AIcon name="Plus" :size="9" weight="bold" />
          </span>
        </button>
      </template>

      <template v-else>
      <div class="flex items-center gap-3">
        <AAvatar :initials="(selectedChat.name || 'C').slice(0, 2).toUpperCase()" :tone="channelTone(selectedChat.platform)" size="lg" />
        <div class="min-w-0">
          <div class="truncate text-[13.5px] font-semibold">{{ selectedChat.name }}</div>
          <div class="truncate text-xs text-ink-3">
            {{ selectedChat.clientInfo?.identifier || selectedChat.contactPhone || '' }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <APill :tone="selectedChat.isContactCreated ? 'lime' : 'butter'">
          {{ selectedChat.isContactCreated ? t("messaging.contact.contactCreated") : t("messaging.contact.noContact") }}
        </APill>
        <button
          v-if="!selectedChat.isContactCreated"
          type="button"
          :disabled="isSavingContact"
          class="inline-flex items-center gap-1.5 rounded-full bg-lilac px-3.5 py-1 text-[11.5px] font-semibold text-lilac-ink disabled:opacity-50"
          @click="saveAsContact"
        >
          <AIcon name="UserPlus" :size="13" />
          {{ isSavingContact ? t("common.saving") : t("messaging.contact.saveAsContact") }}
        </button>
      </div>

      <div class="h-px bg-line" />

      <!-- Análisis de IA · Sentimiento -->
      <div>
        <div class="flex items-center gap-2 text-[14px] font-semibold">
          <AIcon name="Brain" :size="16" class="text-ink-3" />
          {{ t("messaging.insights.title") }}
          <button
            type="button"
            :disabled="isAnalyzingInsights"
            class="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-lilac-ink disabled:opacity-50"
            @click="analyzeInsights"
          >
            <AIcon name="ArrowsClockwise" :size="13" />
            {{ isAnalyzingInsights ? t("messaging.insights.analyzing") : t("messaging.insights.analyze") }}
          </button>
        </div>

        <div v-if="isLoadingInsights" class="mt-3 text-xs font-semibold text-ink-3">
          {{ t("messaging.insights.loading") }}
        </div>
        <div
          v-else-if="!insights"
          class="mt-3 rounded-card border-[1.5px] border-dashed border-line bg-canvas p-4 text-center"
        >
          <AIcon name="Brain" :size="26" class="mx-auto text-line-strong" />
          <p class="mt-1 text-xs text-ink-3">{{ t("messaging.insights.empty") }}</p>
        </div>
        <div v-else class="mt-3">
          <div class="flex items-center gap-2">
            <span class="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-3">
              {{ t("messaging.insights.sentimentLabel") }}
            </span>
            <APill :tone="sentimentTone" class="ml-auto">{{ sentimentLabel }}</APill>
          </div>
          <div class="mt-2.5 flex h-2 overflow-hidden rounded-full bg-sunken">
            <span
              v-for="bar in sentimentBars"
              :key="bar.key"
              class="block h-full"
              :style="{ width: bar.width, background: bar.color }"
            />
          </div>
          <div data-testid="sentiment-breakdown" class="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-3">
            <span v-for="bar in sentimentBars" :key="bar.key">
              <b class="[font-variant-numeric:tabular-nums]">{{ bar.pct }}%</b> {{ sentimentBarLabel(bar.key) }}
            </span>
          </div>
        </div>
      </div>

      <div class="h-px bg-line" />

      <!-- Urgencia -->
      <div>
        <div class="flex items-center gap-2 text-[14px] font-semibold">
          <AIcon name="WarningCircle" :size="16" class="text-ink-3" />
          {{ t("messaging.urgency.title") }}
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <APill :tone="urgency.tone">{{ urgency.level }}</APill>
          <span class="ml-auto min-w-0 text-right text-xs text-ink-3">{{ urgency.reason }}</span>
        </div>
        <div class="mt-2.5 flex gap-1">
          <span
            v-for="step in 3"
            :key="step"
            class="h-2 flex-1 rounded-full"
            :class="step <= urgency.step
              ? urgency.step >= 3 ? 'bg-[color:var(--danger)]' : urgency.step === 2 ? 'bg-butter' : 'bg-lime'
              : 'bg-sunken'"
          />
        </div>
      </div>

      <div class="h-px bg-line" />

      <!-- Detalles -->
      <div>
        <div class="text-[14px] font-semibold">{{ t("messaging.details.title") }}</div>
        <div class="mt-3">
          <div
            v-for="det in details"
            :key="det.label"
            class="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[13px] last:border-b-0"
          >
            <span class="text-ink-3">{{ det.label }}</span>
            <b class="truncate font-semibold">{{ det.value }}</b>
          </div>
        </div>
      </div>
      </template>
    </aside>

    <!-- Modal: modificar parámetros de la herramienta -->
    <AModal
      :open="!!modifyTarget"
      :label="t('messaging.tools.modifyTitle')"
      size="lg"
      @close="closeModifyModal"
    >
      <div class="p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('messaging.tools.modifyTitle') }}</h2>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
            :aria-label="t('common.close')"
            :title="t('common.close')"
            @click="closeModifyModal"
          >
            <AIcon name="X" :size="18" />
          </button>
        </div>
        <label for="tool-params" class="mt-2 block text-xs text-ink-3">{{ t('messaging.tools.modifyPrompt') }}</label>
        <div
          v-if="modifyError"
          class="mt-3 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ modifyError }}
        </div>
        <textarea
          id="tool-params"
          v-model="modifyInput"
          class="field mt-3 h-48 resize-none font-mono text-[13px]"
          spellcheck="false"
        />
        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="closeModifyModal">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" @click="confirmModifyTool">{{ t('common.confirm') }}</AButton>
        </div>
      </div>
    </AModal>

    <!-- Modal: confirmar cambio de modo (acción de alto riesgo) -->
    <AModal
      :open="modeConfirmOpen"
      :label="selectedChat?.mode === 'auto_pilot' ? t('messaging.mode.takeoverTitle') : t('messaging.mode.autoPilotTitle')"
      size="md"
      @close="closeModeConfirm"
    >
      <div class="p-6">
        <div class="flex items-start gap-3">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            :class="selectedChat?.mode === 'auto_pilot' ? 'bg-lilac text-lilac-ink' : 'bg-lime text-lime-ink'"
          >
            <AIcon
              :name="selectedChat?.mode === 'auto_pilot' ? 'User' : 'Robot'"
              :size="20"
              weight="fill"
            />
          </span>
          <div class="min-w-0">
            <h2 class="font-display text-lg font-bold tracking-[-0.02em]">
              {{ selectedChat?.mode === "auto_pilot" ? t("messaging.mode.takeoverTitle") : t("messaging.mode.autoPilotTitle") }}
            </h2>
            <p class="mt-2 text-[13px] leading-relaxed text-ink-2">
              {{ selectedChat?.mode === "auto_pilot" ? t("messaging.mode.takeoverBody") : t("messaging.mode.autoPilotBody") }}
            </p>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="closeModeConfirm">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" :disabled="isUpdatingMode" @click="confirmModeChange">
            {{ selectedChat?.mode === "auto_pilot" ? t("messaging.mode.takeoverConfirm") : t("messaging.mode.autoPilotConfirm") }}
          </AButton>
        </div>
      </div>
    </AModal>

    <ExportDialog
      v-if="canExport"
      :open="showExportDialog"
      :channels="enabledChannels"
      @close="showExportDialog = false"
    />
  </div>
</template>

<style scoped>
.dot-pulse {
  animation: dotPulse 1.1s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}
@keyframes dotPulse {
  0%, 60%, 100% { transform: none; opacity: 0.35; }
  30% { transform: translateY(-3px); opacity: 1; }
}
</style>
