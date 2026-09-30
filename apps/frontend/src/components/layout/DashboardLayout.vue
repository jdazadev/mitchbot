<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AuroraRail from './AuroraRail.vue';
import AuroraTopbar from './AuroraTopbar.vue';

defineProps<{
  noPadding?: boolean;
}>();

const { t } = useI18n();
const mobileNavOpen = ref(false);

function closeMobileNav(navigated = false) {
  mobileNavOpen.value = false;
  nextTick(() => {
    const target = navigated
      ? document.getElementById('main-content')
      : document.querySelector<HTMLElement>('[data-testid="nav-toggle"]');
    target?.focus();
  });
}
</script>

<template>
  <div class="relative flex h-screen w-full overflow-hidden">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink-solid focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-contrast"
    >
      {{ t('a11y.skipToContent') }}
    </a>
    <div class="aurora-haze" aria-hidden="true" />
    <AuroraRail />
    <AuroraRail
      v-if="mobileNavOpen"
      variant="mobile"
      @navigate="closeMobileNav(true)"
      @close="closeMobileNav()"
    />
    <div
      v-if="mobileNavOpen"
      class="fixed inset-0 z-30 bg-[color:var(--overlay)] md:hidden"
      aria-hidden="true"
      @click="closeMobileNav()"
    />
    <main id="main-content" tabindex="-1" class="relative z-10 flex h-full flex-1 flex-col overflow-hidden">
      <AuroraTopbar :nav-open="mobileNavOpen" @toggle-nav="mobileNavOpen = !mobileNavOpen" />
      <div class="flex-1 overflow-y-auto px-[var(--shell-pad)] pb-[var(--shell-pad)] pt-[var(--shell-pad)] md:pl-[var(--rail-offset)]">
        <div
          class="mx-auto w-full max-w-[1400px]"
          :class="{ 'h-full': noPadding }"
        >
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
