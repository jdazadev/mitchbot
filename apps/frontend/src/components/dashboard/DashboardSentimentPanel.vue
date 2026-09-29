<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AEmptyState from '../ui/AEmptyState.vue';

const props = defineProps<{
  sentiment: { positive: number; neutral: number; negative: number; analyzed: number };
}>();

const { t, locale } = useI18n();
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value);
const rows = computed(() => [
  { key: 'positive', label: t('dashboard.sentiment.positive'), value: props.sentiment.positive, color: 'var(--lime)' },
  { key: 'neutral', label: t('dashboard.sentiment.neutral'), value: props.sentiment.neutral, color: 'var(--butter)' },
  { key: 'negative', label: t('dashboard.sentiment.negative'), value: props.sentiment.negative, color: 'var(--danger)' },
].map((row) => ({
  ...row,
  percent: props.sentiment.analyzed ? Math.round((row.value / props.sentiment.analyzed) * 100) : 0,
})));
</script>

<template>
  <section class="rounded-card bg-surface p-5 px-6 shadow-card">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
        {{ t('dashboard.sentiment.title') }}
      </h2>
      <span v-if="sentiment.analyzed" class="text-xs text-ink-3">
        {{ t('dashboard.sentiment.analyzed', { count: formatNumber(sentiment.analyzed) }) }}
      </span>
    </div>
    <AEmptyState
      v-if="sentiment.analyzed === 0"
      class="py-8"
      icon="SmileyMeh"
      :title="t('dashboard.sentiment.empty')"
    />
    <div v-else class="mt-5 space-y-4">
      <div v-for="row in rows" :key="row.key">
        <div class="flex items-center text-[12.5px] font-semibold">
          <span>{{ row.label }}</span>
          <span class="ml-auto text-ink-3 [font-variant-numeric:tabular-nums]">
            {{ formatNumber(row.value) }} | {{ row.percent }}%
          </span>
        </div>
        <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken">
          <span class="block h-full rounded-full" :style="{ width: `${row.percent}%`, backgroundColor: row.color }" />
        </div>
      </div>
    </div>
  </section>
</template>
