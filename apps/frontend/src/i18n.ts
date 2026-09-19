import { watch } from "vue";
import { createI18n } from "vue-i18n";
import es from "./locales/es.json";
import en from "./locales/en.json";

export type AppLocale = "es" | "en";

export const STORAGE_KEY = "mitchbot.locale";
export const SUPPORTED_LOCALES: AppLocale[] = ["es", "en"];
export const DEFAULT_LOCALE: AppLocale = "es";

function resolveInitialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "es" ? stored : DEFAULT_LOCALE;
}

const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { es, en },
});

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
}

export function getLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}

watch(
  () => i18n.global.locale.value,
  (locale) => {
    document.documentElement.setAttribute("lang", locale);
    localStorage.setItem(STORAGE_KEY, locale);
  },
  { immediate: true },
);

export default i18n;
