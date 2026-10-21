<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { authService } from '../services/auth.service';
import { toolsService } from '../services/tools.service';
import { socketService } from '../services/socket.service';
import ATabs, { type TabItem } from '../components/ui/ATabs.vue';
import ToolCatalogPanel from '../components/tools/ToolCatalogPanel.vue';
import ToolApprovalsPanel from '../components/tools/ToolApprovalsPanel.vue';
import ToolHistoryPanel from '../components/tools/ToolHistoryPanel.vue';

const { t } = useI18n();
const route = useRoute();
// `?tab=approvals` abre directamente las aprobaciones (enlace de las notificaciones push).
const activeTab = ref(['catalog', 'approvals', 'history'].includes(String(route.query.tab)) ? String(route.query.tab) : 'catalog');
const pendingCount = ref(0);
const user = authService.getUser();
const canApprove = user?.role === 'admin' || user?.role === 'approver';

const tabs = computed<TabItem[]>(() => [
  { key: 'catalog', label: t('tools.tabs.catalog') },
  { key: 'approvals', label: t('tools.tabs.approvals'), badge: pendingCount.value },
  { key: 'history', label: t('tools.tabs.history') },
]);

async function refreshPendingCount() {
  if (!canApprove) return;
  try {
    const result = await toolsService.listPending();
    pendingCount.value = result.total;
  } catch {
    // La pestaña presenta su propio error recuperable al abrirse.
  }
}

function onNotification(data: any) {
  if (data?.toolExecutionId) void refreshPendingCount();
}

onMounted(() => {
  void refreshPendingCount();
  socketService.onNotification(onNotification);
});
onBeforeUnmount(() => socketService.offNotification(onNotification));
</script>

<template>
  <div class="flex min-w-0 flex-col gap-5">
    <p class="max-w-[72ch] text-[13px] leading-relaxed text-ink-2">{{ t('tools.subtitle') }}</p>
    <ATabs v-model="activeTab" :tabs="tabs" id-prefix="tools" :aria-label="t('tools.tabs.label')" />
    <section v-if="activeTab === 'catalog'" id="tools-panel-catalog" role="tabpanel" aria-labelledby="tools-tab-catalog" tabindex="0">
      <ToolCatalogPanel />
    </section>
    <section v-else-if="activeTab === 'approvals'" id="tools-panel-approvals" role="tabpanel" aria-labelledby="tools-tab-approvals" tabindex="0">
      <ToolApprovalsPanel @count-change="pendingCount = $event" />
    </section>
    <section v-else id="tools-panel-history" role="tabpanel" aria-labelledby="tools-tab-history" tabindex="0">
      <ToolHistoryPanel />
    </section>
  </div>
</template>
