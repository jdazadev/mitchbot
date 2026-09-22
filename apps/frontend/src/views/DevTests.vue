<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { brainService } from '../services/brain.service';
import AIcon from '../components/ui/AIcon.vue';
import ATabs from '../components/ui/ATabs.vue';
import AButton from '../components/ui/AButton.vue';

const { t } = useI18n();

const tabs = computed(() => [
  { key: 'extract', label: t('devTests.tabs.extract') },
  { key: 'pdf-preview', label: t('devTests.tabs.pdfPreview') },
  { key: 'placeholder', label: t('devTests.tabs.comingSoon') },
]);

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
    actionError.value = t('devTests.errors.invalidFile');
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
    actionError.value = t('devTests.errors.invalidFile');
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
    actionError.value = t('devTests.errors.noFile');
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await brainService.extractTextOnly(selectedFile.value);
    extractedMarkdown.value = result.extractedMarkdown || '';
    extractionMeta.value = { method: result.method, pages: result.pages };
    actionSuccess.value = extractedMarkdown.value ? t('devTests.extract.success') : t('devTests.extract.noText');
  } catch (err: any) {
    actionError.value = err.message || t('devTests.errors.extractFailed');
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
    actionError.value = t('devTests.errors.noPdf');
    return;
  }
  if (selectedFile.value.type !== 'application/pdf' && !selectedFile.value.name.toLowerCase().endsWith('.pdf')) {
    actionError.value = t('devTests.errors.notPdf');
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await brainService.convertPdfToImages(selectedFile.value, previewMaxPages.value);
    previewImages.value = result.images || [];
    previewPages.value = result.pages || 0;
    actionSuccess.value = previewImages.value.length
      ? t('devTests.pdfPreview.success', previewImages.value.length)
      : t('devTests.pdfPreview.noImages');
  } catch (err: any) {
    actionError.value = err.message || t('devTests.errors.convertFailed');
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
  <div class="flex flex-col gap-3.5">
    <p class="text-[13px] text-ink-3">{{ t('devTests.subtitle') }}</p>

    <div class="flex flex-col gap-3.5">
      <ATabs :tabs="tabs" :model-value="activeTab" @update:model-value="activeTab = $event" />

      <div v-if="activeTab === 'extract'" class="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div class="rounded-card bg-surface p-6 shadow-card">
          <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('devTests.extract.inputTitle') }}</h2>
          <p class="mt-1 text-xs text-ink-3">{{ t('devTests.extract.inputDescription') }}</p>

          <div v-if="actionError" class="mt-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]">
            <AIcon name="WarningCircle" :size="17" />{{ actionError }}
          </div>
          <div v-if="actionSuccess" class="mt-4 flex items-center gap-2 rounded-field bg-lime-soft p-3 text-[13px] text-lime-ink">
            <AIcon name="CheckCircle" :size="17" />{{ actionSuccess }}
          </div>

          <div
            class="mt-4 rounded-field border-2 border-dashed p-6 text-center transition-colors"
            :class="isDragging ? 'border-lilac bg-lilac-soft' : 'border-line-strong'"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <p class="text-[13px] text-ink-3">{{ t('devTests.extract.dropHint') }}</p>
            <input
              id="dev-extract-file"
              type="file"
              accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,.heic,.heif,.tiff,.tif,.bmp"
              class="hidden"
              @change="handleFileChange"
            />
            <label
              for="dev-extract-file"
              class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink-solid px-4 py-2 text-xs font-semibold text-ink-contrast"
            >
              <AIcon name="UploadSimple" :size="14" />
              {{ t('devTests.extract.selectFile') }}
            </label>
            <div v-if="selectedFile" class="mt-3 text-xs text-ink-2">{{ selectedFile.name }}</div>
          </div>

          <div class="mt-4 flex gap-2">
            <AButton variant="primary" :loading="isSubmitting" @click="handleExtract">
              {{ isSubmitting ? t('devTests.extract.submitting') : t('devTests.extract.submit') }}
            </AButton>
            <AButton variant="ghost" @click="clearResult">{{ t('common.clear') }}</AButton>
          </div>
        </div>

        <div class="rounded-card bg-surface p-6 shadow-card">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('devTests.extract.outputTitle') }}</h2>
              <p class="mt-1 text-xs text-ink-3">{{ t('devTests.extract.outputDescription') }}</p>
            </div>
            <div v-if="extractionMeta" class="text-[10px] uppercase tracking-widest text-ink-3">
              {{ extractionMeta.method || 'llm_file' }} · {{ t('devTests.extract.pagesCount', extractionMeta.pages || 0) }}
            </div>
          </div>

          <div class="mt-4 h-[420px] overflow-y-auto rounded-field bg-canvas">
            <div v-if="!extractedMarkdown" class="flex h-full items-center justify-center text-sm text-ink-3">
              {{ t('devTests.extract.empty') }}
            </div>
            <pre v-else class="whitespace-pre-wrap p-4 text-[13px] text-ink-2">{{ extractedMarkdown }}</pre>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'pdf-preview'" class="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div class="rounded-card bg-surface p-6 shadow-card">
          <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('devTests.pdfPreview.inputTitle') }}</h2>
          <p class="mt-1 text-xs text-ink-3">{{ t('devTests.pdfPreview.inputDescription') }}</p>

          <div v-if="actionError" class="mt-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]">
            <AIcon name="WarningCircle" :size="17" />{{ actionError }}
          </div>
          <div v-if="actionSuccess" class="mt-4 flex items-center gap-2 rounded-field bg-lime-soft p-3 text-[13px] text-lime-ink">
            <AIcon name="CheckCircle" :size="17" />{{ actionSuccess }}
          </div>

          <div
            class="mt-4 rounded-field border-2 border-dashed p-6 text-center transition-colors"
            :class="isDragging ? 'border-lilac bg-lilac-soft' : 'border-line-strong'"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <p class="text-[13px] text-ink-3">{{ t('devTests.pdfPreview.dropHint') }}</p>
            <input
              id="dev-pdf-preview-file"
              type="file"
              accept=".pdf"
              class="hidden"
              @change="handleFileChange"
            />
            <label
              for="dev-pdf-preview-file"
              class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink-solid px-4 py-2 text-xs font-semibold text-ink-contrast"
            >
              <AIcon name="UploadSimple" :size="14" />
              {{ t('devTests.pdfPreview.selectFile') }}
            </label>
            <div v-if="selectedFile" class="mt-3 text-xs text-ink-2">{{ selectedFile.name }}</div>
          </div>

          <div class="mt-4">
            <span class="mb-2 block text-xs font-semibold text-ink-2">{{ t('devTests.pdfPreview.pagesLabel') }}</span>
            <div class="flex items-center gap-3">
              <input
                v-model.number="previewMaxPages"
                type="number"
                min="1"
                max="10"
                class="field w-24"
              />
              <span class="text-xs text-ink-3">{{ t('devTests.pdfPreview.pagesHint') }}</span>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <AButton variant="primary" :loading="isSubmitting" @click="handlePdfPreview">
              {{ isSubmitting ? t('devTests.pdfPreview.submitting') : t('devTests.pdfPreview.submit') }}
            </AButton>
            <AButton variant="ghost" @click="clearResult">{{ t('common.clear') }}</AButton>
          </div>
        </div>

        <div class="rounded-card bg-surface p-6 shadow-card">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('devTests.pdfPreview.outputTitle') }}</h2>
              <p class="mt-1 text-xs text-ink-3">{{ t('devTests.pdfPreview.outputDescription') }}</p>
            </div>
            <div v-if="previewPages" class="text-[10px] uppercase tracking-widest text-ink-3">
              {{ t('devTests.pdfPreview.pagesCount', previewPages) }}
            </div>
          </div>

          <div class="mt-4 h-[420px] overflow-y-auto rounded-field bg-canvas p-4">
            <div v-if="!previewImages.length" class="flex h-full items-center justify-center text-sm text-ink-3">
              {{ t('devTests.pdfPreview.empty') }}
            </div>
            <div v-else class="grid grid-cols-1 gap-4">
              <div
                v-for="(img, idx) in previewImages"
                :key="`${idx}-${img.slice(0, 20)}`"
                class="overflow-hidden rounded-field bg-surface shadow-card"
              >
                <div class="bg-canvas px-3 py-2 text-[10px] uppercase tracking-widest text-ink-3">
                  {{ t('devTests.pdfPreview.pageLabel', { page: idx + 1 }) }}
                </div>
                <img :src="img" :alt="t('devTests.pdfPreview.pageAlt', { page: idx + 1 })" class="w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="rounded-card bg-surface p-6 shadow-card">
        <div class="flex items-center gap-2 text-[13px] text-ink-3">
          <AIcon name="Flask" :size="18" />
          {{ t('devTests.comingSoon.description') }}
        </div>
      </div>
    </div>
  </div>
</template>
