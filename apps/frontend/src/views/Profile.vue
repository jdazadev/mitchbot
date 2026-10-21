<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { authService, type User } from '../services/auth.service';
import { projectService, type Project } from '../services/project.service';
import AIcon from '../components/ui/AIcon.vue';
import AAvatar from '../components/ui/AAvatar.vue';
import APill from '../components/ui/APill.vue';
import AButton from '../components/ui/AButton.vue';
import PushSettings from '../components/profile/PushSettings.vue';

const { t, te } = useI18n();

const currentUser = ref<User | null>(null);
const projects = ref<Project[]>([]);
const profileForm = ref({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
const profileLoading = ref(false);
const profileSuccess = ref('');
const profileError = ref('');

const userInitials = ref('?');
/** El formulario se habilita con el perfil cargado: antes, la carga pisaría lo escrito y se enviaría un correo vacío. */
const profileLoaded = ref(false);

const roleLabel = computed(() => {
  const role = currentUser.value?.role;
  if (!role) return '';
  const key = `users.roles.${role}`;
  return te(key) ? t(key) : role;
});

onMounted(async () => {
  try {
    const user = await authService.getProfile();
    currentUser.value = user;
    profileForm.value.name = user.name;
    profileForm.value.email = user.email;
  } catch {
    currentUser.value = authService.getUser();
    if (currentUser.value) {
      profileForm.value.name = currentUser.value.name;
      profileForm.value.email = currentUser.value.email;
    }
  }
  profileLoaded.value = !!currentUser.value;
  userInitials.value =
    currentUser.value?.name
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  try {
    projects.value = await projectService.listProjects();
  } catch {
    projects.value = [];
  }
});

async function handleUpdateProfile() {
  profileError.value = '';
  profileSuccess.value = '';

  if (profileForm.value.newPassword && profileForm.value.newPassword !== profileForm.value.confirmPassword) {
    profileError.value = t('profile.error.passwordMismatch');
    return;
  }

  profileLoading.value = true;
  try {
    const data: any = {};
    if (profileForm.value.name !== currentUser.value?.name) data.name = profileForm.value.name;
    if (profileForm.value.email !== currentUser.value?.email) data.email = profileForm.value.email;
    if (profileForm.value.newPassword) {
      data.currentPassword = profileForm.value.currentPassword;
      data.newPassword = profileForm.value.newPassword;
    }

    const updated = await authService.updateProfile(data);
    currentUser.value = updated;
    profileSuccess.value = t('profile.toast.updated');
    profileForm.value.currentPassword = '';
    profileForm.value.newPassword = '';
    profileForm.value.confirmPassword = '';
  } catch (err: any) {
    profileError.value = err.message;
  } finally {
    profileLoading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <div class="grid grid-cols-1 gap-3.5 lg:grid-cols-[320px_1fr]">
      <!-- Ficha -->
      <div class="rounded-card bg-surface p-6 text-center shadow-card">
        <AAvatar :initials="userInitials" tone="lilac" size="lg" class="mx-auto h-[84px] w-[84px] text-[30px]" />
        <h2 class="mt-4 font-display text-xl font-bold tracking-[-0.02em]">
          {{ currentUser?.name || t('common.loading') }}
        </h2>
        <p class="mt-1 text-[13px] text-ink-3">{{ currentUser?.email || '' }}</p>
        <div class="mt-3 flex justify-center">
          <APill tone="lilac">{{ roleLabel }}</APill>
        </div>
        <div class="my-4 h-px bg-line" />
        <div class="text-left text-[13px] text-ink-3">
          {{ t('profile.projects.title', { count: projects.length }) }}
        </div>
        <div v-if="projects.length === 0" class="mt-2 text-xs text-ink-3">{{ t('profile.projects.empty') }}</div>
        <div v-else class="mt-2 flex flex-wrap justify-center gap-2">
          <span
            v-for="p in projects"
            :key="p._id"
            class="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink-2"
          >
            <AIcon
              name="FolderOpen"
              :size="13"
              :class="p._id === currentUser?.activeProjectId ? 'text-lilac-ink' : 'text-ink-3'"
            />
            {{ p.name }}
          </span>
        </div>
      </div>

      <!-- Datos -->
      <div class="rounded-card bg-surface p-6 shadow-card">
        <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
          {{ t('profile.info.title') }}
        </h2>

        <div
          v-if="profileSuccess"
          class="mt-4 flex items-center gap-2 rounded-field bg-lime-soft p-3 text-[13px] text-lime-ink"
        >
          <AIcon name="CheckCircle" :size="17" />
          {{ profileSuccess }}
        </div>
        <div
          v-if="profileError"
          class="mt-4 flex items-center gap-2 rounded-field bg-[color:var(--danger-soft)] p-3 text-[13px] text-[color:var(--danger)]"
        >
          <AIcon name="WarningCircle" :size="17" />
          {{ profileError }}
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('common.name') }}</span>
            <input v-model="profileForm.name" type="text" class="field" :disabled="!profileLoaded" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('common.email') }}</span>
            <input v-model="profileForm.email" type="email" class="field" :disabled="!profileLoaded" />
          </label>
        </div>

        <div class="my-5 h-px bg-line" />

        <h2 class="font-display text-[15.5px] font-semibold tracking-[-0.015em]">
          {{ t('profile.password.title') }}
        </h2>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('profile.password.current') }}</span>
            <input v-model="profileForm.currentPassword" type="password" class="field" autocomplete="current-password" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('profile.password.new') }}</span>
            <input v-model="profileForm.newPassword" type="password" class="field" autocomplete="new-password" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-ink-2">{{ t('profile.password.confirm') }}</span>
            <input v-model="profileForm.confirmPassword" type="password" class="field" autocomplete="new-password" />
          </label>
        </div>

        <div class="mt-6 flex justify-end">
          <AButton variant="primary" :loading="profileLoading" :disabled="!profileLoaded" @click="handleUpdateProfile">
            {{ profileLoading ? t('common.saving') : t('common.saveChanges') }}
          </AButton>
        </div>
      </div>
    </div>
    <PushSettings :role="currentUser?.role" />
  </div>
</template>
