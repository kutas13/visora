import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Korumalı rotalar - personel
    "/app/:path*",
    // Korumalı rotalar - admin
    "/admin/dashboard/:path*",
    "/admin/files/:path*",
    "/admin/groups/:path*",
    "/admin/payments/:path*",
    "/admin/logs/:path*",
    "/admin/raporlar/:path*",
    "/admin/atamalar/:path*",
    "/admin/cari-hesap/:path*",
    "/admin/aylik-ozet-rapor",
    // Korumalı rotalar - muhasebe
    "/muhasebe/:path*",
  ],
};
