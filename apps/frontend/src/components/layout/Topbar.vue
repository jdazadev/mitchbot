<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { projectService, type Project } from "../../services/project.service";
import { authService } from "../../services/auth.service";
import { socketService } from "../../services/socket.service";

const route = useRoute();
const router = useRouter();

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

const projects = ref<Project[]>([]);
const activeProjectId = ref<string | null>(null);
const dropdownOpen = ref(false);
const switching = ref(false);

const activeProject = computed(
  () => projects.value.find((p) => p._id === activeProjectId.value) || null
);

onMounted(async () => {
  activeProjectId.value = authService.getActiveProjectId();
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
});

async function selectProject(project: Project) {
  if (project._id === activeProjectId.value) {
    dropdownOpen.value = false;
    return;
  }
  switching.value = true;
  try {
    await projectService.setActiveProject(project._id);
    activeProjectId.value = project._id;
    socketService.reconnect(project._id);
    window.location.reload();
  } catch (err) {
    console.error("Error al cambiar de proyecto:", err);
  } finally {
    switching.value = false;
    dropdownOpen.value = false;
  }
}

function createProject() {
  dropdownOpen.value = false;
  router.push({ name: "setup" });
}
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
      <!-- Selector de proyecto -->
      <div class="relative">
        <button
          @click="dropdownOpen = !dropdownOpen"
          :disabled="switching"
          class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors disabled:opacity-60"
        >
          <span class="material-symbols-outlined text-slate-400 text-[20px]">folder_open</span>
          <span class="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
            {{ activeProject?.name || "Selecciona proyecto" }}
          </span>
          <span class="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
        </button>

        <div
          v-if="dropdownOpen"
          class="fixed inset-0 z-30"
          @click="dropdownOpen = false"
        ></div>
        <div
          v-if="dropdownOpen"
          class="absolute right-0 mt-2 w-64 z-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
        >
          <div class="max-h-64 overflow-y-auto py-1">
            <button
              v-for="project in projects"
              :key="project._id"
              @click="selectProject(project)"
              class="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span
                class="truncate"
                :class="project._id === activeProjectId
                  ? 'font-bold text-blue-600'
                  : 'text-slate-700 dark:text-slate-200'"
              >
                {{ project.name }}
              </span>
              <span
                v-if="project._id === activeProjectId"
                class="material-symbols-outlined text-blue-600 text-[18px]"
              >check</span>
            </button>
            <p
              v-if="projects.length === 0"
              class="px-4 py-3 text-sm text-slate-400"
            >
              No tienes proyectos
            </p>
          </div>
          <button
            @click="createProject"
            class="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            Crear nuevo proyecto
          </button>
        </div>
      </div>

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
