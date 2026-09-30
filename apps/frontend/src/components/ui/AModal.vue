<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    label?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  }>(),
  { label: undefined, size: 'lg' }
);

const emit = defineEmits<{ (e: 'close'): void }>();

const SIZES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

const panel = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab' || !panel.value) return;
  const focusables = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', onKeydown, true);
      await nextTick();
      const target = panel.value?.querySelector<HTMLElement>(
        '[data-autofocus], input, select, textarea, button'
      );
      target?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown, true);
      lastFocused?.focus?.();
      lastFocused = null;
    }
  }
);

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <div class="absolute inset-0 bg-[color:var(--overlay)] backdrop-blur-sm" aria-hidden="true" />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
        :class="[
          'relative max-h-[90vh] w-full overflow-y-auto overscroll-contain rounded-card bg-surface shadow-[var(--shadow-pop)]',
          SIZES[size],
        ]"
        :style="{ maxHeight: 'min(90vh, 90dvh)' }"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
