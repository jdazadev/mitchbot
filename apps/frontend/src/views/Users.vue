<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { userService, type SystemUser } from '../services/user.service';
import { projectService, type Project } from '../services/project.service';
import AIcon from '../components/ui/AIcon.vue';
import AAvatar from '../components/ui/AAvatar.vue';
import APill from '../components/ui/APill.vue';
import AButton from '../components/ui/AButton.vue';

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

const ROLE_TONES: Record<string, 'sky' | 'lilac' | 'lime' | 'ghost'> = {
  admin: 'sky',
  support: 'lilac',
  assistant: 'lime',
};

function roleTone(role: string) {
  return ROLE_TONES[role] || 'ghost';
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
  <div class="flex flex-col gap-3.5">
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="font-display text-[22px] font-bold tracking-[-0.02em]">{{ t('users.title') }}</h1>
        <p class="mt-1 text-[13px] text-ink-3">{{ t('users.subtitle', { count: totalUsers }) }}</p>
      </div>
      <AButton
        class="ml-auto"
        variant="primary"
        icon="UserPlus"
        @click="showCreateModal = true; formError = ''"
      >
        {{ t('users.create.title') }}
      </AButton>
    </div>

    <div v-if="formSuccess" class="flex items-center gap-2 rounded-card bg-lime-soft p-3.5 text-[13px] text-lime-ink">
      <AIcon name="CheckCircle" :size="17" />
      {{ formSuccess }}
    </div>

    <div class="flex gap-2.5">
      <div class="flex flex-1 items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 shadow-card">
        <AIcon name="MagnifyingGlass" :size="17" class="shrink-0 text-ink-3" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('users.searchPlaceholder')"
          class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3"
          @keydown.enter="handleSearch"
        />
      </div>
      <AButton variant="secondary" @click="handleSearch">{{ t('common.search') }}</AButton>
    </div>

    <div v-if="pageLoading" class="flex items-center justify-center gap-3 py-12 text-sm text-ink-3">
      <span class="animate-spin"><AIcon name="SpinnerGap" :size="20" /></span>
      {{ t('users.loading') }}
    </div>

    <div v-else class="overflow-hidden rounded-card bg-surface shadow-card">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                v-for="col in [
                  t('users.table.user'),
                  t('users.table.role'),
                  t('common.status'),
                  t('users.table.createdAt'),
                ]"
                :key="col"
                class="border-b-[1.5px] border-line px-4.5 py-3 text-left text-[11px] font-semibold text-ink-3"
              >
                {{ col }}
              </th>
              <th class="border-b-[1.5px] border-line px-4.5 py-3 text-right text-[11px] font-semibold text-ink-3">
                {{ t('common.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="users.length === 0">
              <td colspan="5" class="px-6 py-10 text-center text-sm text-ink-3">{{ t('users.table.empty') }}</td>
            </tr>
            <tr
              v-for="user in users"
              :key="user._id"
              class="border-b border-line transition-colors last:border-b-0 hover:bg-canvas"
            >
              <td class="px-4.5 py-3.5">
                <div class="flex items-center gap-2.5">
                  <AAvatar
                    :initials="(user.name || 'U').slice(0, 2).toUpperCase()"
                    :tone="roleTone(user.role) === 'ghost' ? 'sky' : (roleTone(user.role) as any)"
                  />
                  <div class="flex flex-col">
                    <span class="font-semibold">{{ user.name }}</span>
                    <span class="text-xs text-ink-3">{{ user.email }}</span>
                  </div>
                </div>
              </td>
              <td class="px-4.5 py-3.5">
                <APill :tone="roleTone(user.role)" size="sm">{{ t('users.roles.' + user.role) }}</APill>
              </td>
              <td class="px-4.5 py-3.5">
                <APill :tone="user.status === 'Active' ? 'lime' : 'ghost'" size="sm">
                  {{ user.status === 'Active' ? t('common.active') : t('common.inactive') }}
                </APill>
              </td>
              <td class="px-4.5 py-3.5 text-xs text-ink-3">{{ formatDate(user.createdAt) }}</td>
              <td class="px-4.5 py-3.5">
                <div class="flex justify-end">
                  <button
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                    :title="t('common.edit')"
                    @click="openEditModal(user)"
                  >
                    <AIcon name="PencilSimple" :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between border-t border-line px-4.5 py-3"
      >
        <span class="text-xs text-ink-3">{{ t('common.page') }} {{ currentPage }} {{ t('common.of') }} {{ totalPages }}</span>
        <div class="flex gap-2">
          <AButton variant="secondary" size="sm" :disabled="currentPage <= 1" @click="loadUsers(currentPage - 1)">
            {{ t('common.previous') }}
          </AButton>
          <AButton variant="secondary" size="sm" :disabled="currentPage >= totalPages" @click="loadUsers(currentPage + 1)">
            {{ t('common.next') }}
          </AButton>
        </div>
      </div>
    </div>

    <!-- Modal: Crear Usuario -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showCreateModal = false">
      <div class="w-full max-w-lg rounded-card bg-surface p-6 shadow-[var(--shadow-pop)]">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('users.create.title') }}</h2>
          <button type="button" class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas" @click="showCreateModal = false">
            <AIcon name="X" :size="18" />
          </button>
        </div>
        <div v-if="formError" class="mt-4 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]">{{ formError }}</div>
        <div class="mt-5 flex flex-col gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.name') }} *</span>
            <input v-model="createForm.name" class="field" :placeholder="t('users.form.namePlaceholder')" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.email') }} *</span>
            <input v-model="createForm.email" type="email" class="field" :placeholder="t('users.form.emailPlaceholder')" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.password') }} *</span>
            <input v-model="createForm.password" type="password" class="field" :placeholder="t('users.form.passwordPlaceholder')" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.role') }}</span>
            <select v-model="createForm.role" class="field appearance-none">
              <option v-for="r in roles" :key="r" :value="r">{{ t('users.roles.' + r) }}</option>
            </select>
          </label>
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.projects') }}</span>
            <div v-if="projects.length === 0" class="text-xs text-ink-3">{{ t('users.noProjects') }}</div>
            <div v-else class="flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-field bg-canvas p-2.5">
              <label v-for="p in projects" :key="p._id" class="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" class="accent-[color:var(--brand)]" :checked="createForm.projectIds.includes(p._id)" @change="toggleCreateProject(p._id)" />
                {{ p.name }}
              </label>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="showCreateModal = false">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" :loading="formLoading" @click="handleCreate">
            {{ formLoading ? t('users.create.submitting') : t('common.create') }}
          </AButton>
        </div>
      </div>
    </div>

    <!-- Modal: Editar Usuario -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showEditModal = false">
      <div class="w-full max-w-lg rounded-card bg-surface p-6 shadow-[var(--shadow-pop)]">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('users.edit.title') }}</h2>
          <button type="button" class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas" @click="showEditModal = false">
            <AIcon name="X" :size="18" />
          </button>
        </div>
        <div v-if="formError" class="mt-4 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]">{{ formError }}</div>
        <div class="mt-5 flex flex-col gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.name') }}</span>
            <input v-model="editForm.name" class="field" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.email') }}</span>
            <input v-model="editForm.email" type="email" class="field" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.role') }}</span>
            <select v-model="editForm.role" class="field appearance-none">
              <option v-for="r in roles" :key="r" :value="r">{{ t('users.roles.' + r) }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('common.status') }}</span>
            <select v-model="editForm.status" class="field appearance-none">
              <option value="Active">{{ t('common.active') }}</option>
              <option value="Inactive">{{ t('common.inactive') }}</option>
            </select>
          </label>
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('users.form.projects') }}</span>
            <div v-if="projects.length === 0" class="text-xs text-ink-3">{{ t('users.noProjects') }}</div>
            <div v-else class="flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-field bg-canvas p-2.5">
              <label v-for="p in projects" :key="p._id" class="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" class="accent-[color:var(--brand)]" :checked="editForm.projectIds.includes(p._id)" @change="toggleEditProject(p._id)" />
                {{ p.name }}
              </label>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="showEditModal = false">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" :loading="formLoading" @click="handleUpdate">
            {{ formLoading ? t('common.saving') : t('common.save') }}
          </AButton>
        </div>
      </div>
    </div>
  </div>
</template>
