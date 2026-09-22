<script setup lang="ts">
import { computed } from 'vue';

export interface TabItem {
  key: string;
  label: string;
  icon?: string;
}

const props = defineProps<{ tabs: TabItem[]; modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="flex flex-wrap gap-1 rounded-full bg-sunken p-1" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.key"
      :class="[
        'inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-150',
        modelValue === tab.key
          ? 'bg-surface text-ink shadow-card'
          : 'text-ink-2 hover:text-ink',
      ]"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
