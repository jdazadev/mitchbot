<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { projectService, SessionInvalidError } from '../services/project.service';
import { authService } from '../services/auth.service';
import AIcon from '../components/ui/AIcon.vue';
import AButton from '../components/ui/AButton.vue';
import ASwitch from '../components/ui/ASwitch.vue';

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

// Steps
const currentStep = ref(1);
const totalSteps = 3;
const isLoading = ref(false);
const checking = ref(true);
const error = ref('');

// Step 1: Proyecto
const projectForm = ref({
  name: '',
  description: '',
});

// Step 2: Agente
const agentForm = ref({
  name: '',
  description: '',
  role: 'assistant' as 'assistant' | 'teacher' | 'seller' | 'support' | 'customer_service',
  temperature: 0.5,
  maxTokens: 300,
  enableWelcomeGreeting: false,
  enableGoodbyeMessage: false,
  enableFallbackAdvisor: false,
  goodbyeKeywords: [
    'adios', 'adiós', 'hasta luego', 'hasta pronto', 'nos vemos',
    'chao', 'ciao', 'bye', 'goodbye',
  ] as string[],
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

const setupRoleOptions = computed(() => [
  { id: 'assistant', label: t('setup.agent.roles.assistant.label'), icon: 'Headset', desc: t('setup.agent.roles.assistant.desc') },
  { id: 'teacher', label: t('setup.agent.roles.teacher.label'), icon: 'GraduationCap', desc: t('setup.agent.roles.teacher.desc') },
  { id: 'seller', label: t('setup.agent.roles.seller.label'), icon: 'Storefront', desc: t('setup.agent.roles.seller.desc') },
  { id: 'support', label: t('setup.agent.roles.support.label'), icon: 'Wrench', desc: t('setup.agent.roles.support.desc') },
  { id: 'customer_service', label: t('setup.agent.roles.customer_service.label'), icon: 'Headphones', desc: t('setup.agent.roles.customer_service.desc') },
]);

const setupChannels = computed(() => [
  { key: 'whatsapp', name: t('setup.channels.whatsapp'), icon: 'Phone' },
  { key: 'instagram', name: t('setup.channels.instagram'), icon: 'Image' },
  { key: 'web', name: t('setup.channels.web'), icon: 'Globe' },
]);

// Step 3: Canales
const configForm = ref({
  channels: {
    whatsapp: true,
    instagram: false,
    web: true,
  },
  options: {
    autoCreateContact: true,
  },
});

onMounted(async () => {
  const proceed = await validateSetup();
  checking.value = false;
});

/**
 * Validación interna del setup: si el usuario ya tiene proyecto (y no pidió
 * crear uno nuevo con ?mode=new), se le lleva al dashboard. Si la sesión ya no
 * es válida en el servidor, se limpia y se vuelve al login.
 * Devuelve `true` si debe mostrarse el wizard.
 */
async function validateSetup(): Promise<boolean> {
  if (route.query.mode === 'new') return true;
  try {
    const hasProject = await projectService.checkProject();
    if (hasProject) {
      await router.replace({ name: 'dashboard' });
      return false;
    }
    return true;
  } catch (err) {
    if (err instanceof SessionInvalidError) {
      authService.clearSession();
      await router.replace({ name: 'login' });
      return false;
    }
    return true;
  }
}

function nextStep() {
  error.value = '';
  if (currentStep.value === 1) {
    if (!projectForm.value.name.trim()) {
      error.value = t('setup.errors.projectNameRequired');
      return;
    }
  }
  if (currentStep.value === 2) {
    if (!agentForm.value.name.trim()) {
      error.value = t('setup.errors.agentNameRequired');
      return;
    }
  }
  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

function prevStep() {
  error.value = '';
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

async function handleSubmit() {
  error.value = '';
  isLoading.value = true;
  try {
    await projectService.createProject({
      name: projectForm.value.name,
      description: projectForm.value.description,
      agent: {
        name: agentForm.value.name,
        description: agentForm.value.description,
        personality: {
          role: agentForm.value.role,
          traits: ['neutro'],
          emojiUsage: 'medium' as const,
          language: 'es' as const,
          responseLength: 'medium' as const,
          ragBehavior: 'hybrid' as const,
          fallbackMessage: 'Lo siento, no tengo información disponible sobre ese tema en este momento.',
        },
        enableWelcomeGreeting: agentForm.value.enableWelcomeGreeting,
        enableGoodbyeMessage: agentForm.value.enableGoodbyeMessage,
        enableFallbackAdvisor: agentForm.value.enableFallbackAdvisor,
        goodbyeKeywords: agentForm.value.goodbyeKeywords,
        temperature: agentForm.value.temperature,
        maxTokens: agentForm.value.maxTokens,
      },
      config: {
        channels: configForm.value.channels,
        options: configForm.value.options,
      },
    });
    // Sincronizar el usuario (projectIds/activeProjectId) tras crear el proyecto
    try { await authService.getProfile(); } catch { /* noop */ }
    router.push('/');
  } catch (err: any) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center p-4">
    <div class="aurora-haze" aria-hidden="true" />

    <div v-if="checking" class="relative z-10 flex flex-col items-center gap-3 text-ink-3">
      <span class="animate-spin"><AIcon name="SpinnerGap" :size="32" /></span>
      <p class="text-sm">{{ t('setup.checking') }}</p>
    </div>

    <div v-else class="relative z-10 w-full max-w-2xl">
      <!-- Header -->
      <div class="mb-5 flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-[14px] bg-ink font-display text-lg font-bold tracking-[-0.02em] text-white">
          M
        </div>
        <p class="text-[12.5px] font-semibold text-ink-3">{{ t('setup.subtitle') }}</p>
      </div>

      <!-- Progress -->
      <div class="mb-5 flex items-center gap-2">
        <template v-for="step in totalSteps" :key="step">
          <div
            class="grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition-all"
            :class="step <= currentStep ? 'bg-lilac text-lilac-ink' : 'bg-sunken text-ink-3'"
          >
            <AIcon v-if="step < currentStep" name="Check" :size="16" weight="bold" />
            <span v-else>{{ step }}</span>
          </div>
          <div
            v-if="step < totalSteps"
            class="h-1 flex-1 rounded-full transition-all"
            :class="step < currentStep ? 'bg-lilac' : 'bg-sunken'"
          />
        </template>
      </div>

      <div class="rounded-big bg-surface p-7 shadow-[var(--shadow-pop)]">
        <div v-if="error" class="mb-5 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]">
          <AIcon name="WarningCircle" :size="17" />
          {{ error }}
        </div>

        <!-- Paso 1: Proyecto -->
        <div v-if="currentStep === 1" class="flex flex-col gap-5">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-[13px] bg-sky text-sky-ink">
              <AIcon name="FolderOpen" :size="20" />
            </span>
            <div>
              <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('setup.project.title') }}</h2>
              <p class="text-xs text-ink-3">{{ t('setup.project.subtitle') }}</p>
            </div>
          </div>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('setup.project.name') }}</span>
            <input v-model="projectForm.name" type="text" class="field" :placeholder="t('setup.project.namePlaceholder')" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('setup.project.description') }}</span>
            <textarea v-model="projectForm.description" class="field h-24 resize-none" :placeholder="t('setup.project.descriptionPlaceholder')" />
          </label>
        </div>

        <!-- Paso 2: Agente -->
        <div v-if="currentStep === 2" class="flex flex-col gap-5">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-[13px] bg-lilac text-lilac-ink">
              <AIcon name="Robot" :size="20" />
            </span>
            <div>
              <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('setup.agent.title') }}</h2>
              <p class="text-xs text-ink-3">{{ t('setup.agent.subtitle') }}</p>
            </div>
          </div>

          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('setup.agent.name') }}</span>
            <input v-model="agentForm.name" type="text" class="field" :placeholder="t('setup.agent.namePlaceholder')" />
          </label>

          <div>
            <span class="block text-xs font-semibold text-ink-2">{{ t('setup.agent.roleLabel') }}</span>
            <p class="mb-2 mt-1 text-[10px] text-ink-3">{{ t('setup.agent.roleHelp') }}</p>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                v-for="r in setupRoleOptions"
                :key="r.id"
                type="button"
                class="flex flex-col items-start rounded-field border-[1.5px] p-3 text-left transition-colors"
                :class="agentForm.role === r.id ? 'border-lilac bg-lilac-soft' : 'border-line hover:border-line-strong'"
                @click="agentForm.role = r.id as typeof agentForm.role"
              >
                <AIcon :name="r.icon" :size="18" :class="agentForm.role === r.id ? 'text-lilac-ink' : 'text-ink-3'" />
                <span class="mt-1.5 text-[13px] font-semibold">{{ r.label }}</span>
                <span class="text-[10px] text-ink-3">{{ r.desc }}</span>
              </button>
            </div>
          </div>

          <div class="border-t border-line pt-4">
            <span class="mb-3 block text-xs font-semibold text-ink-2">{{ t('setup.agent.autoMessages') }}</span>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between rounded-field border border-line p-3">
                <div>
                  <span class="text-[13px] font-medium">{{ t('setup.agent.welcomeGreeting') }}</span>
                  <p class="mt-0.5 text-xs text-ink-3">{{ t('setup.agent.welcomeGreetingHelp') }}</p>
                </div>
                <ASwitch v-model="agentForm.enableWelcomeGreeting" />
              </div>
              <div class="flex items-center justify-between rounded-field border border-line p-3">
                <div>
                  <span class="text-[13px] font-medium">{{ t('setup.agent.goodbyeMessage') }}</span>
                  <p class="mt-0.5 text-xs text-ink-3">{{ t('setup.agent.goodbyeMessageHelp') }}</p>
                </div>
                <ASwitch v-model="agentForm.enableGoodbyeMessage" />
              </div>
              <div class="flex items-center justify-between rounded-field border border-line p-3">
                <div>
                  <span class="text-[13px] font-medium">{{ t('setup.agent.fallbackAdvisor') }}</span>
                  <p class="mt-0.5 text-xs text-ink-3">{{ t('setup.agent.fallbackAdvisorHelp') }}</p>
                </div>
                <ASwitch v-model="agentForm.enableFallbackAdvisor" />
              </div>
            </div>

            <div class="mt-4">
              <span class="block text-xs font-semibold text-ink-2">{{ t('setup.agent.goodbyeKeywords') }}</span>
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
                  :placeholder="t('setup.agent.goodbyeKeywordPlaceholder')"
                  @keydown.enter.prevent="addGoodbyeKeyword"
                />
                <AButton variant="secondary" size="sm" @click="addGoodbyeKeyword">{{ t('setup.agent.addKeyword') }}</AButton>
              </div>
              <p class="mt-1 text-[10px] text-ink-3">{{ t('setup.agent.goodbyeKeywordsHelp') }}</p>
            </div>
          </div>
        </div>

        <!-- Paso 3: Canales y opciones -->
        <div v-if="currentStep === 3" class="flex flex-col gap-5">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-[13px] bg-lime text-lime-ink">
              <AIcon name="GearSix" :size="20" />
            </span>
            <div>
              <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('setup.channels.title') }}</h2>
              <p class="text-xs text-ink-3">{{ t('setup.channels.subtitle') }}</p>
            </div>
          </div>

          <div>
            <span class="mb-3 block text-xs font-semibold text-ink-2">{{ t('setup.channels.channelsLabel') }}</span>
            <div class="flex flex-col gap-3">
              <div
                v-for="ch in setupChannels"
                :key="ch.key"
                class="flex items-center justify-between rounded-field border border-line p-3"
              >
                <div class="flex items-center gap-3">
                  <AIcon :name="ch.icon" :size="20" class="text-ink-3" />
                  <span class="text-[13px] font-medium">{{ ch.name }}</span>
                </div>
                <ASwitch v-model="(configForm.channels as any)[ch.key]" />
              </div>
            </div>
          </div>

          <div class="border-t border-line pt-4">
            <span class="mb-3 block text-xs font-semibold text-ink-2">{{ t('setup.channels.optionsLabel') }}</span>
            <div class="flex items-center justify-between rounded-field border border-line p-3">
              <div>
                <span class="text-[13px] font-medium">{{ t('setup.channels.autoCreateContact') }}</span>
                <p class="mt-0.5 text-xs text-ink-3">{{ t('setup.channels.autoCreateContactHelp') }}</p>
              </div>
              <ASwitch v-model="configForm.options.autoCreateContact" />
            </div>
          </div>

          <div class="rounded-field bg-canvas p-4">
            <h3 class="text-xs font-semibold text-ink-2">{{ t('setup.summary.title') }}</h3>
            <div class="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
              <p>📁 <strong>{{ t('setup.summary.project') }}:</strong> {{ projectForm.name }}</p>
              <p>🤖 <strong>{{ t('setup.summary.agent') }}:</strong> {{ agentForm.name }}</p>
              <p>📡 <strong>{{ t('setup.summary.channels') }}:</strong>
                {{ [
                  configForm.channels.whatsapp ? t('setup.channels.whatsapp') : '',
                  configForm.channels.instagram ? t('setup.channels.instagram') : '',
                  configForm.channels.web ? t('setup.channels.web') : ''
                ].filter(Boolean).join(', ') || t('common.none') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Acciones -->
        <div class="mt-7 flex items-center justify-between border-t border-line pt-6">
          <AButton v-if="currentStep > 1" variant="ghost" icon="ArrowLeft" @click="prevStep">
            {{ t('common.previous') }}
          </AButton>
          <div v-else></div>

          <AButton v-if="currentStep < totalSteps" variant="primary" trailing-icon="ArrowRight" @click="nextStep">
            {{ t('common.next') }}
          </AButton>
          <AButton v-else variant="primary" icon="RocketLaunch" :loading="isLoading" @click="handleSubmit">
            {{ isLoading ? t('setup.actions.creating') : t('setup.actions.createProject') }}
          </AButton>
        </div>
      </div>
    </div>
  </div>
</template>
