<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const pageTitle = computed(() => {
  switch (route.name) {
    case "dashboard":
      return "Dashboard Overview";
    case "messaging":
      return "Conversations";
    case "brain":
      return "Brain & RAG Manager";
    case "contacts":
      return "Contacts";
    default:
      return "BotMaster";
  }
});
</script>

<template>
  <header
    class="h-16 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md dark:bg-slate-800/80 z-20 sticky top-0 border-b border-slate-200/60 dark:border-slate-700/60"
  >
    <div class="flex items-center gap-4">
      <button
        class="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400"
      >
        <span class="material-symbols-outlined">menu</span>
      </button>
      <h2
        class="text-xl font-bold text-slate-800 dark:text-white tracking-tight"
      >
        {{ pageTitle }}
      </h2>
    </div>
    <div class="flex items-center gap-4">
      <div
        class="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer"
      >
        <span class="material-symbols-outlined text-slate-400 text-[20px]"
          >calendar_today</span
        >
        <span class="text-sm font-medium text-slate-600 dark:text-slate-300"
          >Last 30 Days</span
        >
        <span class="material-symbols-outlined text-slate-400 text-[20px]"
          >expand_more</span
        >
      </div>
      <button
        class="p-2 relative text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
      >
        <span class="material-symbols-outlined">notifications</span>
        <span
          class="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-800"
        ></span>
      </button>
    </div>
  </header>
</template>
