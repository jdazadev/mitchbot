<script setup lang="ts">
import { ref } from 'vue';
import { brainService } from '../services/brain.service';

const tabs = [
  { id: 'extract', label: 'Extraer texto', icon: 'description' },
  { id: 'pdf-preview', label: 'PDF a imagenes', icon: 'image' },
  { id: 'placeholder', label: 'Proximamente', icon: 'more_horiz' },
];

const activeTab = ref('extract');
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const isSubmitting = ref(false);
const actionError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);
const extractedMarkdown = ref('');
const extractionMeta = ref<{ method?: string; pages?: number } | null>(null);
const previewImages = ref<string[]>([]);
const previewPages = ref(0);
const previewMaxPages = ref(6);

function isValidFile(file: File) {
  const allowed = ['application/pdf', 'text/plain', 'text/csv', 'application/csv'];
  const isImage = file.type.startsWith('image/');
  return isImage || allowed.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!file) return;
  if (!isValidFile(file)) {
    actionError.value = 'Tipo de archivo no permitido. Solo PDF, TXT, CSV o imagenes.';
    return;
  }
  selectedFile.value = file;
  actionError.value = null;
  extractedMarkdown.value = '';
  extractionMeta.value = null;
  actionSuccess.value = null;
  previewImages.value = [];
  previewPages.value = 0;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (!isValidFile(file)) {
    actionError.value = 'Tipo de archivo no permitido. Solo PDF, TXT, CSV o imagenes.';
    return;
  }
  selectedFile.value = file;
  actionError.value = null;
  extractedMarkdown.value = '';
  extractionMeta.value = null;
  actionSuccess.value = null;
  previewImages.value = [];
  previewPages.value = 0;
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}

async function handleExtract() {
  actionError.value = null;
  actionSuccess.value = null;
  extractedMarkdown.value = '';
  extractionMeta.value = null;
  previewImages.value = [];
  previewPages.value = 0;
  if (!selectedFile.value) {
    actionError.value = 'Selecciona un archivo antes de continuar.';
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await brainService.extractTextOnly(selectedFile.value);
    extractedMarkdown.value = result.extractedMarkdown || '';
    extractionMeta.value = { method: result.method, pages: result.pages };
    actionSuccess.value = extractedMarkdown.value ? 'Texto extraido correctamente.' : 'No se encontro texto en el archivo.';
  } catch (err: any) {
    actionError.value = err.message || 'Error al extraer texto.';
  } finally {
    isSubmitting.value = false;
  }
}

async function handlePdfPreview() {
  actionError.value = null;
  actionSuccess.value = null;
  previewImages.value = [];
  previewPages.value = 0;
  if (!selectedFile.value) {
    actionError.value = 'Selecciona un PDF antes de continuar.';
    return;
  }
  if (selectedFile.value.type !== 'application/pdf' && !selectedFile.value.name.toLowerCase().endsWith('.pdf')) {
    actionError.value = 'Tipo de archivo no permitido. Solo PDF.';
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await brainService.convertPdfToImages(selectedFile.value, previewMaxPages.value);
    previewImages.value = result.images || [];
    previewPages.value = result.pages || 0;
    actionSuccess.value = previewImages.value.length
      ? `PDF convertido (${previewImages.value.length} pagina${previewImages.value.length === 1 ? '' : 's'}).`
      : 'No se pudieron generar imagenes.';
  } catch (err: any) {
    actionError.value = err.message || 'Error al convertir PDF.';
  } finally {
    isSubmitting.value = false;
  }
}

function clearResult() {
  extractedMarkdown.value = '';
  extractionMeta.value = null;
  actionError.value = null;
  actionSuccess.value = null;
  previewImages.value = [];
  previewPages.value = 0;
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Pruebas</h1>
      <p class="text-sm text-slate-500 mt-1">Herramientas internas de diagnóstico</p>
    </div>

    <div class="flex flex-col gap-6">
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
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'extract'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Entrada</h2>
          <p class="text-xs text-slate-400 mt-1">Sube un archivo para extraer texto via modelo tipo file/image.</p>

          <div v-if="actionError" class="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ actionError }}
          </div>
          <div v-if="actionSuccess" class="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">check_circle</span>
            {{ actionSuccess }}
          </div>

          <div
            class="mt-4 border-2 border-dashed rounded-xl p-6 text-center transition-colors"
            :class="isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200'"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <div class="text-sm text-slate-500">
              Arrastra un archivo aqui o selecciona uno
            </div>
            <input
              type="file"
              accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,.heic,.heif,.tiff,.tif,.bmp"
              class="hidden"
              id="dev-extract-file"
              @change="handleFileChange"
            />
            <label for="dev-extract-file" class="inline-flex mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">
              Seleccionar archivo
            </label>
            <div v-if="selectedFile" class="mt-3 text-xs text-slate-600">
              {{ selectedFile.name }}
            </div>
          </div>

          <div class="flex gap-2 mt-4">
            <button
              @click="handleExtract"
              :disabled="isSubmitting"
              class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-bold"
            >
              {{ isSubmitting ? 'Extrayendo...' : 'Extraer texto' }}
            </button>
            <button
              @click="clearResult"
              class="px-4 py-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Salida</h2>
              <p class="text-xs text-slate-400 mt-1">Markdown extraido del archivo.</p>
            </div>
            <div v-if="extractionMeta" class="text-[10px] text-slate-400 uppercase tracking-widest">
              {{ extractionMeta.method || 'llm_file' }} · {{ extractionMeta.pages || 0 }} paginas
            </div>
          </div>

          <div class="mt-4 h-[420px] border border-slate-100 dark:border-slate-700 rounded-lg overflow-y-auto bg-slate-50 dark:bg-slate-900/30">
            <div v-if="!extractedMarkdown" class="h-full flex items-center justify-center text-sm text-slate-400">
              El resultado aparecera aqui
            </div>
            <pre v-else class="p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{{ extractedMarkdown }}</pre>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'pdf-preview'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Entrada</h2>
          <p class="text-xs text-slate-400 mt-1">Convierte un PDF en imagenes para validar el modelo vision.</p>

          <div v-if="actionError" class="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ actionError }}
          </div>
          <div v-if="actionSuccess" class="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">check_circle</span>
            {{ actionSuccess }}
          </div>

          <div
            class="mt-4 border-2 border-dashed rounded-xl p-6 text-center transition-colors"
            :class="isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200'"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <div class="text-sm text-slate-500">
              Arrastra un PDF aqui o selecciona uno
            </div>
            <input
              type="file"
              accept=".pdf"
              class="hidden"
              id="dev-pdf-preview-file"
              @change="handleFileChange"
            />
            <label for="dev-pdf-preview-file" class="inline-flex mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">
              Seleccionar PDF
            </label>
            <div v-if="selectedFile" class="mt-3 text-xs text-slate-600">
              {{ selectedFile.name }}
            </div>
          </div>

          <div class="mt-4">
            <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Paginas a convertir</label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="previewMaxPages"
                type="number"
                min="1"
                max="10"
                class="w-24 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white"
              />
              <span class="text-xs text-slate-400">Maximo 10 paginas</span>
            </div>
          </div>

          <div class="flex gap-2 mt-4">
            <button
              @click="handlePdfPreview"
              :disabled="isSubmitting"
              class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-bold"
            >
              {{ isSubmitting ? 'Convirtiendo...' : 'Convertir PDF' }}
            </button>
            <button
              @click="clearResult"
              class="px-4 py-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Preview</h2>
              <p class="text-xs text-slate-400 mt-1">Imagenes generadas del PDF.</p>
            </div>
            <div v-if="previewPages" class="text-[10px] text-slate-400 uppercase tracking-widest">
              {{ previewPages }} pagina{{ previewPages === 1 ? '' : 's' }}
            </div>
          </div>

          <div class="mt-4 h-[420px] border border-slate-100 dark:border-slate-700 rounded-lg overflow-y-auto bg-slate-50 dark:bg-slate-900/30 p-4">
            <div v-if="!previewImages.length" class="h-full flex items-center justify-center text-sm text-slate-400">
              El preview aparecera aqui
            </div>
            <div v-else class="grid grid-cols-1 gap-4">
              <div v-for="(img, idx) in previewImages" :key="`${idx}-${img.slice(0, 20)}`" class="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div class="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50">Pagina {{ idx + 1 }}</div>
                <img :src="img" :alt="`Pagina ${idx + 1}`" class="w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
        <div class="flex items-center gap-2 text-slate-400 text-sm">
          <span class="material-symbols-outlined text-[18px]">science</span>
          Mas herramientas se agregaran en proximas versiones.
        </div>
      </div>
    </div>
  </div>
</template>
