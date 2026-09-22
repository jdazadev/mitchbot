<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { userService, type SystemUser } from '../services/user.service';
import { projectService, type Project } from '../services/project.service';
import AIcon from '../components/ui/AIcon.vue';
import AAvatar from '../components/ui/AAvatar.vue';
import APill from '../components/ui/APill.vue';
import AButton from '../components/ui/AButton.vue';
import AModal from '../components/ui/AModal.vue';
import ADropdown from '../components/ui/ADropdown.vue';

const { t, locale } = useI18n();

const users = ref<SystemUser[]>([]);
const totalUsers = ref(0);
const currentPage = ref(1);
const totalPages = ref(1);
const pageSize = ref(10);
const pageLoading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');
const sortBy = ref('createdAt');
const sortOrder = ref<'asc' | 'desc'>('desc');
const projects = ref<Project[]>([]);

const roles = ['admin', 'support', 'assistant'] as const;
const pageSizeOptions = [5, 10, 25, 50];

const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingUser = ref<SystemUser | null>(null);
const createForm = ref({ name: '', email: '', password: '', role: 'support' as 'admin' | 'support' | 'assistant', projectIds: [] as string[] });
const editForm = ref<{ name: string; email: string; role: string; status: string; projectIds: string[] }>({ name: '', email: '', role: '', status: '', projectIds: [] });
const formLoading = ref(false);
const formError = ref('');
const formSuccess = ref('');

// Ignora respuestas fuera de orden cuando varios cambios disparan fetches seguidos.
let fetchSeq = 0;

async function loadUsers(page = currentPage.value) {
  const seq = ++fetchSeq;
  pageLoading.value = true;
  error.value = null;
  try {
    const result = await userService.list({
      page,
      limit: pageSize.value,
      q: searchQuery.value || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    });
    if (seq !== fetchSeq) return;
    users.value = result.items;
    totalUsers.value = result.total;
    currentPage.value = result.page;
    totalPages.value = result.totalPages;
  } catch (err: any) {
    if (seq !== fetchSeq) return;
    error.value = err.message || t('common.error');
  } finally {
    if (seq === fetchSeq) pageLoading.value = false;
  }
}

let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadUsers(1);
  }, 300);
});

watch([pageSize, sortBy, sortOrder], () => {
  loadUsers(1);
});

onMounted(async () => {
  loadUsers(1);
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
});

function toggleSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = field;
    sortOrder.value = 'asc';
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    loadUsers(page);
  }
}

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
    return new Date(dateStr).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-[13px] text-ink-3">{{ t('users.subtitle', { count: totalUsers }) }}</p>
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

    <div class="flex min-w-[240px] items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 shadow-card transition-shadow focus-within:shadow-[0_0_0_2px_var(--focus)]">
      <AIcon name="MagnifyingGlass" :size="17" class="shrink-0 text-ink-3" />
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('users.searchPlaceholder')"
        class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:shadow-none"
        @keydown.enter="loadUsers(1)"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-ink-3">
      <AIcon name="Users" :size="15" />
      {{ t('users.results.found', totalUsers) }}
      <span class="ml-auto flex items-center gap-2">
        <ADropdown
          :label="t('users.pagination.perPage')"
          :title="t('users.pagination.perPage')"
          role="listbox"
          haspopup="listbox"
          align="right"
          wrapper-class="shrink-0"
          trigger-class="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-2 transition-colors hover:bg-sunken"
          panel-class="w-24"
        >
          <template #trigger>
            {{ pageSize }}
            <AIcon name="CaretDown" :size="12" class="text-ink-3" />
          </template>
          <template #content="{ close }">
            <button
              v-for="size in pageSizeOptions"
              :key="size"
              type="button"
              role="option"
              :aria-selected="pageSize === size"
              class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
              :class="pageSize === size ? 'text-lilac-ink' : 'text-ink-2'"
              @click="pageSize = size; close()"
            >
              {{ size }}
              <AIcon v-if="pageSize === size" name="Check" :size="16" />
            </button>
          </template>
        </ADropdown>
        {{ t('users.pagination.perPage') }}
      </span>
    </div>

    <div
      v-if="error"
      role="alert"
      class="flex items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-4 text-[13px] text-[color:var(--danger)]"
    >
      <AIcon name="WarningCircle" :size="18" />
      <span class="flex-1">{{ t('users.errors.load', { message: error }) }}</span>
      <button type="button" class="shrink-0 font-semibold underline" @click="loadUsers(currentPage)">
        {{ t('common.retry') }}
      </button>
    </div>

    <div v-if="pageLoading" class="flex items-center justify-center gap-3 py-12 text-sm text-ink-3">
      <span class="animate-spin"><AIcon name="SpinnerGap" :size="20" /></span>
      {{ t('users.loading') }}
    </div>

    <div v-else-if="!error" class="overflow-hidden rounded-card bg-surface shadow-card">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                v-for="col in [
                  { key: 'name', label: t('users.table.user') },
                  { key: 'role', label: t('users.table.role') },
                  { key: 'status', label: t('common.status') },
                  { key: 'createdAt', label: t('users.table.createdAt') },
                ]"
                :key="col.key"
                scope="col"
                :aria-sort="sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
                class="border-b-[1.5px] border-line p-0 text-left text-[11px] font-semibold text-ink-3"
              >
                <button
                  type="button"
                  class="inline-flex w-full items-center gap-1 px-4.5 py-3 text-left transition-colors hover:text-ink focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
                  @click="toggleSort(col.key)"
                >
                  {{ col.label }}
                  <AIcon
                    :name="sortBy !== col.key ? 'CaretUpDown' : sortOrder === 'asc' ? 'CaretUp' : 'CaretDown'"
                    :size="13"
                  />
                </button>
              </th>
              <th scope="col" class="border-b-[1.5px] border-line px-4.5 py-3 text-right text-[11px] font-semibold text-ink-3">
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
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate font-semibold">{{ user.name }}</span>
                    <span class="truncate text-xs text-ink-3">{{ user.email }}</span>
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
                    :aria-label="t('common.edit')"
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
        class="flex items-center justify-between border-t border-line px-4.5 py-3.5"
      >
        <span class="text-xs text-ink-3">
          {{ t('common.page') }} {{ currentPage }} {{ t('common.of') }} {{ totalPages }}
        </span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            :disabled="currentPage === 1"
            class="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition-colors hover:bg-canvas disabled:opacity-30"
            :title="t('common.firstPage')"
            :aria-label="t('common.firstPage')"
            @click="goToPage(1)"
          >
            <AIcon name="CaretDoubleLeft" :size="16" />
          </button>
          <button
            type="button"
            :disabled="currentPage === 1"
            class="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition-colors hover:bg-canvas disabled:opacity-30"
            :title="t('common.previous')"
            :aria-label="t('common.previous')"
            @click="goToPage(currentPage - 1)"
          >
            <AIcon name="CaretLeft" :size="16" />
          </button>

          <template v-for="page in totalPages" :key="page">
            <button
              v-if="Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages"
              type="button"
              :class="[
                'grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors',
                page === currentPage ? 'bg-ink-solid text-ink-contrast' : 'text-ink-2 hover:bg-canvas',
              ]"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
            <span
              v-else-if="Math.abs(page - currentPage) === 3"
              class="text-xs text-line-strong"
            >…</span>
          </template>

          <button
            type="button"
            :disabled="currentPage === totalPages"
            class="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition-colors hover:bg-canvas disabled:opacity-30"
            :title="t('common.next')"
            :aria-label="t('common.next')"
            @click="goToPage(currentPage + 1)"
          >
            <AIcon name="CaretRight" :size="16" />
          </button>
          <button
            type="button"
            :disabled="currentPage === totalPages"
            class="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition-colors hover:bg-canvas disabled:opacity-30"
            :title="t('common.lastPage')"
            :aria-label="t('common.lastPage')"
            @click="goToPage(totalPages)"
          >
            <AIcon name="CaretDoubleRight" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Crear Usuario -->
    <AModal :open="showCreateModal" :label="t('users.create.title')" @close="showCreateModal = false">
      <div class="p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('users.create.title') }}</h2>
          <button type="button" class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas" :aria-label="t('common.close')" :title="t('common.close')" @click="showCreateModal = false">
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
    </AModal>

    <!-- Modal: Editar Usuario -->
    <AModal :open="showEditModal" :label="t('users.edit.title')" @close="showEditModal = false">
      <div class="p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('users.edit.title') }}</h2>
          <button type="button" class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas" :aria-label="t('common.close')" :title="t('common.close')" @click="showEditModal = false">
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
    </AModal>
  </div>
</template>
