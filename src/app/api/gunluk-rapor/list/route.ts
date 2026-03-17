import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const all = request.nextUrl.searchParams.get("all") === "true";

    let query = supabase
      .from("daily_reports")
      .select("id, user_id, personel, tarih, kayit_sayisi, musteri_sayisi, is_revize, created_at, rows")
      .order("created_at", { ascending: false });

    if (!isAdmin || !all) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;

    return NextResponse.json({ reports: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
