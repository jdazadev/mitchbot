<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { settingsService, type AgentData } from '../services/settings.service';

const { t } = useI18n();

const agents = ref<AgentData[]>([]);
const pageLoading = ref(true);

const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingAgent = ref<any>(null);
const createLoading = ref(false);
const editLoading = ref(false);

const createForm = ref({
  name: '',
  description: '',
});

const editForm = ref<any>({});

onMounted(async () => {
  pageLoading.value = true;
  try {
    agents.value = await settingsService.getAgents();
  } catch (err) {
    console.error('Error loading agents:', err);
  } finally {
    pageLoading.value = false;
  }
});

function openEditModal(agent: any) {
  editingAgent.value = agent;
  editForm.value = { ...agent };
  showEditModal.value = true;
}

async function handleCreateAgent() {
  if (!createForm.value.name.trim()) return;
  createLoading.value = true;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('mitchbot_token')}`,
      },
      body: JSON.stringify({
        name: createForm.value.name,
        description: createForm.value.description,
      }),
    });
    if (res.ok) {
      const newAgent = await res.json();
      agents.value.unshift(newAgent);
      showCreateModal.value = false;
      createForm.value = { name: '', description: '' };
    }
  } catch (err) {
    console.error('Error creating agent:', err);
  } finally {
    createLoading.value = false;
  }
}

async function handleUpdateAgent() {
  if (!editingAgent.value?._id) return;
  editLoading.value = true;
  try {
    await settingsService.updateAgent(editingAgent.value._id, {
      name: editForm.value.name,
      description: editForm.value.description,
    } as any);

    const idx = agents.value.findIndex(a => a._id === editingAgent.value._id);
    if (idx !== -1) agents.value[idx] = { ...agents.value[idx], ...editForm.value };
    showEditModal.value = false;
  } catch (err) {
    console.error('Error updating agent:', err);
  } finally {
    editLoading.value = false;
  }
}

async function handleDeleteAgent(agent: any) {
  if (!confirm(t('agents.deleteConfirm', { name: agent.name }))) return;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/agents/${agent._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('mitchbot_token')}` },
    });
    if (res.ok || res.status === 204) {
      agents.value = agents.value.filter(a => a._id !== agent._id);
    }
  } catch (err) {
    console.error('Error deleting agent:', err);
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('agents.title') }}</h1>
        <p class="text-sm text-slate-500 mt-1">{{ t('agents.subtitle') }}</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 uppercase text-sm"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        {{ t('agents.createButton') }}
      </button>
    </div>

    <div v-if="pageLoading" class="flex items-center justify-center p-12">
      <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="ag in agents" :key="ag._id"
        class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span class="material-symbols-outlined text-blue-600 text-[28px]">smart_toy</span>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">{{ ag.name }}</h3>
              <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border"
                :class="ag.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'">
                {{ ag.status }}
              </span>
            </div>
          </div>
          <div class="flex gap-1">
            <button @click="openEditModal(ag)" class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button @click="handleDeleteAgent(ag)" class="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
        <p class="text-xs text-slate-500 mb-4">{{ ag.description }}</p>
      </div>

      <div
        v-if="agents.length === 0"
        @click="showCreateModal = true"
        class="bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors min-h-[200px]"
      >
        <span class="material-symbols-outlined text-slate-300 text-[48px] mb-2">add_circle</span>
        <span class="text-sm font-bold text-slate-400">{{ t('agents.createFirst') }}</span>
      </div>
    </div>

    <!-- Modal: Crear -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" @click.self="showCreateModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold text-slate-900">{{ t('agents.createModal.title') }}</h2>
          <button @click="showCreateModal = false" class="p-1 hover:bg-slate-100 rounded-lg"><span class="material-symbols-outlined text-slate-400">close</span></button>
        </div>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('agents.form.nameRequired') }}</label>
            <input v-model="createForm.name" :placeholder="t('agents.form.namePlaceholder')" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('agents.form.description') }}</label>
            <textarea v-model="createForm.description" :placeholder="t('agents.form.descriptionPlaceholder')" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showCreateModal = false" class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">{{ t('agents.actions.cancel') }}</button>
          <button @click="handleCreateAgent" :disabled="createLoading || !createForm.name.trim()" class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm">
            {{ createLoading ? t('agents.actions.creating') : t('agents.actions.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Editar -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" @click.self="showEditModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold text-slate-900">{{ t('agents.editModal.title') }}</h2>
          <button @click="showEditModal = false" class="p-1 hover:bg-slate-100 rounded-lg"><span class="material-symbols-outlined text-slate-400">close</span></button>
        </div>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('agents.form.name') }}</label>
            <input v-model="editForm.name" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('agents.form.description') }}</label>
            <textarea v-model="editForm.description" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showEditModal = false" class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">{{ t('agents.actions.cancel') }}</button>
          <button @click="handleUpdateAgent" :disabled="editLoading" class="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm">
            {{ editLoading ? t('agents.actions.saving') : t('agents.actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
