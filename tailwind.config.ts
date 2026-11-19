import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--color-paper)",
        surface: "var(--color-surface)",
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
        },
        line: "var(--color-line)",
        action: {
          DEFAULT: "var(--color-action)",
          hover: "var(--color-action-hover)",
        },
        mark: {
          good: "var(--mark-good)",
          satisfactory: "var(--mark-satisfactory)",
          moderate: "var(--mark-moderate)",
          poor: "var(--mark-poor)",
          "very-poor": "var(--mark-very-poor)",
          severe: "var(--mark-severe)",
        },
        tint: {
          good: "var(--tint-good)",
          satisfactory: "var(--tint-satisfactory)",
          moderate: "var(--tint-moderate)",
          poor: "var(--tint-poor)",
          "very-poor": "var(--tint-very-poor)",
          severe: "var(--tint-severe)",
        },
      },
      borderRadius: {
        control: "10px",
        panel: "20px",
        chip: "9999px",
        cell: "4px",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
      },
      fontSize: {
        xs: "0.8125rem",
        sm: "0.9375rem",
        base: "1.0625rem",
        lg: "1.25rem",
        xl: "1.5rem",
        "2xl": "2rem",
        display: "clamp(3.25rem, 8vw, 5rem)",
      },
      backgroundImage: {
        "sky-good": "var(--sky-good)",
        "sky-satisfactory": "var(--sky-satisfactory)",
        "sky-moderate": "var(--sky-moderate)",
        "sky-poor": "var(--sky-poor)",
        "sky-very-poor": "var(--sky-very-poor)",
        "sky-severe": "var(--sky-severe)",
      },
    },
  },
  plugins: [],
};

export default config;
