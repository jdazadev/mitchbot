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
import { useBrand, applyBrand } from '../composables/useBrand';
import AIcon from '../components/ui/AIcon.vue';
import AButton from '../components/ui/AButton.vue';
import APill from '../components/ui/APill.vue';
import ASwitch from '../components/ui/ASwitch.vue';
import ATabs from '../components/ui/ATabs.vue';

// ===================== TABS =====================
type TabId = 'agent' | 'info' | 'channels' | 'options';

const activeTab = ref<TabId>('agent');
const route = useRoute();

const { t } = useI18n();

const tabs = computed<{ id: TabId; name: string; icon: string }[]>(() => [
  { id: 'agent', name: t('settings.tabs.agent'), icon: 'Robot' },
  { id: 'info', name: t('settings.tabs.info'), icon: 'Info' },
  { id: 'channels', name: t('settings.tabs.channels'), icon: 'Globe' },
  { id: 'options', name: t('settings.tabs.options'), icon: 'SlidersHorizontal' },
]);

const tabItems = computed(() => tabs.value.map((tab) => ({ key: tab.id, label: tab.name })));

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

// ===================== AGENT SECTION (divulgación progresiva) =====================
type AgentSectionId = 'identity' | 'voice' | 'knowledge' | 'generation' | 'messages' | 'instructions';

const expandedSections = ref<Record<AgentSectionId, boolean>>({
  identity: true,
  voice: true,
  knowledge: false,
  generation: false,
  messages: false,
  instructions: false,
});

function toggleSection(id: AgentSectionId) {
  expandedSections.value[id] = !expandedSections.value[id];
}

// ===================== PERSONALITY OPTIONS =====================
const roleOptions = computed(() => [
  { id: 'assistant', label: t('settings.agent.roles.assistant'), icon: 'Headset', desc: t('settings.agent.roles.assistantDesc') },
  { id: 'teacher', label: t('settings.agent.roles.teacher'), icon: 'GraduationCap', desc: t('settings.agent.roles.teacherDesc') },
  { id: 'seller', label: t('settings.agent.roles.seller'), icon: 'Storefront', desc: t('settings.agent.roles.sellerDesc') },
  { id: 'support', label: t('settings.agent.roles.support'), icon: 'Wrench', desc: t('settings.agent.roles.supportDesc') },
  { id: 'customer_service', label: t('settings.agent.roles.customerService'), icon: 'Headphones', desc: t('settings.agent.roles.customerServiceDesc') },
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

/** Snapshot serializado del agente cargado/guardado, para detectar cambios sin guardar. */
const savedAgentJson = ref('');

const isAgentDirty = computed(() => {
  if (!agent.value?._id) return false;
  return JSON.stringify(agentForm.value) !== savedAgentJson.value;
});

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
  { id: 'strict', label: t('settings.agent.rag.strict'), desc: t('settings.agent.rag.strictDesc'), icon: 'Lock' },
  { id: 'hybrid', label: t('settings.agent.rag.hybrid'), desc: t('settings.agent.rag.hybridDesc'), icon: 'SlidersHorizontal' },
  { id: 'general', label: t('settings.agent.rag.general'), desc: t('settings.agent.rag.generalDesc'), icon: 'Globe' },
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
  { key: 'whatsapp', name: 'WhatsApp', icon: 'Phone', enabled: true },
  { key: 'instagram', name: 'Instagram', icon: 'Image', enabled: false },
  { key: 'web', name: 'Web', icon: 'Globe', enabled: true },
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
  const brandColor = projectData?.config?.brand?.color;
  brandForm.value = {
    color: brandColor || '#E2C6FF',
    name: projectData.name || '',
    logo: projectData.config?.brand?.logo || projectData.logo || null,
  };
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
    savedAgentJson.value = JSON.stringify(agentForm.value);
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
  savedAgentJson.value = JSON.stringify(agentForm.value);
}

// ===================== IDENTIDAD DEL PROYECTO =====================
const brandForm = ref<{ color: string; name: string; logo: string | null }>({
  color: '#E2C6FF',
  name: '',
  logo: null,
});
const brandSwatches = ['#E2C6FF', '#DCFEBC', '#BBECFF', '#F1EE83', '#7B2FF2', '#1F8A60', '#0E7490', '#0B0B0C'];

const brandLogoInput = ref<HTMLInputElement | null>(null);

function pickBrandLogo() {
  brandLogoInput.value?.click();
}

function onBrandLogoChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 150_000) {
    showErrorMsg(t('settings.brand.logoTooBig'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    brandForm.value.logo = String(reader.result);
  };
  reader.readAsDataURL(file);
}

async function handleSaveBrand() {
  if (!project.value?._id) return showErrorMsg(t('settings.errors.projectNotFound'));
  saving.value = true;
  try {
    const updated = await projectService.updateProject({
      name: brandForm.value.name.trim() || project.value.name,
      logo: brandForm.value.logo || undefined,
      config: {
        ...project.value.config,
        brand: {
          color: brandForm.value.color,
          logo: brandForm.value.logo || '',
        },
      },
    });
    project.value = updated;
    applyBrand({
      name: updated.name || null,
      color: updated.config?.brand?.color || brandForm.value.color,
      logo: updated.config?.brand?.logo || updated.logo || null,
    });
    showSuccessMsg(t('settings.brand.saved'));
  } catch (err: any) {
    showErrorMsg(err.message || t('settings.brand.error'));
  } finally {
    saving.value = false;
  }
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
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3.5">
    <p class="text-[13px] text-ink-3">{{ t('settings.subtitle') }}</p>

    <div v-if="saveSuccess" class="flex items-center gap-2 rounded-card bg-lime-soft p-3.5 text-[13px] text-lime-ink">
      <AIcon name="CheckCircle" :size="17" />
      {{ saveSuccess }}
    </div>
    <div v-if="saveError" class="flex items-center gap-2 rounded-card bg-[color:var(--danger-soft)] p-3.5 text-[13px] text-[color:var(--danger)]">
      <AIcon name="WarningCircle" :size="17" />
      {{ saveError }}
    </div>

    <div v-if="loading" class="flex items-center justify-center gap-3 py-12 text-sm text-ink-3">
      <span class="animate-spin"><AIcon name="SpinnerGap" :size="20" /></span>
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <ATabs :tabs="tabItems" :model-value="activeTab" @update:model-value="activeTab = $event as TabId" />

      <!-- ============== TAB: INFORMACIÓN ============== -->
      <div v-if="activeTab === 'info'">
        <div class="rounded-card bg-surface p-6 shadow-card">
          <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.info.title') }}</h2>
          <p class="mt-1 text-xs text-ink-3">{{ t('settings.info.subtitle') }}</p>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-xs font-semibold text-ink-2">{{ t('settings.info.slugLabel') }}</h3>
              <p class="mt-1 text-xs text-ink-3">{{ t('settings.info.slugHint') }}</p>
            </div>
            <span class="text-[11px] text-ink-3">/test-chat/<b class="font-mono">{{ project?.slug || t('settings.info.slugFallback') }}</b></span>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2.5">
            <input v-model="projectSlugDraft" class="field flex-1" :placeholder="t('settings.info.slugPlaceholder')" />
            <AButton variant="primary" :loading="saving" @click="handleSaveProjectSlug">{{ t('common.save') }}</AButton>
            <AButton variant="ghost" :disabled="saving || !projectSlugDraft.trim()" @click="copyTestChatLink">
              {{ t('settings.info.copyLink') }}
            </AButton>
          </div>

          <div class="my-6 h-px bg-line" />

          <h3 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.brand.title') }}</h3>
          <p class="mt-1 text-xs text-ink-3">{{ t('settings.brand.subtitle') }}</p>

          <div class="mt-5 flex flex-col gap-5">
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('settings.brand.nameLabel') }}</span>
              <input v-model="brandForm.name" class="field" data-testid="brand-name" :placeholder="t('settings.brand.namePlaceholder')" />
            </label>

            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('settings.brand.colorLabel') }}</span>
              <div class="flex flex-wrap items-center gap-3">
                <label
                  class="relative h-11 w-11 cursor-pointer overflow-hidden rounded-field shadow-card"
                  :style="{ background: brandForm.color }"
                  :aria-label="t('settings.brand.colorLabel')"
                >
                  <input v-model="brandForm.color" type="color" class="absolute inset-0 cursor-pointer opacity-0" data-testid="brand-color" />
                </label>
                <input v-model="brandForm.color" class="field w-32 font-mono uppercase" maxlength="7" data-testid="brand-color-hex" />
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="swatch in brandSwatches"
                    :key="swatch"
                    type="button"
                    class="h-7 w-7 rounded-[9px] transition-transform hover:scale-110"
                    :class="brandForm.color.toLowerCase() === swatch ? 'ring-2 ring-offset-2 ring-ink' : ''"
                    :style="{ background: swatch }"
                    :aria-label="`Color ${swatch}`"
                    @click="brandForm.color = swatch"
                  />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('settings.brand.logoLabel') }}</span>
              <div class="flex flex-wrap items-center gap-4">
                <div
                  class="grid h-16 w-16 place-items-center overflow-hidden rounded-[16px]"
                  :style="brandForm.logo ? { background: 'var(--surface)' } : { background: brandForm.color }"
                >
                  <img v-if="brandForm.logo" :src="brandForm.logo" alt="" class="h-full w-full object-cover" />
                  <span v-else class="text-lg font-bold" :style="{ color: 'var(--brand-contrast)' }">
                    {{ (brandForm.name || 'M').charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <AButton variant="ghost" size="sm" icon="UploadSimple" @click="pickBrandLogo">
                      {{ t('settings.brand.uploadLogo') }}
                    </AButton>
                    <button
                      v-if="brandForm.logo"
                      type="button"
                      class="text-xs font-semibold text-[color:var(--danger)]"
                      @click="brandForm.logo = null"
                    >
                      {{ t('settings.brand.removeLogo') }}
                    </button>
                  </div>
                  <p class="text-[11px] text-ink-3">{{ t('settings.brand.logoHint') }}</p>
                </div>
                <input
                  ref="brandLogoInput"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  class="hidden"
                  @change="onBrandLogoChange"
                />
              </div>
            </div>

            <AButton variant="primary" class="self-start" :loading="saving" data-testid="brand-save" @click="handleSaveBrand">
              {{ t('common.save') }}
            </AButton>
          </div>
        </div>
      </div>

      <!-- ============== TAB: AGENTE IA ============== -->
      <div v-if="activeTab === 'agent'">
        <div class="flex flex-col gap-3.5">
          <!-- Modelos (solo lectura) -->
          <div class="rounded-card bg-surface p-6 shadow-card">
            <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.modelsTitle') }}</h2>
            <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.modelsHint') }}</p>
            <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div
                v-for="m in [
                  { label: t('settings.agent.modelChat'), value: resolvedModels.llm?.selectedModel },
                  { label: t('settings.agent.modelEmbeddings'), value: resolvedModels.embedding?.selectedModel },
                  { label: t('settings.agent.modelOcr'), value: resolvedModels.ocr?.selectedModel },
                ]"
                :key="m.label"
                class="rounded-field bg-canvas p-3.5"
              >
                <span class="text-[10px] font-bold uppercase text-ink-3">{{ m.label }}</span>
                <div class="mt-1 break-all font-mono text-[13px] text-ink-2">
                  {{ m.value || t('settings.agent.notConfigured') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Identidad -->
          <section class="rounded-card bg-surface shadow-card">
            <div class="flex items-center gap-3 p-6">
              <div class="min-w-0 flex-1">
                <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.section.identity') }}</h2>
                <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.section.identityHint') }}</p>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas hover:text-ink"
                :aria-label="t('settings.agent.section.identity')"
                :aria-expanded="expandedSections.identity"
                aria-controls="agent-section-identity"
                @click="toggleSection('identity')"
              >
                <AIcon :name="expandedSections.identity ? 'CaretUpDown' : 'CaretDown'" :size="16" />
              </button>
            </div>
            <div v-show="expandedSections.identity" id="agent-section-identity" class="px-6 pb-6">
              <div class="flex flex-col gap-4">
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-semibold text-ink-2">{{ t('settings.agent.nameLabel') }}</span>
                  <input v-model="agentForm.name" class="field" :placeholder="t('settings.agent.namePlaceholder')" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-semibold text-ink-2">{{ t('settings.agent.descriptionLabel') }}</span>
                  <textarea v-model="agentForm.description" class="field h-20 resize-none" :placeholder="t('settings.agent.descriptionPlaceholder')" />
                </label>
              </div>
              <div class="mt-6">
                <span class="mb-2 block text-xs font-semibold text-ink-2">{{ t('settings.agent.roleLabel') }}</span>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    v-for="r in roleOptions"
                    :key="r.id"
                    type="button"
                    class="flex flex-col items-start rounded-field border-[1.5px] p-3 text-left transition-colors"
                    :class="agentForm.personality.role === r.id ? 'border-lilac bg-lilac-soft' : 'border-line hover:border-line-strong'"
                    @click="agentForm.personality.role = r.id as AgentPersonality['role']"
                  >
                    <AIcon :name="r.icon" :size="18" :class="agentForm.personality.role === r.id ? 'text-lilac-ink' : 'text-ink-3'" />
                    <span class="mt-1.5 text-[13px] font-semibold">{{ r.label }}</span>
                    <span class="text-[10px] text-ink-3">{{ r.desc }}</span>
                  </button>
                </div>
              </div>
              <div class="mt-6">
                <span class="block text-xs font-semibold text-ink-2">
                  {{ t('settings.agent.traitsLabel') }} <span class="font-normal text-ink-3">{{ t('settings.agent.traitsMax') }}</span>
                </span>
                <p class="mb-2 mt-1 text-[10px] text-ink-3">{{ t('settings.agent.traitsHint') }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="trait in traitOptions"
                    :key="trait.value"
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                    :class="isTraitSelected(trait.value)
                      ? 'bg-lilac-soft text-lilac-ink'
                      : agentForm.personality.traits.length >= 3
                        ? 'cursor-not-allowed bg-canvas text-ink-3'
                        : 'bg-canvas text-ink-2 hover:bg-sunken'"
                    @click="toggleTrait(trait.value)"
                  >
                    {{ trait.label }}
                  </button>
                </div>
              </div>
              <div class="mt-6">
                <span class="mb-2 block text-xs font-semibold text-ink-2">{{ t('settings.agent.emojiLabel') }}</span>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="e in emojiOptions"
                    :key="e.id"
                    type="button"
                    class="flex items-center justify-center gap-2 rounded-field border-[1.5px] p-3 text-[13px] font-semibold transition-colors"
                    :class="agentForm.personality.emojiUsage === e.id ? 'border-lilac bg-lilac-soft text-lilac-ink' : 'border-line text-ink-2 hover:border-line-strong'"
                    @click="agentForm.personality.emojiUsage = e.id as AgentPersonality['emojiUsage']"
                  >
                    <span>{{ e.icon }}</span> {{ e.label }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Voz y tono -->
          <section class="rounded-card bg-surface shadow-card">
            <div class="flex items-center gap-3 p-6">
              <div class="min-w-0 flex-1">
                <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.section.voice') }}</h2>
                <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.section.voiceHint') }}</p>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas hover:text-ink"
                :aria-label="t('settings.agent.section.voice')"
                :aria-expanded="expandedSections.voice"
                aria-controls="agent-section-voice"
                @click="toggleSection('voice')"
              >
                <AIcon :name="expandedSections.voice ? 'CaretUpDown' : 'CaretDown'" :size="16" />
              </button>
            </div>
            <div v-show="expandedSections.voice" id="agent-section-voice" class="flex flex-col gap-6 px-6 pb-6">
              <div>
                <span class="mb-2 block text-xs font-semibold text-ink-2">{{ t('common.language') }}</span>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="l in languageOptions"
                    :key="l.id"
                    type="button"
                    class="flex items-center justify-center gap-1.5 rounded-field border-[1.5px] p-3 text-[13px] font-semibold transition-colors"
                    :class="agentForm.personality.language === l.id ? 'border-lilac bg-lilac-soft text-lilac-ink' : 'border-line text-ink-2 hover:border-line-strong'"
                    @click="agentForm.personality.language = l.id as AgentPersonality['language']"
                  >
                    <span>{{ l.flag }}</span> {{ l.label }}
                  </button>
                </div>
              </div>
              <div>
                <span class="mb-2 block text-xs font-semibold text-ink-2">{{ t('settings.agent.responseLengthLabel') }}</span>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="rl in responseLengthOptions"
                    :key="rl.id"
                    type="button"
                    class="flex flex-col items-center rounded-field border-[1.5px] p-3 transition-colors"
                    :class="agentForm.personality.responseLength === rl.id ? 'border-lilac bg-lilac-soft' : 'border-line hover:border-line-strong'"
                    @click="agentForm.personality.responseLength = rl.id as AgentPersonality['responseLength']"
                  >
                    <span class="text-[13px] font-semibold" :class="agentForm.personality.responseLength === rl.id ? 'text-lilac-ink' : 'text-ink'">{{ rl.label }}</span>
                    <span class="text-[10px] text-ink-3">{{ rl.desc }}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Conocimiento -->
          <section class="rounded-card bg-surface shadow-card">
            <div class="flex items-center gap-3 p-6">
              <div class="min-w-0 flex-1">
                <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.section.knowledge') }}</h2>
                <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.section.knowledgeHint') }}</p>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas hover:text-ink"
                :aria-label="t('settings.agent.section.knowledge')"
                :aria-expanded="expandedSections.knowledge"
                aria-controls="agent-section-knowledge"
                @click="toggleSection('knowledge')"
              >
                <AIcon :name="expandedSections.knowledge ? 'CaretUpDown' : 'CaretDown'" :size="16" />
              </button>
            </div>
            <div v-show="expandedSections.knowledge" id="agent-section-knowledge" class="px-6 pb-6">
              <span class="mb-2 block text-xs font-semibold text-ink-2">{{ t('settings.agent.ragBehaviorLabel') }}</span>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="rg in ragOptions"
                  :key="rg.id"
                  type="button"
                  class="flex flex-col items-center gap-1 rounded-field border-[1.5px] p-3 transition-colors"
                  :class="agentForm.personality.ragBehavior === rg.id ? 'border-lilac bg-lilac-soft' : 'border-line hover:border-line-strong'"
                  @click="agentForm.personality.ragBehavior = rg.id as AgentPersonality['ragBehavior']"
                >
                  <AIcon :name="rg.icon" :size="18" :class="agentForm.personality.ragBehavior === rg.id ? 'text-lilac-ink' : 'text-ink-3'" />
                  <span class="text-[13px] font-semibold" :class="agentForm.personality.ragBehavior === rg.id ? 'text-lilac-ink' : 'text-ink'">{{ rg.label }}</span>
                  <span class="text-center text-[10px] text-ink-3">{{ rg.desc }}</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Generación -->
          <section class="rounded-card bg-surface shadow-card">
            <div class="flex items-center gap-3 p-6">
              <div class="min-w-0 flex-1">
                <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.section.generation') }}</h2>
                <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.section.generationHint') }}</p>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas hover:text-ink"
                :aria-label="t('settings.agent.section.generation')"
                :aria-expanded="expandedSections.generation"
                aria-controls="agent-section-generation"
                @click="toggleSection('generation')"
              >
                <AIcon :name="expandedSections.generation ? 'CaretUpDown' : 'CaretDown'" :size="16" />
              </button>
            </div>
            <div v-show="expandedSections.generation" id="agent-section-generation" class="flex flex-col gap-6 px-6 pb-6">
              <div>
                <span class="block text-xs font-semibold text-ink-2">
                  {{ t('settings.agent.temperatureLabel', { level: temperatureLabel, value: agentForm.temperature }) }}
                </span>
                <input v-model.number="agentForm.temperature" type="range" min="0" max="1" step="0.1" class="mt-2 w-full accent-[color:var(--brand)]" />
                <div class="mt-1 flex justify-between text-[10px] text-ink-3">
                  <span>🎯 {{ t('settings.agent.temperaturePrecise') }}</span>
                  <span>🎨 {{ t('settings.agent.temperatureCreative') }}</span>
                </div>
                <div v-if="showTemperatureWarning" class="mt-2 flex items-center gap-2 rounded-field bg-butter-soft p-2.5 text-xs text-butter-ink">
                  <AIcon name="Warning" :size="15" />
                  {{ t('settings.agent.temperatureWarning') }}
                </div>
              </div>
              <div>
                <span class="block text-xs font-semibold text-ink-2">
                  {{ t('settings.agent.maxTokensLabel', { level: maxTokensLabel, value: agentForm.maxTokens }) }}
                </span>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  class="mt-2 w-full accent-[color:var(--brand)]"
                  :value="maxTokensIndex"
                  @input="agentForm.maxTokens = maxTokenOptions[Number(($event.target as HTMLInputElement).value)]?.value || 300"
                />
                <div class="mt-1 flex justify-between text-[10px] text-ink-3">
                  <span>{{ t('settings.agent.maxTokensOption.veryShort') }}</span>
                  <span>{{ t('settings.agent.maxTokensOption.medium') }}</span>
                  <span>{{ t('settings.agent.maxTokensOption.long') }}</span>
                  <span>{{ t('settings.agent.maxTokensOption.max') }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Mensajes automáticos -->
          <section class="rounded-card bg-surface shadow-card">
            <div class="flex items-center gap-3 p-6">
              <div class="min-w-0 flex-1">
                <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.section.messages') }}</h2>
                <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.section.messagesHint') }}</p>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas hover:text-ink"
                :aria-label="t('settings.agent.section.messages')"
                :aria-expanded="expandedSections.messages"
                aria-controls="agent-section-messages"
                @click="toggleSection('messages')"
              >
                <AIcon :name="expandedSections.messages ? 'CaretUpDown' : 'CaretDown'" :size="16" />
              </button>
            </div>
            <div v-show="expandedSections.messages" id="agent-section-messages" class="px-6 pb-6">
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between rounded-field border border-line p-3">
                  <div>
                    <span class="text-[13px] font-medium">{{ t('settings.agent.welcome') }}</span>
                    <p class="mt-0.5 text-xs text-ink-3">{{ t('settings.agent.welcomeHint') }}</p>
                  </div>
                  <ASwitch v-model="agentForm.enableWelcomeGreeting" :aria-label="t('settings.agent.welcome')" />
                </div>
                <div class="flex items-center justify-between rounded-field border border-line p-3">
                  <div>
                    <span class="text-[13px] font-medium">{{ t('settings.agent.goodbye') }}</span>
                    <p class="mt-0.5 text-xs text-ink-3">{{ t('settings.agent.goodbyeHint') }}</p>
                  </div>
                  <ASwitch v-model="agentForm.enableGoodbyeMessage" :aria-label="t('settings.agent.goodbye')" />
                </div>
                <div class="flex items-center justify-between rounded-field border border-line p-3">
                  <div>
                    <span class="text-[13px] font-medium">{{ t('settings.agent.fallbackAdvisor') }}</span>
                    <p class="mt-0.5 text-xs text-ink-3">{{ t('settings.agent.fallbackAdvisorHint') }}</p>
                  </div>
                  <ASwitch v-model="agentForm.enableFallbackAdvisor" :aria-label="t('settings.agent.fallbackAdvisor')" />
                </div>
              </div>

              <div class="mt-4">
                <span class="block text-xs font-semibold text-ink-2">{{ t('settings.agent.goodbyeKeywordsLabel') }}</span>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    v-for="keyword in agentForm.goodbyeKeywords"
                    :key="keyword"
                    class="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-2"
                  >
                    {{ keyword }}
                    <button type="button" class="text-ink-3 hover:text-ink" @click="removeGoodbyeKeyword(keyword)">
                      <AIcon name="X" :size="12" />
                    </button>
                  </span>
                </div>
                <div class="mt-2 flex gap-2">
                  <input
                    v-model="goodbyeKeywordInput"
                    class="field flex-1"
                    :placeholder="t('settings.agent.goodbyeKeywordPlaceholder')"
                    @keydown.enter.prevent="addGoodbyeKeyword"
                  />
                  <AButton variant="secondary" size="sm" @click="addGoodbyeKeyword">{{ t('common.add') }}</AButton>
                </div>
                <p class="mt-1 text-[10px] text-ink-3">{{ t('settings.agent.goodbyeKeywordsHint') }}</p>
              </div>
            </div>
          </section>

          <!-- Instrucciones adicionales -->
          <section class="rounded-card bg-surface shadow-card">
            <div class="flex items-center gap-3 p-6">
              <div class="min-w-0 flex-1">
                <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.agent.section.instructions') }}</h2>
                <p class="mt-1 text-xs text-ink-3">{{ t('settings.agent.section.instructionsHint') }}</p>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas hover:text-ink"
                :aria-label="t('settings.agent.section.instructions')"
                :aria-expanded="expandedSections.instructions"
                aria-controls="agent-section-instructions"
                @click="toggleSection('instructions')"
              >
                <AIcon :name="expandedSections.instructions ? 'CaretUpDown' : 'CaretDown'" :size="16" />
              </button>
            </div>
            <div v-show="expandedSections.instructions" id="agent-section-instructions" class="px-6 pb-6">
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-ink-2">
                  {{ t('settings.agent.additionalInstructionsLabel') }} <span class="font-normal text-ink-3">({{ t('common.optional') }})</span>
                </span>
                <textarea
                  v-model="agentForm.personality.additionalInstructions"
                  class="field h-24 resize-none"
                  :placeholder="t('settings.agent.additionalInstructionsPlaceholder')"
                />
              </label>
            </div>
          </section>

          <!-- Guardado pegajoso -->
          <div class="sticky bottom-3.5 z-10 flex flex-wrap items-center gap-3 rounded-card bg-surface p-3 shadow-card">
            <span v-if="isAgentDirty" class="inline-flex items-center gap-1.5 text-xs font-semibold text-butter-ink">
              <span class="h-1.5 w-1.5 rounded-full bg-butter-ink" />
              {{ t('settings.agent.unsaved') }}
            </span>
            <AButton variant="primary" class="ml-auto" :loading="saving" @click="handleSaveAgent">
              {{ saving ? t('common.saving') : t('settings.agent.save') }}
            </AButton>
          </div>
        </div>
      </div>

      <!-- ============== TAB: CANALES ============== -->
      <div v-if="activeTab === 'channels'">
        <div class="rounded-card bg-surface p-6 shadow-card">
          <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.channels.title') }}</h2>
          <div class="mt-4 flex flex-col gap-4">
            <div
              v-for="channel in channels"
              :key="channel.key"
              class="flex items-center justify-between rounded-field border border-line p-4"
            >
              <div class="flex items-center gap-3">
                <AIcon :name="channel.icon" :size="20" class="text-ink-3" />
                <span class="text-[13px] font-medium">{{ channel.name }}</span>
              </div>
              <ASwitch v-model="channel.enabled" :aria-label="channel.name" />
            </div>
          </div>
          <div class="flex justify-end pt-4">
            <AButton variant="primary" :loading="saving" @click="handleSaveChannels">
              {{ saving ? t('common.saving') : t('settings.channels.save') }}
            </AButton>
          </div>
        </div>
      </div>

      <!-- ============== TAB: OPCIONES ============== -->
      <div v-if="activeTab === 'options'">
        <div class="rounded-card bg-surface p-6 shadow-card">
          <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('settings.options.title') }}</h2>
          <div class="mt-4 flex items-center justify-between rounded-field border border-line p-4">
            <div>
              <span class="text-[13px] font-medium">{{ t('settings.options.autoCreateContact') }}</span>
              <p class="mt-0.5 text-xs text-ink-3">{{ t('settings.options.autoCreateContactHint') }}</p>
            </div>
            <ASwitch v-model="optionsForm.autoCreateContact" :aria-label="t('settings.options.autoCreateContact')" />
          </div>
          <div class="flex justify-end pt-4">
            <AButton variant="primary" :loading="saving" @click="handleSaveOptions">
              {{ saving ? t('common.saving') : t('common.save') }}
            </AButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
