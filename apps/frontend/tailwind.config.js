/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{ts,tsx,vue}",
    "./components/**/*.{ts,tsx,vue}",
    "./app/**/*.{ts,tsx,vue}",
    "./src/**/*.{ts,tsx,vue}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* Acento de identidad por proyecto (valor real inyectado por useBrand) */
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          deep: "var(--brand-deep)",
          soft: "var(--brand-soft)",
          softer: "var(--brand-softer)",
          ink: "var(--brand-ink)",
        },
        /* Tokens del mundo Aurora */
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        sunken: "var(--sunken)",
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-2)",
        },
        ink: {
          DEFAULT: "var(--ink-1)",
          1: "var(--ink-1)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          solid: "var(--ink-solid)",
          contrast: "var(--ink-solid-contrast)",
        },
        sky: {
          DEFAULT: "var(--sky)",
          ink: "var(--sky-ink)",
          soft: "var(--sky-soft)",
        },
        lime: {
          DEFAULT: "var(--lime)",
          ink: "var(--lime-ink)",
          soft: "var(--lime-soft)",
        },
        lilac: {
          DEFAULT: "var(--lilac)",
          ink: "var(--lilac-ink)",
          soft: "var(--lilac-soft)",
        },
        butter: {
          DEFAULT: "var(--butter)",
          ink: "var(--butter-ink)",
          soft: "var(--butter-soft)",
        },
      },
      borderRadius: {
        card: "var(--r-card)",
        big: "var(--r-big)",
        field: "var(--r-field)",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      spacing: {
        4.5: "1.125rem",
        8.5: "2.125rem",
        9.5: "2.375rem",
        10.5: "2.625rem",
        13: "3.25rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};
