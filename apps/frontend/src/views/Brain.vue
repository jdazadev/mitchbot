<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  brainService,
  type KnowledgeSource,
  type BrainStats,
} from "../services/brain.service";
import { settingsService } from "../services/settings.service";

const isLoading = ref(true);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);
const isSubmitting = ref(false);
const ragAvailable = ref(true);
const ragAlert = ref<string | null>(null);
const fileAlert = ref<string | null>(null);

const showAddModal = ref(false);
const uploadMode = ref<'file' | 'text'>('file');
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);

const textTitle = ref('');
const textContent = ref('');

const sourceList = ref<KnowledgeSource[]>([]);
const logsBySource = ref<Record<string, Array<{ timestamp: string; level: string; stage?: string; message: string }>>>({});
const extractedTextBySource = ref<Record<string, { markdown: string; method?: string; extractedAt?: string }>>({});
const extractedModalOpen = ref(false);
const extractedModalSourceId = ref<string | null>(null);
const expandedLogs = ref<Record<string, boolean>>({});
const isPolling = ref(false);
const brainStats = ref<BrainStats>({
  totalDocs: 0,
  totalVectors: 0,
  syncStatus: "Unknown",
});

const sources = computed(() =>
  sourceList.value.map((s) => {
    const { icon, color } = getTypeMetadata(s.type);
    const progress = typeof s.progress === 'number' ? s.progress : s.status === 'Indexed' ? 100 : s.status === 'Failed' ? 100 : s.status === 'Processing' ? 40 : 0;
    const stageLabel = s.stage
      ? s.stage === 'queued'
        ? 'En cola'
        : s.stage === 'extracting'
          ? 'Extrayendo'
          : s.stage === 'chunking'
            ? 'Fragmentando'
            : s.stage === 'embedding'
              ? 'Embeddings'
              : s.stage === 'indexing'
                ? 'Indexando'
                : 'Finalizando'
      : s.status === 'Queued'
        ? 'En cola'
        : s.status === 'Processing'
          ? 'Procesando'
          : s.status === 'Failed'
            ? 'Error'
            : 'Listo';
    return {
      ...s,
      date: new Date(s.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      icon,
      color,
      progress,
      stageLabel,
      statusColor:
        s.status === "Indexed"
          ? "emerald"
          : s.status === "Processing"
            ? "amber"
            : "slate", // Simplified logic
    };
  }),
);

const stats = computed(() => [
  {
    label: "Total Documents",
    value: brainStats.value.totalDocs.toString(),
    icon: "folder_open",
  },
  {
    label: "Total Vectors",
    value: new Intl.NumberFormat().format(brainStats.value.totalVectors),
    icon: "account_tree",
  },
  { label: "Sync Status", value: brainStats.value.syncStatus, icon: "sync" },
]);

function getTypeMetadata(type: string) {
  switch (type) {
    case "PDF":
      return { icon: "description", color: "blue" };
    case "TXT":
      return { icon: "text_snippet", color: "slate" };
    case "CSV":
      return { icon: "table", color: "amber" };
    case "IMAGE":
      return { icon: "photo", color: "emerald" };
    default:
      return { icon: "description", color: "gray" };
  }
}

async function refreshBrain() {
  const [fetchedSources, fetchedStats] = await Promise.all([
    brainService.getSources(),
    brainService.getStats(),
  ]);
  sourceList.value = fetchedSources;
  brainStats.value = fetchedStats;
}

async function refreshLogsForSource(id: string) {
  const result = await brainService.getSourceLogs(id);
  logsBySource.value = { ...logsBySource.value, [id]: result.logs };
}

async function toggleLogs(sourceId: string) {
  expandedLogs.value = { ...expandedLogs.value, [sourceId]: !expandedLogs.value[sourceId] };
  if (expandedLogs.value[sourceId]) {
    await refreshLogsForSource(sourceId);
  }
}

async function openExtractedText(sourceId: string) {
  try {
    const data = await brainService.getSourceExtractedText(sourceId);
    extractedTextBySource.value = {
      ...extractedTextBySource.value,
      [sourceId]: {
        markdown: data.extractedMarkdown || '',
        method: data.extractionMethod,
        extractedAt: data.extractedAt,
      },
    };
    extractedModalSourceId.value = sourceId;
    extractedModalOpen.value = true;
  } catch (err: any) {
    actionError.value = err.message || 'Error al obtener texto extraido.';
  }
}

function closeExtractedText() {
  extractedModalOpen.value = false;
  extractedModalSourceId.value = null;
}

async function handleDeleteSource(sourceId: string) {
  actionError.value = null;
  actionSuccess.value = null;
  try {
    await brainService.deleteSource(sourceId);
    actionSuccess.value = 'Fuente eliminada correctamente.';
    await refreshBrain();
  } catch (err: any) {
    actionError.value = err.message || 'Error al eliminar fuente.';
  }
}

function resetModal() {
  selectedFile.value = null;
  textTitle.value = '';
  textContent.value = '';
  actionError.value = null;
  actionSuccess.value = null;
}

function openAddModal() {
  if (!ragAvailable.value) return;
  resetModal();
  uploadMode.value = 'file';
  showAddModal.value = true;
}

function closeAddModal() {
  showAddModal.value = false;
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
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}

function isValidFile(file: File) {
  const allowed = ['application/pdf', 'text/plain', 'text/csv', 'application/csv'];
  const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp'];
  const extension = file.name.toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.tiff', '.tif', '.bmp'];
  return [...allowed, ...imageTypes].includes(file.type)
    || extension.endsWith('.csv')
    || extension.endsWith('.pdf')
    || extension.endsWith('.txt')
    || imageExtensions.some(ext => extension.endsWith(ext));
}

async function handleSubmit() {
  actionError.value = null;
  actionSuccess.value = null;
  isSubmitting.value = true;
  try {
    if (!ragAvailable.value) {
      throw new Error('Configura un modelo de embeddings antes de cargar fuentes.');
    }
    if (uploadMode.value === 'file') {
      if (!selectedFile.value) {
        throw new Error('Selecciona un archivo antes de continuar.');
      }
      const result = await brainService.uploadSource(selectedFile.value);
      actionSuccess.value = 'Archivo en cola para procesamiento.';
      if (result.sourceId) {
        await refreshBrain();
        await refreshLogsForSource(result.sourceId);
      }
    } else {
      if (!textTitle.value.trim()) {
        throw new Error('El titulo es obligatorio.');
      }
      if (textContent.value.trim().length < 10) {
        throw new Error('El contenido debe tener al menos 10 caracteres.');
      }
      await brainService.writeTextSource({
        title: textTitle.value.trim(),
        content: textContent.value.trim(),
      });
      actionSuccess.value = 'Texto guardado y procesado.';
    }

    await refreshBrain();
    setTimeout(() => {
      closeAddModal();
    }, 600);
  } catch (err: any) {
    actionError.value = err.message || 'Error al procesar la fuente.';
  } finally {
    isSubmitting.value = false;
  }
}

async function resolveRagStatus() {
  try {
    const embConfig = await settingsService.getActiveProvider('embedding');
    if (!embConfig?.selectedModel) {
      ragAvailable.value = false;
      ragAlert.value = 'RAG no configurado: selecciona un modelo de embeddings en DevAdmin.';
      return;
    }
    const [fileConfig, imageConfig] = await Promise.all([
      settingsService.getActiveProvider('file'),
      settingsService.getActiveProvider('image'),
    ]);
    if (!fileConfig?.selectedModel && !imageConfig?.selectedModel) {
      fileAlert.value = 'Subida sin modelo file/image: la extraccion multimodal puede fallar.';
    } else if (!fileConfig?.selectedModel) {
      fileAlert.value = 'Subida sin modelo file: se intentara usar el modelo image.';
    } else if (!imageConfig?.selectedModel) {
      fileAlert.value = 'Subida sin modelo image: se usara el modelo file.';
    } else {
      fileAlert.value = null;
    }
    ragAvailable.value = true;
    ragAlert.value = null;
  } catch (err: any) {
    ragAvailable.value = false;
    ragAlert.value = 'No se pudo validar la configuración de embeddings.';
    fileAlert.value = null;
  }
}

onMounted(async () => {
  try {
    isLoading.value = true;
    await resolveRagStatus();
    await refreshBrain();
    startPolling();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
});

let pollTimer: number | null = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = window.setInterval(async () => {
    if (isPolling.value) return;
    isPolling.value = true;
    try {
      await refreshBrain();
      for (const source of sourceList.value) {
        if (expandedLogs.value[source._id]) {
          await refreshLogsForSource(source._id);
        }
      }
    } finally {
      isPolling.value = false;
    }
  }, 4000);
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Header with Action -->
    <div class="flex flex-wrap justify-between items-center gap-4">
      <div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Manage and train your AI with custom knowledge sources.
        </p>
      </div>
      <button
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 uppercase text-sm"
        @click="openAddModal"
        :disabled="!ragAvailable"
      >
        <span class="material-symbols-outlined text-[20px]">add</span> Add
        Source
      </button>
    </div>

    <div v-if="ragAlert" class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px]">warning</span>
        {{ ragAlert }}
      </div>
      <a href="/devadmin/models" class="text-xs font-bold text-amber-700 underline">Ir a DevAdmin</a>
    </div>

    <div v-if="fileAlert" class="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px]">info</span>
        {{ fileAlert }}
      </div>
      <a href="/devadmin/models" class="text-xs font-bold text-slate-600 underline">Ir a DevAdmin</a>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm"
      >
        <div class="flex items-center gap-4">
          <div
            class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-slate-400"
          >
            <span class="material-symbols-outlined text-[24px]">{{
              stat.icon
            }}</span>
          </div>
          <div>
            <p
              class="text-xs font-bold text-slate-400 uppercase tracking-wider"
            >
              {{ stat.label }}
            </p>
            <p class="text-2xl font-bold text-slate-900 dark:text-white">
              {{ stat.value }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Knowledge Sources Table -->
    <div
      class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
    >
      <div class="p-6 border-b border-slate-100 dark:border-slate-700">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">
          Knowledge Sources
        </h3>
      </div>

      <div v-if="isLoading" class="p-8 text-center text-slate-500">
        Loading knowledge sources...
      </div>
      <div v-else-if="error" class="p-8 text-center text-red-500">
        {{ error }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr
              class="bg-slate-50/50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-widest"
            >
              <th class="px-6 py-4">Source Name</th>
              <th class="px-6 py-4">Size/Pages</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4">Progress</th>
              <th class="px-6 py-4">Last Synced</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            <tr v-if="sources.length === 0">
              <td
                colspan="6"
                class="px-6 py-8 text-center text-slate-500 text-sm"
              >
                No knowledge sources found. Add one to get started.
              </td>
            </tr>
            <template v-else v-for="source in sources" :key="source._id">
              <tr
                class="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors"
              >
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div
                    :class="`p-2 rounded bg-${source.color}-50 dark:bg-${source.color}-900/30 text-${source.color}-600 dark:text-${source.color}-400`"
                  >
                    <span class="material-symbols-outlined text-[20px]">{{
                      source.icon
                    }}</span>
                  </div>
                  <div class="flex flex-col">
                    <span
                      class="text-sm font-bold text-slate-900 dark:text-white"
                      >{{ source.name }}</span
                    >
                    <span class="text-[11px] text-slate-400">{{ source.type }}</span>
                  </div>
                </div>
              </td>
              <td
                class="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium"
              >
                {{ source.size }}
              </td>
              <td class="px-6 py-4">
                <span
                  :class="`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-${source.statusColor}-50 text-${source.statusColor}-700 border-${source.statusColor}-100`"
                >
                  {{ source.status }}
                </span>
                <div class="text-[11px] text-slate-400 mt-1">{{ source.stageLabel }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-col gap-2">
                  <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      class="h-2 bg-blue-500"
                      :style="`width: ${source.progress}%`"
                    ></div>
                  </div>
                  <div class="text-[11px] text-slate-400">{{ source.progress }}%</div>
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                {{ source.date }}
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                  @click="openExtractedText(source._id)"
                  title="Ver texto extraido"
                >
                  <span class="material-symbols-outlined text-[20px]">description</span>
                </button>
                <button
                  class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                  @click="toggleLogs(source._id)"
                  title="Ver logs"
                >
                  <span class="material-symbols-outlined text-[20px]">receipt_long</span>
                </button>
                <button
                  class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                  @click="handleDeleteSource(source._id)"
                  title="Eliminar fuente"
                >
                  <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </td>
              </tr>
              <tr v-if="expandedLogs[source._id]">
                <td colspan="6" class="px-6 pb-6">
                  <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
                    <div v-if="!logsBySource[source._id]?.length" class="text-slate-400">Sin logs disponibles</div>
                    <div v-else v-for="log in logsBySource[source._id]" :key="log.timestamp">
                      <span class="font-bold">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                      <span class="uppercase text-[10px]">{{ log.level }}</span>
                      <span class="text-slate-400">{{ log.stage || 'general' }}</span>
                      — {{ log.message }}
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeAddModal">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
          <div class="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Agregar fuente</h3>
              <p class="text-xs text-slate-400 mt-0.5">Sube PDF, TXT, CSV o imagen, o escribe texto manual</p>
            </div>
            <button @click="closeAddModal" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <span class="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          <div class="p-5 border-b border-slate-100 dark:border-slate-700 flex gap-2">
            <button
              @click="uploadMode = 'file'"
              class="px-4 py-2 rounded-lg text-sm font-medium"
              :class="uploadMode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'"
            >
              Subir archivo
            </button>
            <button
              @click="uploadMode = 'text'"
              class="px-4 py-2 rounded-lg text-sm font-medium"
              :class="uploadMode === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'"
            >
              Escribir texto
            </button>
          </div>

          <div class="p-5">
            <div v-if="actionError" class="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">error</span>
              {{ actionError }}
            </div>
            <div v-if="actionSuccess" class="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              {{ actionSuccess }}
            </div>
            <div v-if="uploadMode === 'file'" class="space-y-4">
              <div
                class="border-2 border-dashed rounded-xl p-6 text-center transition-colors"
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
                  id="brain-file"
                  @change="handleFileChange"
                />
                <label for="brain-file" class="inline-flex mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer">
                  Seleccionar archivo
                </label>
                <div v-if="selectedFile" class="mt-3 text-xs text-slate-600">
                  {{ selectedFile.name }}
                </div>
              </div>
            </div>

            <div v-else class="space-y-4">
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Titulo</label>
                <input
                  v-model="textTitle"
                  class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Ej: Guia de producto"
                />
              </div>
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Contenido</label>
                <textarea
                  v-model="textContent"
                  class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm h-36 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Escribe el contenido aqui..."
                ></textarea>
              </div>
            </div>
          </div>

          <div class="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
            <button @click="closeAddModal" class="px-4 py-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
              Cancelar
            </button>
            <button
              @click="handleSubmit"
              :disabled="isSubmitting"
              class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-bold"
            >
              {{ isSubmitting ? 'Procesando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="extractedModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeExtractedText">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
          <div class="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Texto extraido</h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Metodo: {{ extractedModalSourceId ? extractedTextBySource[extractedModalSourceId]?.method || 'llm' : 'llm' }}
              </p>
            </div>
            <button @click="closeExtractedText" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <span class="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>
          <div class="p-5 max-h-[70vh] overflow-y-auto">
            <div v-if="extractedModalSourceId && !extractedTextBySource[extractedModalSourceId]?.markdown" class="text-sm text-slate-400">
              Sin texto extraido.
            </div>
            <pre v-else class="text-sm text-slate-700 whitespace-pre-wrap">{{ extractedModalSourceId ? extractedTextBySource[extractedModalSourceId]?.markdown : '' }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
