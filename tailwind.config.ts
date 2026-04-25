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
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // Visora marka paleti
        // primary = Royal Mavi (#2563EB) - butonlar, aktif, ana vurgu
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#2563eb", // Ana royal mavi (logo geçişi başlangıcı)
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
          950: "#0f172a",
        },
        // navy = Gece Laciverti (#0F172A) - başlıklar, koyu yüzeyler
        navy: {
          50: "#f8fafc",
          100: "#f1f5f9", // App background
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a", // Ana gece laciverti
          950: "#020617",
        },
        // accent = Mor (#7C3AED) - hover, ikon vurgusu, gradient sonu
        accent: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed", // Ana mor (logo gradient sonu)
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // lilac = Açık Mavi-Lila (#A5B4FC) - secondary UI, kartlar, soft alanlar
        lilac: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc", // Ana lilac
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        // Eski Fox turuncu sınıflarını otomatik olarak Visora moruna eşle
        // (Uygulama genelinde 'orange-*' kullanan onlarca dosyayı tek tek
        //  değiştirmek yerine paleti yerinde değiştiriyoruz.)
        orange: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
      },
      backgroundImage: {
        "visora-gradient": "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
        "visora-gradient-soft": "linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)",
      },
      boxShadow: {
        "visora": "0 10px 30px -10px rgba(37, 99, 235, 0.45)",
        "visora-lg": "0 20px 50px -12px rgba(124, 58, 237, 0.40)",
      },
    },
  },
  plugins: [],
};
export default config;
