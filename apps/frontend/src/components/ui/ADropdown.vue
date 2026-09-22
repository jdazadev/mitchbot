<script setup lang="ts">
import { ref, nextTick } from 'vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    title?: string;
    testid?: string;
    role?: 'menu' | 'listbox' | 'dialog';
    haspopup?: 'menu' | 'listbox' | 'dialog';
    align?: 'left' | 'right';
    triggerClass?: string;
    panelClass?: string;
    wrapperClass?: string;
    disabled?: boolean;
    autoFocus?: boolean;
  }>(),
  {
    label: undefined,
    title: undefined,
    testid: undefined,
    role: 'menu',
    haspopup: 'menu',
    align: 'right',
    triggerClass: '',
    panelClass: '',
    wrapperClass: '',
    disabled: false,
    autoFocus: false,
  }
);

const emit = defineEmits<{ (e: 'open'): void; (e: 'close'): void }>();

const open = ref(false);
const panel = ref<HTMLElement | null>(null);

async function openPanel() {
  if (open.value || props.disabled) return;
  open.value = true;
  emit('open');
  if (props.autoFocus) {
    await nextTick();
    panel.value?.focus();
  }
}

function close() {
  if (!open.value) return;
  open.value = false;
  emit('close');
}

function toggle() {
  if (open.value) close();
  else openPanel();
}

defineExpose({ open: openPanel, close });
</script>

<template>
  <div :class="['relative flex min-w-0', wrapperClass]" @keydown.escape="close">
    <button
      type="button"
      :disabled="disabled"
      :aria-label="label"
      :title="title"
      :aria-haspopup="haspopup"
      :aria-expanded="open"
      :data-testid="testid"
      :class="triggerClass"
      @click="toggle"
    >
      <slot name="trigger" :open="open" />
    </button>

    <div v-if="open" class="fixed inset-0 z-30" aria-hidden="true" @click="close" />
    <div
      v-if="open"
      ref="panel"
      :role="role"
      :tabindex="autoFocus ? -1 : undefined"
      :aria-label="label"
      :class="[
        'absolute z-40 mt-2 max-w-[calc(100vw-1.75rem)] overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)] focus:outline-none',
        align === 'right' ? 'right-0' : 'left-0',
        panelClass,
      ]"
    >
      <slot name="content" :close="close" />
    </div>
  </div>
</template>
