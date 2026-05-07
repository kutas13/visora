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

export async function GET() {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("reference_logos")
    .select("id, company_name, logo_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logos: data || [] });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });

  const { action } = body;

  if (action === "add") {
    const { organization_id, company_name, logo_url } = body;
    if (!company_name || !logo_url) {
      return NextResponse.json({ error: "company_name ve logo_url gerekli" }, { status: 400 });
    }

    const { data: maxRow } = await admin
      .from("reference_logos")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await admin
      .from("reference_logos")
      .insert({
        organization_id: organization_id || null,
        company_name,
        logo_url,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logo: data });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

    const { error } = await admin.from("reference_logos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle") {
    const { id, is_active } = body;
    if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

    const { error } = await admin
      .from("reference_logos")
      .update({ is_active: !!is_active })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
