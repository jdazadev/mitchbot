<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { projectService, type Project } from "../../services/project.service";
import { authService } from "../../services/auth.service";
import { socketService } from "../../services/socket.service";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

const pageTitle = computed(() => {
  switch (route.name) {
    case "dashboard":
      return t("topbar.dashboard");
    case "messaging":
      return t("topbar.messaging");
    case "brain":
      return t("topbar.brain");
    case "clients":
      return t("topbar.clients");
    default:
      return t("topbar.default");
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
  router.push({ name: "setup", query: { mode: "new" } });
}

// === Centro de notificaciones (alcance de sesión) ===
type NotificationLevel = "info" | "warning" | "urgent";

interface AdminNotification {
  id: string;
  message: string;
  level: NotificationLevel;
  conversationId?: string;
  createdAt: string;
  read: boolean;
}

const notifications = ref<AdminNotification[]>([]);
const notificationsOpen = ref(false);
const unreadCount = computed(
  () => notifications.value.filter((n) => !n.read).length
);

let notificationSeq = 0;

function handleNotification(data: any) {
  const level: NotificationLevel = ["info", "warning", "urgent"].includes(
    data?.level
  )
    ? data.level
    : "info";
  notifications.value.unshift({
    id: `${Date.now()}-${notificationSeq++}`,
    message: data?.message || t("topbar.newNotification"),
    level,
    conversationId: data?.conversationId,
    createdAt: data?.createdAt || new Date().toISOString(),
    read: false,
  });
}

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value;
}

function markAllRead() {
  notifications.value.forEach((n) => {
    n.read = true;
  });
}

function clearNotifications() {
  notifications.value = [];
}

function levelClass(level: NotificationLevel) {
  switch (level) {
    case "urgent":
      return "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
    case "warning":
      return "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
  }
}

function levelIcon(level: NotificationLevel) {
  switch (level) {
    case "urgent":
      return "priority_high";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("topbar.time.now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("topbar.time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("topbar.time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("topbar.time.daysAgo", { count: days });
}

onMounted(() => {
  socketService.onNotification(handleNotification);
});

onBeforeUnmount(() => {
  socketService.offNotification(handleNotification);
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
        data-testid="page-title"
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
            {{ activeProject?.name || t("topbar.selectProject") }}
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
              {{ t("topbar.noProjects") }}
            </p>
          </div>
          <button
            @click="createProject"
            class="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            {{ t("topbar.createProject") }}
          </button>
        </div>
      </div>

      <!-- Selector de idioma -->
      <div class="relative flex items-center">
        <span
          class="material-symbols-outlined absolute left-2 text-slate-400 text-[18px] pointer-events-none"
          >translate</span
        >
        <select
          v-model="locale"
          :aria-label="t('topbar.language')"
          data-testid="language-selector"
          class="appearance-none pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="es">{{ t("common.spanish") }}</option>
          <option value="en">{{ t("common.english") }}</option>
        </select>
        <span
          class="material-symbols-outlined absolute right-1.5 text-slate-400 text-[18px] pointer-events-none"
          >expand_more</span
        >
      </div>

      <div class="relative">
        <button
          @click="toggleNotifications"
          :aria-label="t('topbar.notifications')"
          class="p-2 relative text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        >
          <span class="material-symbols-outlined">notifications</span>
          <span
            v-if="unreadCount > 0"
            class="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-800"
          ></span>
        </button>

        <div
          v-if="notificationsOpen"
          class="fixed inset-0 z-30"
          @click="notificationsOpen = false"
        ></div>
        <div
          v-if="notificationsOpen"
          class="absolute right-0 mt-2 w-80 z-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700"
          >
            <span class="text-sm font-bold text-slate-800 dark:text-white"
              >{{ t("topbar.notifications") }}</span
            >
            <button
              v-if="unreadCount > 0"
              @click="markAllRead"
              class="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {{ t("topbar.markAllRead") }}
            </button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <p
              v-if="notifications.length === 0"
              class="px-4 py-8 text-center text-sm text-slate-400"
            >
              {{ t("topbar.noNotifications") }}
            </p>
            <template v-else>
              <div
                v-for="n in notifications"
                :key="n.id"
                class="flex gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                :class="n.read ? 'opacity-60' : ''"
              >
                <div
                  :class="[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    levelClass(n.level),
                  ]"
                >
                  <span class="material-symbols-outlined text-[18px]">{{
                    levelIcon(n.level)
                  }}</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <p
                    class="text-sm text-slate-700 dark:text-slate-200 break-words"
                  >
                    {{ n.message }}
                  </p>
                  <span
                    class="text-[10px] text-slate-400 font-medium mt-0.5"
                    >{{ formatNotificationTime(n.createdAt) }}</span
                  >
                </div>
                <span
                  v-if="!n.read"
                  class="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                ></span>
              </div>
            </template>
          </div>
          <button
            v-if="notifications.length > 0"
            @click="clearNotifications"
            class="w-full px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            {{ t("topbar.clearAll") }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
