<script setup lang="ts">
import { computed } from 'vue';

type Tone = 'lime' | 'lilac' | 'sky' | 'butter' | 'danger' | 'ghost' | 'solid-lime' | 'solid-lilac' | 'solid-sky';
type Size = 'sm' | 'md';

const props = withDefaults(
  defineProps<{ tone?: Tone; size?: Size; dot?: boolean }>(),
  { tone: 'ghost', size: 'md', dot: true }
);

const TONE_CLASS: Record<Tone, string> = {
  lime: 'bg-lime-soft text-lime-ink',
  lilac: 'bg-lilac-soft text-lilac-ink',
  sky: 'bg-sky-soft text-sky-ink',
  butter: 'bg-butter-soft text-butter-ink',
  danger: 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
  ghost: 'bg-canvas text-ink-2',
  'solid-lime': 'bg-lime text-lime-ink',
  'solid-lilac': 'bg-lilac text-lilac-ink',
  'solid-sky': 'bg-sky text-sky-ink',
};

const classes = computed(() => [
  'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
  props.size === 'sm' ? 'text-[10.5px] px-2.5 py-0.5' : 'text-[11.5px] px-2.5 py-1',
  TONE_CLASS[props.tone],
]);
</script>

<template>
  <span :class="classes">
    <span v-if="dot" class="h-1.5 w-1.5 rounded-full bg-current" />
    <slot />
  </span>
</template>
