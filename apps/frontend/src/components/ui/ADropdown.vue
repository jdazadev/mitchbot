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
  }
);

const emit = defineEmits<{ (e: 'open'): void; (e: 'close'): void }>();

const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);

const ITEM_SELECTOR =
  '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

function focusableItems(): HTMLElement[] {
  if (!panel.value) return [];
  return Array.from(panel.value.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true'
  );
}

function focusItem(index: number) {
  const items = focusableItems();
  if (items.length === 0) return;
  const clamped = ((index % items.length) + items.length) % items.length;
  items[clamped]?.focus();
}

function moveFocus(delta: number) {
  const items = focusableItems();
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  if (current === -1) {
    focusItem(delta > 0 ? 0 : items.length - 1);
    return;
  }
  focusItem(current + delta);
}

async function openPanel() {
  if (open.value || props.disabled) return;
  open.value = true;
  emit('open');
  await nextTick();
  const items = focusableItems();
  if (items.length === 0) {
    panel.value?.focus();
    return;
  }
  const checked = items.findIndex(
    (el) => el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true'
  );
  focusItem(checked >= 0 ? checked : 0);
}

function close() {
  if (!open.value) return;
  open.value = false;
  emit('close');
  trigger.value?.focus();
}

function toggle() {
  if (open.value) close();
  else openPanel();
}

function onPanelKeydown(event: KeyboardEvent) {
  if (props.role === 'dialog') return;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveFocus(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFocus(-1);
      break;
    case 'Home':
      event.preventDefault();
      focusItem(0);
      break;
    case 'End':
      event.preventDefault();
      focusItem(focusableItems().length - 1);
      break;
    case 'Tab':
      close();
      break;
  }
}

defineExpose({ open: openPanel, close });
</script>

<template>
  <div :class="['relative flex min-w-0', wrapperClass]" @keydown.escape="close">
    <button
      ref="trigger"
      type="button"
      :disabled="disabled"
      :aria-label="label"
      :title="title"
      :aria-haspopup="haspopup"
      :aria-expanded="open"
      :data-testid="testid"
      :class="triggerClass"
      @click="toggle"
      @keydown.down.prevent="openPanel"
      @keydown.up.prevent="openPanel"
    >
      <slot name="trigger" :open="open" />
    </button>

    <div v-if="open" class="fixed inset-0 z-30" aria-hidden="true" @click="close" />
    <div
      v-if="open"
      ref="panel"
      :role="role"
      tabindex="-1"
      :aria-label="label"
      :class="[
        'absolute z-40 mt-2 max-w-[calc(100vw-1.75rem)] overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)] focus:outline-none',
        align === 'right' ? 'right-0' : 'left-0',
        panelClass,
      ]"
      @keydown="onPanelKeydown"
    >
      <slot name="content" :close="close" />
    </div>
  </div>
</template>
