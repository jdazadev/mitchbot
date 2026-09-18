<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { authService, type User } from '../services/auth.service';
import { projectService, type Project } from '../services/project.service';

const currentUser = ref<User | null>(null);
const projects = ref<Project[]>([]);
const profileForm = ref({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
const profileLoading = ref(false);
const profileSuccess = ref('');
const profileError = ref('');

onMounted(async () => {
  try {
    // Cargar perfil actualizado desde el servidor
    const user = await authService.getProfile();
    currentUser.value = user;
    profileForm.value.name = user.name;
    profileForm.value.email = user.email;
  } catch {
    // Fallback a datos locales
    currentUser.value = authService.getUser();
    if (currentUser.value) {
      profileForm.value.name = currentUser.value.name;
      profileForm.value.email = currentUser.value.email;
    }
  }
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
});

async function handleUpdateProfile() {
  profileError.value = '';
  profileSuccess.value = '';

  if (profileForm.value.newPassword && profileForm.value.newPassword !== profileForm.value.confirmPassword) {
    profileError.value = 'Las contraseñas no coinciden';
    return;
  }

  profileLoading.value = true;
  try {
    const data: any = {};
    if (profileForm.value.name !== currentUser.value?.name) data.name = profileForm.value.name;
    if (profileForm.value.email !== currentUser.value?.email) data.email = profileForm.value.email;
    if (profileForm.value.newPassword) {
      data.currentPassword = profileForm.value.currentPassword;
      data.newPassword = profileForm.value.newPassword;
    }

    const updated = await authService.updateProfile(data);
    currentUser.value = updated;
    profileSuccess.value = 'Perfil actualizado correctamente';
    profileForm.value.currentPassword = '';
    profileForm.value.newPassword = '';
    profileForm.value.confirmPassword = '';
  } catch (err: any) {
    profileError.value = err.message;
  } finally {
    profileLoading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Mi Perfil</h1>
        <p class="text-sm text-slate-500 mt-1">Gestiona tu información personal y contraseña</p>
      </div>
    </div>

    <div class="max-w-2xl">
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
        <!-- User avatar & info -->
        <div class="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-700">
          <div class="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center ring-4 ring-blue-100 dark:ring-blue-900/30 text-white text-xl font-bold">
            {{ currentUser?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?' }}
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">{{ currentUser?.name || 'Cargando...' }}</h2>
            <p class="text-sm text-slate-500">{{ currentUser?.email || '' }}</p>
            <span class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100">
              {{ currentUser?.role || '' }}
            </span>
          </div>
        </div>

        <div class="mb-6 pb-6 border-b border-slate-100 dark:border-slate-700">
          <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">folder_open</span>
            Mis Proyectos ({{ projects.length }})
          </h2>
          <div v-if="projects.length === 0" class="text-sm text-slate-400">Sin proyectos asignados</div>
          <div v-else class="flex flex-wrap gap-2">
            <span
              v-for="p in projects"
              :key="p._id"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium"
            >
              <span
                class="material-symbols-outlined text-[14px]"
                :class="p._id === currentUser?.activeProjectId ? 'text-blue-600' : 'text-slate-400'"
              >folder</span>
              {{ p.name }}
            </span>
          </div>
        </div>

        <h2 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">person</span>
          Información Personal
        </h2>

        <!-- Success / Error -->
        <div v-if="profileSuccess" class="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          {{ profileSuccess }}
        </div>
        <div v-if="profileError" class="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ profileError }}
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre</label>
            <input v-model="profileForm.name" type="text" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Email</label>
            <input v-model="profileForm.email" type="email" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white" />
          </div>

          <div class="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
            <h3 class="text-xs font-bold text-slate-500 uppercase mb-3">Cambiar Contraseña</h3>
            <div class="flex flex-col gap-3">
              <input v-model="profileForm.currentPassword" type="password" placeholder="Contraseña actual" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white" />
              <input v-model="profileForm.newPassword" type="password" placeholder="Nueva contraseña" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white" />
              <input v-model="profileForm.confirmPassword" type="password" placeholder="Confirmar nueva contraseña" class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button
              @click="handleUpdateProfile"
              :disabled="profileLoading"
              class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm"
            >
              {{ profileLoading ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
