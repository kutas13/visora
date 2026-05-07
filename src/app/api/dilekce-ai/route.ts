import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const admin = getAdmin();

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return new Response("Yetkisiz", { status: 401 });

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return new Response("Yetkisiz", { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return new Response("Geçersiz veri", { status: 400 });

  const systemPrompt = buildPetitionPrompt(body as PetitionData);

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Lütfen yukarıdaki bilgilere göre Türkçe ve İngilizce dilekçeyi oluştur." },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    return new Response(`OpenAI hatası: ${err}`, { status: 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = openaiRes.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) controller.enqueue(encoder.encode(content));
            } catch {}
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}

interface PetitionData {
  dilekceTuru: "Bireysel" | "Şirket";
  basvuruSehri: string;
  musteriAdi: string;
  pasaportNo: string;
  ulke: string;
  kategori: string;
  seyahatBaslangic: string;
  seyahatBitis: string;
  calismaDurumu: string;
  turkSirketAdi?: string;
  sirketSahibiIsmi?: string;
  iseGirisTarihi?: string;
  davetEdenSirketAdi?: string;
  davetEdenSirketSehir?: string;
  sponsorIsmi?: string;
  gidilecekSehir?: string;
  davetEdenKisi?: string;
  akrabaYakinligi?: string;
  davetEdenKisiSehir?: string;
  davetEdenOkul?: string;
  okulSehir?: string;
  ekstraBilgi?: string;
}

function diplomaticMission(ulke: string, basvuruSehri: string): { tr: string; en: string } {
  const sehirNorm = (basvuruSehri || "").trim().toLocaleLowerCase("tr-TR");
  const ulkeNorm = (ulke || "").trim();
  const isAnkara = sehirNorm === "ankara";
  const trMission = isAnkara
    ? `${ulkeNorm} Büyükelçiliği`
    : `${ulkeNorm} ${basvuruSehri} Başkonsolosluğu`;
  const enMission = isAnkara
    ? `Embassy of ${ulkeNorm} in Ankara`
    : `Consulate General of ${ulkeNorm} in ${basvuruSehri}`;
  return { tr: trMission, en: enMission };
}

function todayTr(): string {
  const d = new Date();
  const aylar = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()}`;
}

function todayEn(): string {
  const d = new Date();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildPetitionPrompt(d: PetitionData): string {
  const mission = diplomaticMission(d.ulke, d.basvuruSehri);
  const isCompany = d.dilekceTuru === "Şirket";

  let details = `
Dilekçe Türü: ${d.dilekceTuru} ${isCompany ? "(şirket ağzından yazılacak)" : "(başvuru sahibinin ağzından yazılacak)"}
Bugünkü Tarih (TR): ${todayTr()}
Bugünkü Tarih (EN): ${todayEn()}
Başvuru Sahibi: ${d.musteriAdi}
Pasaport No: ${d.pasaportNo}
Başvurulan Ülke: ${d.ulke}
Başvuru Şehri: ${d.basvuruSehri}
Hitap Edilecek Misyon (TR): ${mission.tr}
Hitap Edilecek Misyon (EN): ${mission.en}
Başvuru Kategorisi: ${d.kategori}
Seyahat Tarihleri: ${d.seyahatBaslangic} – ${d.seyahatBitis}
Çalışma Durumu: ${d.calismaDurumu}
`;

  if (d.kategori === "Ticari") {
    if (d.calismaDurumu === "Şirket Sahibi") {
      details += `Türk Şirket Adı: ${d.turkSirketAdi || "-"}\nDavet Eden Şirket: ${d.davetEdenSirketAdi || "-"}\nDavet Eden Şirketin Şehri: ${d.davetEdenSirketSehir || "-"}\n`;
    } else if (d.calismaDurumu === "Çalışan") {
      details += `İşe Giriş Tarihi: ${d.iseGirisTarihi || "-"} (Bu tarihi mutlaka dilekçede belirt — kıdemini vurgular)\nŞirket Sahibi: ${d.sirketSahibiIsmi || "-"}\nTürk Şirket Adı: ${d.turkSirketAdi || "-"}\nDavet Eden Şirket: ${d.davetEdenSirketAdi || "-"}\nDavet Eden Şirketin Şehri: ${d.davetEdenSirketSehir || "-"}\n`;
    } else if (d.calismaDurumu === "Sponsor") {
      details += `Sponsor: ${d.sponsorIsmi || "-"}\nDavet Eden Şirket: ${d.davetEdenSirketAdi || "-"}\nDavet Eden Şirketin Şehri: ${d.davetEdenSirketSehir || "-"}\n`;
    }
  } else if (d.kategori === "Turistik") {
    details += `Gidilecek Şehir: ${d.gidilecekSehir || "-"}\nGiderleri Karşılayan: ${d.calismaDurumu === "Sponsor" ? "Sponsor" : "Başvuru sahibinin kendisi"}\n`;
    if (d.calismaDurumu === "Şirket Sahibi") {
      details += `Türk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Çalışan") {
      details += `İşe Giriş Tarihi: ${d.iseGirisTarihi || "-"} (Bu tarihi mutlaka dilekçede belirt)\nŞirket Sahibi: ${d.sirketSahibiIsmi || "-"}\nTürk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Sponsor") {
      details += `Sponsor: ${d.sponsorIsmi || "-"}\n`;
    }
  } else if (d.kategori === "Aile Ziyareti") {
    details += `Davet Eden Kişi: ${d.davetEdenKisi || "-"}\nAkraba Yakınlığı: ${d.akrabaYakinligi || "-"}\nDavet Eden Kişinin Şehri: ${d.davetEdenKisiSehir || "-"}\n`;
    if (d.calismaDurumu === "Şirket Sahibi") {
      details += `Türk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Çalışan") {
      details += `İşe Giriş Tarihi: ${d.iseGirisTarihi || "-"} (Bu tarihi mutlaka dilekçede belirt)\nŞirket Sahibi: ${d.sirketSahibiIsmi || "-"}\nTürk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Sponsor") {
      details += `Sponsor: ${d.sponsorIsmi || "-"}\n`;
    }
  } else if (d.kategori === "Arkadaş Ziyareti") {
    details += `Davet Eden Kişi: ${d.davetEdenKisi || "-"}\nDavet Eden Kişinin Şehri: ${d.davetEdenKisiSehir || "-"}\n`;
    if (d.calismaDurumu === "Şirket Sahibi") {
      details += `Türk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Çalışan") {
      details += `İşe Giriş Tarihi: ${d.iseGirisTarihi || "-"} (Bu tarihi mutlaka dilekçede belirt)\nŞirket Sahibi: ${d.sirketSahibiIsmi || "-"}\nTürk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Sponsor") {
      details += `Sponsor: ${d.sponsorIsmi || "-"}\n`;
    }
  } else if (d.kategori === "Eğitim") {
    details += `Davet Eden Okul: ${d.davetEdenOkul || "-"}\nOkulun Şehri: ${d.okulSehir || "-"}\n`;
    if (d.calismaDurumu === "Çalışan") {
      details += `İşe Giriş Tarihi: ${d.iseGirisTarihi || "-"} (Bu tarihi mutlaka dilekçede belirt)\nŞirket Sahibi: ${d.sirketSahibiIsmi || "-"}\nTürk Şirket Adı: ${d.turkSirketAdi || "-"}\n`;
    } else if (d.calismaDurumu === "Sponsor") {
      details += `Sponsor: ${d.sponsorIsmi || "-"}\n`;
    }
  }

  if (d.ekstraBilgi?.trim()) {
    details += `\nEkstra Bilgi (mutlaka dikkate al): ${d.ekstraBilgi.trim()}\n`;
  }

  const voiceTr = isCompany
    ? `Dilekçeyi "${d.turkSirketAdi || "şirketimiz"}" şirketinin yetkilisi ağzından, "şirketimiz", "personelimiz/çalışanımız ${d.musteriAdi}", "kendisi", "tarafımızca" gibi ifadelerle yaz. Şirket, başvuru sahibinin işvereni olarak referans veriyor (3. tekil şahıs ile başvuru sahibinden bahsediliyor). Açılış: "Şirketimiz ${d.turkSirketAdi || ""} olarak, çalışanımız/personelimiz ${d.musteriAdi}'in (Pasaport No: ${d.pasaportNo})..."`
    : `Dilekçeyi başvuru sahibinin (${d.musteriAdi}) kendi ağzından birinci tekil ("ben", "kendim") yaz. Açılış: "Ben, ${d.musteriAdi} (Pasaport No: ${d.pasaportNo}), ..." şeklinde başlasın.`;

  const voiceEn = isCompany
    ? `Write the petition on behalf of "${d.turkSirketAdi || "our company"}" as the company speaking about its employee. Use third-person for the applicant: "our employee ${d.musteriAdi}", "he/she", "his/her". Opening: "We, ${d.turkSirketAdi || "our company"}, hereby confirm that our employee ${d.musteriAdi} (Passport No: ${d.pasaportNo})..."`
    : `Write the petition in the first-person voice of the applicant (${d.musteriAdi}) using "I", "my", "myself". Opening: "I, ${d.musteriAdi} (${d.pasaportNo}), ..." style.`;

  const closingTr = isCompany
    ? `${d.turkSirketAdi || ""}\n[Yetkili imzası]`
    : d.musteriAdi;
  const closingEn = isCompany
    ? `${d.turkSirketAdi || ""}\n[Authorized Signatory]`
    : d.musteriAdi;

  return `Sen profesyonel, deneyimli bir Schengen vize dilekçesi yazarısın. Aşağıdaki bilgilere göre iki ayrı dilekçe (Türkçe + İngilizce) hazırlayacaksın.

${details}

============================================
İNGİLİZCE TİCARİ DİLEKÇE TARZ ÖRNEĞİ (referans olarak kullan, körlemesine kopyalama):
"To the Consulate General of the Federal Republic of Germany in Istanbul

Dear Sir/Madam,

I, EYÜP ÇİÇEK (U26504711), am the owner of EYÜP ÇİÇEK EMİN TEKSTİL. Our company operates in the textile sector, and I have been invited by DGN FASHION GMBH, located in Hamburg, Germany, for a commercial business visit.

The purpose of my trip is to improve the existing business relations between our companies, establish new business connections, and conduct sectoral meetings. I believe that the meetings to be held during my visit to Germany will provide significant commercial benefits for our company.

My travel dates are between 05/06/2026 and 10/06/2026. All expenses related to my trip, including flight tickets, accommodation, transportation, and other costs, will be covered by my company, EYÜP ÇİÇEK EMİN TEKSTİL.

Due to my ongoing commercial activities, company responsibilities, and strong business ties in Türkiye, I hereby undertake that I will return to my country after the completion of my trip.

I kindly request that the necessary visa be granted to me.

Sincerely,
EYÜP ÇİÇEK
EYÜP ÇİÇEK EMİN TEKSTİL"
============================================

YAZIM KURALLARI:

A) ÇIKTI FORMATI — ZORUNLU:
===TURKCE===
[Türkçe dilekçe burada]

===ENGLISH===
[English petition here]

ÖNCE Türkçe tamamen yazılır, ARDINDAN "===ENGLISH===" satırı ve İngilizce başlar.

B) BAŞLIK / HİTAP:
- Türkçe dilekçenin en üstünde tarih: ${todayTr()}
- Sonra makam: "${mission.tr}"
- Selamlama: "Sayın Yetkili,"
- İngilizce için tarih: ${todayEn()} | Makam: "${mission.en}" | Selamlama: "Dear Sir/Madam,"

C) ASLA YAZMA:
- [Adres], [Telefon], [E-posta], [Vize Bölümü] gibi placeholder'lar
- "Yukarıdaki bilgiler ışığında..." gibi bürokratik ifadeler
- Markdown başlık (#) sembolleri

D) SES / ÜSLUP:
- ${voiceTr}
- ${voiceEn}

E) İÇERİK GEREKSİNİMLERİ:
1. Verilen TÜM bilgileri kullan: seyahat tarihleri (GG.AA.YYYY/dd/mm/yyyy), pasaport no, davet eden şirket/kişi/okul, davet eden şehir, işe giriş tarihi (varsa), akraba yakınlığı, sponsor bilgisi, ekstra bilgi.
2. Çalışan/şirket sahibi ise türk şirket adı + sektör (varsa) + davet eden firma + davet eden firmanın şehri AYNI cümle veya paragrafta net şekilde geçsin.
3. ${d.calismaDurumu === "Çalışan" && d.iseGirisTarihi ? `İşe giriş tarihini (${d.iseGirisTarihi}) "X tarihinden bu yana çalışmaktadır" benzeri bir ifade ile MUTLAKA belirt.` : ""}
4. Seyahat amacı kategoriye göre net yazılsın (ticari → ticari ilişkileri geliştirme, sektörel toplantılar; turistik → şehir gezisi; aile/arkadaş → ziyaret; eğitim → kurs/program).
5. Tüm masrafların kim tarafından karşılanacağı net belirtilsin (şirket / başvuru sahibi / sponsor).
6. ${d.ekstraBilgi?.trim() ? `EKSTRA BİLGİ olarak verilen şu detayı dilekçeye yedir: "${d.ekstraBilgi.trim()}"` : ""}
7. Türkiye'ye dönüş garantisi: iş yükümlülükleri, aile, ekonomik bağlar gibi nedenlerle güçlü vurgu yap.
8. Kibarca vize talep et.

F) UZUNLUK:
- Sade, profesyonel, gereksiz şişirme yapma. Yukarıdaki örnek (~250 kelime) iyi bir referans uzunluk.
- Türkçe ve İngilizce yaklaşık aynı uzunlukta olsun.

G) İMZA:
- Türkçe sonu: "Saygılarımla,\n${closingTr}"
- İngilizce sonu: "Sincerely,\n${closingEn}"`;
}
