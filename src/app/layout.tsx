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
  icons: {
    icon: "/fox-logo.png",
    apple: "/fox-logo.png",
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
