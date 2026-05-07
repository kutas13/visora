import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const admin = getAdmin();

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "platform_owner") {
    return NextResponse.json({ error: "Sadece platform sahibi" }, { status: 403 });
  }

  const url = new URL(req.url);
  const orgIdsParam = url.searchParams.get("orgIds");
  const orgIds = orgIdsParam ? orgIdsParam.split(",").filter(Boolean) : [];

  if (orgIds.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, name, role, organization_id")
    .in("organization_id", orgIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data || [] });
}
