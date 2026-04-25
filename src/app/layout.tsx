import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

/** Kanonik site adresi: Vercel’de `NEXT_PUBLIC_SITE_URL` ile ezilebilir (örn. preview). */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://visora.com.tr";

const shareDescription =
  "Visora — vize dosyası takip, randevu ve operasyon yönetimi.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Visora — Vize Yönetim Sistemi",
    template: "%s | Visora",
  },
  description: shareDescription,
  applicationName: "Visora",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Visora",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: siteUrl,
    siteName: "Visora",
    title: "Visora — Vize Yönetim Sistemi",
    description: shareDescription,
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Visora",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Visora — Vize Yönetim Sistemi",
    description: shareDescription,
    images: ["/icon-512.png"],
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
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <>
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
          </>
        ) : null}
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
