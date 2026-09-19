<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  clientService,
  type Contact,
  type ContactsResponse,
  type ContactFilters,
} from "../services/client.service";

const { t } = useI18n();

const STATUS_LABEL_KEYS: Record<string, string> = {
  Active: "clients.status.active",
  New: "clients.status.new",
  Inactive: "clients.status.inactive",
  Archived: "clients.status.archived",
};

function statusLabel(status: string) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

// Estado
const contactsData = ref<ContactsResponse>({
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
});
const isLoading = ref(true);
const error = ref<string | null>(null);

// Filtros
const searchQuery = ref("");
const filterPlatform = ref("All");
const filterStatus = ref("All");
const sortBy = ref("createdAt");
const sortOrder = ref<"asc" | "desc">("desc");
const currentPage = ref(1);
const pageSize = ref(10);

// Modal de edición
const showEditModal = ref(false);
const editingContact = ref<Contact | null>(null);
const editForm = ref<Partial<Contact>>({});

// Modal de confirmación de archivar
const showArchiveModal = ref(false);
const archivingContact = ref<Contact | null>(null);

const contacts = computed(() => contactsData.value.items);
const totalPages = computed(() => contactsData.value.totalPages);
const totalContacts = computed(() => contactsData.value.total);

// Watcher para re-fetch cuando cambian filtros
let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    fetchContacts();
  }, 300);
});

watch([filterPlatform, filterStatus, sortBy, sortOrder, currentPage, pageSize], () => {
  fetchContacts();
});

// Ignora respuestas fuera de orden cuando varios filtros disparan fetches seguidos.
let fetchSeq = 0;

async function fetchContacts() {
  const seq = ++fetchSeq;
  try {
    isLoading.value = true;
    error.value = null;

    const filters: ContactFilters = {
      q: searchQuery.value || undefined,
      page: currentPage.value,
      limit: pageSize.value,
      platform: filterPlatform.value,
      status: filterStatus.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      includeArchived: filterStatus.value === 'Archived',
    };

    const data = await clientService.getContacts(filters);
    if (seq !== fetchSeq) return;
    contactsData.value = data;
  } catch (err: any) {
    if (seq !== fetchSeq) return;
    error.value = err.message;
  } finally {
    if (seq === fetchSeq) isLoading.value = false;
  }
}

onMounted(() => {
  fetchContacts();
});

function getAvatar(contact: Contact) {
  return (
    contact.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`
  );
}

// === Ordenamiento ===
function toggleSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortOrder.value = "asc";
  }
}

function getSortIcon(field: string) {
  if (sortBy.value !== field) return "unfold_more";
  return sortOrder.value === "asc" ? "expand_less" : "expand_more";
}

// === Paginación ===
function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

// === Editar ===
function openEditModal(contact: Contact) {
  editingContact.value = contact;
  editForm.value = {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    platform: contact.platform,
    status: contact.status,
    tags: [...(contact.tags || [])],
    metadata: { ...contact.metadata },
  };
  showEditModal.value = true;
}

async function saveEdit() {
  if (!editingContact.value) return;
  try {
    await clientService.updateContact(editingContact.value._id, editForm.value);
    showEditModal.value = false;
    editingContact.value = null;
    fetchContacts();
  } catch (err: any) {
    alert(t("clients.errors.update", { message: err.message }));
  }
}

// === Archivar (soft delete) ===
function openArchiveModal(contact: Contact) {
  archivingContact.value = contact;
  showArchiveModal.value = true;
}

async function confirmArchive() {
  if (!archivingContact.value) return;
  try {
    await clientService.archiveContact(archivingContact.value._id);
    showArchiveModal.value = false;
    archivingContact.value = null;
    fetchContacts();
  } catch (err: any) {
    alert(t("clients.errors.archive", { message: err.message }));
  }
}

// === Restaurar ===
async function restoreContact(contact: Contact) {
  try {
    await clientService.restoreContact(contact._id);
    fetchContacts();
  } catch (err: any) {
    alert(t("clients.errors.restore", { message: err.message }));
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header con búsqueda y filtros -->
    <div
      class="flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm"
    >
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <!-- Búsqueda -->
          <div class="relative w-64">
            <span class="absolute left-3 top-2.5 text-slate-400">
              <span class="material-symbols-outlined text-[18px]">search</span>
            </span>
            <input
              v-model="searchQuery"
              class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              :placeholder="t('clients.search.placeholder')"
              type="text"
            />
          </div>

          <!-- Filtro por plataforma -->
          <select
            v-model="filterPlatform"
            data-testid="clients-platform-filter"
            class="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">{{ t('clients.filters.allPlatforms') }}</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Web">Web</option>
          </select>

          <!-- Filtro por status -->
          <select
            v-model="filterStatus"
            data-testid="clients-status-filter"
            class="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">{{ t('clients.filters.allStatuses') }}</option>
            <option value="Active">{{ statusLabel('Active') }}</option>
            <option value="New">{{ statusLabel('New') }}</option>
            <option value="Inactive">{{ statusLabel('Inactive') }}</option>
            <option value="Archived">{{ statusLabel('Archived') }}</option>
          </select>
        </div>

        <!-- Info: los contactos se crean automáticamente -->
        <div class="flex items-center gap-2 text-xs text-slate-400">
          <span class="material-symbols-outlined text-[16px]">info</span>
          {{ t('clients.hint.autoCreated') }}
        </div>
      </div>

      <!-- Info de resultados -->
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>{{ t('clients.results.found', totalContacts) }}</span>
        <div class="flex items-center gap-2">
          <span>{{ t('clients.pagination.show') }}</span>
          <select
            v-model="pageSize"
            class="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-xs"
          >
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
          <span>{{ t('clients.pagination.perPage') }}</span>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div
      class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
    >
      <div v-if="isLoading" class="p-8 text-center text-slate-500">
        {{ t('clients.loading') }}
      </div>
      <div v-else-if="error" class="p-8 text-center text-red-500">
        {{ error }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr
              class="bg-slate-50/50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-widest"
            >
              <th class="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors select-none" @click="toggleSort('name')">
                <div class="flex items-center gap-1">
                  {{ t('clients.table.client') }}
                  <span class="material-symbols-outlined text-[14px]">{{ getSortIcon('name') }}</span>
                </div>
              </th>
              <th class="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors select-none" @click="toggleSort('platform')">
                <div class="flex items-center gap-1">
                  {{ t('clients.table.platform') }}
                  <span class="material-symbols-outlined text-[14px]">{{ getSortIcon('platform') }}</span>
                </div>
              </th>
              <th class="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors select-none" @click="toggleSort('status')">
                <div class="flex items-center gap-1">
                  {{ t('common.status') }}
                  <span class="material-symbols-outlined text-[14px]">{{ getSortIcon('status') }}</span>
                </div>
              </th>
              <th class="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors select-none" @click="toggleSort('phone')">
                <div class="flex items-center gap-1">
                  {{ t('common.phone') }}
                  <span class="material-symbols-outlined text-[14px]">{{ getSortIcon('phone') }}</span>
                </div>
              </th>
              <th class="px-6 py-4 cursor-pointer hover:text-slate-700 transition-colors select-none" @click="toggleSort('createdAt')">
                <div class="flex items-center gap-1">
                  {{ t('clients.table.created') }}
                  <span class="material-symbols-outlined text-[14px]">{{ getSortIcon('createdAt') }}</span>
                </div>
              </th>
              <th class="px-6 py-4 text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            <tr
              v-for="contact in contacts"
              :key="contact._id || contact.email"
              :class="[
                'hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors',
                contact.status === 'Archived' ? 'opacity-50' : ''
              ]"
            >
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-cover bg-center border border-slate-100"
                    :style="{ backgroundImage: `url(${getAvatar(contact)})` }"
                  ></div>
                  <div class="flex flex-col">
                    <span
                      class="text-sm font-bold text-slate-900 dark:text-white"
                      >{{ contact.name }}</span
                    >
                    <span class="text-xs text-slate-400">{{
                      contact.email || t('clients.noEmail')
                    }}</span>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      contact.platform === 'WhatsApp' ? 'bg-green-500' : contact.platform === 'Instagram' ? 'bg-purple-500' : 'bg-blue-500'
                    ]"
                  ></span>
                  <span class="text-sm text-slate-600 dark:text-slate-300">{{
                    contact.platform
                  }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span
                  :class="[
                    'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border',
                    contact.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : contact.status === 'New'
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : contact.status === 'Archived'
                          ? 'bg-slate-100 text-slate-400 border-slate-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200',
                  ]"
                >
                  {{ statusLabel(contact.status) }}
                </span>
              </td>
              <td
                class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-medium"
              >
                {{ contact.phone }}
              </td>
              <td
                class="px-6 py-4 text-xs text-slate-400"
              >
                {{ contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '-' }}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <!-- Editar (solo si no está archivado) -->
                  <button
                    v-if="contact.status !== 'Archived'"
                    @click="openEditModal(contact)"
                    class="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                    :title="t('common.edit')"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <!-- Archivar (solo si no está archivado) -->
                  <button
                    v-if="contact.status !== 'Archived'"
                    @click="openArchiveModal(contact)"
                    class="p-2 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors"
                    :title="t('common.archive')"
                  >
                    <span class="material-symbols-outlined text-[18px]">archive</span>
                  </button>
                  <!-- Restaurar (solo si está archivado) -->
                  <button
                    v-if="contact.status === 'Archived'"
                    @click="restoreContact(contact)"
                    class="p-2 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                    :title="t('common.restore')"
                  >
                    <span class="material-symbols-outlined text-[18px]">unarchive</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="contacts.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-slate-400">
                {{ t('clients.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-6 py-4 border-t border-slate-100"
      >
        <span class="text-xs text-slate-400">
          {{ t('common.page') }} {{ currentPage }} {{ t('common.of') }} {{ totalPages }}
        </span>
        <div class="flex items-center gap-1">
          <button
            @click="goToPage(1)"
            :disabled="currentPage === 1"
            class="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span class="material-symbols-outlined text-[18px] text-slate-500">first_page</span>
          </button>
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span class="material-symbols-outlined text-[18px] text-slate-500">chevron_left</span>
          </button>

          <template v-for="page in totalPages" :key="page">
            <button
              v-if="Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages"
              @click="goToPage(page)"
              :class="[
                'w-8 h-8 rounded text-xs font-bold transition-colors',
                page === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              ]"
            >
              {{ page }}
            </button>
            <span
              v-else-if="Math.abs(page - currentPage) === 3"
              class="text-slate-300 text-xs"
            >...</span>
          </template>

          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span class="material-symbols-outlined text-[18px] text-slate-500">chevron_right</span>
          </button>
          <button
            @click="goToPage(totalPages)"
            :disabled="currentPage === totalPages"
            class="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span class="material-symbols-outlined text-[18px] text-slate-500">last_page</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Editar Contacto -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
      @click.self="showEditModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold text-slate-900">{{ t('clients.editModal.title') }}</h2>
          <button @click="showEditModal = false" class="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <span class="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('clients.editModal.name') }}</label>
            <input v-model="editForm.name" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('common.email') }}</label>
              <input v-model="editForm.email" type="email" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('common.phone') }}</label>
              <input v-model="editForm.phone" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('clients.editModal.platform') }}</label>
              <select v-model="editForm.platform" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="WhatsApp">WhatsApp</option>
                <option value="Instagram">Instagram</option>
                <option value="Web">Web</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('common.status') }}</label>
              <select v-model="editForm.status" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="Active">{{ statusLabel('Active') }}</option>
                <option value="New">{{ statusLabel('New') }}</option>
                <option value="Inactive">{{ statusLabel('Inactive') }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showEditModal = false"
            class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="saveEdit"
            class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Confirmar Archivar -->
    <div
      v-if="showArchiveModal"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
      @click.self="showArchiveModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div class="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-amber-500 text-[28px]">archive</span>
        </div>
        <h2 class="text-lg font-bold text-slate-900 mb-2">{{ t('clients.archiveModal.title') }}</h2>
        <i18n-t
          keypath="clients.archiveModal.confirm"
          tag="p"
          class="text-sm text-slate-500 mb-6"
        >
          <template #name>
            <strong>{{ archivingContact?.name }}</strong>
          </template>
        </i18n-t>
        <div class="flex justify-center gap-3">
          <button
            @click="showArchiveModal = false"
            class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="confirmArchive"
            class="px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors"
          >
            {{ t('common.archive') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
