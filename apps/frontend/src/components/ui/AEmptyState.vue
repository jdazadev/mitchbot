<script setup lang="ts">
import AIcon from './AIcon.vue';
import AButton from './AButton.vue';

withDefaults(
  defineProps<{ icon?: string; title: string; description?: string; actionLabel?: string }>(),
  {}
);

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <span
      v-if="icon"
      class="grid h-14 w-14 place-items-center rounded-[20px] bg-canvas text-ink-3"
    >
      <AIcon :name="icon" :size="26" />
    </span>
    <div class="font-display text-base font-bold tracking-[-0.02em]">{{ title }}</div>
    <p v-if="description" class="max-w-[38ch] text-[13px] leading-relaxed text-ink-3">
      {{ description }}
    </p>
    <AButton
      v-if="actionLabel"
      variant="primary"
      class="mt-1"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </AButton>
  </div>
</template>
