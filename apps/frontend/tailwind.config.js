import tailwindAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
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
        /* El azul heredado de componentes puntuales se mapea al acento de marca */
        brand: "hsl(var(--brand) 0 0)",
        blue: {
          50: "var(--brand-softer)",
          100: "var(--brand-soft)",
          200: "var(--brand-soft)",
          300: "var(--brand-soft)",
          400: "var(--brand)",
          500: "var(--brand)",
          600: "var(--brand)",
          700: "var(--brand-hover)",
          800: "var(--brand-hover)",
          900: "var(--brand-deep)",
          950: "var(--brand-deep)",
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindAnimate],
};
