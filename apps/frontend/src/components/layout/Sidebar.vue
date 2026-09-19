<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { authService, type User } from '../../services/auth.service';
import { socketService } from '../../services/socket.service';
import { useConversations } from '../../composables/useConversations';
import { useBrand } from '../../composables/useBrand';

const router = useRouter();
const { t } = useI18n();
const route = useRoute();
const currentUser = ref<User | null>(null);
const showUserMenu = ref(false);

const { unreadTotal, loadConversations, bindConversationSocket } = useConversations();
const { brand } = useBrand();

const navItems = computed(() => {
  return [
    { name: t('nav.dashboard'), icon: 'dashboard', href: '/', testId: 'dashboard' },
    {
      name: t('nav.conversations'),
      icon: 'chat',
      href: '/messaging',
      testId: 'conversations',
      badge: unreadTotal.value > 0 ? String(unreadTotal.value) : undefined,
    },
    { name: t('nav.clients'), icon: 'groups', href: '/clients', testId: 'clients' },
    { name: t('nav.brain'), icon: 'psychology', href: '/brain', testId: 'brain' },
    { name: t('nav.users'), icon: 'manage_accounts', href: '/users', testId: 'users' },
  ];
});

const orgItems = computed(() => [
  { name: t('nav.settings'), icon: 'settings', href: '/settings', testId: 'settings' },
  { name: t('nav.profile'), icon: 'person', href: '/profile', testId: 'profile' },
]);

onMounted(() => {
  currentUser.value = authService.getUser();
  // Socket compartido para mantener el conteo de no leídos en vivo.
  bindConversationSocket();
  loadConversations().catch(() => {});
});

const userInitials = computed(() => {
  if (!currentUser.value?.name) return '?';
  return currentUser.value.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

const projectInitial = computed(() => (brand.value.name || 'M').trim().charAt(0).toUpperCase());

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
}

async function handleLogout() {
  socketService.disconnect();
  await authService.logout();
  router.push('/login');
}
</script>

<template>
  <aside
    class="hidden md:flex w-72 flex-none flex-col border-r border-warm-line bg-warm-surface transition-colors duration-200"
  >
    <div class="flex flex-col h-full">
      <div class="p-5">
        <div class="flex items-center gap-3 px-1">
          <template v-if="brand.logo">
            <img
              :src="brand.logo"
              alt=""
              class="h-11 w-11 rounded-[12px_6px_12px_6px] object-cover shadow-[--shadow-card]"
            />
          </template>
          <template v-else>
            <div
              class="flex h-11 w-11 items-center justify-center rounded-[12px_6px_12px_6px] text-[18px] font-extrabold"
              :style="{ background: 'var(--brand)', color: 'var(--brand-contrast)' }"
            >
              {{ projectInitial }}
            </div>
          </template>
          <div class="flex flex-col min-w-0">
            <h1
              class="text-[17px] font-extrabold leading-tight text-warm-ink truncate"
            >
              {{ brand.name || t('app.name') }}
            </h1>
            <p class="text-[11px] font-bold text-warm-ink3 truncate">
              {{ brand.name ? t('app.tagline') : t('app.name') }}
            </p>
          </div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1">
        <p class="px-3 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-warm-ink3">
          {{ t('sidebar.operation') }}
        </p>
        <router-link
          v-for="item in navItems"
          :key="item.name"
          :to="item.href"
          :data-testid="'nav-' + item.testId"
          class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-warm-ink2 hover:bg-warm-deep hover:text-warm-ink transition-all duration-150"
          active-class="nav-active"
        >
          <span
            class="material-symbols-outlined text-[20px] transition-colors"
            :class="{ filled: route.path === item.href }"
            :style="route.path === item.href ? { color: 'var(--brand)' } : {}"
          >
            {{ item.icon }}
          </span>
          <span class="text-sm font-bold">{{ item.name }}</span>
          <span
            v-if="item.badge"
            class="ml-auto text-[11px] font-extrabold px-2 py-0.5 rounded-full"
            :style="{ background: 'var(--brand)', color: 'var(--brand-contrast)' }"
          >
            {{ item.badge }}
          </span>
        </router-link>
      </nav>

      <div class="p-4">
        <div>
          <router-link
            v-for="item in orgItems"
            :key="item.name"
            :to="item.href"
            :data-testid="'nav-' + item.testId"
            class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-warm-ink2 hover:bg-warm-deep hover:text-warm-ink transition-all duration-150"
            active-class="nav-active"
          >
            <span
              class="material-symbols-outlined text-[20px]"
              :style="route.path === item.href ? { color: 'var(--brand)' } : {}"
              >{{ item.icon }}</span
            >
            <span class="text-sm font-bold">{{ item.name }}</span>
          </router-link>
        </div>

        <!-- Tarjeta de usuario con menú -->
        <div class="relative mt-3">
          <div
            @click="toggleUserMenu"
            class="flex items-center gap-3 px-3 py-3 rounded-2xl bg-warm-ground hover:bg-warm-deep cursor-pointer transition-colors duration-150"
          >
            <div
              class="h-9 w-9 rounded-[12px_5px_12px_5px] flex items-center justify-center text-white text-xs font-extrabold"
              :style="{ background: 'var(--brand)' }"
            >
              {{ userInitials }}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <p class="text-sm font-bold truncate text-warm-ink">
                {{ currentUser?.name || t('nav.userPlaceholder') }}
              </p>
              <p class="text-[11px] text-warm-ink3 truncate font-bold">
                {{ currentUser?.email || '' }}
              </p>
            </div>
            <span
              class="material-symbols-outlined text-warm-ink3 text-[18px] transition-transform duration-150"
              :class="{ 'rotate-180': showUserMenu }"
              >expand_more</span
            >
          </div>

          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-1"
          >
            <div
              v-if="showUserMenu"
              class="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-warm-line bg-warm-surface shadow-[--shadow-pop] overflow-hidden z-50"
            >
              <router-link
                to="/profile"
                @click="showUserMenu = false"
                class="flex items-center gap-3 px-4 py-3 text-sm font-bold text-warm-ink2 hover:bg-warm-ground hover:text-warm-ink transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">person</span>
                {{ t('nav.profile') }}
              </router-link>
              <div class="border-t border-warm-line"></div>
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)] transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">logout</span>
                {{ t('nav.logout') }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.nav-active {
  color: var(--brand-ink);
}
.nav-active:hover {
  background: var(--brand-softer);
  color: var(--brand-ink);
}
</style>
