<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    icon?: string;
    title: string;
    description?: string;
    actionLabel?: string;
    actionIcon?: string;
  }>(),
  {}
);

const emit = defineEmits<{ action: [] }>();

const hasAction = computed(() => Boolean(props.actionLabel));
</script>

<template>
  <div class="flex flex-wrap items-center gap-5">
    <span
      v-if="icon"
      class="grid h-13 w-13 place-items-center rounded-[18px] bg-canvas text-ink-2"
    >
      <AIcon :name="icon" :size="24" />
    </span>
    <div class="min-w-[240px] flex-1">
      <div class="font-display text-lg font-bold tracking-[-0.02em]">{{ title }}</div>
      <p v-if="description" class="mt-1 text-xs leading-relaxed text-ink-3">{{ description }}</p>
    </div>
    <button
      v-if="hasAction"
      type="button"
      class="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(11,11,12,0.2)]"
      @click="emit('action')"
    >
      <AIcon v-if="actionIcon" :name="actionIcon" :size="17" />
      {{ actionLabel }}
    </button>
    <slot name="action" />
  </div>
</template>
