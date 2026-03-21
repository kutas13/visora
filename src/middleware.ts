import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const agencyId = request.cookies.get("agency_id")?.value;
  const role = request.cookies.get("app_role")?.value;

  if (request.nextUrl.pathname.startsWith("/dashboard") && !agencyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.nextUrl.pathname.startsWith("/yusuf-admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/yusuf-admin/:path*"],
};
