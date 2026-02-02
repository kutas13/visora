import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Korumalı rotalar
    "/app/:path*",
    "/admin/dashboard/:path*",
    "/admin/files/:path*",
    "/admin/groups/:path*",
    "/admin/payments/:path*",
    "/admin/logs/:path*",
  ],
};
