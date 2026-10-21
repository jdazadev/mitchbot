<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { setLocale } from '../../i18n';
import { projectService, type Project } from '../../services/project.service';
import { authService, type User } from '../../services/auth.service';
import { socketService } from '../../services/socket.service';
import { useTheme } from '../../composables/useTheme';
import AIcon from '../ui/AIcon.vue';
import AAvatar from '../ui/AAvatar.vue';
import ADropdown from '../ui/ADropdown.vue';
import AModal from '../ui/AModal.vue';
import AButton from '../ui/AButton.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { theme, toggleTheme } = useTheme();

const emit = defineEmits<{ (e: 'toggle-nav'): void }>();

withDefaults(defineProps<{ navOpen?: boolean }>(), { navOpen: false });

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
    case 'tools':
      return t('nav.tools');
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

// === Reloj (invariante del topbar) ===
const clock = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | undefined;

const clockLabel = computed(() => {
  const date = clock.value.toLocaleDateString(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = clock.value.toLocaleTimeString(locale.value, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} ${time}`;
});
const clockIso = computed(() => clock.value.toISOString());

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
const switching = ref(false);
const projectError = ref<string | null>(null);

const activeProject = computed(
  () => projects.value.find((p) => p._id === activeProjectId.value) || null
);

const projectTriggerClass =
  'flex min-w-0 items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[13px] font-semibold shadow-card transition-colors hover:bg-canvas disabled:opacity-60';

async function selectProject(project: Project) {
  if (project._id === activeProjectId.value) return;
  switching.value = true;
  projectError.value = null;
  try {
    await projectService.setActiveProject(project._id);
    activeProjectId.value = project._id;
    socketService.reconnect(project._id);
    window.location.reload();
  } catch (err: any) {
    projectError.value = t('topbar.projectSwitchError', { message: err?.message || '' });
  } finally {
    switching.value = false;
  }
}

// === Crear proyecto (modal) ===
const createOpen = ref(false);
const creating = ref(false);
const createError = ref<string | null>(null);
const createForm = ref({ name: '', description: '' });

function openCreateProject() {
  projectError.value = null;
  createForm.value = { name: '', description: '' };
  createError.value = null;
  createOpen.value = true;
}

async function submitCreateProject() {
  const name = createForm.value.name.trim();
  if (!name) {
    createError.value = t('topbar.createModal.errors.nameRequired');
    return;
  }
  creating.value = true;
  createError.value = null;
  try {
    const { project } = await projectService.createProject({
      name,
      description: createForm.value.description.trim() || undefined,
      agent: {
        name: t('topbar.createModal.defaultAgentName'),
        description: '',
        personality: {
          role: 'assistant',
          traits: ['neutral'],
          emojiUsage: 'medium',
          language: 'es',
          responseLength: 'medium',
          ragBehavior: 'hybrid',
        },
      },
      config: {
        channels: { whatsapp: true, instagram: false, web: true },
        options: { autoCreateContact: true },
      },
    });
    try {
      await authService.getProfile();
    } catch {
      /* noop */
    }
    createOpen.value = false;
    socketService.reconnect(project._id);
    window.location.reload();
  } catch (err: any) {
    createError.value = t('topbar.createModal.errors.create', { message: err?.message || '' });
  } finally {
    creating.value = false;
  }
}

// === Idioma ===
const localeOptions = computed(() =>
  [
    { value: 'es' as const, label: t('common.spanish') },
    { value: 'en' as const, label: t('common.english') },
  ]
);

async function selectLocale(value: 'es' | 'en') {
  await setLocale(value);
}

// === Usuario ===
async function handleLogout() {
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

const iconButtonClass =
  'grid h-9.5 w-9.5 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-colors hover:bg-canvas hover:text-ink';

onMounted(async () => {
  clockTimer = setInterval(() => {
    clock.value = new Date();
  }, 10_000);
  currentUser.value = authService.getUser();
  activeProjectId.value = authService.getActiveProjectId();
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
  socketService.onNotification(handleNotification);
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  socketService.offNotification(handleNotification);
});
</script>

<template>
  <header class="relative z-20 px-[var(--shell-pad)] pb-[var(--shell-pad)] pt-[var(--shell-pad)] md:pl-[var(--rail-offset)]">
    <div class="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-2.5">
      <button
        type="button"
        data-testid="nav-toggle"
        :aria-label="t('nav.primary')"
        :title="t('nav.primary')"
        :aria-expanded="navOpen"
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-colors hover:bg-canvas hover:text-ink md:hidden"
        @click="emit('toggle-nav')"
      >
        <AIcon name="List" :size="19" />
      </button>

      <h2
        data-testid="page-title"
        class="font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-ink"
      >
        {{ pageTitle }}
      </h2>

      <div class="ml-auto flex min-w-0 items-center gap-2.5">
        <div
          class="mr-1 hidden items-center gap-2 whitespace-nowrap text-[12.5px] font-semibold text-ink-3 min-[1360px]:flex"
        >
          <AIcon name="Clock" :size="15" class="text-ink-3" />
          <time :datetime="clockIso" class="[font-variant-numeric:tabular-nums]">{{ clockLabel }}</time>
        </div>

        <!-- Proyectos -->
        <ADropdown
          :label="t('topbar.selectProject')"
          :title="t('topbar.selectProject')"
          testid="project-selector"
          align="right"
          :disabled="switching"
          :trigger-class="projectTriggerClass"
          panel-class="w-64"
        >
          <template #trigger>
            <span class="h-2 w-2 rounded-full" :style="{ background: 'var(--brand)' }" />
            <span class="min-w-0 max-w-[150px] truncate">
              {{ activeProject?.name || t('topbar.selectProject') }}
            </span>
            <AIcon name="CaretDown" :size="15" class="text-ink-3" />
          </template>

          <template #content="{ close }">
            <div
              v-if="projectError"
              role="alert"
              class="flex items-start gap-2 border-b border-line bg-[color:var(--danger-soft)] px-4 py-3 text-[12px] text-[color:var(--danger)]"
            >
              <AIcon name="WarningCircle" :size="15" class="mt-0.5 shrink-0" />
              <span class="min-w-0 flex-1 break-words">{{ projectError }}</span>
            </div>
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
              @click="close(); openCreateProject()"
            >
              <AIcon name="Plus" :size="16" />
              {{ t('topbar.createProject') }}
            </button>
          </template>
        </ADropdown>

        <!-- Idiomas -->
        <ADropdown
          :label="t('topbar.language')"
          :title="t('topbar.language')"
          testid="language-selector"
          align="right"
          wrapper-class="shrink-0"
          panel-class="w-48"
          :trigger-class="iconButtonClass"
        >
          <template #trigger>
            <AIcon name="Translate" :size="18" />
          </template>
          <template #content="{ close }">
            <button
              v-for="option in localeOptions"
              :key="option.value"
              type="button"
              role="menuitemradio"
              :data-locale="option.value"
              :aria-checked="locale === option.value"
              class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
              :class="locale === option.value ? 'text-lilac-ink' : 'text-ink-2'"
              @click="selectLocale(option.value); close()"
            >
              {{ option.label }}
              <AIcon v-if="locale === option.value" name="Check" :size="16" />
            </button>
          </template>
        </ADropdown>

        <!-- Tema -->
        <button
          type="button"
          data-testid="theme-toggle"
          :aria-label="theme === 'dark' ? t('topbar.themeLight') : t('topbar.themeDark')"
          :title="theme === 'dark' ? t('topbar.themeLight') : t('topbar.themeDark')"
          class="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-colors hover:bg-canvas hover:text-ink"
          @click="toggleTheme"
        >
          <AIcon :name="theme === 'dark' ? 'Sun' : 'MoonStars'" :size="18" />
        </button>

        <!-- Notificaciones -->
        <ADropdown
          :label="t('topbar.notifications')"
          :title="t('topbar.notifications')"
          role="dialog"
          haspopup="dialog"
          align="right"
          wrapper-class="shrink-0"
          panel-class="w-80"
          :trigger-class="'relative ' + iconButtonClass"
        >
          <template #trigger>
            <AIcon name="Bell" :size="18" />
            <span
              v-if="unreadCount > 0"
              data-testid="notification-dot"
              class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full"
              :style="{ background: 'var(--brand)', boxShadow: '0 0 0 2px var(--surface)' }"
            />
          </template>
          <template #content>
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
          </template>
        </ADropdown>

        <!-- Usuario -->
        <ADropdown
          :label="t('nav.profile')"
          :title="t('nav.profile')"
          align="right"
          panel-class="w-56"
          trigger-class="flex min-w-0 items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 shadow-card transition-colors hover:bg-canvas"
        >
          <template #trigger>
            <AAvatar :initials="userInitials" tone="lilac" size="sm" />
            <span class="min-w-0 max-w-[110px] truncate text-[13px] font-semibold">
              {{ currentUser?.name || t('nav.userPlaceholder') }}
            </span>
            <AIcon name="CaretDown" :size="15" class="text-ink-3" />
          </template>
          <template #content="{ close }">
            <div class="border-b border-line px-4 py-3">
              <p class="truncate text-sm font-bold">{{ currentUser?.name }}</p>
              <p class="truncate text-[11px] font-semibold text-ink-3">{{ currentUser?.email }}</p>
            </div>
            <router-link
              to="/settings"
              role="menuitem"
              class="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink-2 hover:bg-canvas hover:text-ink"
              @click="close"
            >
              <AIcon name="GearSix" :size="16" />
              {{ t('nav.settings') }}
            </router-link>
            <router-link
              to="/profile"
              role="menuitem"
              class="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink-2 hover:bg-canvas hover:text-ink"
              @click="close"
            >
              <AIcon name="User" :size="16" />
              {{ t('nav.profile') }}
            </router-link>
            <div class="h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
              @click="close(); handleLogout()"
            >
              <AIcon name="SignOut" :size="16" />
              {{ t('nav.logout') }}
            </button>
          </template>
        </ADropdown>
      </div>
    </div>

    <!-- Modal: Crear proyecto -->
    <AModal
      :open="createOpen"
      :label="t('topbar.createModal.title')"
      size="md"
      @close="createOpen = false"
    >
      <div class="p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">
            {{ t('topbar.createModal.title') }}
          </h2>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
            :aria-label="t('common.close')"
            :title="t('common.close')"
            @click="createOpen = false"
          >
            <AIcon name="X" :size="18" />
          </button>
        </div>
        <p class="mt-1 text-xs text-ink-3">{{ t('topbar.createModal.subtitle') }}</p>

        <div
          v-if="createError"
          role="alert"
          class="mt-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ createError }}
        </div>

        <div class="mt-5 flex flex-col gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('topbar.createModal.name') }}</span>
            <input
              v-model="createForm.name"
              data-autofocus
              class="field"
              :placeholder="t('topbar.createModal.namePlaceholder')"
              @keydown.enter.prevent="submitCreateProject"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('topbar.createModal.description') }}</span>
            <textarea
              v-model="createForm.description"
              class="field h-24 resize-none"
              :placeholder="t('topbar.createModal.descriptionPlaceholder')"
            />
          </label>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="createOpen = false">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" :loading="creating" @click="submitCreateProject">
            {{ creating ? t('topbar.createModal.creating') : t('topbar.createModal.submit') }}
          </AButton>
        </div>
      </div>
    </AModal>
  </header>
</template>
