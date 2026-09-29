<script setup lang="ts">
import AIcon from '../ui/AIcon.vue';

interface Metric {
  label: string;
  value: string;
  detail?: string;
  icon: string;
  testId: string;
}

defineProps<{
  title: string;
  metrics: Metric[];
  isLoading: boolean;
}>();
</script>

<template>
  <section :aria-label="title">
    <h2 class="mb-2 font-display text-sm font-bold text-ink-2">{{ title }}</h2>
    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      <article
        v-for="metric in metrics"
        :key="metric.testId"
        :data-testid="'stat-' + metric.testId"
        class="min-w-0 rounded-card bg-surface p-5 px-6 shadow-card"
      >
        <div class="flex items-center gap-2.5">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-sunken text-ink-2">
            <AIcon :name="metric.icon" :size="16" weight="bold" />
          </span>
          <span class="min-w-0 text-xs font-semibold text-ink-3">{{ metric.label }}</span>
        </div>
        <div
          v-if="isLoading"
          class="mt-3 h-9 w-24 animate-pulse rounded-lg bg-sunken"
          aria-hidden="true"
        />
        <div v-else class="mt-3 min-w-0">
          <p class="break-words font-display text-[32px] font-bold leading-tight tracking-[-0.04em] [font-variant-numeric:tabular-nums]">
            {{ metric.value }}
          </p>
          <p v-if="metric.detail" class="mt-1 text-xs leading-relaxed text-ink-3">
            {{ metric.detail }}
          </p>
        </div>
      </article>
    </div>
  </section>
</template>
