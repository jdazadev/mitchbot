<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{ align?: 'left' | 'right'; width?: string }>(),
  { align: 'right', width: 'w-56' }
);

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}

function onPointerDown(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('mousedown', onPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('mousedown', onPointerDown);
});

const panelClass = computed(() => [
  'absolute z-40 mt-2 overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-pop)]',
  open.value ? '' : 'hidden',
  'top-full',
  props.align === 'right' ? 'right-0' : 'left-0',
  props.width,
]);

defineExpose({ close });
</script>

<template>
  <div ref="root" class="relative">
    <div @click="toggle">
      <slot name="trigger" :open="open" />
    </div>
    <div :class="panelClass">
      <slot :close="close" />
    </div>
  </div>
</template>
