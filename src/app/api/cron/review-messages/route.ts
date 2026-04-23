import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Çin dosyalarını hariç tutmak için
function isChinaCountry(ulke: string | null | undefined): boolean {
  if (!ulke) return false;
  const normalized = String(ulke)
    .toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/İ/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .trim();
  return normalized === "cin" || normalized === "china";
}

async function runReviewMessaging() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";
  // Tercihen direkt yorum linki (g.page/r/XXX/review veya search.google.com/local/writereview?placeid=XXX)
  // Elimizdeki fallback: Google arama sonuç sayfası — müşteri işletmeyi görüp yorum yazabilir.
  const reviewUrl =
    process.env.GOOGLE_REVIEW_URL ||
    "https://www.google.com/search?q=foxturizm";

  if (!supabaseUrl || !serviceKey) {
    return { error: "Supabase yapılandırması eksik.", status: 500 };
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 3 gün önceki tarih aralığı (o günkü başvurular)
  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);
  const fourDaysAgo = new Date(threeDaysAgo);
  fourDaysAgo.setDate(fourDaysAgo.getDate() + 1); // +1 day to make it a [3d, 4d] range

  const { data: files, error: queryError } = await supabase
    .from("visa_files")
    .select("id, musteri_ad, hedef_ulke, musteri_telefon, sonuc_tarihi, google_review_msg_sent_at")
    .eq("sonuc", "vize_onay")
    .not("musteri_telefon", "is", null)
    .is("google_review_msg_sent_at", null)
    .gte("sonuc_tarihi", threeDaysAgo.toISOString().slice(0, 10))
    .lt("sonuc_tarihi", fourDaysAgo.toISOString().slice(0, 10));

  if (queryError) {
    return { error: "Dosya sorgusu başarısız: " + queryError.message, status: 500 };
  }

  const candidates = (files || []).filter(f => {
    if (isChinaCountry(f.hedef_ulke)) return false;
    const phone = (f.musteri_telefon || "").replace(/\D/g, "");
    if (phone.length < 10) return false;
    return true;
  });

  let sentCount = 0;
  const errors: string[] = [];

  for (const f of candidates) {
    const bareDigits = (f.musteri_telefon || "").replace(/\D/g, "");
    let phone = bareDigits;
    if (phone.startsWith("0")) phone = "90" + phone.slice(1);
    if (!phone.startsWith("90")) phone = "90" + phone;
    const whatsappPhone = "+" + phone;

    const message = [
      `Sayın ${f.musteri_ad},`,
      ``,
      `${f.hedef_ulke} vize işleminizde size hizmet verdiğimiz için mutluyuz. 🙏`,
      ``,
      `Deneyiminizi değerlendirir misiniz? Geri bildiriminiz bizim için çok değerli.`,
      ``,
      `⭐ Google yorumunu bırakmak için:`,
      reviewUrl,
      ``,
      `Teşekkür eder, iyi yolculuklar dileriz! ✈️`,
      ``,
      `*Fox Turizm*`,
    ].join("\n");

    try {
      const wpRes = await fetch(`${serviceUrl}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: whatsappPhone, message }),
        signal: AbortSignal.timeout(15000),
      });

      const wpData = await wpRes.json().catch(() => ({}));

      if (wpRes.ok) {
        sentCount++;
        await supabase
          .from("visa_files")
          .update({ google_review_msg_sent_at: new Date().toISOString() } as any)
          .eq("id", f.id);

        try {
          await supabase.from("whatsapp_messages").insert({
            file_id: f.id,
            phone_number: f.musteri_telefon,
            message_type: "google_review",
            message_content: message.substring(0, 500),
            sent_at: new Date().toISOString(),
          });
        } catch {
          // tracking tablosu yoksa sorun değil
        }
      } else {
        errors.push(`${f.musteri_ad}: ${wpData?.error || "WhatsApp hatası"}`);
      }
    } catch (err: any) {
      errors.push(`${f.musteri_ad}: ${err?.message || "Bağlantı hatası"}`);
    }
  }

  return {
    success: true,
    candidates: candidates.length,
    sent: sentCount,
    errors: errors.length ? errors : undefined,
    status: 200,
  };
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const result = await runReviewMessaging();
  const { status, ...rest } = result as any;
  return NextResponse.json(rest, { status: status || 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
