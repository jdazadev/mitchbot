<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  messagingService,
  type ChatConversation,
  type ChatMessage,
} from "../services/messaging.service";
import { socketService } from "../services/socket.service";
import es from "../locales/es.json";
import en from "../locales/en.json";
import AIcon from "../components/ui/AIcon.vue";
import AAvatar from "../components/ui/AAvatar.vue";
import ABubble from "../components/ui/ABubble.vue";
import APill from "../components/ui/APill.vue";
import AButton from "../components/ui/AButton.vue";
import AModal from "../components/ui/AModal.vue";
import { renderMarkdown } from "../lib/markdown";

// El chat público es independiente del idioma del dashboard: usa un
// composer aislado cuyo locale se fija según el idioma del agente del proyecto.
const { t, locale: publicLocale } = useI18n({
  useScope: "isolated",
  locale: "es",
  fallbackLocale: "es",
  messages: { es, en },
});

const activeConversation = ref<ChatConversation | null>(null);
const messages = ref<ChatMessage[]>([]);
const newMessage = ref("");
const isLoading = ref(false);

// Datos del cliente simulado
const clientName = ref("Cliente Test");
const clientPhone = ref("+1234567890");
const clientEmail = ref("");
const selectedPlatform = ref<"WhatsApp" | "Instagram" | "Web">("Web");
const route = useRoute();
const projectSlug = computed(() => String(route.params.slug || ""));

const isSlugReady = computed(() => projectSlug.value.trim().length > 0);

onMounted(() => {
  // Conexión pública para test-chat (requiere slug)
  socketService.connect({ isPublic: true, slug: projectSlug.value });
  socketService.onMessage(onNewMessage);
  socketService.onMessageChunk(onMessageChunk);
  socketService.onMessageUpdated(onMessageUpdated);
  socketService.onConversationStatus(onConversationStatus);

  // El idioma del chat público sigue al del agente del proyecto.
  if (isSlugReady.value) {
    messagingService
      .clientGetConfig(projectSlug.value)
      .then((config) => {
        publicLocale.value = config?.language === "en" ? "en" : "es";
      })
      .catch(() => {});
  }
});

onUnmounted(() => {
  socketService.offMessage(onNewMessage);
  socketService.offMessageChunk(onMessageChunk);
  socketService.offMessageUpdated(onMessageUpdated);
  socketService.offConversationStatus(onConversationStatus);
});

/**
 * El CLIENTE inicia una conversación enviando un primer mensaje.
 * El contacto NO se crea aquí — solo cuando el agente responda.
 */
async function startConversation() {
  if (!newMessage.value.trim()) return;
  if (!isSlugReady.value) return;

  try {
    isLoading.value = true;
    const result = await messagingService.clientStartConversation(projectSlug.value, {
      platform: selectedPlatform.value,
      clientName: clientName.value || undefined,
      clientPhone: clientPhone.value || undefined,
      clientEmail: clientEmail.value || undefined,
      clientIdentifier: clientPhone.value || clientEmail.value || `web-${Date.now()}`,
      initialMessage: newMessage.value,
    });

    activeConversation.value = result.conversation;
    messages.value = [result.message];
    newMessage.value = "";

    // Join room para recibir respuestas
    socketService.joinRoom(result.conversation._id);
  } catch (e) {
    console.error("Error starting conversation:", e);
  } finally {
    isLoading.value = false;
  }
}

/**
 * El CLIENTE envía un mensaje a una conversación existente.
 */
async function sendMessage() {
  if (!newMessage.value.trim() || !activeConversation.value) return;
  if (!isSlugReady.value) return;
  const content = newMessage.value;
  newMessage.value = "";

  try {
    const msg = await messagingService.clientSendMessage(
      projectSlug.value,
      activeConversation.value._id,
      content,
      clientName.value
    );
    if (!messages.value.find((m) => m._id === msg._id)) {
      messages.value.push(msg);
      scrollToBottom();
    }
  } catch (e) {
    console.error(e);
  }
}

function handleSend() {
  if (activeConversation.value) {
    sendMessage();
  } else {
    startConversation();
  }
}

function onNewMessage(msg: ChatMessage) {
  if (
    activeConversation.value &&
    (msg as any).conversationId === activeConversation.value._id
  ) {
    if (!messages.value.find((m) => m._id === msg._id)) {
      messages.value.push(msg);
      scrollToBottom();
    }
  }
}

function onMessageChunk(data: { messageId: string, conversationId: string, content: string, isDone: boolean }) {
  // El bot no emite fragmentos parciales: solo se aplica el mensaje final.
  if (!data.isDone) return;
  if (
    activeConversation.value &&
    data.conversationId === activeConversation.value._id
  ) {
    const existingMsg = messages.value.find((m) => m._id === data.messageId);
    if (existingMsg) {
      existingMsg.content = data.content;
      scrollToBottom();
    }
  }
}

/**
 * Mensajes internos de herramientas que NO deben mostrarse al cliente final.
 * Las solicitudes de confirmación sí se muestran (el cliente debe confirmar).
 */
function isHiddenToolMessage(msg: ChatMessage) {
  return msg.contentType === 'tool_call' || msg.contentType === 'tool_result';
}

function isConfirmationRequest(msg: ChatMessage) {
  return msg.contentType === 'confirmation_request';
}

function confirmTool(msg: ChatMessage, action: 'confirm' | 'cancel') {
  if (!activeConversation.value || !msg.toolData?.executionId) return;
  socketService.confirmTool({
    conversationId: activeConversation.value._id,
    executionId: msg.toolData.executionId,
    action,
  });
}

// === Edición de parámetros de una herramienta (reemplaza window.prompt) ===
const modifyTarget = ref<ChatMessage | null>(null);
const modifyInput = ref("");
const modifyError = ref<string | null>(null);

function modifyTool(msg: ChatMessage) {
  if (!activeConversation.value || !msg.toolData?.executionId) return;
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
  if (!activeConversation.value || !msg?.toolData?.executionId) return;
  try {
    const params = JSON.parse(modifyInput.value);
    socketService.confirmTool({
      conversationId: activeConversation.value._id,
      executionId: msg.toolData.executionId,
      action: "modify",
      params,
    });
    closeModifyModal();
  } catch {
    modifyError.value = t("publicChat.tool.invalidJson");
  }
}

function toolStatusLabel(status?: string) {
  if (!status) return "";
  const key = `publicChat.tool.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function senderLabel(sender: ChatMessage["sender"]) {
  if (sender === "contact") return t("publicChat.sender.you");
  if (sender === "ai_agent") return t("publicChat.sender.ai");
  return t("publicChat.sender.human");
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

/** Mantiene al día el modo/estado de la conversación activa del cliente */
function onConversationStatus(data: { mode?: string; status?: string }) {
  if (!activeConversation.value) return;
  if (data.mode) (activeConversation.value as any).mode = data.mode;
  if (data.status) (activeConversation.value as any).status = data.status;
}

function resetConversation() {
  activeConversation.value = null;
  messages.value = [];
  newMessage.value = "";
}

function scrollToBottom() {
  nextTick(() => {
    const el = document.getElementById("chat-container");
    if (el) el.scrollTop = el.scrollHeight;
  });
}
</script>

<template>
  <div class="relative flex h-full gap-8 overflow-hidden bg-canvas p-8">
    <div class="aurora-haze" aria-hidden="true" />

    <!-- Panel de configuración -->
    <div class="relative z-10 flex w-1/3 flex-col overflow-hidden rounded-card bg-surface shadow-card">
      <div class="border-b border-line p-4">
        <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t("publicChat.simulator.title") }}</h2>
        <p class="mt-1 text-xs text-ink-3">{{ t("publicChat.simulator.subtitle") }}</p>
      </div>
      <div class="flex flex-col gap-4 p-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-2">{{ t("publicChat.client.name") }}</span>
          <input v-model="clientName" class="field" :placeholder="t('publicChat.client.namePlaceholder')" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-2">{{ t("publicChat.client.phone") }}</span>
          <input v-model="clientPhone" class="field" placeholder="+1234567890" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-2">{{ t("publicChat.client.email") }}</span>
          <input v-model="clientEmail" class="field" :placeholder="t('publicChat.client.emailPlaceholder')" />
        </label>
        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-2">{{ t("publicChat.client.platform") }}</span>
          <div class="flex gap-2">
            <button
              v-for="p in ['WhatsApp', 'Instagram', 'Web'] as const"
              :key="p"
              type="button"
              :class="[
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                selectedPlatform === p
                  ? 'bg-ink text-white'
                  : 'bg-canvas text-ink-2 hover:bg-sunken',
              ]"
              @click="selectedPlatform = p"
            >
              {{ p }}
            </button>
          </div>
        </div>

        <div v-if="activeConversation" class="mt-2 rounded-field bg-sky-soft p-3.5">
          <div class="text-xs font-semibold text-sky-ink">{{ t("publicChat.active.title") }}</div>
          <div class="mt-0.5 text-xs text-sky-ink/80">{{ t("publicChat.active.idLabel") }} {{ activeConversation._id }}</div>
          <div class="text-xs text-sky-ink/80">
            {{ t("publicChat.active.contactCreated") }} {{ activeConversation.isContactCreated ? t("publicChat.active.contactCreatedYes") : t("publicChat.active.contactPending") }}
          </div>
          <button
            type="button"
            class="mt-2 rounded-full bg-[color:var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)]"
            @click="resetConversation"
          >
            {{ t("publicChat.active.reset") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Simulador -->
    <div class="relative z-10 flex flex-1 flex-col overflow-hidden rounded-big bg-surface shadow-card">
      <div class="flex items-center gap-3 border-b-[1.5px] border-line p-4">
        <AAvatar :initials="(clientName?.[0] || '?').toUpperCase()" tone="lilac" />
        <div>
          <div class="font-display text-[15px] font-semibold tracking-[-0.01em]">
            {{ clientName || t("publicChat.header.anonymous") }}
          </div>
          <div class="text-xs text-ink-3">
            {{ activeConversation ? t("publicChat.header.activeWithPlatform", { platform: selectedPlatform }) : t("publicChat.header.startPrompt") }}
          </div>
        </div>
        <APill v-if="activeConversation" tone="lime" class="ml-auto">
          <AIcon name="Robot" :size="13" />
          {{ t("publicChat.sender.ai") }}
        </APill>
      </div>

      <div id="chat-container" role="log" aria-live="polite" aria-relevant="additions text" class="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-5">
        <div v-if="messages.length === 0" class="flex flex-1 items-center justify-center text-sm text-ink-3">
          {{ t("publicChat.empty") }}
        </div>
        <template v-for="msg in messages" :key="msg._id">
          <template v-if="!isHiddenToolMessage(msg)">
            <div v-if="isConfirmationRequest(msg)" class="flex w-full justify-end">
              <div class="w-full max-w-[80%] rounded-field bg-butter-soft px-4 py-3 text-xs font-semibold text-butter-ink">
                <div class="mb-1 flex flex-wrap items-center gap-2">
                  <APill tone="butter" size="sm">{{ t('publicChat.tool.confirmationRequired') }}</APill>
                  <span v-if="msg.toolData?.status" class="ml-auto text-[10px] font-bold uppercase">
                    {{ toolStatusLabel(msg.toolData.status) }}
                  </span>
                </div>
                <span v-html="renderMarkdown(msg.content)" />
                <div v-if="msg.toolData?.status === 'needs_confirmation'" class="mt-3 flex flex-wrap gap-2">
                  <button type="button" class="rounded-full bg-lime px-3 py-1 text-[11px] font-bold text-lime-ink" @click="confirmTool(msg, 'confirm')">
                    {{ t("publicChat.tool.confirm") }}
                  </button>
                  <button type="button" class="rounded-full bg-surface px-3 py-1 text-[11px] font-bold text-ink-2 ring-1 ring-line" @click="confirmTool(msg, 'cancel')">
                    {{ t("publicChat.tool.cancel") }}
                  </button>
                  <button type="button" class="rounded-full bg-surface px-3 py-1 text-[11px] font-bold text-ink-2 ring-1 ring-line" @click="modifyTool(msg)">
                    {{ t("publicChat.tool.modify") }}
                  </button>
                </div>
              </div>
            </div>
            <ABubble
              v-else
              :variant="msg.sender === 'contact' ? 'bot' : 'in'"
              :who="senderLabel(msg.sender)"
            >
              <span v-if="!msg.content" class="flex items-center gap-1 py-1">
                <span class="dot-pulse h-1.5 w-1.5 rounded-full bg-current" style="animation-delay: 0ms" />
                <span class="dot-pulse h-1.5 w-1.5 rounded-full bg-current" style="animation-delay: 150ms" />
                <span class="dot-pulse h-1.5 w-1.5 rounded-full bg-current" style="animation-delay: 300ms" />
              </span>
              <span v-else v-html="renderMarkdown(msg.content)" />
            </ABubble>
          </template>
        </template>
      </div>

      <div class="border-t-[1.5px] border-line p-4">
        <div class="flex gap-2">
          <input
            v-model="newMessage"
            class="min-w-0 flex-1 rounded-field bg-canvas px-4 py-3 font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3"
            :placeholder="activeConversation ? t('publicChat.input.placeholder') : t('publicChat.input.firstPlaceholder')"
            @keydown.enter="handleSend"
          />
          <button
            type="button"
            :disabled="!newMessage.trim() || isLoading || !isSlugReady"
            class="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-white transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(11,11,12,0.2)] disabled:opacity-45"
            @click="handleSend"
          >
            <AIcon name="PaperPlaneTilt" :size="15" />
            {{ activeConversation ? t("publicChat.input.send") : t("publicChat.input.start") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: modificar parámetros de la herramienta -->
    <AModal
      :open="!!modifyTarget"
      :label="t('publicChat.tool.modifyPrompt')"
      size="lg"
      @close="closeModifyModal"
    >
      <div class="p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('publicChat.tool.modify') }}</h2>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
            @click="closeModifyModal"
          >
            <AIcon name="X" :size="18" />
          </button>
        </div>
        <p class="mt-2 text-xs text-ink-3">{{ t('publicChat.tool.modifyPrompt') }}</p>
        <div
          v-if="modifyError"
          class="mt-3 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ modifyError }}
        </div>
        <textarea
          v-model="modifyInput"
          class="field mt-3 h-48 resize-none font-mono text-[13px]"
          spellcheck="false"
        />
        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="closeModifyModal">{{ t('publicChat.tool.cancel') }}</AButton>
          <AButton variant="primary" @click="confirmModifyTool">{{ t('publicChat.tool.confirm') }}</AButton>
        </div>
      </div>
    </AModal>
  </div>
</template>
