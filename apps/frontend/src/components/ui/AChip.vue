<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

type Tone = 'neutral' | 'danger' | 'lilac' | 'sky' | 'lime';

const props = withDefaults(
  defineProps<{ tone?: Tone; icon?: string; removable?: boolean }>(),
  { tone: 'neutral', removable: false }
);

const emit = defineEmits<{ remove: [] }>();

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-2',
  danger: 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
  lilac: 'bg-lilac-soft text-lilac-ink',
  sky: 'bg-sky-soft text-sky-ink',
  lime: 'bg-lime-soft text-lime-ink',
};

const classes = computed(() => [
  'inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-medium px-2.5 py-1',
  TONE_CLASS[props.tone],
]);
</script>

<template>
  <span :class="classes">
    <AIcon v-if="icon" :name="icon" :size="13" />
    <slot />
    <button
      v-if="removable"
      type="button"
      class="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-black/5"
      @click="emit('remove')"
    >
      <AIcon name="close" :size="11" />
    </button>
  </span>
</template>
