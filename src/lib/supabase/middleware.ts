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
      pathname.startsWith("/admin/atamalar") ||
      pathname.startsWith("/admin/cari-hesap")) {
    if (!user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Rol kontrolü
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

    // Rol kontrolü
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "muhasebe") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}
