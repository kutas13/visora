import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Origin kontrolü
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    // Muhasebe kullanıcısı kontrolü
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    // Service role ile tam yetkili client
    const supabase = createClient(supabaseUrl, serviceKey);

    // Kullanıcı rolü kontrolü
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "muhasebe") {
      return NextResponse.json({ error: "Sadece muhasebe erişebilir." }, { status: 403 });
    }

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "Kullanıcı ID gerekli." }, { status: 400 });
    }

    // Kullanıcının ödenmemiş dosyaları (firma cari hariç)
    const { data: unpaidFiles } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", targetUserId)
      .eq("arsiv_mi", false)
      .eq("odeme_plani", "cari")
      .eq("odeme_durumu", "odenmedi")
      .neq("cari_tipi", "firma_cari");

    // Kullanıcının tahsilatları
    const { data: payments } = await supabase
      .from("payments")
      .select("*, visa_files(musteri_ad, hedef_ulke)")
      .eq("created_by", targetUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    const allPayments = payments || [];

    // Para birimi bazında toplamlar
    const tlTotal = allPayments.filter(p => (p.currency || "TL") === "TL").reduce((sum, p) => sum + Number(p.tutar), 0);
    const eurTotal = allPayments.filter(p => p.currency === "EUR").reduce((sum, p) => sum + Number(p.tutar), 0);
    const usdTotal = allPayments.filter(p => p.currency === "USD").reduce((sum, p) => sum + Number(p.tutar), 0);

    const stats = {
      tlTotal,
      eurTotal,
      usdTotal,
      bekleyenOdemeler: unpaidFiles?.length || 0,
      sonTahsilatlar: allPayments,
    };

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error("Muhasebe user stats error:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}