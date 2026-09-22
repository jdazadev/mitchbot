<script setup lang="ts">
import AuroraRail from './AuroraRail.vue';
import AuroraTopbar from './AuroraTopbar.vue';

defineProps<{
  noPadding?: boolean;
}>();
</script>

<template>
  <div class="relative flex h-screen w-full overflow-hidden">
    <div class="aurora-haze" aria-hidden="true" />
    <AuroraRail />
    <main class="relative z-10 flex h-full flex-1 flex-col overflow-hidden">
      <AuroraTopbar />
      <div class="flex-1 overflow-y-auto px-3.5 pb-3.5 md:pl-[242px]">
        <div :class="{ 'h-full': noPadding }">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
