import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isWhatsappEnabled, WHATSAPP_DISABLED_MESSAGE } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";
// Vercel serverless default 10s; fonksiyonun uzun sürmesine izin ver
export const maxDuration = 300; // 5 dakika

// WhatsApp rate limit koruması
// - Her mesaj arasında rastgele gecikme (min 8s, max 20s)
// - Tek çalıştırmada maksimum gönderim (kalanlar bir sonraki güne devreder)
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 20_000;
const MAX_PER_RUN = 30;

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runReviewMessaging() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";
  // Tercihen direkt yorum linki (g.page/r/XXX/review veya search.google.com/local/writereview?placeid=XXX)
  const reviewUrl =
    process.env.GOOGLE_REVIEW_URL ||
    "https://www.google.com/search?q=foxturizm";

  if (!supabaseUrl || !serviceKey) {
    return { error: "Supabase yapılandırması eksik.", status: 500 };
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 3 gün önceki tarihteki onaylar
  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);
  const fourDaysAgo = new Date(threeDaysAgo);
  fourDaysAgo.setDate(fourDaysAgo.getDate() + 1);

  // ÖNEMLİ: Çin dosyaları da DAHİL (vize bitiş mesajı değil, sadece yorum mesajı)
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

  // Sadece geçerli telefon filtresi (Çin dosyaları artık dahil)
  const candidates = (files || []).filter(f => {
    const phone = (f.musteri_telefon || "").replace(/\D/g, "");
    return phone.length >= 10;
  });

  // WhatsApp servis bağlantı kontrolü
  try {
    const statusRes = await fetch(`${serviceUrl}/status`, { signal: AbortSignal.timeout(5000) });
    const statusData = await statusRes.json().catch(() => ({}));
    if (!statusData?.connected) {
      return {
        error: "WhatsApp servisi bağlı değil. QR kodu tarayıp tekrar deneyin.",
        status: 503,
      };
    }
  } catch {
    return {
      error: "WhatsApp servisine ulaşılamıyor.",
      status: 503,
    };
  }

  // Bu çalıştırmada gönderilecek maksimum sayı
  const batch = candidates.slice(0, MAX_PER_RUN);
  const remaining = candidates.length - batch.length;

  let sentCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < batch.length; i++) {
    const f = batch[i];
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
      `*Visora*`,
    ].join("\n");

    try {
      const wpRes = await fetch(`${serviceUrl}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: whatsappPhone, message }),
        signal: AbortSignal.timeout(20_000),
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

    // Son mesaj değilse mesajlar arasında rastgele bekle (WP rate limit koruması)
    if (i < batch.length - 1) {
      const delay = randomDelay();
      console.log(`⏳ ${delay}ms bekleniyor (WhatsApp rate limit koruması)...`);
      await sleep(delay);
    }
  }

  return {
    success: true,
    candidates: candidates.length,
    batch: batch.length,
    sent: sentCount,
    remaining,
    errors: errors.length ? errors : undefined,
    note: remaining > 0
      ? `${remaining} mesaj yarınki çalıştırmaya erteledi (WP rate limit koruması).`
      : undefined,
    status: 200,
  };
}

export async function POST(request: NextRequest) {
  if (!isWhatsappEnabled()) {
    return NextResponse.json({ ok: true, disabled: true, sent: 0, message: WHATSAPP_DISABLED_MESSAGE });
  }

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
