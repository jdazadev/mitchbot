<script setup lang="ts">
import AIcon from './AIcon.vue';

withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    label?: string;
    hint?: string;
    icon?: string;
    type?: string;
    disabled?: boolean;
  }>(),
  { type: 'text', disabled: false }
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <label class="flex flex-col gap-1.5">
    <span v-if="label" class="text-xs font-semibold text-ink-2">{{ label }}</span>
    <span class="relative flex items-center">
      <AIcon
        v-if="icon"
        :name="icon"
        :size="17"
        class="pointer-events-none absolute left-3.5 text-ink-3"
      />
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="['field', icon ? 'pl-10' : '']"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </span>
    <span v-if="hint" class="text-[11.5px] text-ink-3">{{ hint }}</span>
  </label>
</template>
