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
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ customers: [] });
  }

  const { data, error } = await admin
    .from("visa_files")
    .select("musteri_ad, pasaport_no, hedef_ulke, musteri_telefon, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("Müşteri arama DB hatası:", error);
    return NextResponse.json({ error: error.message, debug: error }, { status: 500 });
  }

  const unique = new Map<string, any>();
  (data || []).forEach((f: any) => {
    if (!f.musteri_ad) return;
    const key = `${f.musteri_ad}-${f.pasaport_no || ""}`;
    if (!unique.has(key)) {
      unique.set(key, {
        musteri_adi: f.musteri_ad,
        pasaport_no: f.pasaport_no,
        ulke: f.hedef_ulke,
        musteri_telefon: f.musteri_telefon,
      });
    }
  });

  return NextResponse.json({ customers: Array.from(unique.values()) });
}
