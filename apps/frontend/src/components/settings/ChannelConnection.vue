<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import { isValidAccountId, type MetaChannel } from '../../lib/channels';
import type { ChannelServerStatus } from '../../services/project.service';

/** Conexión de un canal de Meta: cuenta del proyecto, webhook para Meta y estado del servidor. */
const props = defineProps<{
  channel: MetaChannel;
  status?: ChannelServerStatus | null;
  webhookUrl: string;
}>();

const account = defineModel<string>({ required: true });
const emit = defineEmits<{ copied: []; copyFailed: [] }>();
const { t } = useI18n();

const key = (name: string) => `settings.channels.${props.channel}.${name}`;
const invalid = computed(() => !!account.value.trim() && !isValidAccountId(account.value));

async function copyWebhook() {
  try {
    await navigator.clipboard.writeText(props.webhookUrl);
    emit('copied');
  } catch {
    emit('copyFailed');
  }
}
</script>

<template>
  <div class="mt-4 flex flex-col gap-4 border-t border-line pt-4" :data-testid="`${channel}-connection`">
    <p
      v-if="status"
      role="status"
      class="flex items-start gap-2 text-xs"
      :class="status.connected ? 'text-lime-ink' : 'text-butter-ink'"
      :data-testid="`${channel}-server-status`"
    >
      <AIcon :name="status.connected ? 'CheckCircle' : 'WarningCircle'" :size="15" class="mt-px shrink-0" />
      <span v-if="status.connected">{{ t(key('serverReady')) }}</span>
      <span v-else>{{ t(key('serverMissing'), { vars: status.missing.join(', ') }) }}</span>
    </p>

    <div class="flex flex-col gap-1.5">
      <label :for="`${channel}-account`" class="text-xs font-semibold text-ink-2">{{ t(key('accountLabel')) }}</label>
      <input
        :id="`${channel}-account`"
        v-model="account"
        class="field"
        inputmode="numeric"
        autocomplete="off"
        :placeholder="t(key('accountPlaceholder'))"
        :aria-invalid="invalid"
        :aria-describedby="`${channel}-account-hint`"
      />
      <p :id="`${channel}-account-hint`" class="text-xs" :class="invalid ? 'text-[color:var(--danger)]' : 'text-ink-3'">
        {{ invalid ? t(key('accountInvalid')) : t(key('accountHint')) }}
      </p>
    </div>

    <!-- Campos propios del canal (p. ej. la WABA de WhatsApp para las plantillas) -->
    <slot name="extra" />

    <div class="flex flex-col gap-1.5">
      <label :for="`${channel}-webhook`" class="text-xs font-semibold text-ink-2">{{ t('settings.channels.webhookLabel') }}</label>
      <div class="flex flex-wrap items-center gap-2.5">
        <input :id="`${channel}-webhook`" :value="webhookUrl" class="field min-w-0 flex-1 font-mono text-xs" readonly />
        <AButton variant="ghost" @click="copyWebhook">{{ t('settings.channels.copyWebhook') }}</AButton>
      </div>
      <p class="text-xs text-ink-3">{{ t(key('webhookHint')) }}</p>
    </div>
  </div>
</template>
