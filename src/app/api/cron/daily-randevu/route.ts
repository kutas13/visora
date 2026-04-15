import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALL_RECIPIENTS = [
  "905435680874", // Davut
  "905055623279", // Bahar
  "905055623301", // Ercan
  "905058937071", // Yusuf
  "905055623170", // Fehmi
  "905078015033", // Sırrı
];

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const { data: files, error } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("islem_tipi", "randevulu")
      .not("randevu_tarihi", "is", null)
      .gte("randevu_tarihi", tomorrow.toISOString())
      .lt("randevu_tarihi", dayAfter.toISOString())
      .order("randevu_tarihi", { ascending: true });

    if (error) {
      console.error("Supabase sorgu hatasi:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const targetFiles = files || [];

    let messageText = `📋 *RANDEVU BİLDİRİMİ — YARIN*\n`;
    messageText += `Yarınki randevu özeti\n`;
    messageText += `${"─".repeat(28)}\n\n`;

    if (targetFiles.length === 0) {
      messageText += `Yarın randevu bulunmuyor.\n`;
    } else {
      messageText += `📊 Toplam: *${targetFiles.length}* randevu\n\n`;
      targetFiles.forEach((file: any, index: number) => {
        const randevuTarihi = new Date(file.randevu_tarihi);
        const tarih = randevuTarihi.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
        const saat = randevuTarihi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        messageText += `*${index + 1}.* ${file.musteri_ad}\n`;
        messageText += `    📅 ${tarih} — ${saat}\n`;
        messageText += `    🌍 ${file.hedef_ulke} · ${file.profiles?.name || "?"}\n\n`;
      });
    }
    messageText += `_Fox Turizm_`;

    // WhatsApp bağlantı kontrolü
    let statusData: any = {};
    try {
      const statusRes = await fetch(`${serviceUrl}/status`, { signal: AbortSignal.timeout(5000) });
      statusData = await statusRes.json().catch(() => ({}));
    } catch {
      return NextResponse.json({ error: "WhatsApp servisi erisilemedi" }, { status: 503 });
    }

    if (!statusData.connected) {
      return NextResponse.json({ error: "WhatsApp bagli degil" }, { status: 503 });
    }

    let successCount = 0;
    for (const phone of ALL_RECIPIENTS) {
      try {
        const wpRes = await fetch(`${serviceUrl}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone, message: messageText }),
          signal: AbortSignal.timeout(15000),
        });
        if (wpRes.ok) {
          successCount++;
          console.log(`✅ Gunluk randevu bildirimi gonderildi: ${phone}`);
        }
      } catch (err: any) {
        console.error(`❌ Gonderim hatasi ${phone}:`, err.message);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({
      success: true,
      randevuCount: targetFiles.length,
      sentTo: successCount,
      totalRecipients: ALL_RECIPIENTS.length,
    });
  } catch (err: any) {
    console.error("Daily randevu cron hatasi:", err);
    return NextResponse.json({ error: err?.message || "Sunucu hatasi" }, { status: 500 });
  }
}
