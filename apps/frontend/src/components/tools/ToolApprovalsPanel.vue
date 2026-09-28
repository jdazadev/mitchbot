<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toolsService, type ToolExecution } from '../../services/tools.service';
import { authService } from '../../services/auth.service';
import { socketService } from '../../services/socket.service';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import APill from '../ui/APill.vue';
import AModal from '../ui/AModal.vue';

const emit = defineEmits<{ 'count-change': [count: number] }>();
const { t, te, locale } = useI18n();
const user = authService.getUser();
const canApprove = user?.role === 'admin' || user?.role === 'approver';
const items = ref<ToolExecution[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const selected = ref<ToolExecution | null>(null);
const decision = ref<'approved' | 'rejected'>('approved');
const resolving = ref(false);

async function load() {
  if (!canApprove) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const result = await toolsService.listPending();
    items.value = result.items;
    emit('count-change', result.total);
  } catch (cause: any) {
    error.value = cause?.message || t('common.error');
  } finally {
    loading.value = false;
  }
}

function onNotification(data: any) {
  if (data?.toolExecutionId) void load();
}

function openDecision(item: ToolExecution, value: 'approved' | 'rejected') {
  selected.value = item;
  decision.value = value;
}

async function resolve() {
  if (!selected.value || resolving.value) return;
  resolving.value = true;
  error.value = null;
  try {
    if (decision.value === 'approved') await toolsService.approve(selected.value._id);
    else await toolsService.reject(selected.value._id);
    items.value = items.value.filter(item => item._id !== selected.value?._id);
    emit('count-change', items.value.length);
    selected.value = null;
  } catch (cause: any) {
    error.value = cause?.message || t('common.error');
  } finally {
    resolving.value = false;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' });
}

function entityLabel(namespace: 'modules' | 'operations', value?: string) {
  if (!value) return t('tools.approvals.unknownOperation');
  const key = `tools.${namespace}.${value}`;
  return te(key) ? t(key) : value;
}

onMounted(() => {
  void load();
  if (canApprove) socketService.onNotification(onNotification);
});
onBeforeUnmount(() => socketService.offNotification(onNotification));
</script>

<template>
  <section aria-labelledby="tools-approvals-heading" class="flex flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="tools-approvals-heading" class="font-display text-[19px] font-bold tracking-[-0.025em]">
          {{ t('tools.approvals.title') }}
        </h2>
        <p class="mt-1 text-[13px] text-ink-3">{{ t('tools.approvals.description') }}</p>
      </div>
      <APill v-if="items.length" tone="butter">{{ items.length }} {{ t('tools.approvals.pending') }}</APill>
    </div>

    <div v-if="!canApprove" role="status" class="flex items-start gap-3 rounded-card bg-sunken p-5 text-[13px] text-ink-2">
      <AIcon name="Lock" :size="18" class="mt-0.5 shrink-0" />
      <p>{{ t('tools.approvals.noPermission') }}</p>
    </div>
    <div v-else-if="loading" aria-busy="true" class="flex flex-col gap-3">
      <div v-for="n in 3" :key="n" class="h-28 animate-pulse rounded-card bg-surface shadow-card" />
    </div>
    <div v-else-if="error" role="alert" class="flex flex-wrap items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-4 text-[13px] text-[color:var(--danger)]">
      <AIcon name="WarningCircle" :size="18" />
      <span class="min-w-0 flex-1">{{ t('tools.errors.load', { message: error }) }}</span>
      <AButton variant="secondary" size="sm" icon="ArrowCounterClockwise" @click="load">{{ t('common.retry') }}</AButton>
    </div>
    <div v-else-if="items.length === 0" class="rounded-card bg-surface px-6 py-12 text-center shadow-card">
      <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime-soft text-lime-ink"><AIcon name="CheckCircle" :size="23" /></span>
      <h3 class="mt-4 font-display text-[16px] font-bold">{{ t('tools.approvals.emptyTitle') }}</h3>
      <p class="mx-auto mt-1 max-w-[48ch] text-[13px] text-ink-3">{{ t('tools.approvals.empty') }}</p>
    </div>
    <ul v-else class="flex flex-col gap-3">
      <li v-for="item in items" :key="item._id" class="rounded-card bg-surface p-4 shadow-card sm:p-5">
        <div class="flex flex-wrap items-start gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-butter-soft text-butter-ink"><AIcon name="Warning" :size="18" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-display text-[15px] font-bold">{{ entityLabel('modules', item.toolId) }}</h3>
              <APill tone="butter" size="sm">{{ entityLabel('operations', item.operation) }}</APill>
              <APill :dot="false" tone="ghost" size="sm">{{ t('tools.binding.internal') }}</APill>
            </div>
            <p class="mt-1.5 text-[13px] text-ink-2">{{ item.userMessage || t('tools.approvals.requestedAction', { action: item.toolName }) }}</p>
            <pre class="mt-2 max-h-32 overflow-auto rounded-field bg-canvas p-3 text-[11px] leading-relaxed text-ink-2">{{ JSON.stringify(item.params, null, 2) }}</pre>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-ink-3">
              <time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time>
              <router-link :to="`/messaging?conversation=${item.conversationId}`" class="inline-flex items-center gap-1 text-lilac-ink underline decoration-line underline-offset-2 hover:decoration-current">
                {{ t('tools.history.openConversation') }} <AIcon name="ArrowRight" :size="13" />
              </router-link>
            </div>
          </div>
          <div class="flex w-full shrink-0 gap-2 sm:w-auto">
            <AButton variant="primary" size="sm" icon="Check" @click="openDecision(item, 'approved')">{{ t('tools.approvals.approve') }}</AButton>
            <AButton variant="ghost" size="sm" icon="X" @click="openDecision(item, 'rejected')">{{ t('tools.approvals.reject') }}</AButton>
          </div>
        </div>
      </li>
    </ul>

    <AModal :open="!!selected" :label="t(`tools.approvals.confirm.${decision}.title`)" size="md" @close="selected = null">
      <div class="p-6">
        <div class="flex items-start gap-3">
          <span :class="['grid h-10 w-10 shrink-0 place-items-center rounded-full', decision === 'approved' ? 'bg-lime-soft text-lime-ink' : 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]']">
            <AIcon :name="decision === 'approved' ? 'CheckCircle' : 'WarningCircle'" :size="20" />
          </span>
          <div>
            <h3 class="font-display text-[17px] font-bold">{{ t(`tools.approvals.confirm.${decision}.title`) }}</h3>
            <p class="mt-1 text-[13px] leading-relaxed text-ink-2">{{ t(`tools.approvals.confirm.${decision}.body`) }}</p>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <AButton variant="ghost" :disabled="resolving" @click="selected = null">{{ t('common.cancel') }}</AButton>
          <AButton :variant="decision === 'approved' ? 'primary' : 'secondary'" :loading="resolving" @click="resolve">
            {{ t(`tools.approvals.confirm.${decision}.action`) }}
          </AButton>
        </div>
      </div>
    </AModal>
  </section>
</template>
