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
        url: "/visora-banner.png",
        width: 1200,
        height: 630,
        alt: "Visora",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Visora — Vize Yönetim Sistemi",
    description: shareDescription,
    images: ["/visora-banner.png"],
  },
  // Favicon stratejisi:
  //   - Google SERP icin /favicon.ico kucuk (4KB, 32x32) ICO dosyamiz var.
  //   - Modern tarayicilar icin Next.js App Router src/app/icon.png ve
  //     src/app/apple-icon.png otomatik olarak <link rel="icon"> uretir,
  //     biz burada netlestirmek icin acik tanimlariyoruz.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", rel: "icon" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
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
