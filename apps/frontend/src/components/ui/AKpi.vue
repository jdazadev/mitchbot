<script setup lang="ts">
import { computed } from 'vue';

type Tone = 'sky' | 'lilac' | 'lime' | 'butter';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    tone?: Tone;
  }>(),
  {}
);

const TONE: Record<Tone, string> = {
  sky: 'bg-sky-soft [&_b]:text-sky-ink',
  lilac: 'bg-lilac-soft [&_b]:text-lilac-ink',
  lime: 'bg-lime-soft [&_b]:text-lime-ink',
  butter: 'bg-butter-soft [&_b]:text-butter-ink',
};
</script>

<template>
  <div
    :class="[
      'flex items-baseline gap-1.5 rounded-full px-3.5 py-1.5',
      tone ? TONE[tone] : 'bg-canvas',
    ]"
  >
    <b
      class="font-display text-base font-bold tracking-[-0.02em] [font-variant-numeric:tabular-nums]"
      :class="tone ? '' : 'text-ink'"
      >{{ value }}</b
    >
    <span class="text-[11px] font-medium text-ink-3">{{ label }}</span>
  </div>
</template>
