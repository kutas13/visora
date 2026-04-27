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
        // Visora marka paleti — Modern Indigo
        // primary = Royal Indigo (#4F46E5) - butonlar, aktif, ana vurgu
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5", // Ana indigo
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
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
        // Eski monolitik kurulumdaki turuncu sınıflarını otomatik olarak Visora moruna eşle
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
        "visora-gradient": "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #D946EF 100%)",
        "visora-gradient-soft": "linear-gradient(135deg, #e0e7ff 0%, #ede9fe 50%, #fae8ff 100%)",
        "visora-mesh":
          "radial-gradient(at 0% 0%, rgba(79,70,229,0.10) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(217,70,239,0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(124,58,237,0.10) 0px, transparent 50%)",
      },
      boxShadow: {
        "visora": "0 10px 30px -10px rgba(79, 70, 229, 0.45)",
        "visora-lg": "0 20px 50px -12px rgba(124, 58, 237, 0.40)",
        "visora-glow": "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px -8px rgba(79,70,229,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
