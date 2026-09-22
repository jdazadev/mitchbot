import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mitchbot.theme';

/** Callback registrado por useBrand para recalcular la familia --brand* al cambiar de tema. */
let brandReapply: (() => void) | null = null;

export function registerBrandReapply(fn: () => void) {
  brandReapply = fn;
}

function readInitialTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark' || attr === 'light') return attr;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'light';
}

const theme = ref<Theme>(readInitialTheme());

export function currentTheme(): Theme {
  return theme.value;
}

export function applyTheme(next: Theme) {
  theme.value = next;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage puede no estar disponible; el tema sigue aplicado en memoria.
  }
  brandReapply?.();
}

export function useTheme() {
  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark');
  }
  return { theme, applyTheme, toggleTheme };
}
