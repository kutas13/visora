import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * WhatsApp mesaj gönder (internal API call)
 */
async function sendWhatsApp(to: string, message: string, baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/whatsapp-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("WhatsApp gonderim hatasi:", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("WhatsApp fetch hatasi:", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Secret kontrolü
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
  }

  const whatsappTo = process.env.WHATSAPP_NOTIFY_NUMBER;
  if (!whatsappTo) {
    return NextResponse.json({ error: "WHATSAPP_NOTIFY_NUMBER tanimli degil" }, { status: 500 });
  }

  // Base URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

  const today = getToday();
  const target = new Date(today);
  target.setDate(today.getDate() + 3); // 3 gün sonrası
  const targetNext = new Date(target);
  targetNext.setDate(target.getDate() + 1);

  let sentCount = 0;

  try {
    // 3 gün sonra randevusu olan dosyaları bul
    // Randevulu, sonucu henüz çıkmamış, arşivlenmemiş dosyalar
    const { data: files, error } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("arsiv_mi", false)
      .eq("islem_tipi", "randevulu")
      .not("randevu_tarihi", "is", null)
      .is("sonuc", null);

    if (error) {
      console.error("Supabase sorgu hatasi:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "Randevusu olan dosya bulunamadi",
      });
    }

    // 3 gün sonra randevusu olanları filtrele
    const upcomingFiles = files.filter((f: any) => {
      if (!f.randevu_tarihi) return false;
      const rd = new Date(f.randevu_tarihi);
      rd.setHours(0, 0, 0, 0);
      return rd >= target && rd < targetNext;
    });

    if (upcomingFiles.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "3 gun sonra randevusu olan dosya yok",
      });
    }

    // Her dosya için WhatsApp mesajı gönder
    for (const file of upcomingFiles) {
      const staffName = (file as any).profiles?.name || "Bilinmiyor";
      const randevuStr = formatDate(file.randevu_tarihi!);

      const message =
        `📋 *RANDEVU HATIRLATMA*\n\n` +
        `👤 Müşteri: *${file.musteri_ad}*\n` +
        `🌍 Ülke: *${file.hedef_ulke}*\n` +
        `📅 Randevu: *${randevuStr}*\n` +
        `👨‍💼 Çalışan: *${staffName}*\n\n` +
        `⏰ Randevuya *3 gün* kaldı.\n\n` +
        `_Fox Turizm Vize Yönetim Sistemi_`;

      const sent = await sendWhatsApp(whatsappTo, message, baseUrl);
      if (sent) sentCount++;

      // Rate limiting - mesajlar arası 1 saniye bekle
      if (upcomingFiles.indexOf(file) < upcomingFiles.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Activity log
    if (sentCount > 0) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .single();

      if (adminProfile) {
        await supabase.from("activity_logs").insert({
          type: "whatsapp_reminder",
          message: `WhatsApp hatırlatma: ${sentCount} randevu bildirimi gönderildi (3 gün kala)`,
          actor_id: adminProfile.id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total: upcomingFiles.length,
      date: today.toISOString().slice(0, 10),
      message: `${sentCount}/${upcomingFiles.length} WhatsApp hatirlatma gonderildi`,
    });
  } catch (err: any) {
    console.error("WhatsApp cron hatasi:", err);
    return NextResponse.json({ error: err?.message || "Sunucu hatasi" }, { status: 500 });
  }
}

// GET için de çalış (test amaçlı)
export async function GET(request: NextRequest) {
  return POST(request);
}
