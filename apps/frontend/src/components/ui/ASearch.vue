<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AIcon from './AIcon.vue';

withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    pill?: boolean;
    disabled?: boolean;
  }>(),
  { pill: true, disabled: false }
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useI18n();
</script>

<template>
  <span
    :class="[
      'flex flex-1 items-center gap-2.5 bg-surface px-4.5 py-2.5 shadow-card transition-shadow focus-within:shadow-[0_0_0_2px_var(--focus)]',
      pill ? 'rounded-full' : 'rounded-field',
    ]"
  >
    <AIcon name="search" :size="17" class="shrink-0 text-ink-3" />
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:shadow-none"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      type="button"
      :aria-label="t('common.clear')"
      class="shrink-0 rounded-full p-0.5 text-ink-3 hover:bg-canvas hover:text-ink"
      @click="emit('update:modelValue', '')"
    >
      <AIcon name="close" :size="14" />
    </button>
  </span>
</template>
