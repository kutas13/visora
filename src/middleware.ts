import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Korumalı rotalar - personel
    "/app/:path*",
    // Korumalı rotalar - admin (genel müdür)
    "/admin/dashboard/:path*",
    "/admin/files/:path*",
    "/admin/groups/:path*",
    "/admin/payments/:path*",
    "/admin/logs/:path*",
    "/admin/raporlar/:path*",
    "/admin/cari-hesap/:path*",
    "/admin/aylik-ozet-rapor",
    "/admin/musteriler/:path*",
    "/admin/personel/:path*",
    "/admin/calendar/:path*",
    "/admin/bildirimler/:path*",
    "/admin/vize-bitisi/:path*",
    "/admin/prim-takibi/:path*",
    "/admin/randevu-listesi/:path*",
    "/admin/randevu-raporlari/:path*",
    // Korumalı rotalar - muhasebe
    "/muhasebe/:path*",
    // Korumalı rotalar - Visora platform sahibi
    "/visora/:path*",
  ],
};
