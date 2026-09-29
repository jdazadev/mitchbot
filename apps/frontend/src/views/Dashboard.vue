<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  dashboardService,
  type DashboardStats,
  type DashboardOutcomes,
  type DashboardAutomation,
  type Activity,
  type ChannelDistribution,
  type VolumeData,
  type VolumePeriod,
} from "../services/dashboard.service";
import AIcon from "../components/ui/AIcon.vue";
import AButton from "../components/ui/AButton.vue";
import DashboardMetricBand from "../components/dashboard/DashboardMetricBand.vue";
import DashboardSentimentPanel from "../components/dashboard/DashboardSentimentPanel.vue";
import DashboardToolsPanel from "../components/dashboard/DashboardToolsPanel.vue";
import { CHANNEL_META, channelFill } from "../lib/channels";

const { t, locale } = useI18n();
const isLoading = ref(true);
const error = ref<string | null>(null);

// Rango de fechas (últimos 7/30/90 días) y granularidad del volumen.
const rangeOptions = [7, 30, 90] as const;
const rangeDays = ref<number>(30);
const period = ref<VolumePeriod>("daily");
const periodOptions = computed<{ id: VolumePeriod; label: string }[]>(() => [
  { id: "daily", label: t("dashboard.volume.daily") },
  { id: "weekly", label: t("dashboard.volume.weekly") },
  { id: "monthly", label: t("dashboard.volume.monthly") },
]);
const volumeData = ref<VolumeData[]>([]);

const dashboardStats = ref<DashboardStats>({
  total: 0,
  active: 0,
  closed: 0,
  responseRate: 0,
  firstResponseMs: null,
  botCoverage: 0,
  backlog: { pendingHuman: 0, unread: 0 },
});

const dashboardOutcomes = ref<DashboardOutcomes>({
  leads: 0,
  appointments: {
    total: 0,
    byStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
  },
  conversionRate: 0,
});

const dashboardAutomation = ref<DashboardAutomation>({
  sentiment: { positive: 0, neutral: 0, negative: 0, analyzed: 0 },
  tools: [],
});

const channelData = ref<ChannelDistribution>({
  whatsapp: 0,
  instagram: 0,
  web: 0,
});

const activityList = ref<Activity[]>([]);

const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value);
const formatPercent = (value: number) => `${formatNumber(value)}%`;

function formatFirstResponse(value: number | null) {
  if (value === null) return t("dashboard.health.noResponses");
  if (value < 60_000) {
    return t("dashboard.health.seconds", { count: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value / 1000) });
  }
  return t("dashboard.health.minutes", { count: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value / 60_000) });
}

const resultMetrics = computed(() => [
  {
    label: t("dashboard.stats.totalConversations"),
    testId: "total-conversations",
    value: formatNumber(dashboardStats.value.total),
    detail: t("dashboard.stats.activeDetail", { count: formatNumber(dashboardStats.value.active) }),
    icon: "ChatTeardropText",
  },
  {
    label: t("dashboard.outcomes.leads"),
    testId: "leads",
    value: formatNumber(dashboardOutcomes.value.leads),
    icon: "UserPlus",
  },
  {
    label: t("dashboard.outcomes.appointments"),
    testId: "appointments",
    value: formatNumber(dashboardOutcomes.value.appointments.total),
    detail: t("dashboard.outcomes.appointmentBreakdown", {
      pending: formatNumber(dashboardOutcomes.value.appointments.byStatus.pending),
      confirmed: formatNumber(dashboardOutcomes.value.appointments.byStatus.confirmed),
      completed: formatNumber(dashboardOutcomes.value.appointments.byStatus.completed),
      cancelled: formatNumber(dashboardOutcomes.value.appointments.byStatus.cancelled),
    }),
    icon: "CalendarCheck",
  },
  {
    label: t("dashboard.outcomes.conversionRate"),
    testId: "conversion-rate",
    value: formatPercent(dashboardOutcomes.value.conversionRate),
    icon: "ChartLineUp",
  },
]);

const healthMetrics = computed(() => [
  {
    label: t("dashboard.health.responseRate"),
    testId: "response-rate",
    value: formatPercent(dashboardStats.value.responseRate),
    icon: "Lightning",
  },
  {
    label: t("dashboard.health.firstResponse"),
    testId: "first-response",
    value: formatFirstResponse(dashboardStats.value.firstResponseMs),
    icon: "Clock",
  },
  {
    label: t("dashboard.health.botCoverage"),
    testId: "bot-coverage",
    value: formatPercent(dashboardStats.value.botCoverage),
    icon: "Robot",
  },
  {
    label: t("dashboard.health.backlog"),
    testId: "backlog",
    value: formatNumber(dashboardStats.value.backlog.pendingHuman),
    detail: t("dashboard.health.unreadCount", { count: formatNumber(dashboardStats.value.backlog.unread) }),
    icon: "Tray",
  },
]);

const activities = computed(() =>
  activityList.value.map((act) => ({
    id: act._id || `${act.title}-${act.createdAt}`,
    title: act.title,
    detail: act.detail,
    time: timeAgo(act.createdAt),
    icon: act.icon,
    color: act.color,
  })),
);

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return t("dashboard.time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("dashboard.time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("dashboard.time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("dashboard.time.daysAgo", { count: days });
}

function formatPeriodDate(value: string) {
  let date: Date;
  if (period.value === "weekly") {
    const [year, week] = value.split("-").map(Number);
    const januaryFourth = new Date(Date.UTC(year, 0, 4));
    const mondayOffset = (januaryFourth.getUTCDay() + 6) % 7;
    date = new Date(januaryFourth.getTime() - mondayOffset * 86_400_000 + (week - 1) * 7 * 86_400_000);
  } else {
    date = new Date(`${value}${period.value === "monthly" ? "-01" : ""}T00:00:00Z`);
  }
  const options: Intl.DateTimeFormatOptions = period.value === "monthly"
    ? { month: "short", year: "numeric", timeZone: "UTC" }
    : { month: "short", day: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale.value, options).format(date);
}

const whatsappPercent = computed(() => channelData.value.whatsapp);
const instagramPercent = computed(() => channelData.value.instagram);
const webPercent = computed(() => channelData.value.web);

const channelBars = computed(() => [
  { key: "whatsapp", label: CHANNEL_META.WhatsApp.label, pct: whatsappPercent.value, color: channelFill("WhatsApp") },
  { key: "instagram", label: CHANNEL_META.Instagram.label, pct: instagramPercent.value, color: channelFill("Instagram") },
  { key: "web", label: CHANNEL_META.Web.label, pct: webPercent.value, color: channelFill("Web") },
]);

const volumeSenderTotals = computed(() => volumeData.value.reduce(
  (totals, row) => ({
    contact: totals.contact + row.bySender.contact,
    bot: totals.bot + row.bySender.bot,
    human: totals.human + row.bySender.human,
  }),
  { contact: 0, bot: 0, human: 0 },
));

const volumeSenderRows = computed(() => volumeData.value.slice(-7).map((row) => {
  const total = row.bySender.contact + row.bySender.bot + row.bySender.human;
  return {
    ...row,
    total,
    contactPercent: total ? (row.bySender.contact / total) * 100 : 0,
    botPercent: total ? (row.bySender.bot / total) * 100 : 0,
    humanPercent: total ? (row.bySender.human / total) * 100 : 0,
  };
}));

// === Gráfico de volumen (a partir de los datos del rango/periodo) ===
const volumePoints = computed(() => {
  const data = volumeData.value;
  if (data.length === 0) return [] as { x: number; y: number; date: string; dateKey: string; count: number }[];
  const max = Math.max(...data.map((d) => d.count), 1);
  const denominator = data.length > 1 ? data.length - 1 : 1;
  return data.map((d, i) => ({
    x: data.length > 1 ? (i / denominator) * 1000 : 500,
    y: 280 - (d.count / max) * 260,
    date: formatPeriodDate(d.date),
    dateKey: d.date,
    count: d.count,
  }));
});

const volumeLinePath = computed(() => {
  const points = volumePoints.value;
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
});

const volumeAreaPath = computed(() => {
  const line = volumeLinePath.value;
  return line ? `${line} L 1000 300 L 0 300 Z` : "";
});

const volumeLabels = computed(() => {
  const points = volumePoints.value;
  if (points.length === 0) return [] as string[];
  if (points.length <= 7) return points.map((p) => p.date);
  const step = (points.length - 1) / 6;
  return Array.from({ length: 7 }, (_, i) => points[Math.round(i * step)].date);
});

// Eje Y real: 0, mitad y máximo del rango (nunca un valor inventado).
const volumeMax = computed(() => Math.max(...volumeData.value.map((d) => d.count), 1));
const volumeTicks = computed(() =>
  [1, 0.5, 0].map((f) => ({ y: 20 + (1 - f) * 260, value: Math.round(volumeMax.value * f) })),
);

async function loadVolume() {
  try {
    volumeData.value = await dashboardService.getVolume(period.value, rangeDays.value);
  } catch (err: any) {
    console.error("Failed to load volume data:", err);
  }
}

async function loadDashboard() {
  try {
    isLoading.value = true;
    error.value = null;

    const [statsRes, outcomesRes, automationRes, channelsRes, activitiesRes, volumeRes] = await Promise.all([
      dashboardService.getStats(rangeDays.value),
      dashboardService.getOutcomes(rangeDays.value),
      dashboardService.getAutomation(rangeDays.value),
      dashboardService.getChannelDistribution(rangeDays.value),
      dashboardService.getActivities(),
      dashboardService.getVolume(period.value, rangeDays.value),
    ]);

    dashboardStats.value = statsRes;
    dashboardOutcomes.value = outcomesRes;
    dashboardAutomation.value = automationRes;
    channelData.value = channelsRes;
    activityList.value = activitiesRes;
    volumeData.value = volumeRes;
  } catch (err: any) {
    console.error("Failed to load dashboard data:", err);
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

watch(rangeDays, () => {
  loadDashboard();
});

watch(period, () => {
  loadVolume();
});

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <div
      v-if="error"
      class="flex flex-wrap items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-5 text-[13px] text-[color:var(--danger)]"
    >
      <AIcon name="WarningCircle" :size="20" />
      <span class="min-w-[200px] flex-1">{{ error }}</span>
      <AButton variant="primary" icon="ArrowsClockwise" @click="loadDashboard">
        {{ t("common.retry") }}
      </AButton>
    </div>

    <template v-else>
      <DashboardMetricBand :title="t('dashboard.sections.outcomes')" :metrics="resultMetrics" :is-loading="isLoading" />
      <DashboardMetricBand :title="t('dashboard.sections.botHealth')" :metrics="healthMetrics" :is-loading="isLoading" />

      <!-- Conversation volume and message mix -->
      <div class="rounded-card bg-surface p-5 px-6 shadow-card">
        <div class="flex flex-wrap items-center gap-3">
          <div>
            <h3 data-testid="volume-title" class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
              {{ t("dashboard.volume.title") }}
            </h3>
            <p class="text-[12px] text-ink-3">{{ t("dashboard.volume.subtitle") }}</p>
          </div>
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <div class="flex gap-0.5 rounded-full bg-canvas p-1">
              <button
                v-for="days in rangeOptions"
                :key="days"
                :data-testid="'range-' + days"
                type="button"
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  rangeDays === days ? 'bg-ink-solid text-ink-contrast' : 'text-ink-2 hover:text-ink',
                ]"
                @click="rangeDays = days"
              >
                {{ t("dashboard.volume.lastDays", { days }) }}
              </button>
            </div>
            <div class="flex gap-0.5 rounded-full bg-canvas p-1">
              <button
                v-for="p in periodOptions"
                :key="p.id"
                :data-testid="'period-' + p.id"
                type="button"
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  period === p.id ? 'bg-ink-solid text-ink-contrast' : 'text-ink-2 hover:text-ink',
                ]"
                @click="period = p.id"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="relative mt-5 h-72 w-full">
          <svg
            class="h-full w-full overflow-visible"
            viewBox="0 0 1000 300"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="var(--lilac)" stop-opacity="0.35" />
                <stop offset="100%" stop-color="var(--lilac)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <template v-if="volumePoints.length > 0">
              <line
                v-for="tick in volumeTicks"
                :key="tick.value"
                stroke="var(--line)"
                :stroke-dasharray="tick.value === 0 ? undefined : '4 4'"
                stroke-width="1"
                x1="0"
                x2="1000"
                :y1="tick.y"
                :y2="tick.y"
              />
              <text
                v-for="tick in volumeTicks"
                :key="'label-' + tick.value"
                fill="var(--ink-3)"
                font-size="13"
                text-anchor="start"
                x="6"
                :y="tick.y - 6"
              >
                {{ tick.value }}
              </text>
            </template>
            <path
              v-if="volumeAreaPath"
              :d="volumeAreaPath"
              fill="url(#chartGradient)"
              stroke="none"
            />
            <path
              v-if="volumeLinePath"
              :d="volumeLinePath"
              fill="none"
              stroke="var(--ink-1)"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
            />
            <circle
              v-for="(p, i) in volumePoints"
              :key="i"
              :fill="i === volumePoints.length - 1 ? 'var(--lilac)' : 'var(--surface)'"
              stroke="var(--ink-1)"
              :cx="p.x"
              :cy="p.y"
              :r="i === volumePoints.length - 1 ? 7 : 5"
              stroke-width="2"
            >
              <title>{{ p.date }}: {{ p.count }}</title>
            </circle>
            <text
              v-if="!isLoading && volumePoints.length === 0"
              fill="var(--ink-3)"
              font-size="16"
              text-anchor="middle"
              x="500"
              y="150"
            >
              {{ t("dashboard.volume.noData") }}
            </text>
          </svg>
          <table v-if="volumePoints.length > 0" class="sr-only">
            <caption>{{ t("dashboard.volume.title") }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ t("dashboard.volume.tableDate") }}</th>
                <th scope="col">{{ t("dashboard.volume.tableCount") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in volumePoints" :key="p.dateKey">
                <th scope="row">{{ p.date }}</th>
                <td>{{ p.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-between px-2 text-xs font-medium text-ink-3">
          <span v-for="(label, i) in volumeLabels" :key="i">{{ label }}</span>
        </div>

        <div class="mt-5 border-t border-line pt-4">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2">
            <span class="font-semibold">{{ t("dashboard.volume.senderBreakdown") }}</span>
            <span>{{ t("dashboard.volume.senderContact") }} {{ formatNumber(volumeSenderTotals.contact) }}</span>
            <span>{{ t("dashboard.volume.senderBot") }} {{ formatNumber(volumeSenderTotals.bot) }}</span>
            <span>{{ t("dashboard.volume.senderHuman") }} {{ formatNumber(volumeSenderTotals.human) }}</span>
          </div>
          <div v-if="volumeSenderRows.length" class="mt-3 space-y-2">
            <div
              v-for="row in volumeSenderRows"
              :key="row.date"
              class="grid grid-cols-[minmax(58px,auto)_1fr] items-center gap-3 text-[11px] text-ink-3"
            >
              <span class="truncate">{{ formatPeriodDate(row.date) }}</span>
              <div
                class="flex h-2.5 overflow-hidden rounded-full bg-sunken"
                role="img"
                :aria-label="t('dashboard.volume.senderRow', {
                  date: row.date,
                  contact: formatNumber(row.bySender.contact),
                  bot: formatNumber(row.bySender.bot),
                  human: formatNumber(row.bySender.human),
                })"
              >
                <span class="h-full bg-sky" :style="{ width: `${row.contactPercent}%` }" />
                <span class="h-full bg-lime" :style="{ width: `${row.botPercent}%` }" />
                <span class="h-full bg-lilac" :style="{ width: `${row.humanPercent}%` }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <!-- Channel distribution -->
        <div class="rounded-card bg-surface p-5 px-6 shadow-card">
          <h3 data-testid="channels-title" class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
            {{ t("dashboard.channels.title") }}
          </h3>
          <div class="mt-5">
            <div v-for="ch in channelBars" :key="ch.key" class="mt-4 first:mt-0">
              <div class="flex text-[12.5px] font-semibold">
                <span>{{ ch.label }}</span>
                <span class="ml-auto text-ink-3 [font-variant-numeric:tabular-nums]">{{ ch.pct }}%</span>
              </div>
              <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken">
                <span class="block h-full rounded-full" :style="{ width: ch.pct + '%', background: ch.color }" />
              </div>
            </div>
          </div>
        </div>

        <DashboardSentimentPanel :sentiment="dashboardAutomation.sentiment" />
      </div>

      <div class="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <!-- Recent activity -->
        <div class="rounded-card bg-surface p-5 px-6 shadow-card">
          <h3 data-testid="activity-title" class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
            {{ t("dashboard.activity.title") }}
          </h3>
          <p v-if="activities.length === 0" class="mt-4 text-sm text-ink-3">
            {{ t("dashboard.activity.empty") }}
          </p>
          <div v-else class="mt-3 flex flex-col">
            <div
              v-for="act in activities"
              :key="act.id"
              class="flex items-start gap-3 border-b border-line py-3 last:border-b-0"
            >
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-canvas text-ink-2">
                <AIcon :name="act.icon" :size="14" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-semibold">{{ act.title }}</p>
                <p class="mt-0.5 text-xs text-ink-3">{{ act.detail }}</p>
              </div>
              <span class="shrink-0 text-[11px] text-ink-3">{{ act.time }}</span>
            </div>
          </div>
        </div>

        <DashboardToolsPanel :tools="dashboardAutomation.tools" />
      </div>
    </template>
  </div>
</template>
