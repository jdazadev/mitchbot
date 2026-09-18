<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { settingsService, type ProviderConfig, type OllamaModelInfo, type RemoteModelInfo } from '../services/settings.service';
import { authService } from '../services/auth.service';

type ProviderType = 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';
type ProviderId = 'ollama' | 'openrouter' | 'gemini' | 'mistral';
type ProviderSelection = ProviderId | '';

const currentUser = authService.getUser();
const isDevAdmin = computed(() => currentUser?.role === 'devadmin');

const activeType = ref<ProviderType>('llm');
const loading = ref(true);
const saving = ref(false);
const testing = ref(false);
const successMsg = ref('');
const errorMsg = ref('');

const apiKey = ref('');
const showApiKey = ref(false);

const activeConfigs = ref<Record<ProviderType, ProviderConfig | null>>({
  llm: null,
  embedding: null,
  file: null,
  image: null,
  audio: null,
  ocr: null,
});

const selectedProvider = ref<Record<ProviderType, ProviderSelection>>({
  llm: '',
  embedding: '',
  file: '',
  image: '',
  audio: '',
  ocr: '',
});

const ollamaModels = ref<OllamaModelInfo[]>([]);
const ollamaLoading = ref(false);

const remoteModels = ref<RemoteModelInfo[]>([]);
const remoteLoading = ref(false);

const selectedModel = ref<Record<ProviderType, string>>({
  llm: '',
  embedding: '',
  file: '',
  image: '',
  audio: '',
  ocr: '',
});

const selectedModelName = ref<Record<ProviderType, string>>({
  llm: '',
  embedding: '',
  file: '',
  image: '',
  audio: '',
  ocr: '',
});

const imageQuality = ref<'low' | 'medium' | 'high'>('medium');
const imageQualitySaving = ref(false);
const pdfExtractScale = ref<number | null>(4);
const pdfExtractMaxPages = ref<number | null>(0);
const pdfExtractBatchSize = ref<number | null>(2);
const pdfExtractTimeout = ref<number | null>(90000);
const pdfExtractMaxBase64 = ref<number | null>(0);
const pdfExtractReturnLimit = ref<number | null>(0);
const pdfExtractSaving = ref(false);

const ocrScale = ref<number | null>(2);
const ocrMaxPages = ref<number | null>(0);
const ocrBatchSize = ref<number | null>(4);
const ocrTimeout = ref<number | null>(60000);
const ocrSaving = ref(false);

const imageQualityOptions = [
  { id: 'low', label: 'Baja', desc: 'Preview rapido' },
  { id: 'medium', label: 'Media', desc: 'Balance recomendado' },
  { id: 'high', label: 'Alta', desc: 'Mas detalle (mas pesado)' },
] as const;

const typeTabs: { id: ProviderType; label: string; icon: string; desc: string }[] = [
  { id: 'llm', label: 'LLM', icon: 'psychology', desc: 'Modelos de lenguaje' },
  { id: 'embedding', label: 'Embeddings', icon: 'data_array', desc: 'Vectores RAG' },
  { id: 'file', label: 'File', icon: 'folder', desc: 'Procesamiento de archivos' },
  { id: 'image', label: 'Image', icon: 'image', desc: 'Modelos para imagen' },
  { id: 'audio', label: 'Audio', icon: 'graphic_eq', desc: 'Modelos para audio' },
  { id: 'ocr', label: 'OCR', icon: 'document_scanner', desc: 'Extracción de texto de PDFs e imágenes' },
];

const providers: { id: ProviderId; name: string; icon: string; desc: string }[] = [
  { id: 'ollama', name: 'Ollama', icon: '🦙', desc: 'Modelos locales vía Ollama' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🔀', desc: 'Modelos vía API' },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', desc: 'Modelos de Google' },
  { id: 'mistral', name: 'Mistral OCR', icon: '📄', desc: 'OCR dedicado vía API' },
];

const OCR_PROVIDER_IDS: ProviderId[] = ['ollama', 'mistral', 'openrouter'];

const filteredProviders = computed(() => {
  if (activeType.value === 'ocr') {
    return providers.filter(p => OCR_PROVIDER_IDS.includes(p.id));
  }
  if (activeType.value === 'embedding') {
    return providers.filter(p => p.id !== 'gemini' && p.id !== 'mistral');
  }
  return providers.filter(p => p.id !== 'mistral');
});

const showProviderModelModal = ref(false);
const providerModelSearchQuery = ref('');
const providerModels = ref<{ id: string; name: string; description?: string }[]>([]);
const providerModelsLoading = ref(false);

function filteredProviderModels() {
  if (!providerModelSearchQuery.value.trim()) return providerModels.value;
  const q = providerModelSearchQuery.value.toLowerCase();
  return providerModels.value.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
}

function selectProviderModel(model: { id: string; name: string }) {
  selectedModel.value[activeType.value] = model.id;
  selectedModelName.value[activeType.value] = model.name;
  showProviderModelModal.value = false;
  providerModelSearchQuery.value = '';
}

function showSuccess(msg: string) {
  successMsg.value = msg;
  errorMsg.value = '';
  setTimeout(() => { successMsg.value = ''; }, 3000);
}

function showError(msg: string) {
  errorMsg.value = msg;
  successMsg.value = '';
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function saveImageQuality() {
  imageQualitySaving.value = true;
  try {
    await settingsService.setConfig('devadmin.pdf_preview_quality', imageQuality.value);
    showSuccess('Calidad de PDF actualizada');
  } catch (err: any) {
    showError(err.message || 'Error al guardar calidad');
  } finally {
    imageQualitySaving.value = false;
  }
}

async function savePdfExtractConfig() {
  pdfExtractSaving.value = true;
  try {
    const scale = Number(pdfExtractScale.value ?? 0);
    const maxPages = Number(pdfExtractMaxPages.value ?? 0);
    const batchSize = Number(pdfExtractBatchSize.value ?? 0);
    const timeoutMs = Number(pdfExtractTimeout.value ?? 0);
    const maxBase64 = Number(pdfExtractMaxBase64.value ?? 0);
    const returnLimit = Number(pdfExtractReturnLimit.value ?? 0);

    await settingsService.setConfig('rag.pdf_extract_scale', Number.isFinite(scale) ? scale : 4);
    await settingsService.setConfig('rag.pdf_extract_max_pages', Number.isFinite(maxPages) ? maxPages : 0);
    await settingsService.setConfig('rag.pdf_extract_page_batch_size', Number.isFinite(batchSize) ? batchSize : 2);
    await settingsService.setConfig('rag.pdf_extract_timeout_ms', Number.isFinite(timeoutMs) ? timeoutMs : 90000);
    await settingsService.setConfig('rag.pdf_extract_max_base64_chars', Number.isFinite(maxBase64) ? maxBase64 : 0);
    await settingsService.setConfig('rag.pdf_extract_return_limit_chars', Number.isFinite(returnLimit) ? returnLimit : 0);
    showSuccess('Configuracion de extraccion PDF actualizada');
  } catch (err: any) {
    showError(err.message || 'Error al guardar configuracion PDF');
  } finally {
    pdfExtractSaving.value = false;
  }
}

async function saveOcrConfig() {
  ocrSaving.value = true;
  try {
    const scale = Number(ocrScale.value ?? 0);
    const maxPages = Number(ocrMaxPages.value ?? 0);
    const batchSize = Number(ocrBatchSize.value ?? 0);
    const timeoutMs = Number(ocrTimeout.value ?? 0);

    await settingsService.setConfig('rag.ocr_scale', Number.isFinite(scale) ? scale : 2);
    await settingsService.setConfig('rag.ocr_max_pages', Number.isFinite(maxPages) ? maxPages : 0);
    await settingsService.setConfig('rag.ocr_batch_size', Number.isFinite(batchSize) ? batchSize : 4);
    await settingsService.setConfig('rag.ocr_timeout_ms', Number.isFinite(timeoutMs) ? timeoutMs : 60000);
    showSuccess('Configuración OCR actualizada');
  } catch (err: any) {
    showError(err.message || 'Error al guardar configuración OCR');
  } finally {
    ocrSaving.value = false;
  }
}

async function loadActiveConfigs() {
  const types: ProviderType[] = ['llm', 'embedding', 'file', 'image', 'audio', 'ocr'];
  const results = await Promise.all(types.map(type => settingsService.getActiveProvider(type).catch(() => null)));
  types.forEach((type, idx) => {
    activeConfigs.value[type] = results[idx];
    if (results[idx]?.provider) {
      selectedProvider.value[type] = results[idx]!.provider as ProviderId;
    }
    if (results[idx]?.selectedModel) {
      selectedModel.value[type] = results[idx]!.selectedModel || '';
    }
    if (results[idx]?.selectedModelName) {
      selectedModelName.value[type] = results[idx]!.selectedModelName || '';
    }
    if (type === 'image') {
      imageQuality.value = 'medium';
    }
  });

  try {
    const quality = await settingsService.getConfig('devadmin.pdf_preview_quality');
    if (quality === 'low' || quality === 'medium' || quality === 'high') {
      imageQuality.value = quality;
    }
  } catch {
    imageQuality.value = 'medium';
  }

  try {
    const [scale, maxPages, batchSize, timeoutMs, maxBase64, returnLimit] = await Promise.all([
      settingsService.getConfig('rag.pdf_extract_scale'),
      settingsService.getConfig('rag.pdf_extract_max_pages'),
      settingsService.getConfig('rag.pdf_extract_page_batch_size'),
      settingsService.getConfig('rag.pdf_extract_timeout_ms'),
      settingsService.getConfig('rag.pdf_extract_max_base64_chars'),
      settingsService.getConfig('rag.pdf_extract_return_limit_chars'),
    ]);
    if (Number.isFinite(Number(scale))) pdfExtractScale.value = Number(scale);
    if (Number.isFinite(Number(maxPages))) pdfExtractMaxPages.value = Number(maxPages);
    if (Number.isFinite(Number(batchSize))) pdfExtractBatchSize.value = Number(batchSize);
    if (Number.isFinite(Number(timeoutMs))) pdfExtractTimeout.value = Number(timeoutMs);
    if (Number.isFinite(Number(maxBase64))) pdfExtractMaxBase64.value = Number(maxBase64);
    if (Number.isFinite(Number(returnLimit))) pdfExtractReturnLimit.value = Number(returnLimit);
  } catch {
    pdfExtractScale.value = 4;
    pdfExtractMaxPages.value = 0;
    pdfExtractBatchSize.value = 2;
    pdfExtractTimeout.value = 90000;
    pdfExtractMaxBase64.value = 0;
    pdfExtractReturnLimit.value = 0;
  }

  try {
    const [scale, maxPages, batchSize, timeoutMs] = await Promise.all([
      settingsService.getConfig('rag.ocr_scale'),
      settingsService.getConfig('rag.ocr_max_pages'),
      settingsService.getConfig('rag.ocr_batch_size'),
      settingsService.getConfig('rag.ocr_timeout_ms'),
    ]);
    if (Number.isFinite(Number(scale))) ocrScale.value = Number(scale);
    if (Number.isFinite(Number(maxPages))) ocrMaxPages.value = Number(maxPages);
    if (Number.isFinite(Number(batchSize))) ocrBatchSize.value = Number(batchSize);
    if (Number.isFinite(Number(timeoutMs))) ocrTimeout.value = Number(timeoutMs);
  } catch {
    ocrScale.value = 2;
    ocrMaxPages.value = 0;
    ocrBatchSize.value = 4;
    ocrTimeout.value = 60000;
  }
}

async function loadOllamaModels() {
  ollamaLoading.value = true;
  try {
    ollamaModels.value = await settingsService.getOllamaModels();
  } catch (err: any) {
    showError(err.message || 'Error al cargar modelos de Ollama');
    ollamaModels.value = [];
  } finally {
    ollamaLoading.value = false;
  }
}

async function loadRemoteModels() {
  const provider = selectedProvider.value[activeType.value];
  if (!provider) {
    showError('Selecciona un proveedor');
    return;
  }
  if (!apiKey.value.trim()) {
    showError('Ingresa una API Key');
    return;
  }
  if (provider === 'openrouter') {
    remoteLoading.value = true;
    try {
      if (activeType.value === 'embedding') {
        remoteModels.value = await settingsService.getOpenRouterEmbeddings(apiKey.value || undefined);
      } else {
        remoteModels.value = await settingsService.getOpenRouterModels(apiKey.value || undefined);
      }
    } catch (err: any) {
      showError(err.message || 'Error al cargar modelos remotos');
      remoteModels.value = [];
    } finally {
      remoteLoading.value = false;
    }
    return;
  }

  if (provider === 'gemini') {
    remoteLoading.value = true;
    try {
      remoteModels.value = await settingsService.getGeminiModels(apiKey.value || undefined);
    } catch (err: any) {
      showError(err.message || 'Error al cargar modelos de Gemini');
      remoteModels.value = [];
    } finally {
      remoteLoading.value = false;
    }
  }
}

async function openProviderModelModal() {
  const provider = selectedProvider.value[activeType.value];
  providerModels.value = [];
  providerModelSearchQuery.value = '';

  if (!provider) {
    showError('Selecciona un proveedor');
    return;
  }

  if (provider !== 'ollama' && !apiKey.value.trim()) {
    showError('Ingresa una API Key');
    return;
  }

  showProviderModelModal.value = true;
  providerModelsLoading.value = true;

  try {
    if (activeType.value === 'ocr' && provider === 'mistral') {
      providerModels.value = [
        { id: 'mistral-ocr-latest', name: 'Mistral OCR (latest)', description: 'OCR dedicado de Mistral AI' },
      ];
      return;
    }

    if (provider === 'ollama') {
      if (ollamaModels.value.length === 0) {
        await loadOllamaModels();
      }
      providerModels.value = ollamaModels.value.map(m => ({
        id: m.name || m.model,
        name: m.name || m.model,
        description: `${formatSize(m.size)}${m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}`,
      }));
      return;
    }

    await loadRemoteModels();
    providerModels.value = remoteModels.value.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
    }));
  } finally {
    providerModelsLoading.value = false;
  }
}

async function handleSaveProvider() {
  saving.value = true;
  try {
    const type = activeType.value;
    const provider = selectedProvider.value[type];
    const payload: any = { type, provider };

    if (!provider) {
      showError('Selecciona un proveedor');
      return;
    }

    if (!selectedModel.value[type]) {
      showError('Selecciona un modelo');
      return;
    }

    if (provider === 'ollama') {
      payload.selectedModel = selectedModel.value[type];
      payload.selectedModelName = selectedModelName.value[type] || selectedModel.value[type];
    } else {
      if (!apiKey.value.trim()) {
        showError('Ingresa una API Key');
        return;
      }
      payload.apiKey = apiKey.value.trim();
      if (provider === 'openrouter') {
        payload.baseUrl = 'https://openrouter.ai/api/v1';
      }
      if (provider === 'mistral') {
        payload.baseUrl = 'https://api.mistral.ai/v1';
      }
      payload.selectedModel = selectedModel.value[type];
      const found = remoteModels.value.find(m => m.id === selectedModel.value[type]);
      payload.selectedModelName = selectedModelName.value[type] || found?.name || selectedModel.value[type];
    }


    const result = await settingsService.saveProviderConfig(payload);
    activeConfigs.value[type] = result;
    apiKey.value = '';
    showSuccess(`Proveedor ${type.toUpperCase()} configurado: ${provider}`);
  } catch (err: any) {
    showError(err.message || 'Error al guardar proveedor');
  } finally {
    saving.value = false;
  }
}

async function handleTestConnection() {
  const provider = selectedProvider.value[activeType.value];
  if (!provider) {
    showError('Selecciona un proveedor');
    return;
  }
  testing.value = true;
  try {
    if (activeType.value === 'ocr') {
      if (provider !== 'ollama' && !apiKey.value.trim()) {
        showError('Ingresa una API Key');
        return;
      }
      const result = await settingsService.testOcrConnection({
        provider,
        apiKey: apiKey.value.trim() || undefined,
        model: selectedModel.value.ocr || undefined,
      });
      if (result?.success === false) {
        showError(result.error || 'Conexión OCR fallida');
        return;
      }
      showSuccess(result?.message || 'Conexión OCR exitosa');
      return;
    }

    if (provider === 'ollama') {
      showError('El test aplica solo a proveedores remotos');
      return;
    }
    if (!apiKey.value.trim()) {
      showError('Ingresa una API Key');
      return;
    }
    const result = await settingsService.testLLMConnection(provider, apiKey.value || undefined);
    if (result?.success === false) {
      showError(result.error || 'Conexión fallida');
      return;
    }
    showSuccess(result?.message || 'Conexión exitosa');
  } catch (err: any) {
    showError(err.message || 'Error al probar conexión');
  } finally {
    testing.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await loadActiveConfigs();
    await loadOllamaModels();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Proveedores</h1>
      <p class="text-sm text-slate-500 mt-1">Gestiona proveedores y modelos avanzados por tipo</p>
    </div>

    <div v-if="!isDevAdmin" class="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
      No tienes permisos para acceder a este módulo.
    </div>

    <div v-else>
      <div v-if="successMsg" class="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2 max-w-3xl">
        <span class="material-symbols-outlined text-[18px]">check_circle</span>
        {{ successMsg }}
      </div>
      <div v-if="errorMsg" class="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2 max-w-3xl">
        <span class="material-symbols-outlined text-[18px]">error</span>
        {{ errorMsg }}
      </div>

      <div v-if="loading" class="flex items-center justify-center p-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500">Cargando...</span>
        </div>
      </div>

      <div v-else class="flex flex-col gap-6">
        <div class="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
          <button
            v-for="tab in typeTabs" :key="tab.id"
            @click="activeType = tab.id"
            class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            :class="activeType === tab.id
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'"
          >
            <span class="material-symbols-outlined text-[18px]">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 max-w-4xl">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">{{ typeTabs.find(t => t.id === activeType)?.label }}</h2>
              <p class="text-xs text-slate-400">{{ typeTabs.find(t => t.id === activeType)?.desc }}</p>
            </div>
            <span v-if="activeConfigs[activeType]?.provider && activeConfigs[activeType]?.selectedModel" class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
              Activo: {{ activeConfigs[activeType]?.provider }}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-6">
            <button
              v-for="p in filteredProviders" :key="p.id"
              @click="selectedProvider[activeType] = p.id; remoteModels = []; apiKey = ''; selectedModel[activeType] = ''; selectedModelName[activeType] = ''"
              class="p-4 rounded-xl border-2 text-left transition-all"
              :class="selectedProvider[activeType] === p.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'"
            >
              <div class="text-2xl mb-1">{{ p.icon }}</div>
              <div class="text-sm font-bold text-slate-800 dark:text-white">{{ p.name }}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">{{ p.desc }}</div>
            </button>
          </div>

          <div v-if="!selectedProvider[activeType]" class="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700 mb-6">
            <span class="font-bold">Sin proveedor configurado.</span> Selecciona un proveedor para continuar.
          </div>

           <div v-if="selectedProvider[activeType] && selectedProvider[activeType] !== 'ollama'">
             <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">API Key</label>
             <div class="flex gap-2 mb-4">
               <div class="flex-1 relative">
                 <input
                   v-model="apiKey"
                   :type="showApiKey ? 'text' : 'password'"
                   placeholder="Ingresa la API Key"
                   class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white pr-10 font-mono"
                 />
                 <button @click="showApiKey = !showApiKey" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                   <span class="material-symbols-outlined text-[16px]">{{ showApiKey ? 'visibility_off' : 'visibility' }}</span>
                 </button>
               </div>
             </div>
           </div>

        <div class="mb-4">
          <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Modelo seleccionado</label>
             <div v-if="selectedModel[activeType]" class="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span class="material-symbols-outlined text-blue-600 text-[18px]">check_circle</span>
                <span class="text-sm font-medium text-blue-800">{{ selectedModelName[activeType] || selectedModel[activeType] }}</span>
                <button @click="selectedModel[activeType] = ''; selectedModelName[activeType] = ''" class="ml-auto text-blue-400 hover:text-blue-600">
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
          </div>
          <button
            @click="openProviderModelModal"
            class="mt-2 w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">search</span>
            {{ selectedModel[activeType] ? 'Cambiar modelo' : 'Seleccionar modelo' }}
          </button>
        </div>

          <div class="flex gap-2 pt-2">
            <button
              @click="handleSaveProvider"
              :disabled="saving"
              class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm"
            >
              {{ saving ? 'Guardando...' : 'Guardar Proveedor' }}
            </button>
            <button
              @click="handleTestConnection"
              :disabled="testing"
              class="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-all"
            >
              {{ testing ? 'Probando...' : 'Test Conexión' }}
            </button>
          </div>
        </div>

        <div v-if="activeType === 'image'" class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 max-w-4xl">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Configuracion de imagenes</h2>
              <p class="text-xs text-slate-400">Ajustes globales para extraccion PDF e imagenes.</p>
            </div>
          </div>

          <div class="mb-4">
            <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Calidad PDF a imagenes</label>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                v-for="opt in imageQualityOptions"
                :key="opt.id"
                @click="imageQuality = opt.id"
                class="p-3 rounded-xl border text-left transition-all"
                :class="imageQuality === opt.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'"
              >
                <div class="text-sm font-bold text-slate-800 dark:text-white">{{ opt.label }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">{{ opt.desc }}</div>
              </button>
            </div>
            <div class="flex items-center gap-2 mt-3">
              <button
                @click="saveImageQuality"
                :disabled="imageQualitySaving"
                class="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold disabled:bg-slate-500"
              >
                {{ imageQualitySaving ? 'Guardando...' : 'Guardar calidad' }}
              </button>
              <span class="text-[11px] text-slate-400">Solo aplica al preview PDF del modulo Pruebas.</span>
            </div>
          </div>

          <div class="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest">Extraccion PDF</h3>
            <p class="text-[11px] text-slate-400 mt-1">0 significa sin limites. Aplica a DevAdmin y RAG.</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Escala PDF a imagen</label>
                <input
                  v-model.number="pdfExtractScale"
                  type="number"
                  min="0"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Max paginas</label>
                <input
                  v-model.number="pdfExtractMaxPages"
                  type="number"
                  min="0"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Batch paginas (0 = secuencial)</label>
                <input
                  v-model.number="pdfExtractBatchSize"
                  type="number"
                  min="0"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Timeout (ms)</label>
                <input
                  v-model.number="pdfExtractTimeout"
                  type="number"
                  min="0"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Max base64 por pagina</label>
                <input
                  v-model.number="pdfExtractMaxBase64"
                  type="number"
                  min="0"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Max caracteres de salida</label>
                <input
                  v-model.number="pdfExtractReturnLimit"
                  type="number"
                  min="0"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>

            <div class="flex items-center gap-2 mt-4">
              <button
                @click="savePdfExtractConfig"
                :disabled="pdfExtractSaving"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:bg-blue-400"
              >
                {{ pdfExtractSaving ? 'Guardando...' : 'Guardar extraccion' }}
              </button>
              <span class="text-[11px] text-slate-400">Aplican a todo el flujo de extraccion PDF.</span>
            </div>
          </div>
        </div>

        <div v-if="activeType === 'ocr'" class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 max-w-4xl">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Pipeline OCR</h2>
              <p class="text-xs text-slate-400">Todos los PDFs se convierten a imágenes y pasan por OCR. Cadena de fallback: Ollama → Mistral → OpenRouter → pdf-parse.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Escala imagen (pdf-to-img)</label>
              <input
                v-model.number="ocrScale"
                type="number"
                min="1"
                max="8"
                class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Máx páginas (0 = todas)</label>
              <input
                v-model.number="ocrMaxPages"
                type="number"
                min="0"
                class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Batch de páginas (0 = secuencial)</label>
              <input
                v-model.number="ocrBatchSize"
                type="number"
                min="0"
                class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label class="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Timeout por página (ms)</label>
              <input
                v-model.number="ocrTimeout"
                type="number"
                min="0"
                class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 mt-4">
            <button
              @click="saveOcrConfig"
              :disabled="ocrSaving"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:bg-blue-400"
            >
              {{ ocrSaving ? 'Guardando...' : 'Guardar configuración OCR' }}
            </button>
            <button
              @click="handleTestConnection"
              :disabled="testing"
              class="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-all"
            >
              {{ testing ? 'Probando...' : 'Probar conexión OCR' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="showProviderModelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showProviderModelModal = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Seleccionar Modelo</h3>
              <p class="text-xs text-slate-400 mt-0.5">{{ typeTabs.find(t => t.id === activeType)?.label }} · {{ providers.find(p => p.id === selectedProvider[activeType])?.name }}</p>
            </div>
            <button @click="showProviderModelModal = false" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <span class="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          <div class="p-4 border-b border-slate-100 dark:border-slate-700">
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                v-model="providerModelSearchQuery"
                type="text"
                placeholder="Buscar modelo por nombre o ID..."
                class="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
                autofocus
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="providerModelsLoading" class="text-sm text-slate-400 p-3 text-center">Cargando modelos...</div>
            <div v-else-if="filteredProviderModels().length === 0" class="p-3 text-sm text-slate-400 text-center">
              No se encontraron modelos
            </div>
            <div v-else class="flex flex-col gap-1.5">
              <button
                v-for="m in filteredProviderModels()" :key="m.id"
                @click="selectProviderModel(m)"
                class="flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                :class="selectedModel[activeType] === m.id
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-100 dark:border-slate-700'"
              >
                <span class="material-symbols-outlined text-[18px]" :class="selectedModel[activeType] === m.id ? 'text-blue-600' : 'text-slate-400'">
                  {{ selectedModel[activeType] === m.id ? 'check_circle' : 'smart_toy' }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-800 dark:text-white truncate">{{ m.name }}</div>
                  <div v-if="m.description" class="text-[10px] text-slate-400 truncate">{{ m.description }}</div>
                </div>
                <span v-if="selectedModel[activeType] === m.id" class="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Activo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
