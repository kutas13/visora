import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();

    const body = await request.json();
    const { tarih, kayitSayisi, musteriSayisi, rows, isRevize } = body;

    const { data, error } = await supabase.from("daily_reports").insert({
      user_id: user.id,
      personel: profile?.name || "Bilinmeyen",
      tarih,
      kayit_sayisi: kayitSayisi,
      musteri_sayisi: musteriSayisi,
      rows,
      is_revize: isRevize || false,
    }).select("id").single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
