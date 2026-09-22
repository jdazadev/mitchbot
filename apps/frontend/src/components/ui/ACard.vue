<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    tone?: 'default' | 'sunken' | 'lilac' | 'sky' | 'lime' | 'butter';
    pad?: boolean;
    big?: boolean;
    lift?: boolean;
  }>(),
  { tone: 'default', pad: false, big: false, lift: false }
);

const TONE_CLASS: Record<string, string> = {
  default: 'bg-surface',
  sunken: 'bg-canvas shadow-none',
  lilac: 'bg-lilac-soft',
  sky: 'bg-sky-soft',
  lime: 'bg-lime-soft',
  butter: 'bg-butter-soft',
};

const classes = computed(() => [
  props.lift ? 'shadow-[var(--shadow-pop)]' : 'shadow-card',
  'overflow-hidden',
  props.big ? 'rounded-big' : 'rounded-card',
  TONE_CLASS[props.tone],
  props.pad ? 'p-5 px-6' : '',
]);
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
