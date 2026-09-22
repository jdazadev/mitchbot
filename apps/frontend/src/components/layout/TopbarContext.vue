<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

export interface TopbarControl {
  key: string;
  kind: 'segmented' | 'counters' | 'chips';
  label?: string;
  options?: { key: string; label: string; icon?: string }[];
  counters?: { value: string; label: string; tone?: 'sky' | 'lilac' | 'lime' | 'butter' }[];
  chips?: { key: string; label: string; color?: string }[];
}

const route = useRoute();
const { t } = useI18n();

const CONTEXT: Record<string, TopbarControl[]> = {
  dashboard: [
    {
      key: 'range',
      kind: 'segmented',
      options: [
        { key: '7', label: '7d' },
        { key: '30', label: '30d' },
        { key: '90', label: '90d' },
      ],
    },
    {
      key: 'period',
      kind: 'segmented',
      options: [
        { key: 'daily', label: 'Diaria' },
        { key: 'weekly', label: 'Semanal' },
        { key: 'monthly', label: 'Mensual' },
      ],
    },
  ],
  messaging: [
    {
      key: 'counters',
      kind: 'counters',
      counters: [
        { value: '12', label: 'activas', tone: 'sky' },
        { value: '3', label: 'piden una mano', tone: 'butter' },
      ],
    },
    {
      key: 'mode',
      kind: 'segmented',
      options: [
        { key: 'auto_pilot', label: 'Piloto' },
        { key: 'human_takeover', label: 'Humano' },
      ],
    },
  ],
  clients: [
    {
      key: 'channels',
      kind: 'chips',
      chips: [
        { key: 'whatsapp', label: 'WhatsApp', color: 'var(--ok)' },
        { key: 'instagram', label: 'Instagram', color: 'var(--lilac)' },
        { key: 'web', label: 'Web', color: 'var(--sky)' },
      ],
    },
  ],
  brain: [
    {
      key: 'sources',
      kind: 'counters',
      counters: [
        { value: '61', label: 'trozos', tone: 'sky' },
        { value: '4', label: 'fuentes', tone: 'lime' },
      ],
    },
  ],
  users: [
    {
      key: 'roles',
      kind: 'counters',
      counters: [
        { value: '1', label: 'admin', tone: 'sky' },
        { value: '1', label: 'soporte', tone: 'lilac' },
        { value: '1', label: 'asistente', tone: 'lime' },
      ],
    },
  ],
  settings: [],
  profile: [],
};

const controls = computed(() => CONTEXT[String(route.name)] ?? []);
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <template v-for="control in controls" :key="control.key">
      <div v-if="control.kind === 'segmented'" class="flex gap-0.5 rounded-full bg-canvas p-1">
        <button
          v-for="(opt, idx) in control.options"
          :key="opt.key"
          type="button"
          :class="[
            'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150',
            idx === (control.key === 'range' ? 1 : 0)
              ? 'bg-ink text-white'
              : 'text-ink-2 hover:text-ink',
          ]"
        >
          {{ opt.label }}
        </button>
      </div>

      <div
        v-else-if="control.kind === 'counters'"
        class="flex gap-2 rounded-full bg-surface p-1.5 shadow-card"
      >
        <div
          v-for="c in control.counters"
          :key="c.label"
          :class="[
            'flex items-baseline gap-1.5 rounded-full px-3 py-1',
            c.tone === 'sky'
              ? 'bg-sky-soft'
              : c.tone === 'lilac'
                ? 'bg-lilac-soft'
                : c.tone === 'lime'
                  ? 'bg-lime-soft'
                  : c.tone === 'butter'
                    ? 'bg-butter-soft'
                    : 'bg-canvas',
          ]"
        >
          <b class="font-display text-sm font-bold tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
            {{ c.value }}
          </b>
          <span class="text-[11px] font-medium text-ink-3">{{ c.label }}</span>
        </div>
      </div>

      <div v-else-if="control.kind === 'chips'" class="flex gap-1.5">
        <button
          v-for="chip in control.chips"
          :key="chip.key"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink"
        >
          <span
            v-if="chip.color"
            class="h-1.5 w-1.5 rounded-full"
            :style="{ background: chip.color }"
          />
          {{ chip.label }}
        </button>
      </div>
    </template>
    <slot />
  </div>
</template>
