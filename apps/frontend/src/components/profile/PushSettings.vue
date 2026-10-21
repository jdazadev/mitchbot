<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AIcon from '../ui/AIcon.vue';
import AButton from '../ui/AButton.vue';
import ASwitch from '../ui/ASwitch.vue';
import { isPushSupported, pushStatus } from '../../lib/push';
import { PUSH_KINDS, pushService, type PushKind } from '../../services/push.service';

/** Notificaciones push: estado en este dispositivo, activar o desactivar, prueba y tipos. */
const props = defineProps<{ role?: string }>();
const { t } = useI18n();

const supported = isPushSupported();
const serverEnabled = ref(false);
const publicKey = ref<string | undefined>();
const subscribed = ref(false);
const permission = ref<NotificationPermission>(supported ? Notification.permission : 'default');
const preferences = ref<Record<PushKind, boolean>>({ team: true, approval: true, delivery: true, channel: true, sla: true });
const busy = ref(false);
const message = ref<{ tone: 'ok' | 'error'; text: string } | null>(null);

const status = computed(() => pushStatus({ supported, serverEnabled: serverEnabled.value, permission: permission.value, subscribed: subscribed.value }));
/** Las aprobaciones solo llegan a quien puede decidir. */
const kinds = computed(() => PUSH_KINDS.filter((kind) => kind !== 'approval' || ['admin', 'approver'].includes(props.role || '')));

onMounted(async () => {
  try {
    const config = await pushService.getConfig();
    serverEnabled.value = config.enabled;
    publicKey.value = config.publicKey;
    preferences.value = { ...preferences.value, ...(await pushService.getMine()).preferences };
    if (supported && config.enabled) subscribed.value = !!(await pushService.currentSubscription());
  } catch {
    message.value = { tone: 'error', text: t('profile.push.errors.load') };
  }
});

async function run(action: () => Promise<void>) {
  busy.value = true;
  message.value = null;
  try {
    await action();
  } catch (error: any) {
    message.value = { tone: 'error', text: error?.message === 'permission' ? t('profile.push.errors.permission') : error?.message || t('profile.push.errors.generic') };
  } finally {
    if (supported) permission.value = Notification.permission;
    busy.value = false;
  }
}

const enable = () => run(async () => {
  await pushService.enable(publicKey.value!);
  subscribed.value = true;
  message.value = { tone: 'ok', text: t('profile.push.enabled') };
});

const disable = () => run(async () => {
  await pushService.disable();
  subscribed.value = false;
  message.value = { tone: 'ok', text: t('profile.push.disabled') };
});

const test = () => run(async () => {
  await pushService.sendTest();
  message.value = { tone: 'ok', text: t('profile.push.testSent') };
});

async function toggle(kind: PushKind, value: boolean) {
  const previous = preferences.value[kind];
  preferences.value = { ...preferences.value, [kind]: value };
  try {
    preferences.value = { ...preferences.value, ...(await pushService.updatePreferences({ [kind]: value })) };
  } catch {
    preferences.value = { ...preferences.value, [kind]: previous };
    message.value = { tone: 'error', text: t('profile.push.errors.generic') };
  }
}
</script>

<template>
  <section class="rounded-card bg-surface p-6 shadow-card" data-testid="push-settings" :aria-label="t('profile.push.title')">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">{{ t('profile.push.title') }}</h2>
        <p class="mt-1 text-xs text-ink-3">{{ t('profile.push.subtitle') }}</p>
      </div>
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        :class="status === 'on' ? 'bg-lime-soft text-lime-ink' : status === 'off' ? 'bg-sunken text-ink-2' : 'bg-butter-soft text-butter-ink'"
        role="status"
        data-testid="push-status"
        :data-status="status"
      >
        <AIcon :name="status === 'on' ? 'BellRinging' : 'BellSlash'" :size="14" />
        {{ t(`profile.push.status.${status}`) }}
      </span>
    </div>

    <p v-if="status === 'denied'" class="mt-3 text-xs text-ink-3">{{ t('profile.push.deniedHint') }}</p>

    <div v-if="status === 'off' || status === 'on'" class="mt-4 flex flex-wrap gap-2.5">
      <AButton v-if="status === 'off'" variant="primary" :loading="busy" @click="enable">{{ t('profile.push.enable') }}</AButton>
      <template v-else>
        <AButton variant="ghost" :loading="busy" @click="test">{{ t('profile.push.test') }}</AButton>
        <AButton variant="ghost" :disabled="busy" @click="disable">{{ t('profile.push.disable') }}</AButton>
      </template>
    </div>

    <p
      v-if="message"
      class="mt-3 text-[13px]"
      :class="message.tone === 'ok' ? 'text-lime-ink' : 'text-[color:var(--danger)]'"
      :role="message.tone === 'error' ? 'alert' : 'status'"
    >
      {{ message.text }}
    </p>

    <div v-if="status !== 'unsupported' && status !== 'unavailable'" class="mt-5 flex flex-col gap-2">
      <p class="text-xs font-semibold text-ink-2">{{ t('profile.push.kindsTitle') }}</p>
      <div v-for="kind in kinds" :key="kind" class="flex items-center justify-between gap-3 rounded-field border border-line p-3.5">
        <span>
          <span class="block text-[13px] font-medium">{{ t(`profile.push.kinds.${kind}.label`) }}</span>
          <span class="block text-xs text-ink-3">{{ t(`profile.push.kinds.${kind}.hint`) }}</span>
        </span>
        <ASwitch
          :model-value="preferences[kind]"
          :aria-label="t(`profile.push.kinds.${kind}.label`)"
          @update:model-value="toggle(kind, $event)"
        />
      </div>
    </div>
  </section>
</template>
