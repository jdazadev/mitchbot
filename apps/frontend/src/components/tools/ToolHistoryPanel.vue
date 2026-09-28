<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toolsService, type ToolCatalogModule, type ToolExecution, type ToolExecutionStatus, type ToolOperation } from '../../services/tools.service';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import APill from '../ui/APill.vue';
import ADropdown from '../ui/ADropdown.vue';

const { t, te, locale } = useI18n();
const catalog = ref<ToolCatalogModule[]>([]);
const result = ref<{ items: ToolExecution[]; total: number; page: number; limit: number; totalPages: number }>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
const loading = ref(true);
const error = ref<string | null>(null);
const filters = ref<{ tool: string; operation: ToolOperation | ''; binding: string; status: ToolExecutionStatus | ''; from: string; to: string }>({ tool: '', operation: '', binding: '', status: '', from: '', to: '' });
const pageSize = 20;

const toolOptions = computed(() => [{ value: '', label: t('tools.history.filters.allTools') }, ...catalog.value.map(module => ({ value: module.id, label: t(`tools.modules.${module.id}`) }))]);
const operationOptions = computed(() => [
  { value: '', label: t('tools.history.filters.allOperations') },
  ...(['leer', 'crear', 'editar', 'eliminar'] as ToolOperation[]).map(value => ({ value, label: t(`tools.operations.${value}`) })),
]);
const statusOptions = computed(() => [
  { value: '', label: t('tools.history.filters.allStatuses') },
  ...(['pending_approval', 'executing', 'approving', 'approved', 'rejected', 'executed', 'failed', 'cancelled', 'pending_confirmation'] as ToolExecutionStatus[])
    .map(value => ({ value, label: t(`tools.history.status.${value}`) })),
]);
const selectedToolLabel = computed(() => toolOptions.value.find(option => option.value === filters.value.tool)?.label || '');
const selectedOperationLabel = computed(() => operationOptions.value.find(option => option.value === filters.value.operation)?.label || '');
const selectedStatusLabel = computed(() => statusOptions.value.find(option => option.value === filters.value.status)?.label || '');

async function load(page = 1) {
  loading.value = true;
  error.value = null;
  try {
    const [history, catalogResponse] = await Promise.all([
      toolsService.listExecutions({ ...filters.value, page, limit: pageSize }),
      catalog.value.length ? Promise.resolve(null) : toolsService.getCatalog(),
    ]);
    result.value = history;
    if (catalogResponse) catalog.value = catalogResponse.catalog;
  } catch (cause: any) {
    error.value = cause?.message || t('common.error');
  } finally {
    loading.value = false;
  }
}

function setFilter<K extends keyof typeof filters.value>(key: K, value: (typeof filters.value)[K], close: () => void) {
  filters.value[key] = value;
  close();
  void load(1);
}

function clearFilters() {
  filters.value = { tool: '', operation: '', binding: '', status: '', from: '', to: '' };
  void load(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusTone(status: string) {
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'pending_approval' || status === 'pending_confirmation' || status === 'executing' || status === 'approving') return 'butter';
  if (status === 'approved' || status === 'executed') return 'lime';
  return 'ghost';
}

function operationLabel(execution: ToolExecution) {
  if (!execution.operation) return execution.toolName;
  const key = `tools.operations.${execution.operation}`;
  return te(key) ? t(key) : execution.toolName;
}

function moduleLabel(execution: ToolExecution) {
  if (!execution.toolId) return execution.toolName;
  const key = `tools.modules.${execution.toolId}`;
  return te(key) ? t(key) : execution.toolName;
}

onMounted(() => { void load(); });
</script>

<template>
  <section aria-labelledby="tools-history-heading" class="flex min-w-0 flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="tools-history-heading" class="font-display text-[19px] font-bold tracking-[-0.025em]">{{ t('tools.history.title') }}</h2>
        <p class="mt-1 text-[13px] text-ink-3">{{ t('tools.history.description') }}</p>
      </div>
      <span class="text-xs font-semibold tabular-nums text-ink-3">{{ t('tools.history.resultCount', { count: result.total }) }}</span>
    </div>

    <form class="flex flex-wrap items-center gap-2" @submit.prevent="load(1)">
      <ADropdown :label="t('tools.history.filters.tool')" role="listbox" haspopup="listbox" panel-class="w-52" trigger-class="flex max-w-full items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-xs font-semibold shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
        <template #trigger><span class="max-w-36 truncate">{{ selectedToolLabel }}</span><AIcon name="CaretDown" :size="13" /></template>
        <template #content="{ close }">
          <button v-for="option in toolOptions" :key="option.value" type="button" role="option" :aria-selected="filters.tool === option.value" class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-canvas" @click="setFilter('tool', option.value, close)">{{ option.label }}<AIcon v-if="filters.tool === option.value" name="Check" :size="15" /></button>
        </template>
      </ADropdown>
      <ADropdown :label="t('tools.history.filters.operation')" role="listbox" haspopup="listbox" panel-class="w-48" trigger-class="flex max-w-full items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-xs font-semibold shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
        <template #trigger><span class="max-w-32 truncate">{{ selectedOperationLabel }}</span><AIcon name="CaretDown" :size="13" /></template>
        <template #content="{ close }">
          <button v-for="option in operationOptions" :key="option.value" type="button" role="option" :aria-selected="filters.operation === option.value" class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-canvas" @click="setFilter('operation', option.value as any, close)">{{ option.label }}<AIcon v-if="filters.operation === option.value" name="Check" :size="15" /></button>
        </template>
      </ADropdown>
      <ADropdown :label="t('tools.history.filters.status')" role="listbox" haspopup="listbox" panel-class="w-52" trigger-class="flex max-w-full items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-xs font-semibold shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
        <template #trigger><span class="max-w-36 truncate">{{ selectedStatusLabel }}</span><AIcon name="CaretDown" :size="13" /></template>
        <template #content="{ close }">
          <button v-for="option in statusOptions" :key="option.value" type="button" role="option" :aria-selected="filters.status === option.value" class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-canvas" @click="setFilter('status', option.value as ToolExecutionStatus | '', close)">{{ option.label }}<AIcon v-if="filters.status === option.value" name="Check" :size="15" /></button>
        </template>
      </ADropdown>
      <label class="flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[11px] font-semibold text-ink-3 shadow-card">
        <span>{{ t('tools.history.filters.from') }}</span>
        <input v-model="filters.from" type="date" class="max-w-32 bg-transparent text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" @change="load(1)" />
      </label>
      <label class="flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[11px] font-semibold text-ink-3 shadow-card">
        <span>{{ t('tools.history.filters.to') }}</span>
        <input v-model="filters.to" type="date" class="max-w-32 bg-transparent text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" @change="load(1)" />
      </label>
      <button type="button" class="rounded-full px-3 py-2 text-xs font-bold text-lilac-ink underline decoration-line underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]" @click="clearFilters">{{ t('common.clear') }}</button>
    </form>

    <div v-if="loading" aria-busy="true" class="h-64 animate-pulse rounded-card bg-surface shadow-card" />
    <div v-else-if="error" role="alert" class="flex flex-wrap items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-4 text-[13px] text-[color:var(--danger)]">
      <AIcon name="WarningCircle" :size="18" /><span class="min-w-0 flex-1">{{ t('tools.errors.load', { message: error }) }}</span>
      <AButton variant="secondary" size="sm" icon="ArrowCounterClockwise" @click="load(result.page)">{{ t('common.retry') }}</AButton>
    </div>
    <div v-else-if="result.items.length === 0" class="rounded-card bg-surface px-6 py-12 text-center shadow-card">
      <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sunken text-ink-2"><AIcon name="Clock" :size="22" /></span>
      <h3 class="mt-4 font-display text-[16px] font-bold">{{ t('tools.history.emptyTitle') }}</h3>
      <p class="mx-auto mt-1 max-w-[48ch] text-[13px] text-ink-3">{{ t('tools.history.empty') }}</p>
    </div>
    <div v-else class="overflow-hidden rounded-card bg-surface shadow-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead><tr class="border-b-[1.5px] border-line text-[11px] font-bold text-ink-3">
            <th scope="col" class="px-4 py-3">{{ t('tools.history.columns.tool') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('tools.history.columns.operation') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('tools.history.columns.binding') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('tools.history.columns.status') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('tools.history.columns.date') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="execution in result.items" :key="execution._id" class="border-b border-line last:border-0 hover:bg-canvas/60">
              <td class="px-4 py-3.5 font-bold">{{ moduleLabel(execution) }}</td>
              <td class="px-4 py-3.5">{{ operationLabel(execution) }}</td>
              <td class="px-4 py-3.5 text-ink-2">{{ t('tools.binding.internal') }}</td>
              <td class="px-4 py-3.5"><APill :dot="false" :tone="statusTone(execution.status) as any" size="sm">{{ t(`tools.history.status.${execution.status}`) }}</APill></td>
              <td class="px-4 py-3.5 whitespace-nowrap text-ink-3">{{ formatDate(execution.createdAt) }}</td>
              <td class="px-4 py-3.5">
                <router-link v-if="execution.conversationId" :to="`/messaging?conversation=${execution.conversationId}`" class="inline-flex items-center gap-1 font-semibold text-lilac-ink underline decoration-line underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                  {{ t('tools.history.openConversation') }} <AIcon name="ArrowRight" :size="13" />
                </router-link>
                <span v-else class="text-ink-3">{{ t('tools.history.noConversation') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span class="text-xs font-semibold text-ink-3">{{ t('common.page') }} {{ result.page }} {{ t('common.of') }} {{ Math.max(result.totalPages, 1) }}</span>
        <div class="flex gap-2">
          <AButton variant="secondary" size="sm" icon="CaretLeft" :disabled="result.page <= 1" :aria-label="t('common.previous')" @click="load(result.page - 1)" />
          <AButton variant="secondary" size="sm" trailing-icon="CaretRight" :disabled="result.page >= result.totalPages" :aria-label="t('common.next')" @click="load(result.page + 1)" />
        </div>
      </div>
    </div>
  </section>
</template>
