<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AModal from '../ui/AModal.vue';
import AButton from '../ui/AButton.vue';
import AIcon from '../ui/AIcon.vue';
import { channelMeta } from '../../lib/channels';
import { downloadBlob } from '../../lib/download';
import { messagingService, type ExportFormat } from '../../services/messaging.service';

/** Exportación en bloque: periodo, canal y formato. */
const props = defineProps<{ open: boolean; channels: string[] }>();
const emit = defineEmits<{ close: []; exported: [fileName: string] }>();
const { t } = useI18n();

type Period = '7' | '30' | '90' | 'custom';
const PERIODS: Period[] = ['7', '30', '90', 'custom'];

const period = ref<Period>('30');
const from = ref('');
const to = ref('');
const platform = ref('All');
const format = ref<ExportFormat>('csv');
const exporting = ref(false);
const error = ref<string | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    error.value = null;
    if (!to.value) to.value = today();
  }
);

const customInvalid = computed(
  () => period.value === 'custom' && (!from.value || !to.value || from.value > to.value)
);

async function submit() {
  if (customInvalid.value) {
    error.value = t('messaging.export.errors.range');
    return;
  }
  exporting.value = true;
  error.value = null;
  try {
    const file = await messagingService.exportConversations({
      format: format.value,
      platform: platform.value,
      ...(period.value === 'custom' ? { from: from.value, to: to.value } : { days: Number(period.value) }),
    });
    downloadBlob(file.blob, file.fileName);
    emit('exported', file.fileName);
    emit('close');
  } catch (err: any) {
    error.value = err?.message || t('messaging.export.errors.failed');
  } finally {
    exporting.value = false;
  }
}

const chip = (active: boolean) => [
  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
  active ? 'bg-ink-solid text-ink-contrast' : 'bg-canvas text-ink-2 hover:bg-sunken hover:text-ink',
];
</script>

<template>
  <AModal :open="open" :label="t('messaging.export.title')" size="md" @close="emit('close')">
    <form class="p-6" data-testid="export-dialog" @submit.prevent="submit">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('messaging.export.title') }}</h2>
        <button
          type="button"
          class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
          :aria-label="t('common.close')"
          :title="t('common.close')"
          @click="emit('close')"
        >
          <AIcon name="X" :size="18" />
        </button>
      </div>
      <p class="mt-1 text-xs text-ink-3">{{ t('messaging.export.subtitle') }}</p>

      <div
        v-if="error"
        role="alert"
        class="mt-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
      >
        <AIcon name="WarningCircle" :size="17" />
        {{ error }}
      </div>

      <fieldset class="mt-5">
        <legend class="text-xs font-semibold text-ink-2">{{ t('messaging.export.period') }}</legend>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="option in PERIODS"
            :key="option"
            type="button"
            :class="chip(period === option)"
            :aria-pressed="period === option"
            @click="period = option"
          >
            {{ option === 'custom' ? t('messaging.export.custom') : t('messaging.export.lastDays', { days: option }) }}
          </button>
        </div>
        <div v-if="period === 'custom'" class="mt-3 grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('messaging.export.from') }}</span>
            <input v-model="from" type="date" class="field" :max="to || undefined" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('messaging.export.to') }}</span>
            <input v-model="to" type="date" class="field" :min="from || undefined" />
          </label>
        </div>
      </fieldset>

      <fieldset class="mt-5">
        <legend class="text-xs font-semibold text-ink-2">{{ t('messaging.export.channel') }}</legend>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="channel in channels"
            :key="channel"
            type="button"
            :class="chip(platform === channel)"
            :aria-pressed="platform === channel"
            @click="platform = channel"
          >
            {{ channel === 'All' ? t('messaging.filters.all') : channelMeta(channel).label }}
          </button>
        </div>
      </fieldset>

      <fieldset class="mt-5">
        <legend class="text-xs font-semibold text-ink-2">{{ t('messaging.export.format') }}</legend>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="option in (['csv', 'json'] as ExportFormat[])"
            :key="option"
            type="button"
            :class="chip(format === option)"
            :aria-pressed="format === option"
            @click="format = option"
          >
            {{ t(`messaging.export.formats.${option}`) }}
          </button>
        </div>
      </fieldset>

      <p class="mt-5 text-xs text-ink-3">{{ t('messaging.export.privacy') }}</p>

      <div class="mt-5 flex justify-end gap-2.5">
        <AButton variant="ghost" type="button" @click="emit('close')">{{ t('common.cancel') }}</AButton>
        <AButton variant="primary" type="submit" :loading="exporting">
          {{ exporting ? t('messaging.export.exporting') : t('messaging.export.submit') }}
        </AButton>
      </div>
    </form>
  </AModal>
</template>
