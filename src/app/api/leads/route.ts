import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`leads:${clientIp}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla istek. Birkaç dakika sonra tekrar deneyin." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const ad = sanitizeInput(body?.ad || "", 80);
    const soyad = sanitizeInput(body?.soyad || "", 80);
    const iletisimNo = sanitizeInput(body?.iletisim_no || "", 30);
    const note = sanitizeInput(body?.note || "", 500);

    if (!ad.trim() || !soyad.trim() || !iletisimNo.trim()) {
      return NextResponse.json({ error: "Ad, soyad ve iletişim no zorunludur." }, { status: 400 });
    }

    const phoneDigits = iletisimNo.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      return NextResponse.json({ error: "Geçerli bir telefon numarası giriniz." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const userAgent = request.headers.get("user-agent") || null;

    const { error } = await supabase.from("landing_leads").insert({
      ad,
      soyad,
      iletisim_no: iletisimNo,
      note: note || null,
      ip_adresi: clientIp,
      user_agent: userAgent,
      durum: "yeni",
    });

    if (error) {
      console.error("Lead insert error:", error);
      return NextResponse.json({ error: "Form kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Leads POST error:", err);
    return NextResponse.json({ error: err?.message || "Sunucu hatası." }, { status: 500 });
  }
}
