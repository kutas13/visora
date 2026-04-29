import { NextRequest, NextResponse } from "next/server";
import {
  sendWelcomeEmail,
  sendTahsilatEmail,
  sendDosyaOlusturulduEmail,
  sendAylikRaporEmail,
  sendInactivityEmail,
  VISORA_OWNER_EMAIL,
} from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tum yeni mail sablonlarini test icin VISORA_OWNER_EMAIL adresine gonderir.
 *
 * Kullanim:
 *   GET  /api/admin/send-test-emails?key=<TEST_EMAIL_KEY>
 *   POST /api/admin/send-test-emails    (body: { key })
 *
 * Onlemler:
 *   - ENABLE_LEGACY_EMAIL=true olmali (mailer icindeki kontrol).
 *   - TEST_EMAIL_KEY env var ile match etmeli (dis tetiklemeyi engellemek icin).
 *
 * Sablonlar:
 *   1. Hosgeldin (yeni GM)
 *   2. Tahsilat alindi (TL ve USD/TL karsiligi olmak uzere 2 ornek)
 *   3. Dosya olusturuldu — cari (pesin yok)
 *   4. Dosya olusturuldu — pesin (otomatik tahsilat dahil)
 *   5. Aylik rapor (kucuk PDF eki ile)
 *   6. Giris yapilmadi (24 saat)
 */

function makeDummyPdf(): Buffer {
  // Minimal valid PDF (1 sayfa, "Visora rapor ornegi") — sadece test icin.
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 64>>stream
BT /F1 24 Tf 100 750 Td (Visora - Test Aylik Rapor) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000054 00000 n 
0000000101 00000 n 
0000000192 00000 n 
0000000252 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
365
%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function POST(request: NextRequest) {
  return runTests(request);
}

export async function GET(request: NextRequest) {
  return runTests(request);
}

async function runTests(request: NextRequest) {
  const requiredKey = process.env.TEST_EMAIL_KEY;
  let providedKey: string | null = null;

  if (request.method === "POST") {
    try {
      const body = await request.json();
      providedKey = body?.key || null;
    } catch {
      providedKey = null;
    }
  }
  if (!providedKey) {
    providedKey = request.nextUrl.searchParams.get("key");
  }

  if (requiredKey) {
    if (providedKey !== requiredKey) {
      return NextResponse.json(
        { ok: false, error: "Gecersiz veya eksik test anahtari (TEST_EMAIL_KEY)." },
        { status: 401 }
      );
    }
  }

  // SMTP credential kontrolu — yokluk durumunda hicbir mail gitmez,
  // bu yuzden net hata don. Trim ile kullanici newline yapistirsa bile sorun olmaz.
  const smtpUser = (process.env.SMTP_USER || "").replace(/^[\s\r\n]+|[\s\r\n]+$/g, "");
  const smtpPass = (process.env.SMTP_PASSWORD || "").replace(/^[\s\r\n]+|[\s\r\n]+$/g, "");
  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SMTP_USER veya SMTP_PASSWORD Vercel env vars'a eklenmemis. Mail gondermek icin ikisi de gerekli.",
      },
      { status: 412 }
    );
  }

  const target = VISORA_OWNER_EMAIL;
  const results: Record<string, unknown> = {};

  try {
    results.welcome = await sendWelcomeEmail({
      gmEmail: target,
      gmName: "Yusuf Bey",
      organizationName: "Visora Demo Şirketi",
    });
  } catch (e: any) {
    results.welcome = { error: e?.message || String(e) };
  }

  try {
    results.tahsilat_tl = await sendTahsilatEmail({
      gmEmail: target,
      actorName: "Bahar (personel)",
      musteriAd: "Mehmet Yılmaz",
      hedefUlke: "Almanya",
      tutar: 5000,
      currency: "TL",
      yontem: "nakit",
    });
  } catch (e: any) {
    results.tahsilat_tl = { error: e?.message || String(e) };
  }

  try {
    results.tahsilat_usd = await sendTahsilatEmail({
      gmEmail: target,
      actorName: "Bahar (personel)",
      musteriAd: "Ayşe Kaya",
      hedefUlke: "ABD",
      tutar: 300,
      currency: "USD",
      yontem: "hesaba",
      hesapSahibi: "Ziraat Bankası — Visora",
      tlKarsilik: 12000,
      notlar: "TL karşılığı alındı.",
    });
  } catch (e: any) {
    results.tahsilat_usd = { error: e?.message || String(e) };
  }

  try {
    results.dosya_cari = await sendDosyaOlusturulduEmail({
      gmEmail: target,
      actorName: "Yusuf Bey (Genel Müdür)",
      musteriAd: "Ali Demir",
      hedefUlke: "İtalya",
      ucret: 8500,
      currency: "TL",
      odemePlani: "cari",
      onOdeme: { tutar: 2000, currency: "TL" },
      notlar: "Schengen turistik vize başvurusu.",
    });
  } catch (e: any) {
    results.dosya_cari = { error: e?.message || String(e) };
  }

  try {
    results.dosya_pesin = await sendDosyaOlusturulduEmail({
      gmEmail: target,
      actorName: "Bahar (personel)",
      musteriAd: "Zeynep Yıldız",
      hedefUlke: "İngiltere",
      ucret: 450,
      currency: "USD",
      odemePlani: "pesin",
      pesinTahsilat: {
        tutar: 450,
        currency: "USD",
        yontem: "hesaba",
        hesapSahibi: "Garanti — Visora",
        tlKarsilik: 18000,
      },
    });
  } catch (e: any) {
    results.dosya_pesin = { error: e?.message || String(e) };
  }

  try {
    results.aylik_rapor = await sendAylikRaporEmail({
      gmEmail: target,
      organizationName: "Visora Demo Şirketi",
      ay: "Nisan 2026",
      ozet: { tlGelir: 124500, eurGelir: 3200, usdGelir: 1800, dosyaSayisi: 47 },
      pdfBuffer: makeDummyPdf(),
      pdfFilename: "visora-test-rapor-nisan-2026.pdf",
    });
  } catch (e: any) {
    results.aylik_rapor = { error: e?.message || String(e) };
  }

  try {
    results.inactivity = await sendInactivityEmail({
      gmEmail: target,
      inactiveUserName: "Bahar (personel)",
      inactiveUserRole: "staff",
      lastSeen: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e: any) {
    results.inactivity = { error: e?.message || String(e) };
  }

  return NextResponse.json({ ok: true, target, results });
}
