import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fox Turizm - Vize Yönetim Sistemi",
  description: "Fox Turizm Vize Dosyası Takip ve Yönetim Sistemi",
  icons: {
    icon: "/fox-logo.png",
    apple: "/fox-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
