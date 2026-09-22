<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  brainService,
  type KnowledgeSource,
  type BrainStats,
} from "../services/brain.service";
import AIcon from "../components/ui/AIcon.vue";
import APill from "../components/ui/APill.vue";
import AButton from "../components/ui/AButton.vue";

const { t } = useI18n();

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
    const { icon, tone, soft, ink } = getTypeMetadata(s.type);
    const progress = typeof s.progress === 'number' ? s.progress : s.status === 'Indexed' ? 100 : s.status === 'Failed' ? 100 : s.status === 'Processing' ? 40 : 0;
    const stageLabel = s.stage
      ? s.stage === 'queued'
        ? t('brain.stage.queued')
        : s.stage === 'extracting'
          ? t('brain.stage.extracting')
          : s.stage === 'chunking'
            ? t('brain.stage.chunking')
            : s.stage === 'embedding'
              ? t('brain.stage.embedding')
              : s.stage === 'indexing'
                ? t('brain.stage.indexing')
                : t('brain.stage.finalizing')
      : s.status === 'Queued'
        ? t('brain.stage.queued')
        : s.status === 'Processing'
          ? t('brain.status.processing')
          : s.status === 'Failed'
            ? t('brain.status.failed')
            : t('brain.status.ready');
    const statusTone: 'lime' | 'butter' | 'danger' | 'ghost' =
      s.status === "Indexed" ? "lime" : s.status === "Processing" ? "butter" : s.status === "Failed" ? "danger" : "ghost";
    const progressColor = s.status === "Failed" ? "var(--danger)" : s.status === "Indexed" ? "var(--lime)" : "var(--butter)";
    return {
      ...s,
      date: new Date(s.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      icon,
      tone,
      soft,
      ink,
      progress,
      stageLabel,
      statusTone,
      progressColor,
    };
  }),
);

const stats = computed(() => [
  {
    label: t("brain.stats.totalDocuments"),
    value: brainStats.value.totalDocs.toString(),
    icon: "FolderOpen",
    tone: "sky" as const,
  },
  {
    label: t("brain.stats.totalVectors"),
    value: new Intl.NumberFormat().format(brainStats.value.totalVectors),
    icon: "TreeStructure",
    tone: "lilac" as const,
  },
  { label: t("brain.stats.syncStatus"), value: brainStats.value.syncStatus, icon: "ArrowsClockwise", tone: "lime" as const },
]);

function getTypeMetadata(type: string) {
  switch (type) {
    case "PDF":
      return { icon: "FileText", tone: "sky", soft: "bg-sky-soft", ink: "text-sky-ink" };
    case "TXT":
      return { icon: "TextAa", tone: "ghost", soft: "bg-canvas", ink: "text-ink-2" };
    case "CSV":
      return { icon: "Table", tone: "butter", soft: "bg-butter-soft", ink: "text-butter-ink" };
    case "IMAGE":
      return { icon: "Image", tone: "lime", soft: "bg-lime-soft", ink: "text-lime-ink" };
    default:
      return { icon: "FileText", tone: "ghost", soft: "bg-canvas", ink: "text-ink-2" };
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
    actionError.value = err.message || t('brain.errors.extractFailed');
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
    actionSuccess.value = t('brain.success.deleted');
    await refreshBrain();
  } catch (err: any) {
    actionError.value = err.message || t('brain.errors.deleteFailed');
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
    actionError.value = t('brain.errors.invalidFile');
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
    actionError.value = t('brain.errors.invalidFile');
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
      throw new Error(t('brain.errors.embeddingsConfig'));
    }
    if (uploadMode.value === 'file') {
      if (!selectedFile.value) {
        throw new Error(t('brain.errors.noFileSelected'));
      }
      const result = await brainService.uploadSource(selectedFile.value);
      actionSuccess.value = t('brain.success.fileQueued');
      if (result.sourceId) {
        await refreshBrain();
        await refreshLogsForSource(result.sourceId);
      }
    } else {
      if (!textTitle.value.trim()) {
        throw new Error(t('brain.errors.titleRequired'));
      }
      if (textContent.value.trim().length < 10) {
        throw new Error(t('brain.errors.contentTooShort'));
      }
      await brainService.writeTextSource({
        title: textTitle.value.trim(),
        content: textContent.value.trim(),
      });
      actionSuccess.value = t('brain.success.textSaved');
    }

    await refreshBrain();
    setTimeout(() => {
      closeAddModal();
    }, 600);
  } catch (err: any) {
    actionError.value = err.message || t('brain.errors.processFailed');
  } finally {
    isSubmitting.value = false;
  }
}

async function resolveRagStatus() {
  try {
    // Con el proveedor único (OpenRouter) las credenciales y el modelo de
    // embeddings provienen del entorno, por lo que RAG siempre está disponible.
    ragAvailable.value = true;
    ragAlert.value = null;
    fileAlert.value = null;
  } catch (err: any) {
    ragAvailable.value = false;
    ragAlert.value = t('brain.errors.embeddingsValidation');
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
  <div class="flex flex-col gap-3.5">
    <div class="flex flex-wrap items-center gap-3">
      <p class="max-w-[52ch] text-[13px] text-ink-2">{{ t("brain.subtitle") }}</p>
      <AButton
        class="ml-auto"
        variant="primary"
        icon="Plus"
        :disabled="!ragAvailable"
        @click="openAddModal"
      >
        {{ t("brain.addSource") }}
      </AButton>
    </div>

    <div
      v-if="ragAlert"
      class="flex items-center gap-3 rounded-card bg-butter-soft p-4 text-[13px] text-butter-ink"
    >
      <AIcon name="Warning" :size="18" />
      {{ ragAlert }}
    </div>
    <div
      v-if="fileAlert"
      class="flex items-center gap-3 rounded-card bg-canvas p-4 text-[13px] text-ink-2"
    >
      <AIcon name="Info" :size="18" />
      {{ fileAlert }}
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-card bg-surface p-5 px-6 shadow-card"
      >
        <div class="flex items-center gap-2.5">
          <span
            :class="[
              'grid h-8 w-8 place-items-center rounded-[11px]',
              stat.tone === 'sky' ? 'bg-sky text-sky-ink' : stat.tone === 'lilac' ? 'bg-lilac text-lilac-ink' : 'bg-lime text-lime-ink',
            ]"
          >
            <AIcon :name="stat.icon" :size="16" weight="bold" />
          </span>
          <span class="text-xs font-semibold text-ink-3">{{ stat.label }}</span>
        </div>
        <div class="mt-3 font-display text-[32px] font-bold leading-none tracking-[-0.04em] [font-variant-numeric:tabular-nums]">
          {{ stat.value }}
        </div>
      </div>
    </div>

    <!-- Fuentes de conocimiento -->
    <div class="overflow-hidden rounded-card bg-surface shadow-card">
      <div class="px-5 pb-1 pt-4">
        <h3 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
          {{ t("brain.sources.title") }}
        </h3>
      </div>

      <div v-if="isLoading" class="px-6 py-10 text-center text-sm font-semibold text-ink-3">
        {{ t("brain.sources.loading") }}
      </div>
      <div v-else-if="error" class="px-6 py-10 text-center text-sm font-semibold text-[color:var(--danger)]">
        {{ error }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                v-for="col in [
                  t('brain.sources.table.sourceName'),
                  t('brain.sources.table.sizePages'),
                  t('common.status'),
                  t('brain.sources.table.progress'),
                  t('brain.sources.table.lastSynced'),
                ]"
                :key="col"
                class="border-b-[1.5px] border-line px-4.5 py-3 text-left text-[11px] font-semibold text-ink-3"
              >
                {{ col }}
              </th>
              <th class="border-b-[1.5px] border-line px-4.5 py-3 text-right text-[11px] font-semibold text-ink-3">
                {{ t("common.actions") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="sources.length === 0">
              <td colspan="6" class="px-6 py-10 text-center text-sm text-ink-3">
                {{ t("brain.sources.empty") }}
              </td>
            </tr>
            <template v-else v-for="source in sources" :key="source._id">
              <tr class="border-b border-line transition-colors last:border-b-0 hover:bg-canvas">
                <td class="px-4.5 py-3.5">
                  <div class="flex items-center gap-3">
                    <span :class="['grid h-9 w-9 place-items-center rounded-[12px]', source.soft, source.ink]">
                      <AIcon :name="source.icon" :size="18" />
                    </span>
                    <div class="flex flex-col">
                      <span class="font-semibold">{{ source.name }}</span>
                      <span class="text-[11px] text-ink-3">{{ source.type }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-4.5 py-3.5 text-ink-2">{{ source.size }}</td>
                <td class="px-4.5 py-3.5">
                  <APill :tone="source.statusTone" size="sm">{{ source.status }}</APill>
                  <div class="mt-1 text-[11px] text-ink-3">{{ source.stageLabel }}</div>
                </td>
                <td class="px-4.5 py-3.5">
                  <div class="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                    <span class="block h-full rounded-full" :style="{ width: source.progress + '%', background: source.progressColor }" />
                  </div>
                  <div class="mt-1 text-[11px] text-ink-3 [font-variant-numeric:tabular-nums]">{{ source.progress }}%</div>
                </td>
                <td class="px-4.5 py-3.5 text-xs text-ink-3">{{ source.date }}</td>
                <td class="px-4.5 py-3.5">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                      :title="t('brain.sources.viewExtracted')"
                      @click="openExtractedText(source._id)"
                    >
                      <AIcon name="FileText" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                      :title="t('brain.sources.viewLogs')"
                      @click="toggleLogs(source._id)"
                    >
                      <AIcon name="NotePencil" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)]"
                      :title="t('brain.sources.delete')"
                      @click="handleDeleteSource(source._id)"
                    >
                      <AIcon name="Trash" :size="14" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedLogs[source._id]">
                <td colspan="6" class="px-4.5 pb-4">
                  <div class="space-y-2 rounded-field bg-canvas p-4 text-xs text-ink-2">
                    <div v-if="!logsBySource[source._id]?.length" class="text-ink-3">{{ t("brain.logs.empty") }}</div>
                    <div v-else v-for="log in logsBySource[source._id]" :key="log.timestamp">
                      <span class="font-bold">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                      <span class="text-[10px] uppercase">{{
                        log.level
                      }}</span>
                      <span class="text-ink-3">{{ log.stage || t('brain.logs.general') }}</span>
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
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div class="relative w-full max-w-2xl overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)]">
          <div class="flex items-center justify-between border-b border-line p-5">
            <div>
              <h3 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t("brain.modal.title") }}</h3>
              <p class="mt-0.5 text-xs text-ink-3">{{ t("brain.modal.subtitle") }}</p>
            </div>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
              @click="closeAddModal"
            >
              <AIcon name="X" :size="18" />
            </button>
          </div>

          <div class="flex gap-1.5 border-b border-line p-4">
            <button
              type="button"
              :class="[
                'rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                uploadMode === 'file' ? 'bg-ink text-white' : 'bg-canvas text-ink-2',
              ]"
              @click="uploadMode = 'file'"
            >
              {{ t("brain.modal.tabFile") }}
            </button>
            <button
              type="button"
              :class="[
                'rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                uploadMode === 'text' ? 'bg-ink text-white' : 'bg-canvas text-ink-2',
              ]"
              @click="uploadMode = 'text'"
            >
              {{ t("brain.modal.tabText") }}
            </button>
          </div>

          <div class="p-5">
            <div v-if="actionError" class="mb-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]">
              <AIcon name="WarningCircle" :size="17" />
              {{ actionError }}
            </div>
            <div v-if="actionSuccess" class="mb-4 flex items-center gap-2 rounded-field bg-lime-soft p-3 text-[13px] text-lime-ink">
              <AIcon name="CheckCircle" :size="17" />
              {{ actionSuccess }}
            </div>

            <div v-if="uploadMode === 'file'">
              <div
                class="rounded-field border-2 border-dashed p-6 text-center transition-colors"
                :class="isDragging ? 'border-lilac bg-lilac-soft' : 'border-line-strong'"
                @drop="handleDrop"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
              >
                <p class="text-[13px] text-ink-3">{{ t("brain.modal.dropzone") }}</p>
                <input
                  id="brain-file"
                  type="file"
                  accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,.heic,.heif,.tiff,.tif,.bmp"
                  class="hidden"
                  @change="handleFileChange"
                />
                <label
                  for="brain-file"
                  class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
                >
                  <AIcon name="UploadSimple" :size="14" />
                  {{ t("brain.modal.selectFile") }}
                </label>
                <div v-if="selectedFile" class="mt-3 text-xs text-ink-2">{{ selectedFile.name }}</div>
              </div>
            </div>

            <div v-else class="flex flex-col gap-4">
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-ink-2">{{ t("brain.modal.titleLabel") }}</span>
                <input v-model="textTitle" class="field" :placeholder="t('brain.modal.titlePlaceholder')" />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-ink-2">{{ t("brain.modal.contentLabel") }}</span>
                <textarea
                  v-model="textContent"
                  class="field h-36 resize-none"
                  :placeholder="t('brain.modal.contentPlaceholder')"
                />
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-line p-5">
            <AButton variant="ghost" @click="closeAddModal">{{ t("common.cancel") }}</AButton>
            <AButton variant="primary" :loading="isSubmitting" @click="handleSubmit">
              {{ isSubmitting ? t("brain.modal.processing") : t("common.save") }}
            </AButton>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="extractedModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeExtractedText">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div class="relative w-full max-w-3xl overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)]">
          <div class="flex items-center justify-between border-b border-line p-5">
            <div>
              <h3 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t("brain.extracted.title") }}</h3>
              <p class="mt-0.5 text-xs text-ink-3">
                {{ t("brain.extracted.method", { method: extractedModalSourceId ? extractedTextBySource[extractedModalSourceId]?.method || 'llm' : 'llm' }) }}
              </p>
            </div>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
              @click="closeExtractedText"
            >
              <AIcon name="X" :size="18" />
            </button>
          </div>
          <div class="max-h-[70vh] overflow-y-auto p-5">
            <div v-if="extractedModalSourceId && !extractedTextBySource[extractedModalSourceId]?.markdown" class="text-sm text-ink-3">
              {{ t("brain.extracted.empty") }}
            </div>
            <pre v-else class="whitespace-pre-wrap text-sm text-ink-2">{{
              extractedModalSourceId ? extractedTextBySource[extractedModalSourceId]?.markdown : ''
            }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
