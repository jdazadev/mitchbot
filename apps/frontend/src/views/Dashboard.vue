<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import {
  dashboardService,
  type DashboardStats,
  type Activity,
  type ChannelDistribution,
  type VolumeData,
  type VolumePeriod,
} from "../services/dashboard.service";

const isLoading = ref(true);
const error = ref<string | null>(null);

// Rango de fechas (últimos 7/30/90 días) y granularidad del volumen.
const rangeOptions = [7, 30, 90] as const;
const rangeDays = ref<number>(30);
const period = ref<VolumePeriod>("daily");
const periodOptions: { id: VolumePeriod; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];
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
    label: "Total Conversations",
    value: new Intl.NumberFormat().format(dashboardStats.value.total),
    change: "+12%", // Mocked for now
    icon: "chat_bubble",
    color: "blue",
  },
  {
    label: "Active Chats",
    value: dashboardStats.value.active.toString(),
    status: "Live",
    icon: "forum",
    color: "violet",
  },
  {
    label: "Response Rate",
    value: dashboardStats.value.responseRate,
    change: "+1.2%", // Mocked
    icon: "bolt",
    color: "amber",
  },
  {
    label: "Lead Conversion",
    value: "14.0%", // Mocked
    change: "+0.5%", // Mocked
    icon: "filter_alt",
    color: "rose",
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

// Helper for time ago
function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

// Donut chart calculations
const whatsappPercent = computed(() => channelData.value.whatsapp);
const instagramPercent = computed(() => channelData.value.instagram);
// const webPercent = computed(() => channelData.value.web);

// Circumference is ~100 for r=15.9154
const donutWhatsapp = computed(
  () => `${whatsappPercent.value} ${100 - whatsappPercent.value}`,
);
const donutInstagram = computed(
  () => `${instagramPercent.value} ${100 - instagramPercent.value}`,
);
const donutInstagramOffset = computed(() => 25 - whatsappPercent.value); // Continuously after whatsapp

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

// Muestra hasta 7 etiquetas repartidas uniformemente.
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

    // Parallel fetch
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

// Cambiar el rango recalcula métricas, canales y volumen.
watch(rangeDays, () => {
  loadDashboard();
});

// Cambiar la granularidad solo afecta al volumen.
watch(period, () => {
  loadVolume();
});

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
      >
        <div class="flex justify-between items-start mb-4">
          <div
            :class="`p-2.5 rounded-lg text-${stat.color}-600 dark:text-${stat.color}-400 bg-${stat.color}-50 dark:bg-${stat.color}-900/30`"
          >
            <span class="material-symbols-outlined text-[24px]">{{
              stat.icon
            }}</span>
          </div>
          <span
            v-if="stat.change"
            class="flex items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md text-xs font-bold ring-1 ring-inset ring-emerald-600/20"
          >
            <span class="material-symbols-outlined text-[16px] mr-0.5"
              >trending_up</span
            >
            {{ stat.change }}
          </span>
          <div
            v-if="stat.status"
            class="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-700/50 rounded-md"
          >
            <span class="relative flex h-2 w-2">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"
              ></span>
            </span>
            <span
              class="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >Live</span
            >
          </div>
        </div>
        <div>
          <h3
            class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight"
          >
            {{ stat.value }}
          </h3>
          <p
            class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1"
          >
            {{ stat.label }}
          </p>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Volume Chart -->
      <div
        class="xl:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm"
      >
        <div class="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              Conversation Volume
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Conversations started over time
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <!-- Rango de fechas -->
            <div
              class="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg"
            >
              <button
                v-for="days in rangeOptions"
                :key="days"
                @click="rangeDays = days"
                :class="[
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  rangeDays === days
                    ? 'font-semibold bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-500'
                    : 'font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                ]"
              >
                Last {{ days }} Days
              </button>
            </div>
            <!-- Granularidad -->
            <div
              class="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg"
            >
              <button
                v-for="p in periodOptions"
                :key="p.id"
                @click="period = p.id"
                :class="[
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  period === p.id
                    ? 'font-semibold bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-500'
                    : 'font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                ]"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
        </div>
        <div class="relative w-full h-80">
          <svg
            class="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 1000 300"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stop-color="#3b82f6"
                  stop-opacity="0.15"
                ></stop>
                <stop
                  offset="100%"
                  stop-color="#3b82f6"
                  stop-opacity="0"
                ></stop>
              </linearGradient>
            </defs>
            <line
              class="stroke-slate-100 dark:stroke-slate-700"
              stroke-width="1"
              x1="0"
              x2="1000"
              y1="299"
              y2="299"
            ></line>
            <line
              class="stroke-slate-100 dark:stroke-slate-700"
              stroke-dasharray="4 4"
              stroke-width="1"
              x1="0"
              x2="1000"
              y1="225"
              y2="225"
            ></line>
            <line
              class="stroke-slate-100 dark:stroke-slate-700"
              stroke-dasharray="4 4"
              stroke-width="1"
              x1="0"
              x2="1000"
              y1="150"
              y2="150"
            ></line>
            <line
              class="stroke-slate-100 dark:stroke-slate-700"
              stroke-dasharray="4 4"
              stroke-width="1"
              x1="0"
              x2="1000"
              y1="75"
              y2="75"
            ></line>
            <path
              v-if="volumeLinePath"
              :d="volumeLinePath"
              fill="none"
              stroke="#2563EB"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
            ></path>
            <path
              v-if="volumeAreaPath"
              :d="volumeAreaPath"
              fill="url(#chartGradient)"
              stroke="none"
            ></path>
            <circle
              v-for="(p, i) in volumePoints"
              :key="i"
              :class="
                i === volumePoints.length - 1
                  ? 'fill-blue-600 stroke-white'
                  : 'fill-white stroke-blue-600'
              "
              :cx="p.x"
              :cy="p.y"
              :r="i === volumePoints.length - 1 ? 7 : 5"
              stroke-width="2"
            ></circle>
            <text
              v-if="volumePoints.length === 0"
              class="fill-slate-400"
              font-size="16"
              text-anchor="middle"
              x="500"
              y="150"
            >
              Sin datos en este rango
            </text>
          </svg>
        </div>
        <div
          class="flex justify-between mt-4 text-xs text-slate-400 font-medium px-2"
        >
          <span v-for="(label, i) in volumeLabels" :key="i">{{ label }}</span>
        </div>
      </div>

      <!-- Right Column -->
      <div class="flex flex-col gap-6">
        <!-- Channel Distribution -->
        <div
          class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex-1 min-h-[300px]"
        >
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Channel Distribution
          </h3>
          <div class="flex flex-col items-center justify-center">
            <div class="relative w-48 h-48">
              <svg class="donut" height="100%" viewBox="0 0 42 42" width="100%">
                <circle
                  class="donut-hole"
                  cx="21"
                  cy="21"
                  fill="transparent"
                  r="15.9154"
                ></circle>
                <circle
                  class="stroke-slate-100 dark:stroke-slate-700"
                  cx="21"
                  cy="21"
                  fill="transparent"
                  r="15.9154"
                  stroke-width="4"
                ></circle>
                <circle
                  class="donut-segment"
                  cx="21"
                  cy="21"
                  fill="transparent"
                  r="15.9154"
                  stroke="#2563EB"
                  :stroke-dasharray="donutWhatsapp"
                  stroke-dashoffset="25"
                  stroke-linecap="round"
                  stroke-width="4"
                ></circle>
                <circle
                  class="donut-segment"
                  cx="21"
                  cy="21"
                  fill="transparent"
                  r="15.9154"
                  stroke="#8b5cf6"
                  :stroke-dasharray="donutInstagram"
                  :stroke-dashoffset="donutInstagramOffset"
                  stroke-linecap="round"
                  stroke-width="4"
                ></circle>
              </svg>
              <div
                class="absolute inset-0 flex flex-col items-center justify-center"
              >
                <span class="text-3xl font-bold text-slate-900 dark:text-white"
                  >100%</span
                >
                <span
                  class="text-xs text-slate-400 font-semibold uppercase tracking-wider"
                  >Traffic</span
                >
              </div>
            </div>
            <div
              class="flex justify-center w-full gap-8 mt-6 border-t border-slate-50 dark:border-slate-700 pt-6"
            >
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-2 mb-1">
                  <div class="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                  <span
                    class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                    >WhatsApp</span
                  >
                </div>
                <span class="text-xs font-bold text-slate-500"
                  >{{ whatsappPercent }}%</span
                >
              </div>
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-2 mb-1">
                  <div class="w-2.5 h-2.5 rounded-full bg-violet-500"></div>
                  <span
                    class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                    >Instagram</span
                  >
                </div>
                <span class="text-xs font-bold text-slate-500"
                  >{{ instagramPercent }}%</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div
          class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex-1"
        >
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h3>
            <button
              class="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View All
            </button>
          </div>
          <div class="relative flex flex-col gap-6">
            <div
              class="absolute left-3.5 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700"
            ></div>
            <div
              v-if="activities.length === 0"
              class="text-sm text-slate-500 p-4"
            >
              No recent activity
            </div>
            <div
              v-else
              v-for="act in activities"
              :key="act.title"
              class="relative flex gap-4 items-start group"
            >
              <div
                :class="`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 ring-2 ring-offset-2 dark:ring-offset-slate-800 ring-${act.color}-500`"
              >
                <span
                  class="material-symbols-outlined text-[14px]"
                  :class="`text-${act.color}-500 font-bold`"
                  >{{ act.icon }}</span
                >
              </div>
              <div class="flex flex-col">
                <p
                  class="text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  {{ act.title }}
                </p>
                <p
                  class="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
                  v-html="act.detail"
                ></p>
                <span class="text-[10px] text-slate-400 font-medium mt-1">{{
                  act.time
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
