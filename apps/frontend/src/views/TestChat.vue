<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { useRoute } from "vue-router";
import {
  messagingService,
  type ChatConversation,
  type ChatMessage,
} from "../services/messaging.service";
import { socketService } from "../services/socket.service";

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
});

onUnmounted(() => {
  socketService.offMessage(onNewMessage);
  socketService.offMessageChunk(onMessageChunk);
  socketService.offMessageUpdated(onMessageUpdated);
});

function renderMarkdown(content: string) {
  if (!content) return '';
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

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

function isToolMessage(msg: ChatMessage) {
  return msg.sender === 'tool'
    || msg.contentType === 'confirmation_request'
    || msg.contentType === 'tool_result'
    || msg.contentType === 'tool_call';
}

function confirmTool(msg: ChatMessage, action: 'confirm' | 'cancel') {
  if (!activeConversation.value || !msg.toolData?.executionId) return;
  socketService.confirmTool({
    conversationId: activeConversation.value._id,
    executionId: msg.toolData.executionId,
    action,
  });
}

function modifyTool(msg: ChatMessage) {
  if (!activeConversation.value || !msg.toolData?.executionId) return;
  const current = JSON.stringify(msg.toolData.params || {}, null, 0);
  const input = window.prompt('Edita los datos de la acción (JSON):', current);
  if (!input) return;
  try {
    const params = JSON.parse(input);
    socketService.confirmTool({
      conversationId: activeConversation.value._id,
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
  <div class="flex h-full bg-slate-100 p-8 gap-8 overflow-hidden">
    <!-- Config Panel -->
    <div
      class="w-1/3 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col"
    >
      <div class="p-4 border-b border-slate-100 bg-slate-50">
        <h2 class="font-bold text-slate-700">🧪 Test — Simulador de Cliente</h2>
        <p class="text-xs text-slate-500 mt-1">
          Simula un cliente que inicia una conversación. El contacto se crea
          automáticamente cuando el agente responde.
        </p>
      </div>
      <div class="p-4 flex flex-col gap-4">
        <div>
          <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre</label>
          <input
            v-model="clientName"
            class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Nombre del cliente"
          />
        </div>
        <div>
          <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Teléfono</label>
          <input
            v-model="clientPhone"
            class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="+1234567890"
          />
        </div>
        <div>
          <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Email</label>
          <input
            v-model="clientEmail"
            class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="cliente@email.com"
          />
        </div>
        <div>
          <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Plataforma</label>
          <div class="flex gap-2">
            <button
              v-for="p in ['WhatsApp', 'Instagram', 'Web'] as const"
              :key="p"
              @click="selectedPlatform = p"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                selectedPlatform === p
                  ? p === 'WhatsApp' ? 'bg-green-500 text-white' : p === 'Instagram' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              ]"
            >
              {{ p }}
            </button>
          </div>
        </div>

        <div v-if="activeConversation" class="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div class="text-xs font-bold text-blue-700 mb-1">Conversación Activa</div>
          <div class="text-xs text-blue-600">ID: {{ activeConversation._id }}</div>
          <div class="text-xs text-blue-600">
            Contacto creado: {{ activeConversation.isContactCreated ? '✅ Sí' : '⏳ Pendiente (responde desde el dashboard)' }}
          </div>
          <button
            @click="resetConversation"
            class="mt-2 px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200 transition-colors"
          >
            Resetear
          </button>
        </div>
      </div>
    </div>

    <!-- Chat Simulator -->
    <div
      class="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col relative"
    >
      <div
        class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold"
          >
            {{ clientName?.[0] || '?' }}
          </div>
          <div>
            <div class="font-bold text-slate-800">
              {{ clientName || 'Cliente Anónimo' }}
            </div>
            <div class="text-xs text-slate-500">
              {{ activeConversation ? `Conversación activa — ${selectedPlatform}` : 'Escribe para iniciar conversación' }}
            </div>
          </div>
        </div>
      </div>

      <div
        id="chat-container"
        class="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-100"
      >
        <div v-if="messages.length === 0" class="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Escribe un mensaje para iniciar una conversación como cliente
        </div>
        <template v-for="msg in messages" :key="msg._id">
          <div v-if="isToolMessage(msg)" class="w-full flex justify-center">
            <div
              class="max-w-[520px] w-full rounded-xl border p-3 shadow-sm text-sm"
              :class="msg.contentType === 'confirmation_request'
                ? 'bg-amber-50 border-amber-200'
                : (msg.toolData?.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200')"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {{ msg.contentType === 'confirmation_request' ? 'Confirmación requerida' : (msg.toolData?.toolName || 'Herramienta') }}
                </span>
                <span
                  v-if="msg.toolData?.status"
                  class="ml-auto text-[10px] font-bold uppercase"
                  :class="msg.toolData.status === 'success' ? 'text-emerald-600' : msg.toolData.status === 'error' ? 'text-red-600' : 'text-amber-600'"
                >
                  {{ msg.toolData.status }}
                </span>
              </div>
              <div v-html="renderMarkdown(msg.content)"></div>
              <div v-if="msg.contentType === 'confirmation_request' && msg.toolData?.status === 'needs_confirmation'" class="flex flex-wrap gap-2 mt-3">
                <button @click="confirmTool(msg, 'confirm')" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">Confirmar</button>
                <button @click="confirmTool(msg, 'cancel')" class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold bg-white hover:bg-slate-50">Cancelar</button>
                <button @click="modifyTool(msg)" class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold bg-white hover:bg-slate-50">Modificar</button>
              </div>
            </div>
          </div>
          <div
            v-else
            :class="[
              'max-w-[80%] p-3 rounded-xl text-sm shadow-sm',
              msg.sender === 'contact'
                ? 'bg-green-100 text-slate-800 self-end rounded-tr-none'
                : 'bg-white text-slate-800 self-start rounded-tl-none',
            ]"
          >
            <div class="font-bold text-[10px] mb-1 opacity-50">
              {{
                msg.sender === "contact"
                  ? "Tú (Cliente)"
                  : msg.sender === "ai_agent"
                    ? "Mitchbot (AI)"
                    : "Agente Humano"
              }}
            </div>
            <div v-if="!msg.content" class="flex items-center gap-1 h-5 mt-1">
              <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
              <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
              <div class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
            <div v-else v-html="renderMarkdown(msg.content)"></div>
          </div>
        </template>
      </div>

      <div class="p-4 border-t border-slate-100">
        <div class="flex gap-2">
          <input
            v-model="newMessage"
            @keydown.enter="handleSend"
            :placeholder="activeConversation ? 'Escribe un mensaje...' : 'Escribe tu primer mensaje para iniciar la conversación...'"
            class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            @click="handleSend"
            :disabled="!newMessage.trim() || isLoading || !isSlugReady"
            class="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white rounded-lg font-bold transition-colors"
          >
            {{ activeConversation ? 'Enviar' : 'Iniciar Chat' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
