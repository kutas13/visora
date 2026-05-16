import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/* ===========================================================================
 *  YENI STRATEJI (yuksek dogruluk)
 *  ---------------------------------------------------------------------
 *  1. AI'dan SADECE MRZ'yi (2 satir) ve ust kismindaki etiketli ad/soyad'i
 *     karakter karakter aynen kopyalamasi istenir. Bu cok kolay bir gorev,
 *     dolayisiyla model nadiren hata yapar.
 *  2. Sunucuda MRZ deterministik olarak parse edilir (ICAO 9303 standardi).
 *  3. ICAO checksum'lari hesaplanip MRZ'den okunan checksum karakterleri
 *     ile karsilastirilir. UYUSMAYAN alan SUPHELI olarak isaretlenir.
 *  4. Ust gorseldeki ad/soyad (Turkce karakter destegi) MRZ ile capraz
 *     dogrulanir; aralarinda buyuk fark varsa MRZ asal alinir.
 *  5. Sonuc tutarsizsa AI bir kez DAHA cagrilir (yuksek detay + zoom).
 * ========================================================================= */

const SYSTEM = `Sen pasaport gorsellerinden TAM TAM olarak iki bilgi cikartan bir yardimcisin:

1) ALT KISIMDAKI MRZ (Machine Readable Zone) — SAYI ve HARF dolu, '<' ile dolu iki satirdir.
2) UST KISIMDAKI etiketli "Soyadi / Surname" ve "Adi / Given Names" alanlarinin tam yazimi.

KESIN KURALLAR:
- MRZ'nin iki satirini olabildigince DOGRU karakterlerle, hicbir karakteri atlamadan oku.
- '<' karakterleri MRZ'de DOLDURMA karakteridir; aynen koru.
- MRZ ozellikle ASCII'dir; Turkce karakter (C,G,O,U,I,S) burada YOK; aksanli yerine duz harfler vardir.
- Ust kisimdaki "Soyadi" ve "Adi" alanlarini Turkce karakter dahil aynen oku.
- Pasaportu cevirebilirsin, kontrast az olabilir; yine de en iyi tahminini ver.
- Eger bir satiri okuyamiyorsan o alani null bos birak.

ZORUNLU TEK SATIR JSON CIKTIS FORMATI:
{
  "mrz_line1": "P<TURYILMAZ<<AHMET<MEHMET<<<<<<<<<<<<<<<<<<<<<<<",
  "mrz_line2": "U12345678<TUR8503012M2503125<<<<<<<<<<<<<<<2",
  "ust_soyad": "YILMAZ",
  "ust_ad":    "AHMET MEHMET"
}

NOTLAR:
- Cikti SADECE JSON olsun. Markdown, aciklama, ` + "```" + ` kullanma.
- Eger gorselde MRZ yoksa ikisini de null yap.
- mrz_line1 ve mrz_line2 her zaman 44 karakter (TD3) veya 36 karakter (TD2) civarinda olur. KISALT ETME.`;

interface AIRaw {
  mrz_line1?: string | null;
  mrz_line2?: string | null;
  ust_soyad?: string | null;
  ust_ad?: string | null;
}

/* ----------- ICAO 9303 MRZ checksum ----------------------------------- */
const CHECKSUM_WEIGHTS = [7, 3, 1];
function mrzCharValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A=10
  if (c === "<") return 0;
  return 0;
}
function calcChecksum(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum += mrzCharValue(s[i]) * CHECKSUM_WEIGHTS[i % 3];
  }
  return sum % 10;
}

/* ----------- MRZ parse (TD3 - 2 satir x 44 karakter) ------------------ */
function parseMrz(line1Raw: string, line2Raw: string) {
  const l1 = (line1Raw || "").toUpperCase().replace(/\s/g, "");
  const l2 = (line2Raw || "").toUpperCase().replace(/\s/g, "");

  // Satir 1: Tip + 2-3 karakter ulke + Soyad<<Ad
  // P<TUR{SOYAD}<<{ADLAR}<<<<<...
  const docCode = l1[0] || ""; // genelde P
  const issuingCountry = l1.slice(2, 5).replace(/</g, ""); // 3 char
  const namesPart = l1.slice(5);
  const splitAt = namesPart.indexOf("<<");
  const soyadRaw = splitAt >= 0 ? namesPart.slice(0, splitAt) : namesPart;
  const adRaw = splitAt >= 0 ? namesPart.slice(splitAt + 2) : "";

  const cleanName = (s: string) =>
    s
      .replace(/</g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const soyad = cleanName(soyadRaw) || null;
  const ad = cleanName(adRaw) || null;

  // Satir 2 (TD3 ICAO 9303):
  // [9 char passport no][1 check][3 char nat][6 char dob][1 check][1 sex][6 char exp][1 check][14 char personal][1 check][1 composite check]
  const passportNoRaw = l2.slice(0, 9);
  const passportCheck = l2[9];
  const nationality = l2.slice(10, 13).replace(/</g, "");
  const dobRaw = l2.slice(13, 19);
  const dobCheck = l2[19];
  const sexChar = l2[20];
  const expRaw = l2.slice(21, 27);
  const expCheck = l2[27];

  const passportNo = passportNoRaw.replace(/</g, "");

  // YYMMDD -> YYYY-MM-DD
  const yyToYear = (yy: number, isExpiry: boolean) => {
    if (isExpiry) {
      // expiry icin 50+ ise 19YY genelde imkansiz; ama yine de standart kural
      return yy >= 50 ? 1900 + yy : 2000 + yy;
    }
    // dogum tarihi: yy >= 50 -> 19YY, yoksa 20YY
    return yy >= 50 ? 1900 + yy : 2000 + yy;
  };
  const ymdToISO = (s: string, isExpiry: boolean): string | null => {
    if (!/^\d{6}$/.test(s)) return null;
    const yy = Number(s.slice(0, 2));
    const mm = Number(s.slice(2, 4));
    const dd = Number(s.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const yyyy = yyToYear(yy, isExpiry);
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  };

  const dogum = ymdToISO(dobRaw, false);
  const sonKullanma = ymdToISO(expRaw, true);

  const cinsiyet =
    sexChar === "M" || sexChar === "F" ? (sexChar as "M" | "F") : null;

  // Checksum dogrulama (ICAO 9303)
  const checks = {
    passport: passportCheck === String(calcChecksum(passportNoRaw)),
    dob: dobCheck === String(calcChecksum(dobRaw)),
    expiry: expCheck === String(calcChecksum(expRaw)),
  };

  return {
    docCode,
    issuingCountry: issuingCountry || null,
    soyad,
    ad,
    pasaport_no: passportNo || null,
    uyruk: nationality || null,
    dogum_tarihi: dogum,
    son_kullanma: sonKullanma,
    cinsiyet,
    checks,
    raw: { l1, l2 },
  };
}

/* ----------- AI cagrisi ----------------------------------------------- */
async function callOpenAI(
  imageUrl: string,
  hi: boolean,
  fast: boolean = false
): Promise<AIRaw | null> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY tanimli degil.");
  }

  // fast modunda detail=low + maks token kucuk → cok daha hizli
  const detail: "high" | "low" = fast ? "low" : "high";
  const maxTokens = fast ? 350 : 600;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: hi
                ? `Bu bir TUR pasaportunun on yuzu — kontrast / cozunurluk dusuk olabilir. Yine de MRZ'nin iki satirini ve ust kisimdaki Soyadi / Adi alanlarini en hassas sekilde oku. Once MRZ'yi karakter karakter al; sadece JSON dondur.`
                : `Bu pasaport on yuzunden:
1) Alt kisimdaki MRZ'nin iki satirini AYNEN cikar (her '<' karakteri dahil).
2) Ust kismindaki "Soyadi / Surname" ve "Adi / Given Names" etiketlerinin yanindaki yazilari oku.
JSON dondur.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[ocr] OpenAI hata:", errText);
    return null;
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content) as AIRaw;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as AIRaw;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/* ----------- POST ------------------------------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const base64: string | undefined = body?.base64;
    const urlInput: string | undefined = body?.url;
    // fast=true → hız öncelikli (vize randevu akışı). max accuracy istemiyorsak retry kapatır.
    const fast: boolean = body?.fast === true;

    if (!base64 && !urlInput) {
      return NextResponse.json(
        { error: "Görsel (base64) veya url eksik." },
        { status: 400 }
      );
    }

    // OpenAI image_url alanı HTTP URL'yi de kabul ediyor — base64 round-trip yapmaktan
    // ~%70 daha hızlı (bandwidth ve serialization).
    const imageUrl = urlInput
      ? urlInput
      : (base64!.startsWith("data:") ? base64! : `data:image/jpeg;base64,${base64!}`);

    // 1. cagri (fast modda detail=low)
    let ai = await callOpenAI(imageUrl, false, fast);
    let parsed = ai && ai.mrz_line1 && ai.mrz_line2
      ? parseMrz(ai.mrz_line1, ai.mrz_line2)
      : null;

    const allChecksumsOk =
      parsed && parsed.checks.passport && parsed.checks.dob && parsed.checks.expiry;

    // Fast modunda retry yapmıyoruz; sonuç ne ise onu döndür
    if (!fast && (!parsed || !allChecksumsOk)) {
      const ai2 = await callOpenAI(imageUrl, true, false);
      if (ai2 && ai2.mrz_line1 && ai2.mrz_line2) {
        const parsed2 = parseMrz(ai2.mrz_line1, ai2.mrz_line2);
        const ok2 =
          parsed2.checks.passport && parsed2.checks.dob && parsed2.checks.expiry;
        const score = (p: ReturnType<typeof parseMrz> | null) =>
          p ? Number(p.checks.passport) + Number(p.checks.dob) + Number(p.checks.expiry) : -1;
        if (score(parsed2) > score(parsed)) {
          parsed = parsed2;
          ai = ai2;
        }
        if (ok2 && (!parsed || !allChecksumsOk)) {
          parsed = parsed2;
          ai = ai2;
        }
      }
    }

    if (!parsed) {
      return NextResponse.json(
        { error: "Pasaport MRZ alani okunamadi. Lutfen daha net bir gorsel yukleyin." },
        { status: 422 }
      );
    }

    // Ust gorsel ad/soyad - turkce karakterler icin (MRZ ASCII'dir)
    const upperTurkize = (s: string | null | undefined) =>
      typeof s === "string" ? s.trim().toLocaleUpperCase("tr-TR") : "";
    const ustSoyad = upperTurkize(ai?.ust_soyad);
    const ustAd = upperTurkize(ai?.ust_ad);

    // ASCII karsiligi (Turkce -> ASCII) ile MRZ adini kiyasla; ust gorsel
    // Turkce karakter iceriyorsa onu tercih et (cunku MRZ'de aksan yok).
    const tToAscii = (s: string) =>
      s
        .replace(/Ç/g, "C")
        .replace(/Ğ/g, "G")
        .replace(/İ/g, "I")
        .replace(/İ/g, "I")
        .replace(/Ö/g, "O")
        .replace(/Ş/g, "S")
        .replace(/Ü/g, "U")
        .replace(/[^A-Z\s]/g, "");
    const namesMatch = (ust: string, mrz: string | null) => {
      if (!ust || !mrz) return false;
      return tToAscii(ust) === mrz.toUpperCase();
    };

    const adFinal = namesMatch(ustAd, parsed.ad) ? ustAd : parsed.ad;
    const soyadFinal = namesMatch(ustSoyad, parsed.soyad) ? ustSoyad : parsed.soyad;

    // Eger ust gorsel kismi bos ya da MRZ ile uyusmuyorsa, MRZ'yi kullan
    // (bu "asla terslenmez" garantisini saglar).

    const result = {
      ad: adFinal,
      soyad: soyadFinal,
      pasaport_no: parsed.pasaport_no,
      dogum_tarihi: parsed.dogum_tarihi,
      son_kullanma: parsed.son_kullanma,
      uyruk: parsed.uyruk,
      cinsiyet: parsed.cinsiyet,
      // Debug bilgisi (frontend'in guvenmesi icin)
      _meta: {
        checksum_ok: parsed.checks,
        mrz_line1: parsed.raw.l1,
        mrz_line2: parsed.raw.l2,
      },
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    console.error("[ocr] fatal:", err);
    return NextResponse.json(
      { error: err?.message || "OCR sırasında beklenmeyen hata oluştu." },
      { status: 500 }
    );
  }
}
