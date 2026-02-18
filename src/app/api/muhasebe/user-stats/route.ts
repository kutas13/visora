import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }

    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Yapılandırma eksik." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Tüm verileri tek seferde çek (admin cari hesap sayfasıyla aynı mantık)
    const [profilesRes, filesRes, paymentsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("visa_files").select("*").eq("odeme_plani", "cari").neq("cari_tipi", "firma_cari").eq("arsiv_mi", false).order("created_at", { ascending: false }),
      supabase.from("payments").select("*, visa_files(musteri_ad, hedef_ulke, assigned_user_id)").eq("payment_type", "tahsilat").order("created_at", { ascending: false }),
    ]);

    const profiles = profilesRes.data || [];
    const files = filesRes.data || [];
    const payments = paymentsRes.data || [];

    // Kullanıcı bazlı cari hesap hesapla (admin cari-hesap sayfasıyla birebir aynı mantık)
    const staffList = profiles
      .filter(p => p.role === "staff" || p.role === "admin")
      .map(profile => {
        const userFiles = files.filter(f => f.assigned_user_id === profile.id);
        const userPayments = payments.filter(p => p.created_by === profile.id);

        const totals: Record<string, { borc: number; tahsilat: number; kalan: number }> = {};

        userFiles.forEach(f => {
          const c = f.ucret_currency || "TL";
          if (!totals[c]) totals[c] = { borc: 0, tahsilat: 0, kalan: 0 };
          totals[c].borc += Number(f.ucret) || 0;
        });

        userPayments.forEach(p => {
          const c = p.currency || "TL";
          if (!totals[c]) totals[c] = { borc: 0, tahsilat: 0, kalan: 0 };
          totals[c].tahsilat += Number(p.tutar) || 0;
        });

        Object.keys(totals).forEach(c => {
          totals[c].kalan = totals[c].borc - totals[c].tahsilat;
        });

        return {
          profile,
          totals,
          files: userFiles,
          payments: userPayments,
          bekleyenOdeme: userFiles.filter(f => f.odeme_durumu === "odenmedi").length,
        };
      })
      .filter(s => s.files.length > 0 || s.payments.length > 0);

    return NextResponse.json({ staffList });
  } catch (err: any) {
    console.error("Muhasebe stats error:", err);
    return NextResponse.json({ error: err?.message || "Hata." }, { status: 500 });
  }
}