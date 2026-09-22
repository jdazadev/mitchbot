<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

type Tone = 'sky' | 'lilac' | 'lime' | 'butter';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{ initials?: string; tone?: Tone; size?: Size; icon?: string }>(),
  { tone: 'sky', size: 'md' }
);

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8.5 w-8.5 text-[11.5px]',
  md: 'h-9.5 w-9.5 text-[12.5px]',
  lg: 'h-10.5 w-10.5 text-[14px]',
};

const TONE_CLASS: Record<Tone, string> = {
  sky: 'bg-sky text-sky-ink',
  lilac: 'bg-lilac text-lilac-ink',
  lime: 'bg-lime text-lime-ink',
  butter: 'bg-butter text-butter-ink',
};

const classes = computed(() => [
  'grid shrink-0 place-items-center rounded-full font-bold',
  SIZE_CLASS[props.size],
  props.icon ? 'bg-sunken text-ink-2' : TONE_CLASS[props.tone],
]);
</script>

<template>
  <span :class="classes">
    <AIcon v-if="icon" :name="icon" :size="18" />
    <template v-else>{{ initials }}</template>
  </span>
</template>
