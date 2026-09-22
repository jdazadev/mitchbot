<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { projectService, type Project } from '../../services/project.service';
import { authService, type User } from '../../services/auth.service';
import { socketService } from '../../services/socket.service';
import AIcon from '../ui/AIcon.vue';
import AAvatar from '../ui/AAvatar.vue';
import TopbarContext from './TopbarContext.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

const emit = defineEmits<{ (e: 'toggle-nav'): void }>();

withDefaults(defineProps<{ navOpen?: boolean }>(), { navOpen: false });

function closeMenus() {
  projectOpen.value = false;
  notificationsOpen.value = false;
  userOpen.value = false;
}
function toggleMenu(menu: 'project' | 'notifications' | 'user') {
  const next = {
    project: menu === 'project' ? !projectOpen.value : false,
    notifications: menu === 'notifications' ? !notificationsOpen.value : false,
    user: menu === 'user' ? !userOpen.value : false,
  };
  projectOpen.value = next.project;
  notificationsOpen.value = next.notifications;
  userOpen.value = next.user;
}

const pageTitle = computed(() => {
  switch (route.name) {
    case 'dashboard':
      return t('topbar.dashboard');
    case 'messaging':
      return t('topbar.messaging');
    case 'brain':
      return t('topbar.brain');
    case 'clients':
      return t('topbar.clients');
    case 'users':
      return t('nav.users');
    case 'settings':
      return t('nav.settings');
    case 'profile':
      return t('nav.profile');
    case 'dev-tests':
      return t('devTests.title');
    default:
      return t('topbar.default');
  }
});

const currentUser = ref<User | null>(null);

const userInitials = computed(() => {
  if (!currentUser.value?.name) return '?';
  return currentUser.value.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

// === Selector de proyecto ===
const projects = ref<Project[]>([]);
const activeProjectId = ref<string | null>(null);
const projectOpen = ref(false);
const switching = ref(false);

const activeProject = computed(
  () => projects.value.find((p) => p._id === activeProjectId.value) || null
);

async function selectProject(project: Project) {
  if (project._id === activeProjectId.value) {
    projectOpen.value = false;
    return;
  }
  switching.value = true;
  try {
    await projectService.setActiveProject(project._id);
    activeProjectId.value = project._id;
    socketService.reconnect(project._id);
    window.location.reload();
  } catch (err) {
    console.error('Error al cambiar de proyecto:', err);
  } finally {
    switching.value = false;
    projectOpen.value = false;
  }
}

function createProject() {
  projectOpen.value = false;
  router.push({ name: 'setup', query: { mode: 'new' } });
}

// === Usuario ===
const userOpen = ref(false);

async function handleLogout() {
  userOpen.value = false;
  socketService.disconnect();
  await authService.logout();
  router.push('/login');
}

// === Notificaciones ===
type NotificationLevel = 'info' | 'warning' | 'urgent';

interface AdminNotification {
  id: string;
  message: string;
  level: NotificationLevel;
  createdAt: string;
  read: boolean;
}

const notifications = ref<AdminNotification[]>([]);
const notificationsOpen = ref(false);
const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length);

let notificationSeq = 0;

function handleNotification(data: any) {
  const level: NotificationLevel = ['info', 'warning', 'urgent'].includes(data?.level)
    ? data.level
    : 'info';
  notifications.value.unshift({
    id: `${Date.now()}-${notificationSeq++}`,
    message: data?.message || t('topbar.newNotification'),
    level,
    createdAt: data?.createdAt || new Date().toISOString(),
    read: false,
  });
}

function markAllRead() {
  notifications.value.forEach((n) => {
    n.read = true;
  });
}

function levelTone(level: NotificationLevel) {
  switch (level) {
    case 'urgent':
      return 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]';
    case 'warning':
      return 'bg-butter-soft text-butter-ink';
    default:
      return 'bg-sky-soft text-sky-ink';
  }
}

function levelIcon(level: NotificationLevel) {
  switch (level) {
    case 'urgent':
      return 'WarningCircle';
    case 'warning':
      return 'Warning';
    default:
      return 'Info';
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t('topbar.time.now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('topbar.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('topbar.time.hoursAgo', { count: hours });
  return t('topbar.time.daysAgo', { count: Math.floor(hours / 24) });
}

onMounted(async () => {
  currentUser.value = authService.getUser();
  activeProjectId.value = authService.getActiveProjectId();
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
  socketService.onNotification(handleNotification);
});
</script>

<template>
  <header class="relative z-20 px-3.5 pb-3.5 pt-3.5 md:pl-[242px]">
    <div class="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-2.5">
      <button
        type="button"
        data-testid="nav-toggle"
        :aria-label="t('nav.primary')"
        :aria-expanded="navOpen"
        class="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-colors hover:bg-canvas hover:text-ink md:hidden"
        @click="emit('toggle-nav')"
      >
        <AIcon name="List" :size="19" />
      </button>

      <h2
        data-testid="page-title"
        class="rounded-full bg-surface px-4 py-2 font-display text-[15px] font-bold tracking-[-0.02em] shadow-card"
      >
        {{ pageTitle }}
      </h2>

      <TopbarContext />

      <div class="ml-auto flex items-center gap-2">
        <!-- Proyectos -->
        <div class="relative" @keydown.escape="projectOpen = false">
          <button
            type="button"
            :disabled="switching"
            aria-haspopup="menu"
            :aria-expanded="projectOpen"
            class="flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[13px] font-semibold shadow-card transition-colors hover:bg-canvas disabled:opacity-60"
            @click="toggleMenu('project')"
          >
            <span class="h-2 w-2 rounded-full" :style="{ background: 'var(--brand)' }" />
            <span class="max-w-[150px] truncate">
              {{ activeProject?.name || t('topbar.selectProject') }}
            </span>
            <AIcon name="CaretDown" :size="15" class="text-ink-3" />
          </button>

          <div v-if="projectOpen" class="fixed inset-0 z-30" aria-hidden="true" @click="projectOpen = false" />
          <div
            v-if="projectOpen"
            role="menu"
            class="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)]"
          >
            <div class="max-h-64 overflow-y-auto py-1">
              <button
                v-for="project in projects"
                :key="project._id"
                type="button"
                role="menuitem"
                class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
                @click="selectProject(project)"
              >
                <span
                  class="truncate"
                  :class="project._id === activeProjectId ? 'text-lilac-ink' : 'text-ink-2'"
                >
                  {{ project.name }}
                </span>
                <AIcon
                  v-if="project._id === activeProjectId"
                  name="Check"
                  :size="16"
                  class="text-lilac-ink"
                />
              </button>
              <p v-if="projects.length === 0" class="px-4 py-3 text-sm font-semibold text-ink-3">
                {{ t('topbar.noProjects') }}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-sm font-semibold text-lilac-ink hover:bg-canvas"
              @click="createProject"
            >
              <AIcon name="Plus" :size="16" />
              {{ t('topbar.createProject') }}
            </button>
          </div>
        </div>

        <!-- Idiomas -->
        <div class="relative flex items-center">
          <AIcon
            name="Translate"
            :size="16"
            class="pointer-events-none absolute left-3 text-ink-3"
          />
          <select
            v-model="locale"
            :aria-label="t('topbar.language')"
            data-testid="language-selector"
            class="appearance-none rounded-full bg-surface py-2 pl-9 pr-7 text-[13px] font-semibold text-ink-2 shadow-card transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]"
          >
            <option value="es">{{ t('common.spanish') }}</option>
            <option value="en">{{ t('common.english') }}</option>
          </select>
          <AIcon
            name="CaretDown"
            :size="15"
            class="pointer-events-none absolute right-2.5 text-ink-3"
          />
        </div>

        <!-- Notificaciones -->
        <div class="relative" @keydown.escape="notificationsOpen = false">
          <button
            type="button"
            :aria-label="t('topbar.notifications')"
            aria-haspopup="dialog"
            :aria-expanded="notificationsOpen"
            class="relative grid h-9.5 w-9.5 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-colors hover:bg-canvas hover:text-ink"
            @click="toggleMenu('notifications')"
          >
            <AIcon name="Bell" :size="18" />
            <span
              v-if="unreadCount > 0"
              data-testid="notification-dot"
              class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full"
              :style="{ background: 'var(--brand)', boxShadow: '0 0 0 2px var(--surface)' }"
            />
          </button>

          <div v-if="notificationsOpen" class="fixed inset-0 z-30" aria-hidden="true" @click="notificationsOpen = false" />
          <div
            v-if="notificationsOpen"
            role="dialog"
            :aria-label="t('topbar.notifications')"
            class="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)]"
          >
            <div class="flex items-center justify-between border-b border-line px-4 py-3">
              <span class="text-sm font-bold">{{ t('topbar.notifications') }}</span>
              <button
                v-if="unreadCount > 0"
                type="button"
                class="text-xs font-bold text-lilac-ink hover:opacity-80"
                @click="markAllRead"
              >
                {{ t('topbar.markAllRead') }}
              </button>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <p
                v-if="notifications.length === 0"
                class="px-4 py-8 text-center text-sm font-semibold text-ink-3"
              >
                {{ t('topbar.noNotifications') }}
              </p>
              <div
                v-for="n in notifications"
                v-else
                :key="n.id"
                :class="['flex gap-3 border-b border-line px-4 py-3 last:border-0', n.read ? 'opacity-60' : '']"
              >
                <div
                  :class="[
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                    levelTone(n.level),
                  ]"
                >
                  <AIcon :name="levelIcon(n.level)" :size="16" weight="bold" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <p class="break-words text-sm">{{ n.message }}</p>
                  <span class="mt-0.5 text-[10px] font-semibold text-ink-3">
                    {{ formatNotificationTime(n.createdAt) }}
                  </span>
                </div>
              </div>
            </div>
            <button
              v-if="notifications.length > 0"
              type="button"
              class="w-full border-t border-line px-4 py-2.5 text-sm font-semibold text-ink-2 hover:bg-canvas"
              @click="notifications = []"
            >
              {{ t('topbar.clearAll') }}
            </button>
          </div>
        </div>

        <!-- Usuario -->
        <div class="relative" @keydown.escape="userOpen = false">
          <button
            type="button"
            aria-haspopup="menu"
            :aria-expanded="userOpen"
            :aria-label="t('nav.profile')"
            class="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 shadow-card transition-colors hover:bg-canvas"
            @click="toggleMenu('user')"
          >
            <AAvatar :initials="userInitials" tone="lilac" size="sm" />
            <span class="max-w-[110px] truncate text-[13px] font-semibold">
              {{ currentUser?.name || t('nav.userPlaceholder') }}
            </span>
            <AIcon name="CaretDown" :size="15" class="text-ink-3" />
          </button>

          <div v-if="userOpen" class="fixed inset-0 z-30" aria-hidden="true" @click="userOpen = false" />
          <div
            v-if="userOpen"
            role="menu"
            class="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-card bg-surface shadow-[var(--shadow-pop)]"
          >
            <div class="border-b border-line px-4 py-3">
              <p class="truncate text-sm font-bold">{{ currentUser?.name }}</p>
              <p class="truncate text-[11px] font-semibold text-ink-3">{{ currentUser?.email }}</p>
            </div>
            <router-link
              to="/profile"
              role="menuitem"
              class="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink-2 hover:bg-canvas hover:text-ink"
              @click="userOpen = false"
            >
              <AIcon name="User" :size="16" />
              {{ t('nav.profile') }}
            </router-link>
            <div class="h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
              @click="handleLogout"
            >
              <AIcon name="SignOut" :size="16" />
              {{ t('nav.logout') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
