import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, sanitizeAIInput, validateOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getFileStatus(f: any): string {
  if (f.sonuc === "vize_onay") return "Vize Onay ✅";
  if (f.sonuc === "red") return "Red ❌";
  if (f.islemden_cikti) return "İşlemden Çıktı";
  if (f.basvuru_yapildi) return "İşlemde";
  if (f.dosya_hazir) return "Hazır";
  return "Yeni";
}

function buildSystemPrompt(
  userName: string,
  userRole: string,
  fileList: string,
  staffSummary: string,
  paymentSummary: string
): string {
  const today = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `Sen "FOX AI" adında, Fox Turizm vize ajansının yapay zeka asistanısın. 🦊
Bugünün tarihi: ${today}.

Şu an **${userName}** ile konuşuyorsun. Rolü: ${userRole === "admin" ? "Yönetici (Admin) - TÜM dosyaları görebilir" : "Personel - SADECE kendi dosyalarını görebilir"}.

GÖREV:
- ${userName}'a vize dosyaları, randevular, ödemeler ve günlük işler konusunda yardımcı ol.
- Türkçe konuş, samimi ve profesyonel ol. Kısa ve öz cevap ver.

ÇOK ÖNEMLİ - DOSYA GÖSTERME KURALLARI:
1. Kullanıcı dosyalar hakkında soru sorduğunda (randevular, ödemeler, müşteriler vs.) UZUN AÇIKLAMA YAZMA.
2. Sadece kısa bir başlık/özet yaz, sonra ilgili dosyaların ID'lerini [[DOSYA:uuid]] formatında ekle.
3. Frontend bu ID'leri otomatik olarak müşteri adı, ülke, randevu tarihi, kalan gün ve "Detay Gör" butonu içeren kartlara dönüştürür.
4. ASLA müşterinin randevu tarihi, ülkesi, ödeme durumu gibi detayları metin olarak yazma - bunlar kartta zaten gösterilecek.
5. Örnek doğru yanıt: "📅 3 yaklaşan randevunuz var:\n\n[[DOSYA:abc-123]] [[DOSYA:def-456]] [[DOSYA:ghi-789]]"
6. Örnek YANLIŞ yanıt: "Ali Yılmaz - Almanya - 15.02.2026 - 3 gün kaldı..." (bu bilgileri YAZMA, kart gösterecek)
7. ${userRole !== "admin" ? `SADECE ${userName}'ın dosyalarını göster. Başka personellerin dosyalarını ASLA paylaşma.` : "Tüm personellerin dosyalarını görebilirsin."}
8. Genel sohbet ve istatistik sorularında normal metin yanıt ver.
9. Birden fazla dosya varsa her [[DOSYA:id]] etiketini ayrı satıra koy.

SİTE NAVİGASYONU VE YARDIM (kullanıcıya yönlendirme yap):
- "/app" → Ana Sayfa: Dashboard, günlük özet, hızlı işlemler
- "/app/files" → Vize Dosyaları: Dosya listesi, arama, düzenleme
- "/app/files/new" → Yeni Dosya Oluştur: Müşteri bilgilerini gir
- "/app/payments" → Ödemeler: Tahsilat yap, ödeme geçmişi
- "/app/calendar" → Randevu Takvimi: Gün/hafta görünümü
- "/app/atamalar" → iDATA Atamaları: Email randevu atamaları
- "/app/cari-hesap" → Cari Hesabım: Ödenmemiş dosyalar
- "/app/groups" → Gruplar: Dosya gruplama
- "/app/vize-bitisi" → Vize Bitiş Takibi
- "/app/bildirimler" → Bildirimler

SIK SORULAN SORULAR (SSS):
Q: Nasıl dosya oluştururum?
A: Vize Dosyaları sayfasına git (/app/files) → + Yeni Dosya butonuna bas veya direkt /app/files/new

Q: Tahsilat nasıl yapılır? 
A: Ödemeler sayfasına git (/app/payments) → Bekleyen dosyaya "Tahsilat Yap" butonuna bas

Q: Peşin/Cari/Firma Cari farkı nedir?
A: Peşin: Para alındı, Cari: Sonra tahsil edilecek, Firma Cari: Şirketten tahsil (muhasebe takibinde)

Q: Randevularımı nasıl görürüm?
A: Randevu Takvimi sayfasına git (/app/calendar) - gün ve hafta görünümü var

Q: iDATA ataması nedir?
A: Vize başvurusu onaylandıktan sonra randevu tarihini seçme maili (/app/atamalar)

Q: Mail neden gitmiyor?
A: Vercel environment variables kontrol edin: SMTP_PASS_YUSUF, SMTP_PASS_BAHAR, SMTP_PASS_ERCAN

MESAJLAŞMA:
- Kullanıcı "mesaj gönder", "mesaj at", "mesaj yaz" veya herhangi birine mesaj göndermek isterse, yanıtında [[MESAJ_GONDER]] etiketi ekle.
- Mesaj gönderme dosyalarla ilgili DEĞİLDİR. Bu bir dahili mesajlaşma sistemidir. Dosya araması YAPMA.
- "Davut'a mesaj gönder", "Bahar'a mesaj at", "mesaj göndermek istiyorum" gibi isteklerde SADECE kısa bir onay mesajı yaz ve [[MESAJ_GONDER]] ekle. Başka bir şey yapma.

${userRole === "admin" ? `ADMİN YETKİLERİ:
- Tüm personellerin dosyalarını görebilirsin.
- Personel karşılaştırması ve performans analizi yapabilirsin.
- Finansal özet ve gelir raporları verebilirsin.` : `PERSONEL YETKİLERİ:
- Sadece ${userName}'ın kendi dosyalarını göster.
- Diğer personellerin dosyalarını ASLA paylaşma.`}

===== ${userName.toUpperCase()}'${userRole === "admin" ? "UN TÜM" : "IN"} DOSYALARI =====
${fileList || "Dosya bulunamadı."}

💰 ÖDEME ÖZETİ:
${paymentSummary}

${userRole === "admin" && staffSummary ? `👥 PERSONEL ÖZETİ:\n${staffSummary}` : ""}
===========================`;
}

export async function POST(request: NextRequest) {
  try {
    // ===== GÜVENLİK KONTROLLARI =====
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`ai-chat:${clientIp}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin." },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API anahtarı tanımlı değil." }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase yapılandırması eksik." }, { status: 500 });
    }

    const body = await request.json();
    const { messages, userId } = body as { messages: ChatMessage[]; userId: string };

    if (!userId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Eksik parametreler." }, { status: 400 });
    }

    const sanitizedMessages = messages.map((m) => ({
      ...m,
      content: m.role === "user" ? sanitizeAIInput(m.content) : m.content,
    }));

    const supabase = createClient(supabaseUrl, serviceKey);

    // Kullanıcı bilgisi
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const userName = profile.name;
    const userRole = profile.role;

    // Dosyaları getir - KULLANICI BAZLI FİLTRELEME
    let filesQuery = supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)");

    if (userRole !== "admin") {
      filesQuery = filesQuery.eq("assigned_user_id", userId);
    }

    const { data: files } = await filesQuery;
    const allFiles = files || [];

    // Ödemeleri getir
    let paymentsQuery = supabase.from("payments").select("*").eq("durum", "odendi");
    if (userRole !== "admin") {
      paymentsQuery = paymentsQuery.eq("created_by", userId);
    }
    const { data: payments } = await paymentsQuery;
    const allPayments = payments || [];

    // ===== DETAYLI DOSYA LİSTESİ OLUŞTUR =====
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fileList = allFiles.map((f: any) => {
      const status = getFileStatus(f);
      const odeme = f.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi";
      const randevu = f.randevu_tarihi
        ? new Date(f.randevu_tarihi).toLocaleDateString("tr-TR")
        : "Randevu yok";
      const evrak = f.evrak_eksik_mi ? "Eksik evrak var" : f.evrak_durumu === "geldi" ? "Evrak tamam" : "Evrak gelmedi";
      const ucret = f.ucret ? `${f.ucret} ${f.ucret_currency || "TL"}` : "Ücret girilmemiş";
      const staff = f.profiles?.name || "?";
      const arsiv = f.arsiv_mi ? " [ARŞİV]" : "";

      return `- ID:${f.id} | ${f.musteri_ad} | ${f.hedef_ulke} | Durum: ${status} | Ödeme: ${odeme} (${ucret}) | Randevu: ${randevu} | Evrak: ${evrak}${userRole === "admin" ? ` | Personel: ${staff}` : ""}${arsiv}`;
    }).join("\n");

    // Personel listesi (admin için)
    let staffSummary = "";
    if (userRole === "admin") {
      const { data: staffList } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("role", "staff");

      if (staffList) {
        staffSummary = staffList.map((s) => {
          const sFiles = allFiles.filter((f: any) => f.assigned_user_id === s.id);
          const active = sFiles.filter((f: any) => !f.sonuc && !f.arsiv_mi).length;
          const approved = sFiles.filter((f: any) => f.sonuc === "vize_onay").length;
          const rejected = sFiles.filter((f: any) => f.sonuc === "red").length;
          return `- ${s.name}: ${sFiles.length} toplam, ${active} aktif, ${approved} onay, ${rejected} red`;
        }).join("\n");
      }
    }

    // Ödeme özeti
    const tlTotal = allPayments.filter((p: any) => (p.currency || "TL") === "TL").reduce((a: number, p: any) => a + Number(p.tutar), 0);
    const eurTotal = allPayments.filter((p: any) => p.currency === "EUR").reduce((a: number, p: any) => a + Number(p.tutar), 0);
    const usdTotal = allPayments.filter((p: any) => p.currency === "USD").reduce((a: number, p: any) => a + Number(p.tutar), 0);
    const paymentSummary = `Toplam: ${allPayments.length} tahsilat | ${tlTotal.toLocaleString("tr-TR")} TL | ${eurTotal.toLocaleString("tr-TR")} EUR | ${usdTotal.toLocaleString("tr-TR")} USD`;

    // System prompt
    const systemPrompt = buildSystemPrompt(userName, userRole, fileList, staffSummary, paymentSummary);

    // OpenAI'ya gönder
    const openaiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizedMessages.slice(-20),
    ];

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenAI API hatası:", JSON.stringify(err));
      return NextResponse.json(
        { error: err?.error?.message || `OpenAI API hatası (${response.status})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "Yanıt alınamadı.";

    // Yanıttaki [[DOSYA:id]] referanslarından dosya bilgilerini çıkar
    const fileRefs: string[] = [];
    const fileRegex = /\[\[DOSYA:([a-f0-9-]+)\]\]/gi;
    let match;
    while ((match = fileRegex.exec(aiMessage)) !== null) {
      fileRefs.push(match[1]);
    }

    // Referans edilen dosyaları bul
    const referencedFiles = fileRefs.length > 0
      ? allFiles
          .filter((f: any) => fileRefs.includes(f.id))
          .map((f: any) => ({
            id: f.id,
            musteri_ad: f.musteri_ad,
            hedef_ulke: f.hedef_ulke,
            durum: getFileStatus(f),
            randevu_tarihi: f.randevu_tarihi || null,
            odeme_durumu: f.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi",
            ucret: f.ucret,
            ucret_currency: f.ucret_currency || "TL",
            staff_name: userRole === "admin" ? f.profiles?.name : undefined,
          }))
      : [];

    // [[DOSYA:id]] etiketlerini temizle
    const cleanContent = aiMessage.replace(/\s*\[\[DOSYA:[a-f0-9-]+\]\]/gi, "").trim();

    // [[MESAJ_GONDER]] kontrolü
    const hasMessageIntent = aiMessage.includes("[[MESAJ_GONDER]]");
    const finalContent = cleanContent.replace(/\s*\[\[MESAJ_GONDER\]\]/gi, "").trim();

    return NextResponse.json({
      content: finalContent,
      files: referencedFiles,
      messageIntent: hasMessageIntent,
      usage: data.usage,
    });
  } catch (err: any) {
    console.error("AI Chat hatası:", err);
    return NextResponse.json(
      { error: err?.message || "AI servisi hatası" },
      { status: 500 }
    );
  }
}
