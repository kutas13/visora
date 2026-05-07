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

const SYSTEM = `Sen Türk pasaportları başta olmak üzere uluslararası pasaport görsellerinden veri çıkaran bir OCR uzmanısın. EN GÜVENİLİR KAYNAK PASAPORTUN ALTINDAKİ MRZ (Machine Readable Zone) BÖLÜMÜDÜR — daima ÖNCE MRZ'yi oku, sonra üstteki etiketli alanlarla doğrula.

═══════════════════════════════════════════════════════
MRZ NASIL OKUNUR (Türk pasaportu örneği):
═══════════════════════════════════════════════════════
Pasaportun en altında "<<<" karakterleri içeren İKİ SATIR vardır.

▶ SATIR 1 formatı:
P<TUR{SOYAD}<<{ADLAR}<<<<<<<<<<<<<<<<<<<<<<<<<<<
   ↑    ↑       ↑
   |    |       |
   |    |       └── ÇİFT '<<' SONRASI: AD (given names)
   |    └────────── 'TUR' SONRASI: SOYAD (surname / family name)
   └─────────────── Ülke kodu (TUR, USA, DEU vs.)

ÖRNEK 1 — "P<TURYILMAZ<<AHMET<MEHMET<<<<<<<<<<<<<<<<<<"
  → soyad = "YILMAZ"   (TUR'dan sonra çift '<<' öncesi)
  → ad    = "AHMET MEHMET"  (çift '<<' sonrası, tek '<' boşluk demektir)

ÖRNEK 2 — "P<TURKAYA<<AYSE<DEMET<<<<<<<<<<<<<<<<<<<<<<"
  → soyad = "KAYA"
  → ad    = "AYSE DEMET"

▶ SATIR 2 formatı:
{PasaportNo}<{ÜlkeKodu}{DogumTarihi}{Cinsiyet}{SonKullanma}<{...}<{checkdigit}
 ↑            ↑          ↑              ↑          ↑
 9 karakter   3 karakter 6 karakter     M/F        6 karakter
 Pas. No      TUR vs.    YYMMDD         Cinsiyet   YYMMDD

ÖRNEK 2. SATIR — "U12345678<TUR8503012M2503125<<<<<<<<<<<<<<<2"
  → pasaport_no   = "U12345678"  (ilk 9 karakter — '<' silinir)
  → uyruk         = "TUR"
  → dogum_tarihi  = "850301"  →  1985-03-01  (yıl 85 ≥ 50 ⇒ 19YY)
  → cinsiyet      = "M"
  → son_kullanma  = "250312"  →  2025-03-12  (yıl 25 < 50 ⇒ 20YY)

═══════════════════════════════════════════════════════
TARİH DÖNÜŞÜM KURALI (MRZ → YYYY-MM-DD):
═══════════════════════════════════════════════════════
YYMMDD verildiğinde:
  - YY ≥ 50  →  19YY  (örn: 75 → 1975)
  - YY < 50  →  20YY  (örn: 25 → 2025, 03 → 2003)

═══════════════════════════════════════════════════════
TÜRK PASAPORTU ÜST GÖRSEL ALAN (MRZ ile doğrula):
═══════════════════════════════════════════════════════
Üstte tipik etiketler:
  "Soyadı / Surname"           → SOYAD  (üstte gözüken ilk ad-tipi alan)
  "Adı / Given Names"          → AD     (Soyadı satırının altında)
  "Doğum Tarihi / Date of Birth"
  "Geçerlilik Tarihi / Date of Expiry"
  "Pasaport No / Passport No"

⚠️ DİKKAT: Türk pasaportunda etiket sırası UFAK FONTLA "Soyadı / Surname" ÖNCE yazar; bu yüzden MRZ ile çapraz kontrol et. Hiçbir zaman ad/soyad'ı tersine çevirme.

═══════════════════════════════════════════════════════
ÇIKARMAN GEREKEN ALANLAR (JSON):
═══════════════════════════════════════════════════════
{
  "ad":           "Ad / Given Names — sadece isim, soyadsız",
  "soyad":        "Soyadı / Surname",
  "pasaport_no":  "Pasaport numarası (büyük harf, boşluksuz)",
  "dogum_tarihi": "YYYY-MM-DD formatında",
  "son_kullanma": "YYYY-MM-DD formatında (Geçerlilik / Date of Expiry)",
  "uyruk":        "TUR / USA gibi 3-harf kod",
  "cinsiyet":     "M veya F"
}

═══════════════════════════════════════════════════════
KESİN KURALLAR:
═══════════════════════════════════════════════════════
1. Önce MRZ'yi (alttaki iki '<<<' satırı) bul ve oku — en güvenilir.
2. AD ve SOYAD'ı KESİNLİKLE KARIŞTIRMA:
   - MRZ ilk satırda: TUR'dan sonra çift '<<' ÖNCESİ = SOYAD, ÇİFT '<<' SONRASI = AD.
   - Üst alanda: "Soyadı / Surname" etiketinin yanı = SOYAD, "Adı / Given Names" yanı = AD.
3. Tarihleri YYMMDD'den YYYY-MM-DD'ye doğru çevir (50 kuralı).
4. Türkçe karakterler (Ç, Ğ, Ş, Ü, Ö, İ) varsa üst alanı oku — MRZ'de zaten ASCII olur.
5. Eğer alan okunamıyor / belirsiz ise null döndür. ASLA TAHMİN ETME.
6. Pasaport numarasında '<' veya boşluk OLMAZ.
7. Sadece geçerli, minified JSON döndür. Markdown YOK, açıklama YOK, ek metin YOK.

DÖNÜŞ FORMATI (TEK BİR SATIR JSON):
{"ad": "AHMET MEHMET", "soyad": "YILMAZ", "pasaport_no": "U12345678", "dogum_tarihi": "1985-03-01", "son_kullanma": "2025-03-12", "uyruk": "TUR", "cinsiyet": "M"}`;

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

    if (!base64 || typeof base64 !== "string") {
      return NextResponse.json(
        { error: "Görsel (base64) eksik." },
        { status: 400 }
      );
    }

    // dataURL prefix'i (data:image/jpeg;base64,...) varsa olduğu gibi gönder, yoksa ekle
    const imageUrl = base64.startsWith("data:")
      ? base64
      : `data:image/jpeg;base64,${base64}`;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Sunucu OCR yapılandırması eksik (OPENAI_API_KEY)." },
        { status: 500 }
      );
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Bu pasaport ön yüzü görselindeki bilgileri çıkar.

ADIM ADIM YAP:
1. Görselin ALT KISMINDAKİ MRZ'yi (iki tane '<<<' içeren satır) bul.
2. MRZ ilk satırından SOYAD ve AD'ı ayır:
   - 'TUR' (veya başka 3 harfli ülke kodu) sonrası ÇİFT '<<' ÖNCESİ = SOYAD
   - ÇİFT '<<' SONRASI = AD (tek '<' boşluk demektir)
3. MRZ ikinci satırından pasaport_no, dogum_tarihi, cinsiyet, son_kullanma'yı çıkar.
4. Tarihleri YYMMDD'den YYYY-MM-DD'ye çevir (yıl 50+ ise 19YY, yoksa 20YY).
5. Üstteki görsel alanla doğrula — özellikle Türkçe karakterli ad/soyad için üst alanı oku.
6. JSON olarak döndür.

ÖZELLİKLE DİKKAT: Türk pasaportunda 'Soyadı / Surname' önce yazar — ad ile soyadı asla TERS DOLDURMA. MRZ kesin doğrudur.`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("[ocr] OpenAI hatası:", errText);
      return NextResponse.json(
        { error: "OCR servisi şu anda yanıt vermedi. Lütfen tekrar deneyin." },
        { status: 502 }
      );
    }

    const json = await openaiRes.json();
    const content: string = json?.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = {};
        }
      }
    }

    const norm = (v: any) =>
      typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null"
        ? v.trim()
        : null;

    const cleanDate = (d: any): string | null => {
      const s = norm(d);
      if (!s) return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      // sanity check: 1900-2100, ay 1-12, gün 1-31
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      return s;
    };

    const cleanPassportNo = (v: any): string | null => {
      const s = norm(v);
      if (!s) return null;
      // < ve boşluk temizle, büyük harfe çevir
      const cleaned = s.replace(/[<\s]/g, "").toUpperCase();
      // En az 6 karakter olmalı, 4-12 karakter aralığı tipik
      if (cleaned.length < 5 || cleaned.length > 14) return null;
      return cleaned;
    };

    const cleanGender = (v: any): "M" | "F" | null => {
      const s = norm(v);
      if (!s) return null;
      const upper = s.toUpperCase();
      if (upper === "M" || upper === "MALE" || upper === "ERKEK") return "M";
      if (upper === "F" || upper === "FEMALE" || upper === "KADIN") return "F";
      return null;
    };

    let dogum = cleanDate(parsed.dogum_tarihi);
    let sonKul = cleanDate(parsed.son_kullanma);

    // Eğer son_kullanma doğum_tarihinden önceyse, ikisi de şüpheli
    // (Çok nadir hata: AI tarihleri ters döndürmüş olabilir.)
    if (dogum && sonKul && sonKul < dogum) {
      [dogum, sonKul] = [sonKul, dogum];
    }

    const result = {
      ad: norm(parsed.ad),
      soyad: norm(parsed.soyad),
      pasaport_no: cleanPassportNo(parsed.pasaport_no),
      dogum_tarihi: dogum,
      son_kullanma: sonKul,
      uyruk: norm(parsed.uyruk)?.toUpperCase().slice(0, 3) || null,
      cinsiyet: cleanGender(parsed.cinsiyet),
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
