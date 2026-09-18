<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { projectService } from '../services/project.service';
import { authService } from '../services/auth.service';
import { settingsService, type AgentModelGroup } from '../services/settings.service';

const router = useRouter();

// Steps
const currentStep = ref(1);
const totalSteps = 3;
const isLoading = ref(false);
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
  model: '',
  role: 'assistant' as 'assistant' | 'teacher' | 'seller' | 'support' | 'customer_service',
  temperature: 0.5,
  maxTokens: 300,
  enableWelcomeGreeting: false,
  enableGoodbyeMessage: false,
  enableFallbackAdvisor: false,
  goodbyeKeywords: [
    'adios', 'adiós', 'hasta luego', 'hasta pronto', 'nos vemos',
    'chao', 'ciao', 'bye', 'goodbye', 'gracias', 'muchas gracias',
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

const setupRoleOptions = [
  { id: 'assistant', label: 'Asistente', icon: 'support_agent', desc: 'Ayuda general' },
  { id: 'teacher', label: 'Profesor', icon: 'school', desc: 'Enseña paso a paso' },
  { id: 'seller', label: 'Vendedor', icon: 'storefront', desc: 'Persuade y cierra ventas' },
  { id: 'support', label: 'Soporte', icon: 'build', desc: 'Resuelve problemas técnicos' },
  { id: 'customer_service', label: 'Atención al cliente', icon: 'headset_mic', desc: 'Gestiona consultas' },
];

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

const agentModelGroups = ref<AgentModelGroup[]>([]);
const modelsLoading = ref(true);

onMounted(async () => {
  try {
    agentModelGroups.value = await settingsService.getModelsForAgent();
    // Pre-seleccionar primer modelo si existe
    if (agentModelGroups.value.length > 0 && agentModelGroups.value[0].models.length > 0) {
      agentForm.value.model = agentModelGroups.value[0].models[0].id;
    }
  } catch (err) {
    console.error('Error loading models:', err);
  } finally {
    modelsLoading.value = false;
  }
});

function nextStep() {
  error.value = '';
  if (currentStep.value === 1) {
    if (!projectForm.value.name.trim()) {
      error.value = 'El nombre del proyecto es obligatorio';
      return;
    }
  }
  if (currentStep.value === 2) {
    if (!agentForm.value.name.trim()) {
      error.value = 'El nombre del agente es obligatorio';
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
        model: agentForm.value.model,
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
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">

      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-3 mb-3">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <span class="material-symbols-outlined text-[32px]">rocket_launch</span>
          </div>
        </div>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white">Configurar Proyecto</h1>
        <p class="text-sm text-slate-500 mt-2">Configura tu proyecto y agente para empezar a trabajar</p>
      </div>

      <!-- Progress Steps -->
      <div class="flex items-center justify-center gap-2 mb-8">
        <template v-for="step in totalSteps" :key="step">
          <div
            class="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all"
            :class="step <= currentStep
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400'"
          >
            <span v-if="step < currentStep" class="material-symbols-outlined text-[18px]">check</span>
            <span v-else>{{ step }}</span>
          </div>
          <div v-if="step < totalSteps" class="w-16 h-0.5 rounded-full transition-all" :class="step < currentStep ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"></div>
        </template>
      </div>

      <!-- Card -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8">

        <!-- Error -->
        <div v-if="error" class="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error }}
        </div>

        <!-- Step 1: Proyecto -->
        <div v-if="currentStep === 1" class="flex flex-col gap-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <span class="material-symbols-outlined text-blue-600 text-[22px]">folder_open</span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">Datos del Proyecto</h2>
              <p class="text-xs text-slate-500">Información básica de tu proyecto</p>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Nombre del Proyecto *</label>
            <input
              v-model="projectForm.name"
              type="text"
              placeholder="Ej: Mi Tienda Online, Soporte Técnico..."
              class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Descripción</label>
            <textarea
              v-model="projectForm.description"
              placeholder="Describe brevemente de qué trata tu proyecto..."
              class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
            ></textarea>
          </div>
        </div>

        <!-- Step 2: Agente IA -->
        <div v-if="currentStep === 2" class="flex flex-col gap-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <span class="material-symbols-outlined text-purple-600 text-[22px]">smart_toy</span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">Agente de IA</h2>
              <p class="text-xs text-slate-500">Configura la personalidad e inteligencia de tu bot</p>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Nombre del Agente *</label>
            <input
              v-model="agentForm.name"
              type="text"
              placeholder="Ej: Asistente de Ventas, Soporte Bot..."
              class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Modelo IA</label>
            <div v-if="modelsLoading" class="text-sm text-slate-400 p-3">Cargando modelos...</div>
            <div v-else-if="agentModelGroups.length === 0" class="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
              <span class="font-bold">Sin proveedor configurado.</span> Configura un proveedor LLM en Settings después del onboarding.
            </div>
            <select v-else v-model="agentForm.model" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white">
              <option value="" disabled>Selecciona un modelo</option>
              <template v-for="group in agentModelGroups" :key="group.provider">
                <optgroup :label="group.providerName">
                  <option v-for="m in group.models" :key="m.id" :value="m.id">{{ m.name }}</option>
                </optgroup>
              </template>
            </select>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Rol del Bot</label>
            <p class="text-[10px] text-slate-400 mb-2">Podrás configurar la personalidad completa después en Settings</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="r in setupRoleOptions" :key="r.id"
                type="button"
                @click="agentForm.role = r.id as typeof agentForm.role"
                class="flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
                :class="agentForm.role === r.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'"
              >
                <span class="material-symbols-outlined text-[20px] mb-1" :class="agentForm.role === r.id ? 'text-blue-600' : 'text-slate-400'">{{ r.icon }}</span>
                <span class="text-sm font-medium" :class="agentForm.role === r.id ? 'text-blue-700' : 'text-slate-700 dark:text-white'">{{ r.label }}</span>
                <span class="text-[10px] text-slate-400">{{ r.desc }}</span>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 dark:border-slate-700 pt-4">
            <label class="text-xs font-bold text-slate-500 uppercase mb-3 block">Mensajes automáticos</label>
            <div class="flex flex-col gap-3">
              <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                <div>
                  <span class="text-sm font-medium text-slate-800 dark:text-white">Saludar siempre</span>
                  <p class="text-xs text-slate-400 mt-0.5">Saluda al iniciar o retomar tras 6 horas</p>
                </div>
                <input type="checkbox" v-model="agentForm.enableWelcomeGreeting" class="h-4 w-4 accent-blue-600" />
              </label>
              <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                <div>
                  <span class="text-sm font-medium text-slate-800 dark:text-white">Despedir siempre</span>
                  <p class="text-xs text-slate-400 mt-0.5">Despide cuando el usuario se despida o cierre chat</p>
                </div>
                <input type="checkbox" v-model="agentForm.enableGoodbyeMessage" class="h-4 w-4 accent-blue-600" />
              </label>
              <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                <div>
                  <span class="text-sm font-medium text-slate-800 dark:text-white">Cuando no sepa la respuesta</span>
                  <p class="text-xs text-slate-400 mt-0.5">Disculparse y aconsejar contactar con un asesor</p>
                </div>
                <input type="checkbox" v-model="agentForm.enableFallbackAdvisor" class="h-4 w-4 accent-blue-600" />
              </label>
            </div>
            <div class="mt-4">
              <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Keywords de despedida</label>
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
                  placeholder="Escribe una keyword"
                  class="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
                />
                <button type="button" class="px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg" @click="addGoodbyeKeyword">
                  Agregar
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-1">Se comparan en minúsculas. Usa términos como “adios”, “gracias”, “bye”.</p>
            </div>
          </div>
        </div>

        <!-- Step 3: Canales y Opciones -->
        <div v-if="currentStep === 3" class="flex flex-col gap-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <span class="material-symbols-outlined text-emerald-600 text-[22px]">settings</span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">Canales y Opciones</h2>
              <p class="text-xs text-slate-500">Elige los canales de comunicación</p>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-3 block">Canales</label>
            <div class="flex flex-col gap-3">
              <div v-for="ch in [
                { key: 'whatsapp', name: 'WhatsApp', icon: 'call', color: 'green' },
                { key: 'instagram', name: 'Instagram', icon: 'photo_camera', color: 'purple' },
                { key: 'web', name: 'Chat Web', icon: 'language', color: 'blue' },
              ]" :key="ch.key" class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-slate-500 text-[20px]">{{ ch.icon }}</span>
                  <span class="text-sm font-medium text-slate-800 dark:text-white">{{ ch.name }}</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="(configForm.channels as any)[ch.key]" class="sr-only peer">
                  <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 dark:border-slate-700 pt-4">
            <label class="text-xs font-bold text-slate-500 uppercase mb-3 block">Opciones</label>
            <div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-600">
              <div>
                <span class="text-sm font-medium text-slate-800 dark:text-white">Crear contacto automáticamente</span>
                <p class="text-xs text-slate-400 mt-0.5">Al contestar el primer mensaje del cliente</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="configForm.options.autoCreateContact" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <!-- Resumen -->
          <div class="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 mt-2">
            <h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Resumen</h3>
            <div class="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
              <p>📁 <strong>Proyecto:</strong> {{ projectForm.name }}</p>
              <p>🤖 <strong>Agente:</strong> {{ agentForm.name }} ({{ agentForm.model }})</p>
              <p>📡 <strong>Canales:</strong>
                {{ [
                  configForm.channels.whatsapp ? 'WhatsApp' : '',
                  configForm.channels.instagram ? 'Instagram' : '',
                  configForm.channels.web ? 'Web' : ''
                ].filter(Boolean).join(', ') || 'Ninguno' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
          <button
            v-if="currentStep > 1"
            @click="prevStep"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            Anterior
          </button>
          <div v-else></div>

          <button
            v-if="currentStep < totalSteps"
            @click="nextStep"
            class="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all text-sm"
          >
            Siguiente
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
          <button
            v-else
            @click="handleSubmit"
            :disabled="isLoading"
            class="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm"
          >
            <span class="material-symbols-outlined text-[18px]">rocket_launch</span>
            {{ isLoading ? 'Creando...' : 'Crear Proyecto' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
