import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: {
          50: "#f0eeff",
          100: "#e0ddff",
          200: "#c4bfff",
          300: "#a49dff",
          400: "#8b82ff",
          500: "#6C63FF",
          600: "#5A52E0",
          700: "#4840bf",
          800: "#37319f",
          900: "#2a2680",
        },
        navy: {
          50: "#f0f2f5",
          100: "#e2e5ea",
          200: "#c5cbd5",
          300: "#94a3b8",
          400: "#64748b",
          500: "#475569",
          600: "#334155",
          700: "#1e293b",
          800: "#0f172a",
          900: "#020617",
          950: "#010313",
        },
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#00C2A8",
          600: "#059669",
          700: "#047857",
        },
      },
    },
  },
  plugins: [],
};
export default config;
