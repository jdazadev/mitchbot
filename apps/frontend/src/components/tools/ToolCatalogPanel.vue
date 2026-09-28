<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toolsService, type ToolCatalogModule, type ToolConfig, type ToolOperation } from '../../services/tools.service';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import APill from '../ui/APill.vue';
import ASwitch from '../ui/ASwitch.vue';

const { t } = useI18n();
const catalog = ref<ToolCatalogModule[]>([]);
const config = ref<ToolConfig>({});
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);

const moduleIcons: Record<string, string> = {
  agenda: 'Clock', conocimiento: 'Brain', inventario: 'Storefront', pagos: 'Lightning',
};
const modules = computed(() => catalog.value);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const result = await toolsService.getCatalog();
    catalog.value = result.catalog;
    config.value = result.config;
  } catch (cause: any) {
    error.value = cause?.message || t('common.error');
  } finally {
    loading.value = false;
  }
}

async function persist() {
  if (saving.value) return;
  saving.value = true;
  error.value = null;
  try {
    const result = await toolsService.saveConfig(config.value);
    catalog.value = result.catalog;
    config.value = result.config;
  } catch (cause: any) {
    const message = cause?.message || t('common.error');
    await load();
    error.value = message;
  } finally {
    saving.value = false;
  }
}

function updateModule(module: ToolCatalogModule, enabled: boolean) {
  if (!config.value[module.id]) return;
  config.value[module.id].enabled = enabled;
  void persist();
}

function updateOperation(moduleId: string, operation: ToolOperation, enabled: boolean) {
  const setting = config.value[moduleId]?.operations[operation];
  if (!setting) return;
  setting.enabled = enabled;
  void persist();
}

function controlTone(control: string) {
  if (control === 'aprobacion_operador') return 'butter';
  if (control === 'confirmacion_cliente') return 'lilac';
  return 'ghost';
}

function controlLabel(control: string) {
  const key = `tools.control.${control}`;
  return t(key);
}

onMounted(load);
</script>

<template>
  <section aria-labelledby="tools-catalog-heading" class="flex flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="tools-catalog-heading" class="font-display text-[19px] font-bold tracking-[-0.025em]">
          {{ t('tools.catalog.title') }}
        </h2>
        <p class="mt-1 max-w-[68ch] text-[13px] text-ink-3">{{ t('tools.catalog.description') }}</p>
      </div>
      <APill :dot="false" tone="ghost"><AIcon name="Wrench" :size="14" />{{ t('tools.binding.internal') }}</APill>
    </div>

    <div v-if="loading" aria-busy="true" class="grid gap-4 md:grid-cols-2">
      <div v-for="n in 4" :key="n" class="h-52 animate-pulse rounded-card bg-surface shadow-card" />
    </div>

    <div v-else-if="error" role="alert" class="flex flex-wrap items-center gap-3 rounded-card bg-[color:var(--danger-soft)] p-4 text-[13px] text-[color:var(--danger)]">
      <AIcon name="WarningCircle" :size="18" />
      <span class="min-w-0 flex-1">{{ t('tools.errors.load', { message: error }) }}</span>
      <AButton variant="secondary" size="sm" icon="ArrowCounterClockwise" @click="load">{{ t('common.retry') }}</AButton>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <section v-for="module in modules" :key="module.id" class="min-w-0 overflow-hidden rounded-card bg-surface shadow-card">
        <div class="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-5">
          <span :class="['grid h-10 w-10 shrink-0 place-items-center rounded-[14px]', module.id === 'conocimiento' ? 'bg-lime-soft text-lime-ink' : module.id === 'agenda' ? 'bg-sky-soft text-sky-ink' : module.id === 'inventario' ? 'bg-lilac-soft text-lilac-ink' : 'bg-butter-soft text-butter-ink']">
            <AIcon :name="moduleIcons[module.id] || 'Wrench'" :size="19" />
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-display text-[16px] font-bold tracking-[-0.02em]">{{ t(`tools.modules.${module.id}`) }}</h3>
            <p class="mt-0.5 text-xs text-ink-3">{{ t(`tools.modules.${module.id}Description`) }}</p>
          </div>
          <ASwitch
            :model-value="config[module.id]?.enabled ?? module.enabled"
            :aria-label="t('tools.catalog.toggleModule', { module: t(`tools.modules.${module.id}`) })"
            :disabled="saving"
            @update:model-value="updateModule(module, $event)"
          />
        </div>

        <ul class="divide-y divide-line px-4 sm:px-5">
          <li v-for="operation in module.operations" :key="operation.id" class="flex min-w-0 items-center gap-3 py-3.5">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[13px] font-bold">{{ t(`tools.operations.${operation.id}`) }}</span>
                <APill :dot="false" :tone="controlTone(operation.control) as any" size="sm">
                  {{ controlLabel(operation.control) }}
                </APill>
              </div>
              <p class="mt-1 text-xs leading-relaxed text-ink-3">{{ t(`tools.operationDescriptions.${module.id}.${operation.id}`) }}</p>
              <span class="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2">
                <AIcon name="Lock" :size="12" />
                {{ t('tools.binding.internal') }}
              </span>
            </div>
            <ASwitch
              :model-value="config[module.id]?.operations[operation.id]?.enabled ?? operation.enabled"
              :aria-label="t('tools.catalog.toggleOperation', { operation: t(`tools.operations.${operation.id}`), module: t(`tools.modules.${module.id}`) })"
              :disabled="saving || !(config[module.id]?.enabled ?? module.enabled)"
              @update:model-value="updateOperation(module.id, operation.id, $event)"
            />
          </li>
        </ul>
      </section>
    </div>

    <p v-if="saving" role="status" class="text-right text-xs font-semibold text-ink-3">{{ t('tools.catalog.saving') }}</p>
  </section>
</template>
