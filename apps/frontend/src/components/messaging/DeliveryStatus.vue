<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AIcon from '../ui/AIcon.vue';
import type { MessageDelivery } from '../../services/messaging.service';

defineProps<{
  delivery?: MessageDelivery;
  retrying?: boolean;
  retryError?: boolean;
}>();

const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <p
    v-if="delivery?.status === 'queued'"
    class="flex items-center gap-1 text-[11px] font-medium text-ink-3"
    data-testid="delivery-status"
    data-status="queued"
  >
    <AIcon name="Clock" :size="12" />
    {{ t('messaging.delivery.queued') }}
  </p>
  <p
    v-else-if="delivery?.status === 'sent'"
    class="flex items-center gap-1 text-[11px] font-medium text-ink-3"
    data-testid="delivery-status"
    data-status="sent"
  >
    <AIcon name="Check" :size="12" />
    {{ t('messaging.delivery.sent') }}
  </p>
  <p
    v-else-if="delivery?.status === 'delivered' || delivery?.status === 'read'"
    class="flex items-center gap-1 text-[11px] font-medium"
    :class="delivery.status === 'read' ? 'text-ink-2' : 'text-ink-3'"
    data-testid="delivery-status"
    :data-status="delivery.status"
  >
    <AIcon name="Checks" :size="12" :weight="delivery.status === 'read' ? 'bold' : 'regular'" />
    {{ t(`messaging.delivery.${delivery.status}`) }}
  </p>
  <div
    v-else-if="delivery?.status === 'failed'"
    role="status"
    class="flex flex-wrap items-center justify-end gap-2 text-[11px] font-semibold text-[color:var(--danger)]"
    data-testid="delivery-status"
    data-status="failed"
  >
    <AIcon name="WarningCircle" :size="13" />
    <span>{{ t('messaging.delivery.failed') }}</span>
    <span v-if="delivery.error" class="font-medium text-ink-3">· {{ delivery.error }}</span>
    <span v-if="retryError" class="font-medium">· {{ t('messaging.delivery.retryError') }}</span>
    <button
      type="button"
      class="rounded-full bg-surface px-3 py-1 font-bold text-ink-1 shadow-card transition-shadow hover:shadow-pop disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      :disabled="retrying"
      @click="emit('retry')"
    >
      {{ retrying ? t('messaging.delivery.retrying') : t('messaging.delivery.retry') }}
    </button>
  </div>
</template>
