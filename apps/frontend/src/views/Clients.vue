<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import {
  clientService,
  type Contact,
  type ContactsResponse,
  type ContactFilters,
} from "../services/client.service";
import { messagingService, type ChatConversation } from "../services/messaging.service";
import AIcon from "../components/ui/AIcon.vue";
import AAvatar from "../components/ui/AAvatar.vue";
import APill from "../components/ui/APill.vue";
import AButton from "../components/ui/AButton.vue";
import AModal from "../components/ui/AModal.vue";
import ADropdown from "../components/ui/ADropdown.vue";
import { channelInk, channelTone } from "../lib/channels";

const { t, locale } = useI18n();
const router = useRouter();

function formatDate(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  Active: "clients.status.active",
  New: "clients.status.new",
  Inactive: "clients.status.inactive",
  Archived: "clients.status.archived",
};

const STATUS_TONES: Record<string, "lime" | "sky" | "ghost"> = {
  Active: "lime",
  New: "sky",
  Inactive: "ghost",
  Archived: "ghost",
};

function statusLabel(status: string) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

function statusTone(status: string) {
  return STATUS_TONES[status] || "ghost";
}

function platformColor(platform: string) {
  return channelInk(platform);
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
const actionError = ref<string | null>(null);

// Filtros
const searchQuery = ref("");
const filterPlatform = ref("All");
const filterStatus = ref("All");
const sortBy = ref("createdAt");
const sortOrder = ref<"asc" | "desc">("desc");
const currentPage = ref(1);
const pageSize = ref(10);

const platformOptions = computed(() => [
  { value: "All", label: t("clients.filters.allPlatforms") },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Instagram", label: "Instagram" },
  { value: "Web", label: "Web" },
]);

const statusOptions = computed(() => [
  { value: "All", label: t("clients.filters.allStatuses") },
  { value: "Active", label: statusLabel("Active") },
  { value: "New", label: statusLabel("New") },
  { value: "Inactive", label: statusLabel("Inactive") },
  { value: "Archived", label: statusLabel("Archived") },
]);

const pageSizeOptions = [5, 10, 25, 50];

const platformFilterLabel = computed(
  () => platformOptions.value.find((o) => o.value === filterPlatform.value)?.label ?? ""
);
const statusFilterLabel = computed(
  () => statusOptions.value.find((o) => o.value === filterStatus.value)?.label ?? ""
);

// Modal de edición
const showEditModal = ref(false);
const editingContact = ref<Contact | null>(null);
const editForm = ref<Partial<Contact>>({});
const editError = ref<string | null>(null);

const editPlatformOptions: { value: Contact["platform"]; label: string }[] = [
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Instagram", label: "Instagram" },
  { value: "Web", label: "Web" },
];

const editStatusOptions = computed<{ value: Contact["status"]; label: string }[]>(() => [
  { value: "Active", label: statusLabel("Active") },
  { value: "New", label: statusLabel("New") },
  { value: "Inactive", label: statusLabel("Inactive") },
]);

const editPlatformLabel = computed(
  () => editPlatformOptions.find((o) => o.value === editForm.value.platform)?.label ?? ""
);
const editStatusLabel = computed(
  () => editStatusOptions.value.find((o) => o.value === editForm.value.status)?.label ?? ""
);

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

// === Conversación del cliente ===
const conversationsByContact = ref<Record<string, ChatConversation>>({});

/** Prefiere la conversación activa y, en su defecto, la más reciente (orden del servidor). */
function pickPreferredConversation(list: ChatConversation[]): ChatConversation | undefined {
  return list.find((c) => c.status === "active") || list[0];
}

function conversationFor(contact: Contact): ChatConversation | undefined {
  return contact._id ? conversationsByContact.value[contact._id] : undefined;
}

/**
 * Carga un mapa contacto→conversación para saber si ofrecer la acción.
 * La conversación definitiva se resuelve en el servidor al abrirla.
 */
async function loadContactConversations() {
  try {
    const list = await messagingService.getConversations();
    const map: Record<string, ChatConversation> = {};
    for (const conv of list) {
      if (!conv.contactId) continue;
      const current = map[conv.contactId];
      // La lista viene ordenada por `lastMessageAt` desc: se conserva la primera
      // salvo que aparezca una activa y la actual no lo sea.
      if (!current || (current.status !== "active" && conv.status === "active")) {
        map[conv.contactId] = conv;
      }
    }
    conversationsByContact.value = map;
  } catch {
    conversationsByContact.value = {};
  }
}

/** Abre la bandeja con la conversación del cliente preseleccionada. */
async function openConversation(contact: Contact) {
  let conversationId = conversationFor(contact)?._id;
  try {
    const list = await messagingService.getConversations("All", contact._id);
    const resolved = pickPreferredConversation(list);
    if (resolved?._id) conversationId = resolved._id;
  } catch {
    // Si la resolución en el servidor falla, se usa el mapa local.
  }
  if (!conversationId) return;
  router.push({ path: "/messaging", query: { conversation: conversationId } });
}

onMounted(() => {
  fetchContacts();
  loadContactConversations();
});

// === Ordenamiento ===
function toggleSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortOrder.value = "asc";
  }
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
  editError.value = null;
  showEditModal.value = true;
}

async function saveEdit() {
  if (!editingContact.value) return;
  editError.value = null;
  try {
    await clientService.updateContact(editingContact.value._id, editForm.value);
    showEditModal.value = false;
    editingContact.value = null;
    fetchContacts();
  } catch (err: any) {
    editError.value = t("clients.errors.update", { message: err.message });
  }
}

// === Archivar (soft delete) ===
function openArchiveModal(contact: Contact) {
  archivingContact.value = contact;
  showArchiveModal.value = true;
}

async function confirmArchive() {
  if (!archivingContact.value) return;
  actionError.value = null;
  try {
    await clientService.archiveContact(archivingContact.value._id);
    showArchiveModal.value = false;
    archivingContact.value = null;
    fetchContacts();
  } catch (err: any) {
    showArchiveModal.value = false;
    actionError.value = t("clients.errors.archive", { message: err.message });
  }
}

// === Restaurar ===
async function restoreContact(contact: Contact) {
  actionError.value = null;
  try {
    await clientService.restoreContact(contact._id);
    fetchContacts();
  } catch (err: any) {
    actionError.value = t("clients.errors.restore", { message: err.message });
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <!-- Búsqueda y filtros -->
    <div class="flex flex-wrap items-center gap-2.5">
      <div class="flex min-w-[240px] flex-1 items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 shadow-card transition-shadow focus-within:shadow-[0_0_0_2px_var(--focus)]">
        <AIcon name="MagnifyingGlass" :size="17" class="shrink-0 text-ink-3" />
        <input
          v-model="searchQuery"
          class="min-w-0 flex-1 border-none bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:shadow-none"
          :placeholder="t('clients.search.placeholder')"
          type="text"
        />
      </div>
      <ADropdown
        :label="t('clients.filters.allPlatforms')"
        :title="t('clients.filters.allPlatforms')"
        testid="clients-platform-filter"
        role="listbox"
        haspopup="listbox"
        align="left"
        wrapper-class="shrink-0"
        :trigger-class="'flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink-2 shadow-card transition-colors hover:bg-canvas'"
        panel-class="w-52"
      >
        <template #trigger>
          {{ platformFilterLabel }}
          <AIcon name="CaretDown" :size="14" class="text-ink-3" />
        </template>
        <template #content="{ close }">
          <button
            v-for="option in platformOptions"
            :key="option.value"
            type="button"
            role="option"
            :data-value="option.value"
            :aria-selected="filterPlatform === option.value"
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
            :class="filterPlatform === option.value ? 'text-lilac-ink' : 'text-ink-2'"
            @click="filterPlatform = option.value; close()"
          >
            {{ option.label }}
            <AIcon v-if="filterPlatform === option.value" name="Check" :size="16" />
          </button>
        </template>
      </ADropdown>
      <ADropdown
        :label="t('clients.filters.allStatuses')"
        :title="t('clients.filters.allStatuses')"
        testid="clients-status-filter"
        role="listbox"
        haspopup="listbox"
        align="right"
        wrapper-class="shrink-0"
        :trigger-class="'flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink-2 shadow-card transition-colors hover:bg-canvas'"
        panel-class="w-52"
      >
        <template #trigger>
          {{ statusFilterLabel }}
          <AIcon name="CaretDown" :size="14" class="text-ink-3" />
        </template>
        <template #content="{ close }">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            role="option"
            :data-value="option.value"
            :aria-selected="filterStatus === option.value"
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
            :class="filterStatus === option.value ? 'text-lilac-ink' : 'text-ink-2'"
            @click="filterStatus = option.value; close()"
          >
            {{ option.label }}
            <AIcon v-if="filterStatus === option.value" name="Check" :size="16" />
          </button>
        </template>
      </ADropdown>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-ink-3">
      <AIcon name="Info" :size="15" />
      {{ t('clients.hint.autoCreated') }}
      <span class="ml-auto flex items-center gap-2">
        {{ t('clients.results.found', totalContacts) }}
        <ADropdown
          :label="t('clients.pagination.perPage')"
          :title="t('clients.pagination.perPage')"
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
        {{ t('clients.pagination.perPage') }}
      </span>
    </div>

    <div
      v-if="actionError"
      class="flex items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-4 text-[13px] text-[color:var(--danger)]"
    >
      <AIcon name="WarningCircle" :size="18" />
      <span class="flex-1">{{ actionError }}</span>
      <button type="button" class="shrink-0" :aria-label="t('common.close')" :title="t('common.close')" @click="actionError = null">
        <AIcon name="X" :size="16" />
      </button>
    </div>

    <!-- Tabla -->
    <div class="overflow-hidden rounded-card bg-surface shadow-card">
      <div v-if="isLoading" class="px-6 py-10 text-center text-sm font-semibold text-ink-3">
        {{ t('clients.loading') }}
      </div>
      <div
        v-else-if="error"
        role="alert"
        class="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm font-semibold text-[color:var(--danger)]"
      >
        <span>{{ t('clients.errors.load', { message: error }) }}</span>
        <AButton variant="secondary" size="sm" icon="ArrowsClockwise" @click="fetchContacts">
          {{ t('common.retry') }}
        </AButton>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                v-for="col in [
                  { key: 'name', label: t('clients.table.client') },
                  { key: 'platform', label: t('clients.table.platform') },
                  { key: 'status', label: t('common.status') },
                  { key: 'phone', label: t('common.phone') },
                  { key: 'createdAt', label: t('clients.table.created') },
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
              <th class="border-b-[1.5px] border-line px-4.5 py-3 text-right text-[11px] font-semibold text-ink-3">
                {{ t('common.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="contact in contacts"
              :key="contact._id || contact.email"
              :class="[
                'border-b border-line transition-colors last:border-b-0 hover:bg-canvas',
                contact.status === 'Archived' ? 'opacity-50' : '',
              ]"
            >
              <td class="px-4.5 py-3.5">
                <div class="flex items-center gap-2.5">
                  <AAvatar
                    :initials="(contact.name || 'C').slice(0, 2).toUpperCase()"
                    :tone="channelTone(contact.platform)"
                  />
                  <div class="flex flex-col">
                    <span class="font-semibold">{{ contact.name }}</span>
                    <span class="text-xs text-ink-3">{{ contact.email || t('clients.noEmail') }}</span>
                  </div>
                </div>
              </td>
              <td class="px-4.5 py-3.5">
                <span class="inline-flex items-center gap-2 text-[12.5px] text-ink-2">
                  <span class="h-2 w-2 rounded-full" :style="{ background: platformColor(contact.platform) }" />
                  {{ contact.platform }}
                </span>
              </td>
              <td class="px-4.5 py-3.5">
                <APill :tone="statusTone(contact.status)" size="sm">{{ statusLabel(contact.status) }}</APill>
              </td>
              <td class="px-4.5 py-3.5 text-ink-3 [font-variant-numeric:tabular-nums]">{{ contact.phone }}</td>
              <td class="px-4.5 py-3.5 text-xs text-ink-3">
                {{ formatDate(contact.createdAt) }}
              </td>
              <td class="px-4.5 py-3.5">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    v-if="conversationFor(contact)"
                    type="button"
                    data-testid="clients-view-conversation"
                    class="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                    :title="t('clients.actions.viewConversation')"
                    @click="openConversation(contact)"
                  >
                    <AIcon name="ChatsCircle" :size="13" />
                    {{ t('clients.actions.viewConversation') }}
                  </button>
                  <button
                    v-if="contact.status !== 'Archived'"
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                    :title="t('common.edit')"
                    :aria-label="t('common.edit')"
                    @click="openEditModal(contact)"
                  >
                    <AIcon name="PencilSimple" :size="14" />
                  </button>
                  <button
                    v-if="contact.status !== 'Archived'"
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-butter-soft hover:text-butter-ink"
                    :title="t('common.archive')"
                    :aria-label="t('common.archive')"
                    @click="openArchiveModal(contact)"
                  >
                    <AIcon name="Archive" :size="14" />
                  </button>
                  <button
                    v-if="contact.status === 'Archived'"
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-full bg-canvas text-ink-2 transition-colors hover:bg-lime-soft hover:text-lime-ink"
                    :title="t('common.restore')"
                    :aria-label="t('common.restore')"
                    @click="restoreContact(contact)"
                  >
                    <AIcon name="ArrowCounterClockwise" :size="14" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="contacts.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-ink-3">{{ t('clients.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
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

    <!-- Modal: Editar Cliente -->
    <AModal :open="showEditModal" :label="t('clients.editModal.title')" @close="showEditModal = false">
      <div class="p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('clients.editModal.title') }}</h2>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-canvas"
            :aria-label="t('common.close')"
            :title="t('common.close')"
            @click="showEditModal = false"
          >
            <AIcon name="X" :size="18" />
          </button>
        </div>

        <div
          v-if="editError"
          class="mt-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ editError }}
        </div>

        <div class="mt-5 flex flex-col gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('clients.editModal.name') }}</span>
            <input v-model="editForm.name" class="field" />
          </label>
          <div class="grid grid-cols-2 gap-4">
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('common.email') }}</span>
              <input v-model="editForm.email" type="email" class="field" />
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('common.phone') }}</span>
              <input v-model="editForm.phone" class="field" />
            </label>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('clients.editModal.platform') }}</span>
              <ADropdown
                :label="t('clients.editModal.platform')"
                role="listbox"
                haspopup="listbox"
                align="left"
                wrapper-class="w-full"
                trigger-class="field flex items-center justify-between gap-2 text-left"
                panel-class="w-full"
              >
                <template #trigger>
                  <span class="truncate">{{ editPlatformLabel }}</span>
                  <AIcon name="CaretDown" :size="14" class="shrink-0 text-ink-3" />
                </template>
                <template #content="{ close }">
                  <button
                    v-for="option in editPlatformOptions"
                    :key="option.value"
                    type="button"
                    role="option"
                    :aria-selected="editForm.platform === option.value"
                    class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
                    :class="editForm.platform === option.value ? 'text-lilac-ink' : 'text-ink-2'"
                    @click="editForm.platform = option.value; close()"
                  >
                    {{ option.label }}
                    <AIcon v-if="editForm.platform === option.value" name="Check" :size="16" />
                  </button>
                </template>
              </ADropdown>
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-2">{{ t('common.status') }}</span>
              <ADropdown
                :label="t('common.status')"
                role="listbox"
                haspopup="listbox"
                align="left"
                wrapper-class="w-full"
                trigger-class="field flex items-center justify-between gap-2 text-left"
                panel-class="w-full"
              >
                <template #trigger>
                  <span class="truncate">{{ editStatusLabel }}</span>
                  <AIcon name="CaretDown" :size="14" class="shrink-0 text-ink-3" />
                </template>
                <template #content="{ close }">
                  <button
                    v-for="option in editStatusOptions"
                    :key="option.value"
                    type="button"
                    role="option"
                    :aria-selected="editForm.status === option.value"
                    class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas"
                    :class="editForm.status === option.value ? 'text-lilac-ink' : 'text-ink-2'"
                    @click="editForm.status = option.value; close()"
                  >
                    {{ option.label }}
                    <AIcon v-if="editForm.status === option.value" name="Check" :size="16" />
                  </button>
                </template>
              </ADropdown>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="showEditModal = false">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" @click="saveEdit">{{ t('common.save') }}</AButton>
        </div>
      </div>
    </AModal>

    <!-- Modal: Confirmar Archivar -->
    <AModal
      :open="showArchiveModal"
      :label="t('clients.archiveModal.title')"
      size="sm"
      @close="showArchiveModal = false"
    >
      <div class="p-6 text-center">
        <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-butter-soft">
          <AIcon name="Archive" :size="26" class="text-butter-ink" />
        </div>
        <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('clients.archiveModal.title') }}</h2>
        <i18n-t
          keypath="clients.archiveModal.confirm"
          tag="p"
          class="mt-2 text-sm text-ink-3"
        >
          <template #name>
            <strong class="text-ink">{{ archivingContact?.name }}</strong>
          </template>
        </i18n-t>
        <div class="mt-6 flex justify-center gap-3">
          <AButton variant="ghost" @click="showArchiveModal = false">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" @click="confirmArchive">{{ t('common.archive') }}</AButton>
        </div>
      </div>
    </AModal>
  </div>
</template>
