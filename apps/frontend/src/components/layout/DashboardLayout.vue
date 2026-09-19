<script setup lang="ts">
import Sidebar from "./Sidebar.vue";
import Topbar from "./Topbar.vue";

defineProps<{
  noPadding?: boolean;
}>();
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden">
    <Sidebar />
    <main
      class="flex-1 flex flex-col h-full overflow-hidden relative bg-warm-ground"
    >
      <Topbar />
      <div class="flex-1 overflow-y-auto" :class="{ 'p-6 md:p-8': !noPadding }">
        <div :class="{ 'max-w-7xl mx-auto': !noPadding, 'h-full': noPadding }">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
