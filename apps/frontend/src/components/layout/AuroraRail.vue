<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useConversations } from '../../composables/useConversations';
import { useBrand } from '../../composables/useBrand';
import AIcon from '../ui/AIcon.vue';

const props = withDefaults(defineProps<{ variant?: 'desktop' | 'mobile' }>(), {
  variant: 'desktop',
});

const emit = defineEmits<{ (e: 'navigate'): void }>();

const { t, locale } = useI18n();
const route = useRoute();
const { unreadTotal } = useConversations();
const { brand } = useBrand();

const OPERATION = [
  { key: 'dashboard', icon: 'SquaresFour', href: '/' },
  { key: 'conversations', icon: 'ChatCircleDots', href: '/messaging' },
  { key: 'clients', icon: 'Users', href: '/clients' },
  { key: 'brain', icon: 'Brain', href: '/brain' },
  { key: 'users', icon: 'UserList', href: '/users' },
];

const ORGANIZATION = [
  { key: 'settings', icon: 'GearSix', href: '/settings' },
  { key: 'profile', icon: 'User', href: '/profile' },
];

const projectInitial = computed(() => (brand.value.name || 'M').trim().charAt(0).toUpperCase());

const containerClass = computed(() =>
  props.variant === 'mobile'
    ? 'fixed inset-y-[var(--shell-pad)] left-[var(--shell-pad)] z-40 flex w-[var(--rail-w)] flex-col overflow-hidden rounded-big bg-surface shadow-card md:hidden'
    : 'fixed inset-y-[var(--shell-pad)] left-[var(--shell-pad)] z-20 hidden w-[var(--rail-w)] flex-col overflow-hidden rounded-big bg-surface shadow-card md:flex'
);

const clock = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | undefined;

const railRef = ref<HTMLElement | null>(null);

/** En móvil el rail es un drawer: mueve el foco dentro y lo atrapa. */
function onDrawerKeydown(event: KeyboardEvent) {
  if (props.variant !== 'mobile') return;
  if (event.key === 'Escape') {
    emit('navigate');
    return;
  }
  if (event.key !== 'Tab' || !railRef.value) return;
  const focusables = Array.from(
    railRef.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

const timeLabel = computed(() =>
  clock.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
);
const weekdayLabel = computed(() => clock.value.toLocaleDateString(locale.value, { weekday: 'long' }));
const dateLabel = computed(() => {
  const d = clock.value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
});

onMounted(() => {
  clockTimer = setInterval(() => {
    clock.value = new Date();
  }, 10_000);

  if (props.variant === 'mobile') {
    document.addEventListener('keydown', onDrawerKeydown);
    nextTick(() => railRef.value?.querySelector<HTMLElement>('a[href]')?.focus());
  }
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  document.removeEventListener('keydown', onDrawerKeydown);
});

function isActive(href: string) {
  if (href === '/') return route.path === '/';
  return route.path.startsWith(href);
}
</script>

<template>
  <aside
    ref="railRef"
    :class="containerClass"
    :tabindex="variant === 'mobile' ? -1 : undefined"
    :role="variant === 'mobile' ? 'dialog' : undefined"
    :aria-modal="variant === 'mobile' ? 'true' : undefined"
    :aria-label="variant === 'mobile' ? t('nav.primary') : undefined"
  >
    <div class="flex flex-col items-center gap-2.5 px-4 pb-4.5 pt-5 text-center">
      <img
        v-if="brand.logo"
        :src="brand.logo"
        alt=""
        class="h-10 w-10 rounded-[14px] object-cover"
      />
      <div
        v-else
        class="grid h-10 w-10 place-items-center rounded-[14px] bg-ink-solid font-display text-[19px] font-bold tracking-[-0.02em] text-ink-contrast"
      >
        {{ projectInitial }}
      </div>
      <span class="font-display text-[16.5px] font-bold leading-tight tracking-[-0.02em]">
        {{ brand.name || 'Mitchbot' }}
      </span>
    </div>

    <nav :aria-label="t('nav.primary')" class="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
      <router-link
        v-for="item in OPERATION"
        :key="item.key"
        :to="item.href"
        :data-testid="'nav-' + item.key"
        :class="[
          'flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150',
          isActive(item.href)
            ? 'bg-lilac-soft font-semibold text-lilac-ink'
            : 'text-ink-2 hover:bg-canvas hover:text-ink',
        ]"
        @click="emit('navigate')"
      >
        <AIcon :name="item.icon" :size="18" :weight="isActive(item.href) ? 'fill' : 'regular'" />
        <span class="truncate">{{ t('nav.' + item.key) }}</span>
        <span
          v-if="item.key === 'conversations' && unreadTotal > 0"
          class="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-ink-solid px-1.5 text-[11px] font-bold text-ink-contrast [font-variant-numeric:tabular-nums]"
        >
          {{ unreadTotal }}
        </span>
      </router-link>

      <div class="my-2 h-px bg-line" />

      <router-link
        v-for="item in ORGANIZATION"
        :key="item.key"
        :to="item.href"
        :data-testid="'nav-' + item.key"
        :class="[
          'flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150',
          isActive(item.href)
            ? 'bg-lilac-soft font-semibold text-lilac-ink'
            : 'text-ink-2 hover:bg-canvas hover:text-ink',
        ]"
        @click="emit('navigate')"
      >
        <AIcon :name="item.icon" :size="18" :weight="isActive(item.href) ? 'fill' : 'regular'" />
        <span class="truncate">{{ t('nav.' + item.key) }}</span>
      </router-link>
    </nav>

    <div class="m-3 mt-2 rounded-card bg-canvas px-3 py-3.5 text-center">
      <div
        class="font-display text-[24px] font-bold tracking-[-0.03em] [font-variant-numeric:tabular-nums]"
      >
        {{ timeLabel }}
      </div>
      <div class="mt-0.5 text-[11.5px] capitalize text-ink-3">{{ weekdayLabel }}</div>
      <div class="text-[11.5px] text-ink-3 [font-variant-numeric:tabular-nums]">
        {{ dateLabel }}
      </div>
    </div>
  </aside>
</template>
