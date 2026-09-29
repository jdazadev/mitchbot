<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AEmptyState from '../ui/AEmptyState.vue';
import AIcon from '../ui/AIcon.vue';

defineProps<{ tools: { name: string; count: number; successRate: number }[] }>();
const { t, locale } = useI18n();
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value);
</script>

<template>
  <section class="rounded-card bg-surface p-5 px-6 shadow-card">
    <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
      {{ t('dashboard.tools.title') }}
    </h2>
    <AEmptyState
      v-if="tools.length === 0"
      class="py-8"
      icon="Wrench"
      :title="t('dashboard.tools.empty')"
    />
    <ol v-else class="mt-3 flex flex-col">
      <li
        v-for="(tool, index) in tools"
        :key="tool.name"
        class="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
      >
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas text-ink-2">
          <AIcon :name="index === 0 ? 'Lightning' : 'Wrench'" :size="15" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-semibold">{{ tool.name }}</p>
          <p class="mt-0.5 text-xs text-ink-3">
            {{ t('dashboard.tools.executions', { count: formatNumber(tool.count) }) }}
          </p>
        </div>
        <span class="shrink-0 text-xs font-semibold text-ink-2 [font-variant-numeric:tabular-nums]">
          {{ t('dashboard.tools.successRate', { rate: tool.successRate }) }}
        </span>
      </li>
    </ol>
  </section>
</template>
