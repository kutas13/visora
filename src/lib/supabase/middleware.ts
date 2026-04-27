import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware için Supabase client
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Session'ı yenile
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Korumalı route kontrolü
  const pathname = request.nextUrl.pathname;

  // ------------------------------------------------------------------
  // Sirket statu kontrolu: hesap askiya alindiysa / iptalse oturum kapat
  // ------------------------------------------------------------------
  const isProtectedAppRoute =
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin/dashboard") ||
    pathname.startsWith("/admin/files") ||
    pathname.startsWith("/admin/groups") ||
    pathname.startsWith("/admin/payments") ||
    pathname.startsWith("/admin/logs") ||
    pathname.startsWith("/admin/raporlar") ||
    pathname.startsWith("/admin/cari-hesap") ||
    pathname.startsWith("/admin/musteriler") ||
    pathname.startsWith("/admin/personel") ||
    pathname.startsWith("/admin/calendar") ||
    pathname.startsWith("/admin/bildirimler") ||
    pathname.startsWith("/admin/vize-bitisi") ||
    pathname.startsWith("/admin/aylik-ozet-rapor") ||
    pathname.startsWith("/admin/randevu") ||
    pathname.startsWith("/muhasebe");

  if (user && isProtectedAppRoute) {
    const { data: meProfile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    // Platform owner sirket statusunden bagimsiz devam edebilir
    if (meProfile?.role !== "platform_owner" && meProfile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("status")
        .eq("id", meProfile.organization_id)
        .single();

      if (!org || org.status !== "active") {
        await supabase.auth.signOut();
        const url = new URL("/login", request.url);
        url.searchParams.set(
          "blocked",
          org?.status === "cancelled" ? "cancelled" : "suspended"
        );
        return NextResponse.redirect(url);
      }
    }
  }

  // /app/* rotaları için giriş gerekli
  if (pathname.startsWith("/app") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // /admin/* rotaları için admin rolü gerekli
  if (pathname.startsWith("/admin/dashboard") ||
      pathname.startsWith("/admin/files") ||
      pathname.startsWith("/admin/groups") ||
      pathname.startsWith("/admin/payments") ||
      pathname.startsWith("/admin/logs") ||
      pathname.startsWith("/admin/raporlar") ||
      pathname.startsWith("/admin/cari-hesap")) {
    if (!user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }

  // /muhasebe/* rotaları için muhasebe rolü gerekli
  if (pathname.startsWith("/muhasebe")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "muhasebe") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // /visora/* rotaları için platform_owner rolü gerekli
  if (pathname.startsWith("/visora")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "platform_owner") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}
