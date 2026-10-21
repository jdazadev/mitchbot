<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DashboardMetricBand from './DashboardMetricBand.vue';
import AIcon from '../ui/AIcon.vue';
import { channelIcon } from '../../lib/channels';
import { formatDuration } from '../../lib/sla';
import type { DashboardSla } from '../../services/dashboard.service';

/** Cumplimiento de los objetivos de respuesta y resolución, y esperas vencidas ahora. */
const props = defineProps<{ sla: DashboardSla | null; isLoading: boolean; now: number }>();
const { t, locale } = useI18n();

const percent = (rate: number | null | undefined) =>
  rate === null || rate === undefined ? '—' : `${new Intl.NumberFormat(locale.value).format(rate)} %`;

const metrics = computed(() => {
  const sla = props.sla;
  if (!sla) return [];
  return [
    {
      testId: 'sla-response',
      icon: 'Timer',
      label: t('dashboard.sla.response', { minutes: sla.targets.responseMinutes }),
      value: percent(sla.response.rate),
      detail: sla.response.total
        ? t('dashboard.sla.turns', { onTime: sla.response.onTime, total: sla.response.total })
        : t('dashboard.sla.noTurns'),
    },
    {
      testId: 'sla-resolution',
      icon: 'CheckCircle',
      label: t('dashboard.sla.resolution', { hours: sla.targets.resolutionHours }),
      value: percent(sla.resolution.rate),
      detail: sla.resolution.total
        ? t('dashboard.sla.resolved', { onTime: sla.resolution.onTime, total: sla.resolution.total })
        : t('dashboard.sla.noResolutions'),
    },
    {
      testId: 'sla-wait',
      icon: 'Clock',
      label: t('dashboard.sla.medianWait'),
      value: formatDuration(sla.response.medianMs, locale.value),
      detail: sla.response.p90Ms !== null ? t('dashboard.sla.p90', { value: formatDuration(sla.response.p90Ms, locale.value) }) : undefined,
    },
    {
      testId: 'sla-breached',
      icon: 'WarningCircle',
      label: t('dashboard.sla.breachedNow'),
      value: new Intl.NumberFormat(locale.value).format(sla.now.breached),
      detail: t('dashboard.sla.atRisk', { count: sla.now.atRisk }),
    },
  ];
});
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <DashboardMetricBand :title="t('dashboard.sections.sla')" :metrics="metrics" :is-loading="isLoading || !sla" />

    <section
      v-if="sla && sla.now.conversations.length"
      class="rounded-card bg-surface p-5 px-6 shadow-card"
      :aria-label="t('dashboard.sla.waitingTitle')"
      data-testid="sla-waiting"
    >
      <h3 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('dashboard.sla.waitingTitle') }}</h3>
      <p class="text-[12px] text-ink-3">{{ t('dashboard.sla.waitingSubtitle', { minutes: sla.targets.responseMinutes }) }}</p>
      <ul class="mt-3 flex flex-col divide-y divide-line">
        <li v-for="conversation in sla.now.conversations" :key="conversation.id">
          <RouterLink
            :to="{ path: '/messaging', query: { conversation: conversation.id } }"
            class="flex items-center gap-3 py-2.5 text-[13px] hover:text-ink"
          >
            <AIcon :name="channelIcon(conversation.platform)" :size="15" class="shrink-0 text-ink-3" />
            <span class="min-w-0 flex-1 truncate font-semibold">{{ conversation.name || t('dashboard.sla.unknownClient') }}</span>
            <span class="shrink-0 text-xs font-semibold text-[color:var(--danger)] [font-variant-numeric:tabular-nums]">
              {{ t('dashboard.sla.waiting', { time: formatDuration(now - Date.parse(conversation.awaitingReplySince), locale) }) }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
