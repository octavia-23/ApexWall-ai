/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Locode Warm Desert Sand / Terracotta Gold palette (replaces cold cobalt & brownish copper)
        blue: {
          50: "#FAF7F2",
          100: "#F5EFE6",
          200: "#EADECF",
          300: "#DFCCB4",
          400: "#E2B88E",
          500: "#D4A373", // Locode Primary Accent
          600: "#C4925F", // Locode Deep Gold Accent
          700: "#A67645",
          800: "#7E552C",
          900: "#543619",
          950: "#2C1A0B",
        },
        // Locode Natural Muted Zinc / Charcoal Graphite
        slate: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
          950: "#09090B",
        },
        gold: {
          DEFAULT: "#D4A373",
          hover: "#E2B88E",
          subtle: "rgba(212, 163, 115, 0.14)",
          border: "rgba(212, 163, 115, 0.35)",
          text: "#E5B98F",
          light: "#EADECF",
        },
        copper: {
          DEFAULT: "#D4A373",
          hover: "#E2B88E",
          subtle: "rgba(212, 163, 115, 0.14)",
          border: "rgba(212, 163, 115, 0.35)",
          text: "#E5B98F",
          light: "#EADECF",
        },
        obsidian: {
          base: "#060708",
          surface: "#0D0F12",
          elevated: "#14171D",
          hover: "#1C2028",
          inset: "#08090C",
        },
        telemetry: {
          cyan: "#38bdf8",
          red: "#f43f5e",
          orange: "#fb923c",
          green: "#34d399",
          amber: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        body: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono'", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
