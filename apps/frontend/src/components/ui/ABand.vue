<script setup lang="ts">
import { computed } from 'vue';

type Tone = 'sky' | 'lilac' | 'lime' | 'butter';

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    tone: Tone;
    icon?: string;
    actionLabel?: string;
    actionIcon?: string;
  }>(),
  { tone: 'sky' }
);

const emit = defineEmits<{ action: [] }>();

const TONE: Record<Tone, { bg: string; ink: string; btn: string }> = {
  sky: { bg: 'bg-sky-soft', ink: 'text-sky-ink', btn: 'bg-sky-ink' },
  lilac: { bg: 'bg-lilac-soft', ink: 'text-lilac-ink', btn: 'bg-lilac-ink' },
  lime: { bg: 'bg-lime-soft', ink: 'text-lime-ink', btn: 'bg-lime-ink' },
  butter: { bg: 'bg-butter-soft', ink: 'text-butter-ink', btn: 'bg-butter-ink' },
};

const t = computed(() => TONE[props.tone]);
</script>

<template>
  <div
    :class="[
      'flex flex-wrap items-center gap-5 rounded-big p-6 px-7',
      t.bg,
    ]"
  >
    <span
      v-if="icon"
      :class="['grid h-13 w-13 place-items-center rounded-[18px]', tone === 'sky' ? 'bg-sky' : tone === 'lime' ? 'bg-lime' : tone === 'lilac' ? 'bg-lilac' : 'bg-butter']"
    >
      <slot name="icon" />
    </span>
    <div class="min-w-[240px] flex-1">
      <div :class="['font-display text-lg font-bold tracking-[-0.02em]', t.ink]">
        {{ title }}
      </div>
      <p v-if="description" :class="['mt-1 text-xs leading-relaxed opacity-80', t.ink]">
        {{ description }}
      </p>
    </div>
    <button
      v-if="actionLabel"
      type="button"
      :class="[
        'ml-auto inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px',
        t.btn,
      ]"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
    <slot name="action" />
  </div>
</template>
