<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  dashboardService,
  type DashboardStats,
  type Activity,
  type ChannelDistribution,
  type VolumeData,
  type VolumePeriod,
} from "../services/dashboard.service";
import AIcon from "../components/ui/AIcon.vue";
import AButton from "../components/ui/AButton.vue";
import { CHANNEL_META, channelFill } from "../lib/channels";

const { t } = useI18n();
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
  responseRate: "0%",
});

const channelData = ref<ChannelDistribution>({
  whatsapp: 0,
  instagram: 0,
  web: 0,
});

const activityList = ref<Activity[]>([]);

const stats = computed(() => [
  {
    label: t("dashboard.stats.totalConversations"),
    testId: "total-conversations",
    value: new Intl.NumberFormat().format(dashboardStats.value.total),
    icon: "ChatTeardropText",
    tone: "sky" as const,
    live: false,
  },
  {
    label: t("dashboard.stats.activeChats"),
    testId: "active-chats",
    value: dashboardStats.value.active.toString(),
    icon: "ChatsCircle",
    tone: "lilac" as const,
    live: true,
  },
  {
    label: t("dashboard.stats.responseRate"),
    testId: "response-rate",
    value: dashboardStats.value.responseRate,
    icon: "Lightning",
    tone: "lime" as const,
    live: false,
  },
]);

const activities = computed(() =>
  activityList.value.map((act) => ({
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

const whatsappPercent = computed(() => channelData.value.whatsapp);
const instagramPercent = computed(() => channelData.value.instagram);
const webPercent = computed(() => channelData.value.web);

const channelBars = computed(() => [
  { key: "whatsapp", label: CHANNEL_META.WhatsApp.label, pct: whatsappPercent.value, color: channelFill("WhatsApp") },
  { key: "instagram", label: CHANNEL_META.Instagram.label, pct: instagramPercent.value, color: channelFill("Instagram") },
  { key: "web", label: CHANNEL_META.Web.label, pct: webPercent.value, color: channelFill("Web") },
]);

// === Gráfico de volumen (a partir de los datos del rango/periodo) ===
const volumePoints = computed(() => {
  const data = volumeData.value;
  if (data.length === 0) return [] as { x: number; y: number; date: string; count: number }[];
  const max = Math.max(...data.map((d) => d.count), 1);
  const denominator = data.length > 1 ? data.length - 1 : 1;
  return data.map((d, i) => ({
    x: data.length > 1 ? (i / denominator) * 1000 : 500,
    y: 280 - (d.count / max) * 260,
    date: d.date,
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

    const [statsRes, channelsRes, activitiesRes, volumeRes] = await Promise.all([
      dashboardService.getStats(rangeDays.value),
      dashboardService.getChannelDistribution(rangeDays.value),
      dashboardService.getActivities(),
      dashboardService.getVolume(period.value, rangeDays.value),
    ]);

    dashboardStats.value = statsRes;
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
      <!-- Stats -->
      <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <div
          v-for="stat in stats"
          :key="stat.label"
          :data-testid="'stat-' + stat.testId"
          class="rounded-card bg-surface p-5 px-6 shadow-card"
        >
          <div class="flex items-center gap-2.5">
            <span
              :class="[
                'grid h-8 w-8 place-items-center rounded-[11px]',
                stat.tone === 'sky' ? 'bg-sky text-sky-ink' : stat.tone === 'lilac' ? 'bg-lilac text-lilac-ink' : 'bg-lime text-lime-ink',
              ]"
            >
              <AIcon :name="stat.icon" :size="16" weight="bold" />
            </span>
            <span class="text-xs font-semibold text-ink-3">{{ stat.label }}</span>
          </div>
          <div
            v-if="isLoading"
            class="mt-3 h-9 w-24 animate-pulse rounded-lg bg-sunken"
            aria-hidden="true"
          />
          <div
            v-else
            class="mt-3 font-display text-[38px] font-bold leading-none tracking-[-0.04em] [font-variant-numeric:tabular-nums]"
          >
            {{ stat.value }}
          </div>
          <div v-if="stat.live && !isLoading" class="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-lime-ink">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-ink" />
            {{ t("dashboard.stats.live") }}
          </div>
        </div>
      </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.7fr_1fr]">
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
                  rangeDays === days ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink',
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
                  period === p.id ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink',
                ]"
                @click="period = p.id"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="relative mt-5 h-72 w-full">
          <svg class="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
            <defs>
              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="var(--lilac)" stop-opacity="0.35" />
                <stop offset="100%" stop-color="var(--lilac)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <line
              v-for="y in [299, 225, 150, 75]"
              :key="y"
              stroke="var(--line)"
              :stroke-dasharray="y === 299 ? undefined : '4 4'"
              stroke-width="1"
              x1="0"
              x2="1000"
              :y1="y"
              :y2="y"
            />
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
            />
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
        </div>
        <div class="mt-4 flex justify-between px-2 text-xs font-medium text-ink-3">
          <span v-for="(label, i) in volumeLabels" :key="i">{{ label }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-3.5">
        <!-- Channel distribution -->
        <div class="flex-1 rounded-card bg-surface p-5 px-6 shadow-card">
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
            <p class="mt-4 text-xs text-ink-3">
              {{ t("dashboard.channels.traffic") }}: 100%
            </p>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="flex-1 rounded-card bg-surface p-5 px-6 shadow-card">
          <h3 data-testid="activity-title" class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
            {{ t("dashboard.activity.title") }}
          </h3>
          <p v-if="activities.length === 0" class="mt-4 text-sm text-ink-3">
            {{ t("dashboard.activity.empty") }}
          </p>
          <div v-else class="mt-3 flex flex-col">
            <div
              v-for="act in activities"
              :key="act.title"
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
      </div>
    </div>
    </template>
  </div>
</template>
