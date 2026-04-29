import { NextRequest, NextResponse } from "next/server";
import {
  sendWelcomeEmail,
  sendTahsilatEmail,
  sendDosyaOlusturulduEmail,
  sendAylikRaporEmail,
  sendInactivityEmail,
  sendStaffWelcomeEmail,
  sendStaffCreatedEmail,
  sendRandevuTalebiEmail,
  sendRandevuAlindiEmail,
  VISORA_OWNER_EMAIL,
  SITE_URL,
} from "@/lib/mailer";
import { renderToBuffer } from "@react-pdf/renderer";
import { AylikRaporPdf } from "@/lib/reports/AylikRaporPdf";
import React from "react";

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

async function makeAylikRaporPdf(): Promise<Buffer> {
  const element = React.createElement(AylikRaporPdf, {
    data: {
      organizationName: "Visora Demo Şirketi",
      ay: "Nisan 2026",
      generatedAt: new Date().toLocaleString("tr-TR"),
      bannerUrl: `${SITE_URL}/visora-banner.png`,
      ozet: {
        dosyaSayisi: 47,
        tlGelir: 124500,
        eurGelir: 3200,
        usdGelir: 1800,
        aktivePersonel: 3,
      },
      personeller: [
        { personelAd: "Yusuf Bey (GM)", dosyaSayisi: 18, tlGelir: 56000, eurGelir: 1200, usdGelir: 800 },
        { personelAd: "Bahar", dosyaSayisi: 12, tlGelir: 32500, eurGelir: 800, usdGelir: 400 },
        { personelAd: "Ercan", dosyaSayisi: 9, tlGelir: 22000, eurGelir: 600, usdGelir: 300 },
        { personelAd: "Zafer", dosyaSayisi: 8, tlGelir: 14000, eurGelir: 600, usdGelir: 300 },
      ],
      ulkeler: [
        { ulke: "Almanya", dosyaSayisi: 14 },
        { ulke: "İtalya", dosyaSayisi: 9 },
        { ulke: "Fransa", dosyaSayisi: 7 },
        { ulke: "İspanya", dosyaSayisi: 6 },
        { ulke: "Hollanda", dosyaSayisi: 5 },
        { ulke: "ABD", dosyaSayisi: 3 },
        { ulke: "İngiltere", dosyaSayisi: 3 },
      ],
    },
  });
  const buf = await renderToBuffer(element as any);
  return buf as unknown as Buffer;
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
    const pdfBuffer = await makeAylikRaporPdf();
    results.aylik_rapor = await sendAylikRaporEmail({
      gmEmail: target,
      organizationName: "Visora Demo Şirketi",
      ay: "Nisan 2026",
      ozet: { tlGelir: 124500, eurGelir: 3200, usdGelir: 1800, dosyaSayisi: 47 },
      pdfBuffer,
      pdfFilename: "visora-rapor-nisan-2026.pdf",
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

  try {
    results.staff_welcome = await sendStaffWelcomeEmail({
      staffEmail: target,
      staffName: "Bahar",
      organizationName: "Visora Demo Şirketi",
      gmEmail: null,
    });
  } catch (e: any) {
    results.staff_welcome = { error: e?.message || String(e) };
  }

  try {
    results.staff_created = await sendStaffCreatedEmail({
      gmEmail: target,
      gmName: "Yusuf Bey",
      staffName: "Bahar",
      staffEmail: "bahar@visoraturizm.com",
      organizationName: "Visora Demo Şirketi",
    });
  } catch (e: any) {
    results.staff_created = { error: e?.message || String(e) };
  }

  try {
    results.randevu_talebi = await sendRandevuTalebiEmail({
      gmEmail: target,
      actorName: "Bahar (personel)",
      dosyaAdi: "Mehmet Yılmaz",
      ulkeler: ["Almanya"],
      vizeTipi: "Turistik",
      iletisim: "+905551112233",
      notlar: "Aile birleşimi başvurusu, acil.",
    });
  } catch (e: any) {
    results.randevu_talebi = { error: e?.message || String(e) };
  }

  try {
    results.randevu_alindi = await sendRandevuAlindiEmail({
      gmEmail: target,
      actorName: "Yusuf Bey (Genel Müdür)",
      dosyaAdi: "Mehmet Yılmaz",
      ulkeler: ["Almanya"],
      vizeTipi: "Turistik",
      randevuTarihi: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      olusturanAd: "Bahar (personel)",
    });
  } catch (e: any) {
    results.randevu_alindi = { error: e?.message || String(e) };
  }

  return NextResponse.json({ ok: true, target, results });
}
