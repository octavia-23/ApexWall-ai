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
        // Refined Anodized Copper & Champagne palette (21st.dev template design language)
        blue: {
          50: "#FAF6F2",
          100: "#F5EBE1",
          200: "#E8D4C3",
          300: "#DCBBA1",
          400: "#CFA07E",
          500: "#C87038",
          600: "#B85D28",
          700: "#984A1D",
          800: "#773815",
          900: "#50240D",
          950: "#2A1206",
        },
        // Neutral Obsidian Graphite & Charcoal Zinc (replaces cold navy slate)
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
        copper: {
          DEFAULT: "#C87038",
          hover: "#A85524",
          subtle: "rgba(200, 112, 56, 0.12)",
          border: "rgba(200, 112, 56, 0.35)",
          text: "#F09B66",
          light: "#E59560",
        },
        obsidian: {
          base: "#060708",
          surface: "#0D0F12",
          elevated: "#14171D",
          hover: "#1C2028",
          inset: "#08090C",
        },
        telemetry: {
          cyan: "#00d2be",
          red: "#ff3b30",
          orange: "#ff6b35",
          green: "#22c55e",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        display: ["Rajdhani", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
