<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  settingsService,
  type AgentData,
  type AgentPersonality,
  type ProviderConfig,
} from '../services/settings.service';
import { projectService, type Project } from '../services/project.service';

// ===================== TABS =====================
type TabId = 'agent' | 'info' | 'channels' | 'options';

const activeTab = ref<TabId>('agent');
const route = useRoute();

const { t } = useI18n();

const tabs = computed<{ id: TabId; name: string; icon: string }[]>(() => [
  { id: 'agent', name: t('settings.tabs.agent'), icon: 'smart_toy' },
  { id: 'info', name: t('settings.tabs.info'), icon: 'info' },
  { id: 'channels', name: t('settings.tabs.channels'), icon: 'language' },
  { id: 'options', name: t('settings.tabs.options'), icon: 'tune' },
]);

function isValidTab(tab: string): tab is TabId {
  return tabs.value.some(t => t.id === tab);
}

function syncTabFromRoute() {
  const tab = route.query.tab;
  if (typeof tab === 'string' && isValidTab(tab)) {
    activeTab.value = tab;
  }
}

// ===================== LOADING =====================
const loading = ref(true);
const saving = ref(false);
const saveSuccess = ref('');
const saveError = ref('');

// ===================== DATA =====================
const project = ref<Project | null>(null);
const projectSlugDraft = ref('');
const agent = ref<AgentData | null>(null);

// ===================== AGENT FORM =====================
const agentForm = ref({
  name: '',
  description: '',
  temperature: 0.5,
  maxTokens: 300,
  enableWelcomeGreeting: false,
  enableGoodbyeMessage: false,
  enableFallbackAdvisor: false,
  goodbyeKeywords: [
    'adios', 'adiós', 'hasta luego', 'hasta pronto', 'nos vemos',
    'chao', 'ciao', 'bye', 'goodbye',
  ] as string[],
  personality: {
    role: 'assistant' as AgentPersonality['role'],
    traits: ['neutro'] as string[],
    emojiUsage: 'medium' as AgentPersonality['emojiUsage'],
    language: 'es' as AgentPersonality['language'],
    responseLength: 'medium' as AgentPersonality['responseLength'],
    ragBehavior: 'hybrid' as AgentPersonality['ragBehavior'],
    fallbackMessage: 'Lo siento, no tengo información disponible sobre ese tema en este momento.',
    additionalInstructions: '',
  },
});

// ===================== PERSONALITY OPTIONS =====================
const roleOptions = computed(() => [
  { id: 'assistant', label: t('settings.agent.roles.assistant'), icon: 'support_agent', desc: t('settings.agent.roles.assistantDesc') },
  { id: 'teacher', label: t('settings.agent.roles.teacher'), icon: 'school', desc: t('settings.agent.roles.teacherDesc') },
  { id: 'seller', label: t('settings.agent.roles.seller'), icon: 'storefront', desc: t('settings.agent.roles.sellerDesc') },
  { id: 'support', label: t('settings.agent.roles.support'), icon: 'build', desc: t('settings.agent.roles.supportDesc') },
  { id: 'customer_service', label: t('settings.agent.roles.customerService'), icon: 'headset_mic', desc: t('settings.agent.roles.customerServiceDesc') },
]);

const traitOptions = computed(() => [
  { value: 'Formal', label: t('settings.agent.traits.formal') },
  { value: 'Empático', label: t('settings.agent.traits.empathetic') },
  { value: 'Irreverente', label: t('settings.agent.traits.irreverent') },
  { value: 'Directo', label: t('settings.agent.traits.direct') },
  { value: 'Objetivo', label: t('settings.agent.traits.objective') },
  { value: 'Entusiasta', label: t('settings.agent.traits.enthusiastic') },
  { value: 'Sarcástico', label: t('settings.agent.traits.sarcastic') },
  { value: 'Sociable', label: t('settings.agent.traits.sociable') },
  { value: 'Amable', label: t('settings.agent.traits.kind') },
  { value: 'Alegre', label: t('settings.agent.traits.cheerful') },
  { value: 'Neutro', label: t('settings.agent.traits.neutral') },
]);

const emojiOptions = computed(() => [
  { id: 'low', label: t('settings.agent.emoji.low'), icon: '😐' },
  { id: 'medium', label: t('settings.agent.emoji.medium'), icon: '🙂' },
  { id: 'high', label: t('settings.agent.emoji.high'), icon: '😄' },
]);

const languageOptions = computed(() => [
  { id: 'es', label: t('common.spanish'), flag: '🇪🇸' },
  { id: 'en', label: t('common.english'), flag: '🇺🇸' },
]);

const responseLengthOptions = computed(() => [
  { id: 'short', label: t('settings.agent.responseLength.short'), desc: t('settings.agent.responseLength.shortDesc') },
  { id: 'medium', label: t('settings.agent.responseLength.medium'), desc: t('settings.agent.responseLength.mediumDesc') },
  { id: 'detailed', label: t('settings.agent.responseLength.detailed'), desc: t('settings.agent.responseLength.detailedDesc') },
]);

const maxTokenOptions = computed(() => [
  { label: t('settings.agent.maxTokensOption.veryShort'), value: 150 },
  { label: t('settings.agent.maxTokensOption.medium'), value: 300 },
  { label: t('settings.agent.maxTokensOption.long'), value: 800 },
  { label: t('settings.agent.maxTokensOption.max'), value: 2048 },
]);

const maxTokensLabel = computed(() => {
  const current = agentForm.value.maxTokens;
  const found = maxTokenOptions.value.find(option => option.value === current);
  return found?.label || `${current}`;
});

const maxTokensIndex = computed(() => {
  const index = maxTokenOptions.value.findIndex(option => option.value === agentForm.value.maxTokens);
  return index >= 0 ? index : 1;
});

const goodbyeKeywordInput = ref('');

function addGoodbyeKeyword() {
  const value = goodbyeKeywordInput.value.trim();
  if (!value) return;
  if (!agentForm.value.goodbyeKeywords.includes(value)) {
    agentForm.value.goodbyeKeywords.push(value);
  }
  goodbyeKeywordInput.value = '';
}

function removeGoodbyeKeyword(keyword: string) {
  agentForm.value.goodbyeKeywords = agentForm.value.goodbyeKeywords.filter(k => k !== keyword);
}

const ragOptions = computed(() => [
  { id: 'strict', label: t('settings.agent.rag.strict'), desc: t('settings.agent.rag.strictDesc'), icon: 'lock' },
  { id: 'hybrid', label: t('settings.agent.rag.hybrid'), desc: t('settings.agent.rag.hybridDesc'), icon: 'tune' },
  { id: 'general', label: t('settings.agent.rag.general'), desc: t('settings.agent.rag.generalDesc'), icon: 'public' },
]);

function toggleTrait(trait: string) {
  const normalized = trait.toLowerCase();
  const idx = agentForm.value.personality.traits.indexOf(normalized);
  if (idx >= 0) {
    agentForm.value.personality.traits.splice(idx, 1);
  } else if (agentForm.value.personality.traits.length < 3) {
    agentForm.value.personality.traits.push(normalized);
  }
}

function isTraitSelected(trait: string) {
  return agentForm.value.personality.traits.includes(trait.toLowerCase());
}

const temperatureLabel = computed(() => {
  const value = agentForm.value.temperature;
  if (value <= 0.2) return t('settings.agent.temperatureLevels.veryLow');
  if (value <= 0.4) return t('settings.agent.temperatureLevels.low');
  if (value <= 0.6) return t('settings.agent.temperatureLevels.medium');
  if (value <= 0.8) return t('settings.agent.temperatureLevels.high');
  return t('settings.agent.temperatureLevels.veryHigh');
});

const showTemperatureWarning = computed(() => agentForm.value.temperature > 0.6);

// ===================== CHANNELS =====================
const channels = ref([
  { key: 'whatsapp', name: 'WhatsApp', icon: 'call', color: 'green', enabled: true },
  { key: 'instagram', name: 'Instagram', icon: 'photo_camera', color: 'purple', enabled: false },
  { key: 'web', name: 'Web', icon: 'language', color: 'blue', enabled: true },
]);


// ===================== OPTIONS =====================
const optionsForm = ref({ autoCreateContact: true });

// ===================== MODELOS (SOLO LECTURA) =====================
const resolvedModels = ref<{ llm: ProviderConfig | null; embedding: ProviderConfig | null; ocr: ProviderConfig | null }>({
  llm: null,
  embedding: null,
  ocr: null,
});

// ===================== LOAD DATA =====================
onMounted(async () => {
  loading.value = true;
  try {
    syncTabFromRoute();
    const [projectData, agents, llmProvider, embeddingProvider, ocrProvider] = await Promise.all([
      projectService.getProject(),
      settingsService.getAgents(),
      settingsService.getActiveProvider('llm').catch(() => null),
      settingsService.getActiveProvider('embedding').catch(() => null),
      settingsService.getActiveProvider('ocr').catch(() => null),
    ]);

    resolvedModels.value = { llm: llmProvider, embedding: embeddingProvider, ocr: ocrProvider };

    // Project
    if (projectData) {
      project.value = projectData;
      projectSlugDraft.value = projectData.slug || '';
      if (projectData.config?.channels) {
        channels.value[0].enabled = projectData.config.channels.whatsapp ?? true;
        channels.value[1].enabled = projectData.config.channels.instagram ?? false;
        channels.value[2].enabled = projectData.config.channels.web ?? true;
      }
      if (projectData.config?.options) {
        optionsForm.value.autoCreateContact = projectData.config.options.autoCreateContact ?? true;
      }
    }

    // Agent
    if (agents.length > 0) {
      applyAgent(agents[0]);
    }

  } catch (err: any) {
    console.error('Error loading settings:', err);
    saveError.value = t('settings.errors.loadConfig');
  } finally {
    loading.value = false;
  }
});

watch(
  () => route.query.tab,
  () => {
    syncTabFromRoute();
  }
);


// ===================== HELPERS =====================
function showSuccessMsg(msg: string) {
  saveSuccess.value = msg;
  saveError.value = '';
  setTimeout(() => { saveSuccess.value = ''; }, 3000);
}
function showErrorMsg(msg: string) {
  saveError.value = msg;
  saveSuccess.value = '';
}

async function handleSaveProjectSlug() {
  if (!project.value?._id) return showErrorMsg(t('settings.errors.projectNotFound'));
  if (!projectSlugDraft.value.trim()) return showErrorMsg(t('settings.errors.slugRequired'));
  saving.value = true;
  try {
    const updated = await projectService.updateProject({
      slug: projectSlugDraft.value.trim(),
    } as any);
    project.value = updated;
    projectSlugDraft.value = updated.slug || projectSlugDraft.value.trim();
    showSuccessMsg(t('settings.toasts.slugUpdated'));
  } catch (err: any) {
    showErrorMsg(err.message || t('settings.errors.slugUpdate'));
  } finally {
    saving.value = false;
  }
}

async function copyTestChatLink() {
  if (!projectSlugDraft.value.trim()) return showErrorMsg(t('settings.errors.slugRequired'));
  const link = `${window.location.origin}/test-chat/${projectSlugDraft.value.trim()}`;
  try {
    await navigator.clipboard.writeText(link);
    showSuccessMsg(t('settings.toasts.linkCopied'));
  } catch {
    showErrorMsg(t('settings.errors.copyLink'));
  }
}

async function handleSaveAgent() {
  if (!agent.value?._id) return showErrorMsg(t('settings.errors.agentNotFound'));
  saving.value = true;
  try {
    await settingsService.updateAgent(agent.value._id, {
      name: agentForm.value.name,
      description: agentForm.value.description,
      personality: agentForm.value.personality,
      config: {
        temperature: agentForm.value.temperature,
        maxTokens: agentForm.value.maxTokens,
        enableWelcomeGreeting: agentForm.value.enableWelcomeGreeting,
        enableGoodbyeMessage: agentForm.value.enableGoodbyeMessage,
        enableFallbackAdvisor: agentForm.value.enableFallbackAdvisor,
        goodbyeKeywords: agentForm.value.goodbyeKeywords,
      },
    } as any);
    showSuccessMsg(t('settings.toasts.agentUpdated'));
  } catch (err: any) {
    showErrorMsg(err.message || t('settings.errors.agentSave'));
  } finally {
    saving.value = false;
  }
}

function applyAgent(data: AgentData) {
  agent.value = data;
  const p = data.personality;
  agentForm.value = {
    name: data.name || '',
    description: data.description || '',
    temperature: data.config?.temperature ?? 0.5,
    maxTokens: data.config?.maxTokens ?? 300,
    enableWelcomeGreeting: data.config?.enableWelcomeGreeting ?? false,
    enableGoodbyeMessage: data.config?.enableGoodbyeMessage ?? false,
    enableFallbackAdvisor: data.config?.enableFallbackAdvisor ?? false,
    goodbyeKeywords: data.config?.goodbyeKeywords || [],
    personality: {
      role: p?.role || 'assistant',
      traits: p?.traits || ['neutro'],
      emojiUsage: p?.emojiUsage || 'medium',
      language: p?.language || 'es',
      responseLength: p?.responseLength || 'medium',
      ragBehavior: p?.ragBehavior || 'hybrid',
      fallbackMessage: p?.fallbackMessage || 'Lo siento, no tengo información disponible sobre ese tema en este momento.',
      additionalInstructions: p?.additionalInstructions || '',
    },
  };
}

// ===================== CHANNELS =====================
async function handleSaveChannels() {
  if (!project.value?._id) return showErrorMsg(t('settings.errors.projectNotFound'));
  saving.value = true;
  try {
    await projectService.updateProject({
      config: {
        ...project.value.config,
        channels: {
          whatsapp: channels.value[0].enabled,
          instagram: channels.value[1].enabled,
          web: channels.value[2].enabled,
        },
      },
    });
    showSuccessMsg(t('settings.toasts.channelsUpdated'));
  } catch (err: any) {
    showErrorMsg(err.message);
  } finally {
    saving.value = false;
  }
}


// ===================== OPTIONS =====================
async function handleSaveOptions() {
  if (!project.value?._id) return showErrorMsg(t('settings.errors.projectNotFound'));
  saving.value = true;
  try {
    await projectService.updateProject({
      config: {
        ...project.value.config,
        options: optionsForm.value,
      },
    });
    showSuccessMsg(t('settings.toasts.optionsUpdated'));
  } catch (err: any) {
    showErrorMsg(err.message);
  } finally {
    saving.value = false;
  }
}

// ===================== UTILS =====================
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('settings.title') }}</h1>
      <p class="text-sm text-slate-500 mt-1">{{ t('settings.subtitle') }}</p>
    </div>

    <!-- Global feedback -->
    <div v-if="saveSuccess" class="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2 max-w-3xl">
      <span class="material-symbols-outlined text-[18px]">check_circle</span>
      {{ saveSuccess }}
    </div>
    <div v-if="saveError" class="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2 max-w-3xl">
      <span class="material-symbols-outlined text-[18px]">error</span>
      {{ saveError }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center p-12">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-slate-500">{{ t('common.loading') }}</span>
      </div>
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
        <button
          v-for="tab in tabs" :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
          :class="activeTab === tab.id
            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'"
        >
          <span class="material-symbols-outlined text-[18px]">{{ tab.icon }}</span>
          {{ tab.name }}
        </button>
      </div>

      <!-- ============== TAB: INFORMACION ============== -->
      <div v-if="activeTab === 'info'" class="max-w-3xl">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">info</span>
            {{ t('settings.info.title') }}
          </h2>
          <p class="text-xs text-slate-400 mb-6">{{ t('settings.info.subtitle') }}</p>

          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest">{{ t('settings.info.slugLabel') }}</h3>
              <p class="text-xs text-slate-400 mt-1">{{ t('settings.info.slugHint') }}</p>
            </div>
            <div class="text-[10px] text-slate-400">/test-chat/<span class="font-mono">{{ project?.slug || t('settings.info.slugFallback') }}</span></div>
          </div>

          <div class="flex items-center gap-3">
            <input
              v-model="projectSlugDraft"
              class="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
              :placeholder="t('settings.info.slugPlaceholder')"
            />
            <button
              @click="handleSaveProjectSlug"
              :disabled="saving"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm"
            >
              {{ t('common.save') }}
            </button>
            <button
              @click="copyTestChatLink"
              :disabled="saving || !projectSlugDraft.trim()"
              class="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-all"
            >
              {{ t('settings.info.copyLink') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============== TAB: AGENTE IA ============== -->
      <div v-if="activeTab === 'agent'" class="max-w-3xl">
        <div class="flex flex-col gap-6">

          <!-- Card: Info básica -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">smart_toy</span>
              {{ t('settings.agent.basicTitle') }}
            </h2>
            <div class="flex flex-col gap-4">
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.nameLabel') }}</label>
                <input v-model="agentForm.name" :placeholder="t('settings.agent.namePlaceholder')" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white" />
              </div>
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.descriptionLabel') }}</label>
                <textarea v-model="agentForm.description" :placeholder="t('settings.agent.descriptionPlaceholder')" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"></textarea>
              </div>
            </div>
          </div>

          <!-- Card: Modelos de IA (solo lectura) -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">memory</span>
              {{ t('settings.agent.modelsTitle') }}
            </h2>
            <p class="text-xs text-slate-400 mb-5">{{ t('settings.agent.modelsHint') }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-1">{{ t('settings.agent.modelChat') }}</span>
                <span class="text-sm font-mono text-slate-700 dark:text-slate-200 break-all">{{ resolvedModels.llm?.selectedModel || t('settings.agent.notConfigured') }}</span>
              </div>
              <div class="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-1">{{ t('settings.agent.modelEmbeddings') }}</span>
                <span class="text-sm font-mono text-slate-700 dark:text-slate-200 break-all">{{ resolvedModels.embedding?.selectedModel || t('settings.agent.notConfigured') }}</span>
              </div>
              <div class="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-1">{{ t('settings.agent.modelOcr') }}</span>
                <span class="text-sm font-mono text-slate-700 dark:text-slate-200 break-all">{{ resolvedModels.ocr?.selectedModel || t('settings.agent.notConfigured') }}</span>
              </div>
            </div>
          </div>

          <!-- Card: Personalidad -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">psychology</span>
              {{ t('settings.agent.personalityTitle') }}
            </h2>
            <p class="text-xs text-slate-400 mb-5">{{ t('settings.agent.personalityHint') }}</p>

            <div class="flex flex-col gap-6">
              <!-- ROL -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">{{ t('settings.agent.roleLabel') }}</label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    v-for="r in roleOptions" :key="r.id"
                    @click="agentForm.personality.role = r.id as AgentPersonality['role']"
                    class="flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
                    :class="agentForm.personality.role === r.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'"
                  >
                    <span class="material-symbols-outlined text-[20px] mb-1" :class="agentForm.personality.role === r.id ? 'text-blue-600' : 'text-slate-400'">{{ r.icon }}</span>
                    <span class="text-sm font-medium" :class="agentForm.personality.role === r.id ? 'text-blue-700' : 'text-slate-700 dark:text-white'">{{ r.label }}</span>
                    <span class="text-[10px] text-slate-400">{{ r.desc }}</span>
                  </button>
                </div>
              </div>

              <!-- RASGOS -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.traitsLabel') }} <span class="text-slate-400 font-normal">{{ t('settings.agent.traitsMax') }}</span></label>
                <p class="text-[10px] text-slate-400 mb-2">{{ t('settings.agent.traitsHint') }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="trait in traitOptions" :key="trait.value"
                    @click="toggleTrait(trait.value)"
                    class="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                    :class="isTraitSelected(trait.value)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : agentForm.personality.traits.length >= 3
                        ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'"
                  >
                    {{ trait.label }}
                  </button>
                </div>
              </div>

              <!-- EMOJIS -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">{{ t('settings.agent.emojiLabel') }}</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="e in emojiOptions" :key="e.id"
                    @click="agentForm.personality.emojiUsage = e.id as AgentPersonality['emojiUsage']"
                    class="flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all"
                    :class="agentForm.personality.emojiUsage === e.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'"
                  >
                    <span>{{ e.icon }}</span> {{ e.label }}
                  </button>
                </div>
              </div>

              <!-- IDIOMA -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">{{ t('common.language') }}</label>
                <div class="grid grid-cols-4 gap-2">
                  <button
                    v-for="l in languageOptions" :key="l.id"
                    @click="agentForm.personality.language = l.id as AgentPersonality['language']"
                    class="flex items-center justify-center gap-1.5 p-3 rounded-lg border-2 text-sm font-medium transition-all"
                    :class="agentForm.personality.language === l.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'"
                  >
                    <span>{{ l.flag }}</span> {{ l.label }}
                  </button>
                </div>
              </div>

              <!-- LONGITUD -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">{{ t('settings.agent.responseLengthLabel') }}</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="rl in responseLengthOptions" :key="rl.id"
                    @click="agentForm.personality.responseLength = rl.id as AgentPersonality['responseLength']"
                    class="flex flex-col items-center p-3 rounded-lg border-2 transition-all"
                    :class="agentForm.personality.responseLength === rl.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'"
                  >
                    <span class="text-sm font-medium" :class="agentForm.personality.responseLength === rl.id ? 'text-blue-700' : 'text-slate-700'">{{ rl.label }}</span>
                    <span class="text-[10px] text-slate-400">{{ rl.desc }}</span>
                  </button>
                </div>
              </div>

              <!-- COMPORTAMIENTO RAG -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">{{ t('settings.agent.ragBehaviorLabel') }}</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="rg in ragOptions" :key="rg.id"
                    @click="agentForm.personality.ragBehavior = rg.id as AgentPersonality['ragBehavior']"
                    class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all"
                    :class="agentForm.personality.ragBehavior === rg.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'"
                  >
                    <span class="material-symbols-outlined text-[20px]" :class="agentForm.personality.ragBehavior === rg.id ? 'text-blue-600' : 'text-slate-400'">{{ rg.icon }}</span>
                    <span class="text-sm font-medium" :class="agentForm.personality.ragBehavior === rg.id ? 'text-blue-700' : 'text-slate-700'">{{ rg.label }}</span>
                    <span class="text-[10px] text-slate-400 text-center">{{ rg.desc }}</span>
                  </button>
                </div>
              </div>

              <!-- TEMPERATURA -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.temperatureLabel', { level: temperatureLabel, value: agentForm.temperature }) }}</label>
                <input v-model.number="agentForm.temperature" type="range" min="0" max="1" step="0.1" class="w-full accent-blue-600" />
                <div class="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>🎯 {{ t('settings.agent.temperaturePrecise') }}</span>
                  <span>🎨 {{ t('settings.agent.temperatureCreative') }}</span>
                </div>
                <div v-if="showTemperatureWarning" class="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">warning</span>
                  {{ t('settings.agent.temperatureWarning') }}
                </div>
              </div>

              <!-- MAX TOKENS -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.maxTokensLabel', { level: maxTokensLabel, value: agentForm.maxTokens }) }}</label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  class="w-full accent-blue-600"
                  :value="maxTokensIndex"
                  @input="agentForm.maxTokens = maxTokenOptions[Number(($event.target as HTMLInputElement).value)]?.value || 300"
                />
                <div class="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{{ t('settings.agent.maxTokensOption.veryShort') }}</span>
                  <span>{{ t('settings.agent.maxTokensOption.medium') }}</span>
                  <span>{{ t('settings.agent.maxTokensOption.long') }}</span>
                  <span>{{ t('settings.agent.maxTokensOption.max') }}</span>
                </div>
              </div>

              <!-- MENSAJES AUTOMÁTICOS -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-3 block">{{ t('settings.agent.autoMessagesTitle') }}</label>
                <div class="flex flex-col gap-3">
                  <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div>
                      <span class="text-sm font-medium text-slate-800 dark:text-white">{{ t('settings.agent.welcome') }}</span>
                      <p class="text-xs text-slate-400 mt-0.5">{{ t('settings.agent.welcomeHint') }}</p>
                    </div>
                    <input type="checkbox" v-model="agentForm.enableWelcomeGreeting" class="h-4 w-4 accent-blue-600" />
                  </label>
                  <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div>
                      <span class="text-sm font-medium text-slate-800 dark:text-white">{{ t('settings.agent.goodbye') }}</span>
                      <p class="text-xs text-slate-400 mt-0.5">{{ t('settings.agent.goodbyeHint') }}</p>
                    </div>
                    <input type="checkbox" v-model="agentForm.enableGoodbyeMessage" class="h-4 w-4 accent-blue-600" />
                  </label>
                  <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div>
                      <span class="text-sm font-medium text-slate-800 dark:text-white">{{ t('settings.agent.fallbackAdvisor') }}</span>
                      <p class="text-xs text-slate-400 mt-0.5">{{ t('settings.agent.fallbackAdvisorHint') }}</p>
                    </div>
                    <input type="checkbox" v-model="agentForm.enableFallbackAdvisor" class="h-4 w-4 accent-blue-600" />
                  </label>
                </div>
                <div class="mt-4">
                  <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.goodbyeKeywordsLabel') }}</label>
                  <div class="flex flex-wrap gap-2 mb-2">
                    <span v-for="keyword in agentForm.goodbyeKeywords" :key="keyword" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
                      {{ keyword }}
                      <button type="button" class="text-slate-400 hover:text-slate-600" @click="removeGoodbyeKeyword(keyword)">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  </div>
                  <div class="flex gap-2">
                    <input
                      v-model="goodbyeKeywordInput"
                      @keydown.enter.prevent="addGoodbyeKeyword"
                      :placeholder="t('settings.agent.goodbyeKeywordPlaceholder')"
                      class="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
                    />
                    <button type="button" class="px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg" @click="addGoodbyeKeyword">
                      {{ t('common.add') }}
                    </button>
                  </div>
                  <p class="text-[10px] text-slate-400 mt-1">{{ t('settings.agent.goodbyeKeywordsHint') }}</p>
                </div>
              </div>

              <!-- INSTRUCCIONES ADICIONALES -->
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('settings.agent.additionalInstructionsLabel') }} <span class="text-slate-400 font-normal">({{ t('common.optional') }})</span></label>
                <textarea v-model="agentForm.personality.additionalInstructions" :placeholder="t('settings.agent.additionalInstructionsPlaceholder')" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"></textarea>
              </div>
            </div>
          </div>

          <!-- Guardar -->
          <div class="flex justify-end">
            <button @click="handleSaveAgent" :disabled="saving" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm">
              {{ saving ? t('common.saving') : t('settings.agent.save') }}
            </button>
          </div>

        </div>
      </div>

      <!-- ============== TAB: CANALES ============== -->
      <div v-if="activeTab === 'channels'" class="max-w-2xl">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">language</span>
            {{ t('settings.channels.title') }}
          </h2>
          <div class="flex flex-col gap-4">
            <div v-for="channel in channels" :key="channel.key" class="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-700">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-[20px] text-slate-500">{{ channel.icon }}</span>
                <span class="text-sm font-medium text-slate-800 dark:text-white">{{ channel.name }}</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="channel.enabled" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          <div class="flex justify-end pt-4">
            <button @click="handleSaveChannels" :disabled="saving" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm">
              {{ saving ? t('common.saving') : t('settings.channels.save') }}
            </button>
          </div>
        </div>
      </div>


      <!-- ============== TAB: OPCIONES ============== -->
      <div v-if="activeTab === 'options'" class="max-w-2xl">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">tune</span>
            {{ t('settings.options.title') }}
          </h2>
          <div class="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-700">
            <div>
              <span class="text-sm font-medium text-slate-800 dark:text-white">{{ t('settings.options.autoCreateContact') }}</span>
              <p class="text-xs text-slate-400 mt-0.5">{{ t('settings.options.autoCreateContactHint') }}</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="optionsForm.autoCreateContact" class="sr-only peer">
              <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div class="flex justify-end pt-4">
            <button @click="handleSaveOptions" :disabled="saving" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm">
              {{ saving ? t('common.saving') : t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
