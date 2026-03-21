import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Visora | Vize Süreç Yönetim Platformu",
  description: "Vize danışmanlık firmaları ve turizm acenteleri için geliştirilmiş modern vize süreç yönetim platformu.",
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6C63FF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="dns-prefetch" href="https://tmmrrepnslvhejrpcnpt.supabase.co" />
        <link rel="preconnect" href="https://tmmrrepnslvhejrpcnpt.supabase.co" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
