<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

type Tone = 'bot' | 'human';

const props = withDefaults(
  defineProps<{
    variant: 'in' | 'bot' | 'human' | 'tool';
    who?: string;
    tone?: Tone;
    pending?: boolean;
    error?: boolean;
  }>(),
  { pending: false, error: false }
);

const classes = computed(() => {
  const base = 'max-w-[66%] px-4 py-2.5 text-[13.5px] leading-relaxed';
  switch (props.variant) {
    case 'in':
      return `${base} self-start rounded-[20px] rounded-bl-[7px] border-[1.5px] border-line bg-surface`;
    case 'bot':
      return `${base} self-end rounded-[20px] rounded-br-[7px] bg-ink-solid text-ink-contrast`;
    case 'human':
      return `${base} self-end rounded-[20px] rounded-br-[7px] bg-lilac-soft text-lilac-ink shadow-[inset_0_0_0_1.5px_var(--lilac)]`;
    default:
      return 'self-end rounded-[16px] px-4 py-2.5 text-xs font-semibold flex items-center gap-2';
  }
});
</script>

<template>
  <div :class="classes">
    <p v-if="who" class="mb-1 text-[11px] font-bold opacity-65">{{ who }}</p>
    <slot />
  </div>
</template>
