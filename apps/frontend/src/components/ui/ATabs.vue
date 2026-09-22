<script setup lang="ts">
import { ref, nextTick } from 'vue';

export interface TabItem {
  key: string;
  label: string;
  icon?: string;
}

const props = defineProps<{ tabs: TabItem[]; modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const tabRefs = ref<HTMLButtonElement[]>([]);

function select(key: string) {
  emit('update:modelValue', key);
}

async function onKeydown(event: KeyboardEvent, index: number) {
  const handled = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
  if (!handled.includes(event.key)) return;
  event.preventDefault();
  const count = props.tabs.length;
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % count;
  else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = count - 1;
  select(props.tabs[next].key);
  await nextTick();
  tabRefs.value[next]?.focus();
}
</script>

<template>
  <div class="flex flex-wrap gap-1 rounded-full bg-sunken p-1" role="tablist">
    <button
      v-for="(tab, index) in tabs"
      :key="tab.key"
      ref="tabRefs"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.key"
      :tabindex="modelValue === tab.key ? 0 : -1"
      :class="[
        'inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-[color,background-color,box-shadow] duration-150',
        modelValue === tab.key
          ? 'bg-surface text-ink shadow-card'
          : 'text-ink-2 hover:text-ink',
      ]"
      @click="select(tab.key)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
