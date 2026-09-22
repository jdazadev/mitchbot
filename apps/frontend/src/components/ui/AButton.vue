<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    icon?: string;
    iconWeight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    trailingIcon?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
  }>(),
  { variant: 'primary', size: 'md', type: 'button', disabled: false, loading: false, block: false }
);

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-ink-solid text-ink-contrast hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(11,11,12,0.2)]',
  secondary: 'bg-sunken text-ink hover:shadow-[0_8px_18px_rgba(11,11,12,0.1)]',
  ghost: 'bg-transparent text-ink-2 hover:bg-canvas hover:text-ink',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'text-xs px-3.5 py-1.5 gap-1.5',
  md: 'text-[13px] px-5 py-2.5 gap-2',
  lg: 'text-sm px-6 py-3 gap-2',
};

const iconSize = computed(() => (props.size === 'sm' ? 15 : props.size === 'lg' ? 19 : 17));

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-full font-semibold cursor-pointer select-none',
  'transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none',
  VARIANT_CLASS[props.variant],
  SIZE_CLASS[props.size],
  props.block ? 'w-full' : '',
]);
</script>

<template>
  <button :type="type" :disabled="disabled || loading" :class="classes">
    <span v-if="loading" class="animate-spin"><AIcon name="progress_activity" :size="iconSize" /></span>
    <AIcon v-else-if="icon" :name="icon" :size="iconSize" :weight="iconWeight" />
    <slot />
    <AIcon v-if="trailingIcon" :name="trailingIcon" :size="iconSize" />
  </button>
</template>
