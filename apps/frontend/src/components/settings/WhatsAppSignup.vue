<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import AModal from '../ui/AModal.vue';
import APill from '../ui/APill.vue';
import { SignupFlowError, startSignup } from '../../lib/embedded-signup';
import { projectService, type WhatsAppConnection, type WhatsAppSignupConfig } from '../../services/project.service';

/** Conectar WhatsApp con el registro integrado de Meta: sin copiar identificadores ni tokens. */
const props = defineProps<{
  config: WhatsAppSignupConfig;
  connection: WhatsAppConnection | null;
}>();
const emit = defineEmits<{ connected: [connection: WhatsAppConnection]; disconnected: [] }>();
const { t } = useI18n();

const busy = ref(false);
const error = ref('');
const confirmOpen = ref(false);
const disconnecting = ref(false);

async function connect() {
  if (!props.config.appId || !props.config.configId || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await startSignup({ appId: props.config.appId, configId: props.config.configId, apiVersion: props.config.apiVersion });
    // Cerrar la ventana sin terminar no es un error.
    if (!result) return;
    emit('connected', await projectService.completeWhatsAppSignup(result));
  } catch (cause) {
    if (cause instanceof SignupFlowError) {
      error.value = t(`settings.channels.whatsapp.signup.errors.${cause.reason}`);
    } else {
      error.value = (cause as Error)?.message || t('settings.channels.whatsapp.signup.errors.meta');
    }
  } finally {
    busy.value = false;
  }
}

async function disconnect() {
  disconnecting.value = true;
  error.value = '';
  try {
    await projectService.disconnectWhatsApp();
    confirmOpen.value = false;
    emit('disconnected');
  } catch (cause) {
    error.value = (cause as Error)?.message || t('settings.channels.whatsapp.signup.errors.disconnect');
    confirmOpen.value = false;
  } finally {
    disconnecting.value = false;
  }
}
</script>

<template>
  <div class="mt-4 flex flex-col gap-3 border-t border-line pt-4" data-testid="wa-signup">
    <!-- Conectado: el número, su nombre y el modo -->
    <div v-if="connection" class="flex flex-col gap-3" data-testid="wa-connection" :data-status="connection.status">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
            <AIcon name="Phone" :size="18" weight="fill" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-[13px] font-semibold" data-testid="wa-connection-phone">
              {{ connection.displayPhone || connection.account }}
            </p>
            <p class="truncate text-xs text-ink-3">
              {{ connection.verifiedName || t('settings.channels.whatsapp.signup.noName') }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <APill :dot="false" data-testid="wa-connection-mode">
            {{ t(`settings.channels.whatsapp.signup.mode.${connection.mode}`) }}
          </APill>
          <AButton variant="ghost" size="sm" data-testid="wa-disconnect" @click="confirmOpen = true">
            {{ t('settings.channels.whatsapp.signup.disconnect') }}
          </AButton>
        </div>
      </div>

      <div
        v-if="connection.status === 'invalid'"
        role="alert"
        class="flex flex-wrap items-center justify-between gap-3 rounded-field bg-butter-soft p-3 text-xs text-butter-ink"
        data-testid="wa-connection-invalid"
      >
        <span class="flex items-start gap-2">
          <AIcon name="WarningCircle" :size="15" class="mt-px shrink-0" />
          {{ t('settings.channels.whatsapp.signup.invalid') }}
        </span>
        <AButton size="sm" :loading="busy" data-testid="wa-signup-reconnect" @click="connect">
          {{ t('settings.channels.whatsapp.signup.reconnect') }}
        </AButton>
      </div>
      <p v-else-if="connection.mode === 'coexistence'" class="text-xs text-ink-3">
        {{ t('settings.channels.whatsapp.signup.coexistenceHint') }}
      </p>
    </div>

    <!-- Sin conectar: un botón y qué va a pasar -->
    <div v-else class="flex flex-col gap-3">
      <p class="text-xs leading-relaxed text-ink-2">{{ t('settings.channels.whatsapp.signup.intro') }}</p>
      <div>
        <AButton icon="Phone" :loading="busy" data-testid="wa-signup-connect" @click="connect">
          {{ busy ? t('settings.channels.whatsapp.signup.connecting') : t('settings.channels.whatsapp.signup.connect') }}
        </AButton>
      </div>
    </div>

    <p v-if="error" role="alert" class="flex items-start gap-2 text-xs text-[color:var(--danger)]" data-testid="wa-signup-error">
      <AIcon name="WarningCircle" :size="15" class="mt-px shrink-0" />
      <span>{{ error }}</span>
    </p>

    <AModal :open="confirmOpen" :label="t('settings.channels.whatsapp.signup.disconnectTitle')" size="md" @close="confirmOpen = false">
      <div class="p-6">
        <h2 class="font-display text-lg font-bold tracking-[-0.02em]">{{ t('settings.channels.whatsapp.signup.disconnectTitle') }}</h2>
        <p class="mt-2 text-[13px] leading-relaxed text-ink-2">{{ t('settings.channels.whatsapp.signup.disconnectBody') }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <AButton variant="ghost" @click="confirmOpen = false">{{ t('common.cancel') }}</AButton>
          <AButton :loading="disconnecting" data-testid="wa-disconnect-confirm" @click="disconnect">
            {{ t('settings.channels.whatsapp.signup.disconnect') }}
          </AButton>
        </div>
      </div>
    </AModal>
  </div>
</template>
