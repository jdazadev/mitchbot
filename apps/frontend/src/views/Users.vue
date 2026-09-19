<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { userService, type SystemUser } from '../services/user.service';
import { projectService, type Project } from '../services/project.service';

const { t } = useI18n();

const users = ref<SystemUser[]>([]);
const totalUsers = ref(0);
const currentPage = ref(1);
const totalPages = ref(1);
const pageLoading = ref(true);
const searchQuery = ref('');
const projects = ref<Project[]>([]);

const roles = ['admin', 'support', 'assistant'] as const;

const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingUser = ref<SystemUser | null>(null);
const createForm = ref({ name: '', email: '', password: '', role: 'support' as 'admin' | 'support' | 'assistant', projectIds: [] as string[] });
const editForm = ref<{ name: string; email: string; role: string; status: string; projectIds: string[] }>({ name: '', email: '', role: '', status: '', projectIds: [] });
const formLoading = ref(false);
const formError = ref('');
const formSuccess = ref('');

async function loadUsers(page = 1) {
  pageLoading.value = true;
  try {
    const result = await userService.list({
      page,
      limit: 10,
      q: searchQuery.value || undefined,
    });
    users.value = result.items;
    totalUsers.value = result.total;
    currentPage.value = result.page;
    totalPages.value = result.totalPages;
  } catch (err: any) {
    console.error('Error loading users:', err);
  } finally {
    pageLoading.value = false;
  }
}

onMounted(async () => {
  loadUsers();
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
});

function toggleCreateProject(id: string) {
  const list = createForm.value.projectIds;
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
}

function toggleEditProject(id: string) {
  const list = editForm.value.projectIds;
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
}

function handleSearch() {
  loadUsers(1);
}

function openEditModal(user: SystemUser) {
  editingUser.value = user;
  editForm.value = {
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    projectIds: (user.projectIds || []).map((id: any) => id.toString()),
  };
  showEditModal.value = true;
  formError.value = '';
}

async function handleCreate() {
  formError.value = '';
  formLoading.value = true;
  try {
    await userService.create(createForm.value);
    showCreateModal.value = false;
    createForm.value = { name: '', email: '', password: '', role: 'support', projectIds: [] };
    formSuccess.value = t('users.toast.created');
    setTimeout(() => { formSuccess.value = ''; }, 3000);
    await loadUsers(currentPage.value);
  } catch (err: any) {
    formError.value = err.message;
  } finally {
    formLoading.value = false;
  }
}

async function handleUpdate() {
  if (!editingUser.value) return;
  formError.value = '';
  formLoading.value = true;
  try {
    await userService.update(editingUser.value._id, editForm.value as any);
    showEditModal.value = false;
    formSuccess.value = t('users.toast.updated');
    setTimeout(() => { formSuccess.value = ''; }, 3000);
    await loadUsers(currentPage.value);
  } catch (err: any) {
    formError.value = err.message;
  } finally {
    formLoading.value = false;
  }
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case 'admin': return 'bg-red-50 text-red-700 border-red-100';
    case 'support': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'assistant': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    default: return 'bg-slate-50 text-slate-500 border-slate-200';
  }
}

function getStatusBadgeClass(status: string) {
  return status === 'Active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : 'bg-slate-100 text-slate-500 border-slate-200';
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('users.title') }}</h1>
        <p class="text-sm text-slate-500 mt-1">{{ t('users.subtitle', { count: totalUsers }) }}</p>
      </div>
      <button
        @click="showCreateModal = true; formError = ''"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 uppercase text-sm"
      >
        <span class="material-symbols-outlined text-[20px]">person_add</span>
        {{ t('users.create.title') }}
      </button>
    </div>

    <!-- Success message -->
    <div v-if="formSuccess" class="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-600 flex items-center gap-2">
      <span class="material-symbols-outlined text-[18px]">check_circle</span>
      {{ formSuccess }}
    </div>

    <!-- Search Bar -->
    <div class="flex gap-3">
      <div class="flex-1 relative">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
        <input
          v-model="searchQuery"
          @keydown.enter="handleSearch"
          type="text"
          :placeholder="t('users.searchPlaceholder')"
          class="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
        />
      </div>
      <button @click="handleSearch" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
        {{ t('common.search') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pageLoading" class="flex items-center justify-center p-12">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-slate-500">{{ t('users.loading') }}</span>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50/50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-widest">
            <th class="px-6 py-4">{{ t('users.table.user') }}</th>
            <th class="px-6 py-4">{{ t('users.table.role') }}</th>
            <th class="px-6 py-4">{{ t('common.status') }}</th>
            <th class="px-6 py-4">{{ t('users.table.createdAt') }}</th>
            <th class="px-6 py-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
          <tr v-if="users.length === 0">
            <td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">{{ t('users.table.empty') }}</td>
          </tr>
          <tr v-for="user in users" :key="user._id" class="hover:bg-slate-50/50 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {{ user.name[0] }}
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-slate-900 dark:text-white">{{ user.name }}</span>
                  <span class="text-xs text-slate-400">{{ user.email }}</span>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border', getRoleBadgeClass(user.role)]">
                {{ t('users.roles.' + user.role) }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border', getStatusBadgeClass(user.status)]">
                {{ user.status === 'Active' ? t('common.active') : t('common.inactive') }}
              </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-400">{{ formatDate(user.createdAt) }}</td>
            <td class="px-6 py-4 text-right">
              <button @click="openEditModal(user)" class="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors" :title="t('common.edit')">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-700">
        <span class="text-xs text-slate-400">{{ t('common.page') }} {{ currentPage }} {{ t('common.of') }} {{ totalPages }}</span>
        <div class="flex gap-2">
          <button
            @click="loadUsers(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="px-3 py-1 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            {{ t('common.previous') }}
          </button>
          <button
            @click="loadUsers(currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="px-3 py-1 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            {{ t('common.next') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Crear Usuario -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" @click.self="showCreateModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold text-slate-900">{{ t('users.create.title') }}</h2>
          <button @click="showCreateModal = false" class="p-1 hover:bg-slate-100 rounded-lg"><span class="material-symbols-outlined text-slate-400">close</span></button>
        </div>
        <div v-if="formError" class="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{{ formError }}</div>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.name') }} *</label>
            <input v-model="createForm.name" :placeholder="t('users.form.namePlaceholder')" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.email') }} *</label>
            <input v-model="createForm.email" type="email" :placeholder="t('users.form.emailPlaceholder')" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.password') }} *</label>
            <input v-model="createForm.password" type="password" :placeholder="t('users.form.passwordPlaceholder')" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.role') }}</label>
            <select v-model="createForm.role" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option v-for="r in roles" :key="r" :value="r">{{ t('users.roles.' + r) }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.projects') }}</label>
            <div v-if="projects.length === 0" class="text-xs text-slate-400">{{ t('users.noProjects') }}</div>
            <div v-else class="flex flex-col gap-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
              <label v-for="p in projects" :key="p._id" class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" :checked="createForm.projectIds.includes(p._id)" @change="toggleCreateProject(p._id)" class="h-4 w-4 accent-blue-600" />
                {{ p.name }}
              </label>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showCreateModal = false" class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">{{ t('common.cancel') }}</button>
          <button
            @click="handleCreate"
            :disabled="formLoading"
            class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm transition-colors"
          >
            {{ formLoading ? t('users.create.submitting') : t('common.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Editar Usuario -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" @click.self="showEditModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold text-slate-900">{{ t('users.edit.title') }}</h2>
          <button @click="showEditModal = false" class="p-1 hover:bg-slate-100 rounded-lg"><span class="material-symbols-outlined text-slate-400">close</span></button>
        </div>
        <div v-if="formError" class="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{{ formError }}</div>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.name') }}</label>
            <input v-model="editForm.name" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.email') }}</label>
            <input v-model="editForm.email" type="email" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.role') }}</label>
            <select v-model="editForm.role" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option v-for="r in roles" :key="r" :value="r">{{ t('users.roles.' + r) }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('common.status') }}</label>
            <select v-model="editForm.status" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="Active">{{ t('common.active') }}</option>
              <option value="Inactive">{{ t('common.inactive') }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('users.form.projects') }}</label>
            <div v-if="projects.length === 0" class="text-xs text-slate-400">{{ t('users.noProjects') }}</div>
            <div v-else class="flex flex-col gap-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
              <label v-for="p in projects" :key="p._id" class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" :checked="editForm.projectIds.includes(p._id)" @change="toggleEditProject(p._id)" class="h-4 w-4 accent-blue-600" />
                {{ p.name }}
              </label>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showEditModal = false" class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">{{ t('common.cancel') }}</button>
          <button
            @click="handleUpdate"
            :disabled="formLoading"
            class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm transition-colors"
          >
            {{ formLoading ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
