import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://visora.com.tr";

const siteTitle = "Visora | Vize Süreç Yönetim Platformu";

const shareDescription =
  "Vize ofisleri için tasarlanmış modern yönetim platformu. Müşteri dosyaları, randevu takibi, tahsilat, evrak kontrolü ve ekip yönetimini tek panelde yapın. Türkiye'nin vize acenteleri için güçlü SaaS platformu.";

const keywords = [
  "vize yönetim sistemi",
  "vize ofisi yazılımı",
  "vize başvuru takibi",
  "acente yönetim programı",
  "randevu takip sistemi",
  "Schengen vize başvurusu",
  "vize danışmanlık yazılımı",
  "SaaS vize platformu",
  "vize dosya takibi",
  "vize acentesi CRM",
  "Visora",
  "vize operasyon yönetimi",
];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Visora",
  },
  description: shareDescription,
  keywords,
  authors: [{ name: "Visora", url: siteUrl }],
  creator: "Visora",
  publisher: "Visora",
  category: "Business Software",
  applicationName: "Visora",
  manifest: "/manifest.json",
  alternates: {
    canonical: siteUrl,
    languages: { "tr-TR": siteUrl },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
    title: siteTitle,
    description: shareDescription,
    images: [
      {
        url: "/visora-banner.png",
        width: 1200,
        height: 630,
        alt: "Visora — Vize Süreç Yönetim Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: shareDescription,
    images: ["/visora-banner.png"],
  },
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
        {/* JSON-LD: Organization yapısal verisi — Google Rich Results için */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Visora",
              url: siteUrl,
              description: shareDescription,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                priceCurrency: "TRY",
                price: "0",
                description: "15 gün ücretsiz deneme",
              },
              provider: {
                "@type": "Organization",
                name: "Visora",
                url: siteUrl,
                contactPoint: {
                  "@type": "ContactPoint",
                  email: "destek@destekvisora.com",
                  contactType: "customer support",
                  availableLanguage: "Turkish",
                },
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
