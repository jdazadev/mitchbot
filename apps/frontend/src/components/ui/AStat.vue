<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

type Tone = 'sky' | 'lilac' | 'lime' | 'butter';

const props = withDefaults(
  defineProps<{
    value: string;
    label: string;
    delta?: string;
    up?: boolean;
    tone?: Tone;
    icon?: string;
  }>(),
  { up: true }
);

const TONE_CLASS: Record<Tone, string> = {
  sky: 'bg-sky text-sky-ink',
  lilac: 'bg-lilac text-lilac-ink',
  lime: 'bg-lime text-lime-ink',
  butter: 'bg-butter text-butter-ink',
};

const iconClass = computed(() => (props.tone ? TONE_CLASS[props.tone] : 'bg-canvas text-ink-2'));
</script>

<template>
  <div class="rounded-card bg-surface p-5 px-6 shadow-card">
    <div class="flex items-center gap-2.5">
      <span
        v-if="icon"
        :class="['grid h-8 w-8 place-items-center rounded-[11px]', iconClass]"
      >
        <AIcon :name="icon" :size="16" weight="bold" />
      </span>
      <span class="text-xs font-semibold text-ink-3">{{ label }}</span>
    </div>
    <div
      class="mt-3 font-display text-[38px] font-bold leading-none tracking-[-0.04em] [font-variant-numeric:tabular-nums]"
    >
      {{ value }}
    </div>
    <div
      v-if="delta"
      :class="['mt-2 text-xs font-semibold', up ? 'text-lime-ink' : 'text-ink-3']"
    >
      {{ delta }}
    </div>
  </div>
</template>
