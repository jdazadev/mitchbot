import { watch } from "vue";
import { createI18n } from "vue-i18n";
import es from "./locales/es.json";

export type AppLocale = "es" | "en";

export const STORAGE_KEY = "mitchbot.locale";
export const SUPPORTED_LOCALES: AppLocale[] = ["es", "en"];
export const DEFAULT_LOCALE: AppLocale = "es";

function resolveInitialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "es" ? stored : DEFAULT_LOCALE;
}

const initialLocale = resolveInitialLocale();
let englishLoaded = false;

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { es, en: {} as typeof es },
});

async function loadLocaleMessages(locale: AppLocale) {
  if (locale === "en" && !englishLoaded) {
    const { default: messages } = await import("./locales/en.json");
    i18n.global.setLocaleMessage(locale, messages);
    englishLoaded = true;
  }
}

export async function initializeLocale() {
  try {
    await loadLocaleMessages(initialLocale);
    i18n.global.locale.value = initialLocale;
  } catch {
    i18n.global.locale.value = DEFAULT_LOCALE;
  }
}

export async function setLocale(locale: AppLocale) {
  await loadLocaleMessages(locale);
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
);

export default i18n;
