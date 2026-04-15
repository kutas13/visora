import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase yapilandirmasi eksik" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: talepler, error } = await supabase
      .from("randevu_talepleri")
      .select("id, dosya_adi, ulkeler, hesap_bilgileri, son_hesap_hatirlatma, created_by, profiles:created_by(name)")
      .eq("arsivlendi", false)
      .not("hesap_bilgileri", "is", null);

    if (error || !talepler) {
      return NextResponse.json({ error: "Veri alinamadi", detail: error?.message }, { status: 500 });
    }

    const now = new Date();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    let sent = 0;

    const STAFF_PHONES: Record<string, string> = {
      DAVUT: "905435680874",
      BAHAR: "905055623279",
      ERCAN: "905055623301",
      YUSUF: "905058937071",
      SIRRI: "905078015033",
      ZAFER: "905363434444",
    };

    for (const talep of talepler) {
      const hesap = talep.hesap_bilgileri as Record<string, { hesap_var: boolean }> | null;
      if (!hesap) continue;

      const eksikUlkeler = Object.entries(hesap)
        .filter(([, v]) => !v.hesap_var)
        .map(([k]) => k);

      if (eksikUlkeler.length === 0) continue;

      if (talep.son_hesap_hatirlatma) {
        const lastReminder = new Date(talep.son_hesap_hatirlatma);
        if (now.getTime() - lastReminder.getTime() < threeDaysMs) continue;
      }

      const rawProfile = talep.profiles as unknown;
      const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
      const creatorName = (profile as { name: string } | null)?.name || "";
      const creatorPhone = STAFF_PHONES[creatorName];

      if (!creatorPhone) continue;

      const msg =
        `⚠️ *Hesap Hatırlatma*\n\n` +
        `📁 Dosya: *${talep.dosya_adi}*\n` +
        `🌍 ${eksikUlkeler.join(", ")} hesabı henüz açılmamıştır.\n\n` +
        `Lütfen ilgili ülke hesaplarını oluşturunuz.\n\n` +
        `_Fox Turizm Randevu Takip Sistemi_`;

      try {
        await fetch(`${serviceUrl}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: creatorPhone, message: msg }),
        });
        sent++;
      } catch {
        // continue
      }

      await supabase
        .from("randevu_talepleri")
        .update({ son_hesap_hatirlatma: now.toISOString() })
        .eq("id", talep.id);

      await new Promise(r => setTimeout(r, 1500));
    }

    return NextResponse.json({ success: true, sent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
