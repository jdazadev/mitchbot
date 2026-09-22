<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { authService } from '../services/auth.service';
import AIcon from '../components/ui/AIcon.vue';
import AButton from '../components/ui/AButton.vue';

const { t } = useI18n();
const router = useRouter();
const isLoading = ref(false);
const error = ref<string | null>(null);

const loginForm = ref({ email: '', password: '' });

async function handleLogin() {
  error.value = null;
  if (!loginForm.value.email || !loginForm.value.password) {
    error.value = t('login.errors.requiredFields');
    return;
  }
  isLoading.value = true;
  try {
    await authService.login(loginForm.value.email, loginForm.value.password);
    router.push('/');
  } catch (err: any) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center p-4">
    <div class="aurora-haze" aria-hidden="true" />
    <div class="relative z-10 w-full max-w-md">
      <div class="mb-6 flex items-center gap-3">
        <div class="grid h-11 w-11 place-items-center rounded-[16px] bg-ink font-display text-xl font-bold tracking-[-0.02em] text-white">
          M
        </div>
        <div class="font-display text-xl font-bold tracking-[-0.02em]">Mitchbot</div>
      </div>

      <div class="rounded-big bg-surface p-8 shadow-[var(--shadow-pop)]">
        <h1 class="font-display text-[34px] font-bold leading-none tracking-[-0.035em]">
          {{ t('login.headline.line1') }}<br />{{ t('login.headline.line2') }}
        </h1>
        <p class="mb-6 mt-2.5 text-[13px] text-ink-3">{{ t('login.subtitle') }}</p>

        <div
          v-if="error"
          class="mb-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ error }}
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('common.email') }}</span>
            <input
              v-model="loginForm.email"
              type="email"
              class="field"
              :placeholder="t('login.form.emailPlaceholder')"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('login.form.password') }}</span>
            <input
              v-model="loginForm.password"
              type="password"
              class="field"
              :placeholder="t('login.form.passwordPlaceholder')"
            />
          </label>
          <AButton type="submit" variant="primary" block :loading="isLoading" class="mt-1 py-3">
            {{ isLoading ? t('login.loading') : t('login.submit') }}
          </AButton>
        </form>

        <div class="mt-5 flex flex-wrap justify-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-sky-soft px-2.5 py-1 text-[11px] font-semibold text-sky-ink">
            <span class="h-1.5 w-1.5 rounded-full bg-current" />{{ t('login.badges.noCard') }}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-lime-soft px-2.5 py-1 text-[11px] font-semibold text-lime-ink">
            <span class="h-1.5 w-1.5 rounded-full bg-current" />{{ t('login.badges.readyInMinutes') }}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-lilac-soft px-2.5 py-1 text-[11px] font-semibold text-lilac-ink">
            <span class="h-1.5 w-1.5 rounded-full bg-current" />{{ t('login.badges.encrypted') }}
          </span>
        </div>
      </div>

      <p class="mt-4 text-center text-xs text-ink-3">{{ t('login.accountsNote') }}</p>
    </div>
  </div>
</template>
