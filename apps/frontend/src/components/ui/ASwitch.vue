<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ modelValue: boolean; disabled?: boolean; ariaLabel?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const classes = computed(() => [
  'relative h-6 w-10.5 shrink-0 cursor-pointer appearance-none rounded-full transition-colors duration-150',
  props.modelValue ? 'bg-lilac' : 'bg-sunken',
  props.disabled ? 'cursor-not-allowed opacity-45' : '',
]);
</script>

<template>
  <label class="inline-flex items-center gap-3">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :class="classes"
      class="before:absolute before:left-[3px] before:top-[3px] before:h-4.5 before:w-4.5 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(0,0,0,0.2)] before:transition-transform before:duration-150 checked:before:translate-x-[18px]"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="text-[13.5px] font-medium"><slot /></span>
  </label>
</template>
