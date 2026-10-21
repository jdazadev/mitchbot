<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AModal from '../ui/AModal.vue';
import AButton from '../ui/AButton.vue';
import AIcon from '../ui/AIcon.vue';
import APill from '../ui/APill.vue';
import { messagingService, type ChatMessage } from '../../services/messaging.service';
import {
  emptyParameters,
  parametersComplete,
  previewTemplate,
  type TemplateParameters,
  type WhatsAppTemplate,
} from '../../lib/templates';

/** Elegir una plantilla aprobada, rellenar sus variables y enviarla a la conversación. */
const props = defineProps<{ open: boolean; conversationId: string; windowClosed?: boolean }>();
const emit = defineEmits<{ close: []; sent: [message: ChatMessage] }>();
const { t } = useI18n();

const templates = ref<WhatsAppTemplate[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);
const search = ref('');
const selected = ref<WhatsAppTemplate | null>(null);
const parameters = ref<TemplateParameters>({ header: [], body: [] });
const sending = ref(false);
const sendError = ref<string | null>(null);

async function load(refresh = false) {
  loading.value = true;
  loadError.value = null;
  try {
    templates.value = await messagingService.listTemplates(refresh);
  } catch (err: any) {
    loadError.value = err?.message || t('messaging.templates.errors.load');
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    selected.value = null;
    search.value = '';
    sendError.value = null;
    void load();
  },
  { immediate: true }
);

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return templates.value;
  return templates.value.filter((template) =>
    [template.name, template.body, template.category, template.language].some((field) => field?.toLowerCase().includes(query))
  );
});

function choose(template: WhatsAppTemplate) {
  if (!template.supported) return;
  selected.value = template;
  parameters.value = emptyParameters(template);
  sendError.value = null;
}

const variables = computed(() => {
  if (!selected.value) return [];
  let header = 0;
  let body = 0;
  return selected.value.variables.map((variable) => ({
    ...variable,
    index: variable.component === 'header' ? header++ : body++,
  }));
});

const preview = computed(() => (selected.value ? previewTemplate(selected.value, parameters.value) : ''));
const ready = computed(() => !!selected.value && parametersComplete(parameters.value));

async function send() {
  if (!selected.value || !ready.value) return;
  sending.value = true;
  sendError.value = null;
  try {
    const message = await messagingService.sendTemplate(props.conversationId, {
      name: selected.value.name,
      language: selected.value.language,
      parameters: parameters.value,
    });
    emit('sent', message);
    emit('close');
  } catch (err: any) {
    sendError.value = err?.message || t('messaging.templates.errors.send');
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AModal :open="open" :label="t('messaging.templates.title')" size="xl" @close="emit('close')">
    <div class="flex max-h-[85vh] flex-col p-6" data-testid="template-picker">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('messaging.templates.title') }}</h2>
        <button
          type="button"
          class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-canvas"
          :aria-label="t('common.close')"
          :title="t('common.close')"
          @click="emit('close')"
        >
          <AIcon name="X" :size="18" />
        </button>
      </div>
      <p class="mt-1 text-xs text-ink-3">
        {{ windowClosed ? t('messaging.templates.subtitleClosed') : t('messaging.templates.subtitle') }}
      </p>

      <div v-if="loading" role="status" class="py-10 text-center text-sm font-semibold text-ink-3">
        {{ t('messaging.templates.loading') }}
      </div>
      <div
        v-else-if="loadError"
        role="alert"
        class="mt-4 flex flex-wrap items-center gap-3 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
      >
        <AIcon name="WarningCircle" :size="17" />
        <span class="min-w-0 flex-1">{{ loadError }}</span>
        <AButton variant="ghost" size="sm" @click="load(true)">{{ t('common.retry') }}</AButton>
      </div>

      <template v-else-if="!selected">
        <div class="mt-4 flex items-center gap-2.5">
          <label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-canvas px-4 py-2.5 focus-within:shadow-[0_0_0_2px_var(--focus)]">
            <AIcon name="MagnifyingGlass" :size="16" class="shrink-0 text-ink-3" />
            <span class="sr-only">{{ t('messaging.templates.search') }}</span>
            <input
              v-model="search"
              type="search"
              class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none placeholder:text-ink-3"
              :placeholder="t('messaging.templates.search')"
            />
          </label>
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2 hover:bg-sunken"
            :aria-label="t('messaging.templates.refresh')"
            :title="t('messaging.templates.refresh')"
            @click="load(true)"
          >
            <AIcon name="ArrowsClockwise" :size="16" />
          </button>
        </div>

        <p v-if="!visible.length" class="py-10 text-center text-sm text-ink-3">
          {{ templates.length ? t('messaging.templates.noResults') : t('messaging.templates.empty') }}
        </p>
        <ul v-else class="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1" :aria-label="t('messaging.templates.title')">
          <li v-for="template in visible" :key="`${template.name}:${template.language}`">
            <button
              type="button"
              class="flex w-full flex-col gap-1.5 rounded-field border border-line p-3.5 text-left transition-colors enabled:hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!template.supported"
              :aria-describedby="!template.supported ? `tpl-reason-${template.name}-${template.language}` : undefined"
              :data-template="template.name"
              @click="choose(template)"
            >
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-[12.5px] font-semibold text-ink">{{ template.name }}</span>
                <APill :dot="false" size="sm">{{ template.language }}</APill>
                <span class="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{{ template.category.toLowerCase() }}</span>
              </span>
              <span class="line-clamp-2 text-xs text-ink-2">{{ template.body }}</span>
              <span
                v-if="!template.supported"
                :id="`tpl-reason-${template.name}-${template.language}`"
                class="flex items-center gap-1 text-[11px] font-semibold text-butter-ink"
              >
                <AIcon name="WarningCircle" :size="13" />
                {{ t('messaging.templates.unsupported', { reason: template.unsupportedReason }) }}
              </span>
            </button>
          </li>
        </ul>
      </template>

      <form v-else class="mt-4 flex min-h-0 flex-col gap-4 overflow-y-auto" @submit.prevent="send">
        <button type="button" class="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink" @click="selected = null">
          <AIcon name="ArrowLeft" :size="14" />
          {{ t('messaging.templates.back') }}
        </button>
        <p class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-[13px] font-semibold">{{ selected.name }}</span>
          <APill :dot="false" size="sm">{{ selected.language }}</APill>
        </p>

        <div v-if="variables.length" class="grid gap-3 sm:grid-cols-2">
          <label v-for="variable in variables" :key="`${variable.component}-${variable.key}`" class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">
              {{ t(`messaging.templates.variable.${variable.component}`, { key: variable.key }) }}
            </span>
            <input
              v-model="parameters[variable.component][variable.index]"
              class="field"
              maxlength="1024"
              :placeholder="variable.example ? t('messaging.templates.example', { example: variable.example }) : ''"
            />
          </label>
        </div>
        <p v-else class="text-xs text-ink-3">{{ t('messaging.templates.noVariables') }}</p>

        <div>
          <p class="text-xs font-semibold text-ink-2">{{ t('messaging.templates.preview') }}</p>
          <p
            class="mt-2 whitespace-pre-line rounded-field bg-lime-soft p-4 text-[13px] text-ink"
            data-testid="template-preview"
          >{{ preview }}</p>
          <p v-if="selected.buttons.length" class="mt-2 flex flex-wrap gap-1.5">
            <APill v-for="button in selected.buttons" :key="button.text" :dot="false" size="sm">{{ button.text }}</APill>
          </p>
        </div>

        <div
          v-if="sendError"
          role="alert"
          class="flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ sendError }}
        </div>

        <div class="flex justify-end gap-2.5">
          <AButton variant="ghost" type="button" @click="emit('close')">{{ t('common.cancel') }}</AButton>
          <AButton variant="primary" type="submit" :disabled="!ready" :loading="sending">
            {{ sending ? t('messaging.templates.sending') : t('messaging.templates.send') }}
          </AButton>
        </div>
      </form>
    </div>
  </AModal>
</template>
