<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

const props = withDefaults(
  defineProps<{ label: string; icon?: string; active?: boolean }>(),
  { active: false }
);

const emit = defineEmits<{ toggle: [] }>();

const classes = computed(() => [
  'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150',
  props.active
    ? 'bg-lilac-soft text-lilac-ink'
    : 'text-ink-2 hover:bg-canvas hover:text-ink',
]);
</script>

<template>
  <button type="button" :class="classes" @click="emit('toggle')">
    <AIcon v-if="icon" :name="icon" :size="16" :weight="active ? 'bold' : 'regular'" />
    {{ label }}
  </button>
</template>
