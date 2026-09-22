<script setup lang="ts">
import { computed } from 'vue';
import AIcon from './AIcon.vue';

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  width?: string;
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[];
    rows: Record<string, unknown>[];
    rowKey?: string;
    empty?: string;
    loading?: boolean;
    loadingLabel?: string;
    muted?: (row: Record<string, unknown>) => boolean;
  }>(),
  { rowKey: '_id', loading: false }
);

const emit = defineEmits<{ rowClick: [row: Record<string, unknown>] }>();

const hasRows = computed(() => props.rows.length > 0);
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? { width: col.width } : {}"
            :class="[
              'border-b-[1.5px] border-line px-4.5 py-3 text-[11px] font-semibold text-ink-3',
              col.align === 'right' ? 'text-right' : 'text-left',
            ]"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length" class="px-4.5 py-10 text-center text-ink-3">
            {{ loadingLabel }}
          </td>
        </tr>
        <tr v-else-if="!hasRows">
          <td :colspan="columns.length" class="px-4.5 py-10 text-center text-ink-3">
            {{ empty }}
          </td>
        </tr>
        <tr
          v-for="row in rows"
          v-else
          :key="String(row[rowKey])"
          :class="[
            'cursor-default border-b border-line last:border-b-0 hover:bg-canvas',
            muted && muted(row) ? 'opacity-50' : '',
          ]"
          @click="emit('rowClick', row)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :class="[
              'px-4.5 py-3.5',
              col.align === 'right' ? 'text-right' : 'text-left',
            ]"
          >
            <slot :name="col.key" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
