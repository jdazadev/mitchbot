<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import ASwitch from '../ui/ASwitch.vue';
import { invalidOrigins, widgetFrameUrl, widgetSnippet, type WidgetForm } from '../../lib/widget';

/** Widget embebible del canal Web: activación, dominios, apariencia, fragmento y vista previa. */
const props = defineProps<{
  slug: string;
  apiBase: string;
  /** Lo guardado en el servidor: la vista previa solo funciona con el widget activo guardado. */
  savedEnabled: boolean;
}>();
const form = defineModel<WidgetForm>({ required: true });
const emit = defineEmits<{ copied: []; copyFailed: [] }>();
const { t } = useI18n();

const snippet = computed(() => widgetSnippet(props.apiBase, props.slug));
const invalid = computed(() => invalidOrigins(form.value.allowedOrigins));
const showPreview = ref(false);
const previewUrl = computed(() => widgetFrameUrl(props.apiBase, props.slug));

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value);
    emit('copied');
  } catch {
    emit('copyFailed');
  }
}
</script>

<template>
  <div class="mt-4 flex flex-col gap-4 border-t border-line pt-4" data-testid="widget-settings">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-[13px] font-semibold">{{ t('settings.widget.title') }}</p>
        <p class="text-xs text-ink-3">{{ t('settings.widget.subtitle') }}</p>
      </div>
      <ASwitch v-model="form.enabled" :aria-label="t('settings.widget.enable')" />
    </div>

    <template v-if="form.enabled">
      <div class="flex flex-col gap-1.5">
        <label for="widget-origins" class="text-xs font-semibold text-ink-2">{{ t('settings.widget.originsLabel') }}</label>
        <textarea
          id="widget-origins"
          v-model="form.allowedOrigins"
          rows="3"
          class="field font-mono text-xs"
          :placeholder="t('settings.widget.originsPlaceholder')"
          :aria-invalid="invalid.length > 0"
          aria-describedby="widget-origins-hint"
        />
        <p id="widget-origins-hint" class="text-xs" :class="invalid.length ? 'text-[color:var(--danger)]' : 'text-ink-3'">
          {{ invalid.length ? t('settings.widget.originsInvalid', { origins: invalid.join(', ') }) : t('settings.widget.originsHint') }}
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-2">{{ t('settings.widget.titleLabel') }}</span>
          <input v-model="form.title" class="field" maxlength="60" :placeholder="t('settings.widget.titlePlaceholder')" />
        </label>
        <fieldset class="flex flex-col gap-1.5">
          <legend class="text-xs font-semibold text-ink-2">{{ t('settings.widget.position') }}</legend>
          <div class="mt-1.5 flex gap-1.5">
            <button
              v-for="side in (['right', 'left'] as const)"
              :key="side"
              type="button"
              class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
              :class="form.position === side ? 'bg-ink-solid text-ink-contrast' : 'bg-canvas text-ink-2 hover:bg-sunken'"
              :aria-pressed="form.position === side"
              @click="form.position = side"
            >
              {{ t(`settings.widget.positions.${side}`) }}
            </button>
          </div>
        </fieldset>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-ink-2">{{ t('settings.widget.greetingLabel') }}</span>
        <textarea v-model="form.greeting" rows="2" class="field" maxlength="300" :placeholder="t('settings.widget.greetingPlaceholder')" />
      </label>

      <div class="flex flex-col gap-1.5">
        <label for="widget-snippet" class="text-xs font-semibold text-ink-2">{{ t('settings.widget.snippetLabel') }}</label>
        <div class="flex flex-wrap items-center gap-2.5">
          <input id="widget-snippet" :value="snippet" class="field min-w-0 flex-1 font-mono text-xs" readonly />
          <AButton variant="ghost" @click="copySnippet">{{ t('settings.widget.copySnippet') }}</AButton>
        </div>
        <p class="text-xs text-ink-3">{{ t('settings.widget.snippetHint') }}</p>
      </div>

      <div>
        <AButton variant="ghost" :disabled="!savedEnabled" @click="showPreview = !showPreview">
          <AIcon name="Eye" :size="15" />
          {{ showPreview ? t('settings.widget.hidePreview') : t('settings.widget.preview') }}
        </AButton>
        <p v-if="!savedEnabled" class="mt-1.5 text-xs text-ink-3">{{ t('settings.widget.previewHint') }}</p>
        <iframe
          v-if="showPreview && savedEnabled"
          :src="previewUrl"
          :title="t('settings.widget.preview')"
          class="mt-3 h-[520px] w-full max-w-[380px] rounded-[22px] border border-line shadow-card"
          data-testid="widget-preview"
        />
      </div>
    </template>
  </div>
</template>
