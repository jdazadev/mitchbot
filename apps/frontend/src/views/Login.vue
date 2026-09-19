<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { authService } from '../services/auth.service';

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
  <div class="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-3 mb-2">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <span class="material-symbols-outlined text-[28px]">smart_toy</span>
          </div>
        </div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">BotMaster</h1>
        <p class="text-sm text-slate-500">{{ t('login.subtitle') }}</p>
      </div>

      <!-- Card -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8">
        <!-- Error -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error }}
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('common.email') }}</label>
            <input
              v-model="loginForm.email"
              type="email"
              :placeholder="t('login.form.emailPlaceholder')"
              class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">{{ t('login.form.password') }}</label>
            <input
              v-model="loginForm.password"
              type="password"
              :placeholder="t('login.form.passwordPlaceholder')"
              class="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-700 dark:text-white"
            />
          </div>
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-all text-sm"
          >
            {{ isLoading ? t('login.loading') : t('login.submit') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
