<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { authService, type User } from '../../services/auth.service';

const router = useRouter();
const currentUser = ref<User | null>(null);
const showUserMenu = ref(false);

const navItems = computed(() => {
  const base = [
    { name: 'Dashboard', icon: 'dashboard', href: '/' },
    { name: 'Conversations', icon: 'chat', href: '/messaging', badge: '12' },
    { name: 'Contacts', icon: 'groups', href: '/contacts' },
    { name: 'Brain & RAG', icon: 'psychology', href: '/brain' },
    { name: 'Users', icon: 'manage_accounts', href: '/users' },
  ];

  if (currentUser.value?.role === 'devadmin') {
    base.push({ name: 'Proveedores', icon: 'admin_panel_settings', href: '/devadmin/models' });
    base.push({ name: 'Pruebas', icon: 'science', href: '/devadmin/tests' });
  }

  return base;
});

onMounted(() => {
  currentUser.value = authService.getUser();
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

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
}

async function handleLogout() {
  await authService.logout();
  router.push('/login');
}
</script>

<template>
  <aside
    class="hidden md:flex w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 transition-colors duration-200"
  >
    <div class="flex flex-col h-full">
      <div class="p-6">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"
          >
            <span class="material-symbols-outlined text-[24px]">smart_toy</span>
          </div>
          <div class="flex flex-col">
            <h1
              class="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white"
            >
              BotMaster
            </h1>
            <p class="text-xs font-medium text-slate-400 dark:text-slate-500">
              Analytics Panel
            </p>
          </div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1.5">
        <router-link
          v-for="item in navItems"
          :key="item.name"
          :to="item.href"
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-slate-200 transition-colors group"
          active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
        >
          <span
            class="material-symbols-outlined group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            :class="{ filled: $route.path === item.href }"
          >
            {{ item.icon }}
          </span>
          <span class="text-sm">{{ item.name }}</span>
          <span
            v-if="item.badge"
            class="ml-auto bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full"
          >
            {{ item.badge }}
          </span>
        </router-link>
      </nav>

      <div class="p-4 border-t border-slate-100 dark:border-slate-800">
        <router-link
          to="/settings"
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-slate-200 transition-colors group mb-2"
          active-class="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
        >
          <span
            class="material-symbols-outlined group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            >settings</span
          >
          <span class="text-sm font-medium">Configuración</span>
        </router-link>

        <!-- User Card con menú -->
        <div class="relative">
          <div
            @click="toggleUserMenu"
            class="flex items-center gap-3 px-3 py-3 mt-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
          >
            <div
              class="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center ring-2 ring-white dark:ring-slate-700 text-white text-xs font-bold"
            >
              {{ userInitials }}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <p
                class="text-sm font-semibold truncate text-slate-900 dark:text-white"
              >
                {{ currentUser?.name || 'Usuario' }}
              </p>
              <p class="text-xs text-slate-500 truncate dark:text-slate-400">
                {{ currentUser?.email || '' }}
              </p>
            </div>
            <span class="material-symbols-outlined text-slate-400 text-[18px] transition-transform" :class="{ 'rotate-180': showUserMenu }">expand_more</span>
          </div>

          <!-- Dropdown Menu -->
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
              class="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden z-50"
            >
              <router-link
                to="/profile"
                @click="showUserMenu = false"
                class="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">person</span>
                Mi Perfil
              </router-link>
              <div class="border-t border-slate-100 dark:border-slate-700"></div>
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">logout</span>
                Cerrar Sesión
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </aside>
</template>
