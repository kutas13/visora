import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Fox Turizm - Vize Yönetim Sistemi",
  description: "Fox Turizm Vize Dosyası Takip ve Yönetim Sistemi",
  applicationName: "Fox Turizm",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Fox Turizm",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        {/* DNS prefetch for Supabase */}
        {/* DNS prefetch for Supabase */}
        <link rel="dns-prefetch" href="https://hqfyouklljanwhyopwjz.supabase.co" />
        <link rel="preconnect" href="https://hqfyouklljanwhyopwjz.supabase.co" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
