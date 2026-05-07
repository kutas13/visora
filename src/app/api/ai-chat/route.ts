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
  orgName: string,
  fileList: string,
  staffSummary: string,
  paymentSummary: string,
  customerSummary: string,
  appointmentSummary: string,
  cariSummary: string,
): string {
  const today = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const roleLabel = userRole === "admin" ? "Genel Müdür (Admin)" : "Personel";

  return `Sen "Visora AI" adında, Visora vize operasyon platformunun yapay zeka asistanısın.
Bugünün tarihi: ${today}.
Şirket: ${orgName}.

Şu an **${userName}** ile konuşuyorsun. Rolü: ${roleLabel}${userRole === "admin" ? " - TÜM dosyaları ve verileri görebilir" : " - SADECE kendi dosyalarını görebilir"}.

GÖREV:
- ${userName}'a vize dosyaları, müşteriler, randevular, ödemeler, cari hesaplar ve tüm operasyon konusunda yardımcı ol.
- Türkçe konuş, samimi ve profesyonel ol. Kısa ve öz cevap ver.
- Platform hakkında "nasıl yapılır" soruları sorulduğunda aşağıdaki KULLANIM REHBERİ bölümünden yararlanarak adım adım açıkla.

DİLEKÇE AI YÖNLENDİRME:
- Kullanıcı "dilekçe yaz", "dilekçe oluştur", "petition", "cover letter", "mektup yaz", "niyet mektubu" gibi dilekçe ile ilgili bir şey sorduğunda:
  Şu şekilde yanıt ver: "Dilekçe oluşturmak için **Dilekçe AI** modülümüzü kullanabilirsiniz! 📄 Üst menüdeki **Dilekçe AI** linkine tıklayarak müşterinizi seçin, başvuru detaylarını girin ve AI otomatik olarak hem Türkçe hem İngilizce profesyonel dilekçe oluştursun. [[DILEKCE_AI]]"
- [[DILEKCE_AI]] etiketi frontend tarafından Dilekçe AI sayfasına link butonuna dönüştürülecek.

PLATFORM ÖZELLİKLERİ:
- Dilekçe AI: Üst menüdeki "Dilekçe AI" linki ile erişilir. Müşteri arayıp seçebilir, başvuru kategorisi (Ticari, Turistik, Aile Ziyareti, Arkadaş Ziyareti, Eğitim) belirleyip, detayları girip AI ile otomatik Türkçe+İngilizce dilekçe oluşturabilirsiniz.
- Nasıl Kullanılır: Üst menüdeki "Nasıl Kullanılır?" linkinden platforma ait tüm kullanım rehberine ulaşabilirsiniz.
- Referanslarımız: Ana sayfada platformu kullanan firmaların logoları dönüyor.

ÇOK ÖNEMLİ - DOSYA GÖSTERME KURALLARI:
1. Kullanıcı dosyalar hakkında soru sorduğunda UZUN AÇIKLAMA YAZMA.
2. Sadece kısa bir başlık/özet yaz, sonra ilgili dosyaların ID'lerini [[DOSYA:uuid]] formatında ekle.
3. Frontend bu ID'leri otomatik olarak müşteri adı, ülke, randevu tarihi, kalan gün ve "Detay Gör" butonu içeren kartlara dönüştürür.
4. ASLA müşterinin randevu tarihi, ülkesi, ödeme durumu gibi detayları metin olarak yazma - bunlar kartta zaten gösterilecek.
5. Örnek doğru yanıt: "📅 3 yaklaşan randevunuz var:\\n\\n[[DOSYA:abc-123]] [[DOSYA:def-456]] [[DOSYA:ghi-789]]"
6. ${userRole !== "admin" ? `SADECE ${userName}'ın dosyalarını göster. Başka personellerin dosyalarını ASLA paylaşma.` : "Tüm personellerin dosyalarını görebilirsin."}
7. Birden fazla dosya varsa her [[DOSYA:id]] etiketini ayrı satıra koy.
8. Genel sohbet, istatistik ve "nasıl yapılır" sorularında normal metin yanıt ver.

MESAJLAŞMA:
- Kullanıcı "mesaj gönder", "mesaj at", "mesaj yaz" gibi isteklerde [[MESAJ_GONDER]] etiketi ekle.

${userRole === "admin" ? `ADMİN YETKİLERİ:
- Tüm personellerin dosyalarını görebilirsin.
- Personel karşılaştırması ve performans analizi yapabilirsin.
- Finansal özet ve gelir raporları verebilirsin.
- Müşteri ve cari hesap bilgilerine tam erişimin var.` : `PERSONEL YETKİLERİ:
- Sadece ${userName}'ın kendi dosyalarını göster.
- Diğer personellerin dosyalarını ASLA paylaşma.`}

===== KULLANIM REHBERİ (NASIL YAPILIR?) =====
${userRole === "admin" ? `
**Genel Müdür Rehberi:**

1. **İlk Giriş:** Platform sahibinden aldığınız e-posta ve geçici şifre ile giriş yapın. İlk girişte yeni şifre oluşturmanız istenir.

2. **Ana Sayfa:** Giriş yaptığınızda kontrol panelinden aktif dosya sayısı, günün randevuları, ödenmemiş dosyalar ve toplam geliri görebilirsiniz.

3. **Personel Ekleme:** Yönetim > Personel sayfasına gidin, "Yeni Personel Ekle" butonuna tıklayın. Ad, e-posta ve geçici şifre belirleyin. Her şirkette en fazla 3 personel hesabı oluşturabilirsiniz.

4. **Yeni Dosya Oluşturma:** Operasyon > Yeni Dosya sayfasına gidin. Müşterinin ad-soyad, telefon, pasaport numarası, hedef ülke ve vize tipini girin. Ücret ve ödeme planını (peşin/cari) seçin.

5. **Dosya Yönetimi:** Operasyon > Vize Dosyaları sayfasından tüm dosyaları yönetin. Durum takibi yapın: evrak bekleniyor, işlemde, randevu alındı veya sonuçlandı.

6. **Müşteriler:** Operasyon > Müşteriler sayfasından müşteri kartlarını görüntüleyin. Her müşterinin geçmiş dosyaları ve ödeme durumlarını inceleyin.

7. **Randevular:** Randevu Alınacak sayfasından bekleyen talepleri yönetin. Takvim sayfasından günlük/haftalık/aylık görünümde takip edin.

8. **Finans:** Kasa sayfasından tüm tahsilat hareketlerini takip edin. Banka Hesapları sayfasından hesaplarınızı yönetin. Ödemeler sayfasından tahsilat kayıtlarını listeleyin. Cari Hesap sayfasından borç/alacak durumunu kontrol edin.

9. **Raporlar:** Raporlar sayfasından performans ve operasyon verilerini inceleyin. Aylık Özet sayfasından PDF rapor indirin.

10. **Yönetim:** Personel sayfasından ekibinizi yönetin. Gruplar sayfasından müşterileri gruplandırın. Sistem Logları sayfasından tüm işlem kayıtlarını görün.

11. **Bildirimler:** Sağ üstteki zil simgesinden randevu hatırlatmaları ve uyarıları görün.

12. **AI Asistan:** Sağ üstteki AI simgesinden Visora AI'ı açın ve sorularınıza cevap alın.
` : `
**Personel Rehberi:**

1. **İlk Giriş:** Genel müdürünüzden aldığınız e-posta ve geçici şifre ile giriş yapın. İlk girişte kendi şifrenizi oluşturmanız istenir.

2. **Ana Sayfa:** Size atanan dosyaların özeti ve kişisel performansınız burada görünür. Haftalık istatistiklerinizi takip edin.

3. **Dosya Oluşturma:** Operasyon > Yeni Dosya sayfasından yeni vize dosyası oluşturun. Müşteri bilgileri, hedef ülke, vize tipi ve ücret bilgilerini girin.

4. **Dosyalarım:** Operasyon > Vize Dosyaları sayfasından size atanmış dosyaları görüntüleyin. Tahsilat ekleyin veya durumu güncelleyin.

5. **Müşterilerim:** Operasyon > Müşteriler sayfasından size bağlı müşterilerin kartlarını ve geçmişlerini inceleyin.

6. **Randevular:** Randevu Alınacak sayfasından bekleyen talepleri görün. Takvim sayfasından randevularınızı takip edin.

7. **Finans:** Ödemeler sayfasından tahsilat kayıtlarınızı görün. Cari Hesabım sayfasından borç/alacak durumunuzu takip edin.

8. **Raporlar:** Raporlarım sayfasından kişisel performans istatistiklerinizi görün.

9. **Bildirimler:** Sağ üstteki zil simgesinden hatırlatma ve uyarıları görün.

10. **AI Asistan:** Sağ üstteki AI simgesinden Visora AI'ı açın ve sorularınıza cevap alın.
`}
========================================

===== ${userName.toUpperCase()}'${userRole === "admin" ? "UN TÜM" : "IN"} VİZE DOSYALARI =====
${fileList || "Dosya bulunamadı."}

💰 ÖDEME ÖZETİ:
${paymentSummary}

👥 MÜŞTERİ ÖZETİ:
${customerSummary || "Müşteri bilgisi yok."}

📅 RANDEVU ÖZETİ:
${appointmentSummary || "Yaklaşan randevu yok."}

💳 CARİ HESAP ÖZETİ:
${cariSummary || "Cari bilgisi yok."}

${userRole === "admin" && staffSummary ? `👥 PERSONEL ÖZETİ:\n${staffSummary}` : ""}
===========================`;
}

export async function POST(request: NextRequest) {
  try {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role, organization_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const userName = profile.name;
    const userRole = profile.role;
    const orgId = profile.organization_id;

    let orgName = "Bilinmiyor";
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single();
      if (org) orgName = org.name;
    }

    // ===== VİZE DOSYALARI =====
    let filesQuery = supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)");

    if (userRole === "admin" && orgId) {
      filesQuery = filesQuery.eq("organization_id", orgId);
    } else if (userRole !== "admin") {
      filesQuery = filesQuery.eq("assigned_user_id", userId);
    }

    const { data: files } = await filesQuery;
    const allFiles = files || [];

    // ===== ÖDEMELER =====
    let paymentsQuery = supabase.from("payments").select("*").eq("durum", "odendi");
    if (userRole === "admin" && orgId) {
      paymentsQuery = paymentsQuery.eq("organization_id", orgId);
    } else if (userRole !== "admin") {
      paymentsQuery = paymentsQuery.eq("created_by", userId);
    }
    const { data: payments } = await paymentsQuery;
    const allPayments = payments || [];

    // ===== DETAYLI DOSYA LİSTESİ =====
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
      const tel = f.musteri_telefon ? ` | Tel: ${f.musteri_telefon}` : "";

      return `- ID:${f.id} | ${f.musteri_ad} | ${f.hedef_ulke} | Durum: ${status} | Ödeme: ${odeme} (${ucret}) | Randevu: ${randevu} | Evrak: ${evrak}${tel}${userRole === "admin" ? ` | Personel: ${staff}` : ""}${arsiv}`;
    }).join("\n");

    // ===== PERSONEL ÖZETİ (admin) =====
    let staffSummary = "";
    if (userRole === "admin") {
      let staffQuery = supabase
        .from("profiles")
        .select("id, name, role")
        .eq("role", "staff");
      if (orgId) staffQuery = staffQuery.eq("organization_id", orgId);
      const { data: staffList } = await staffQuery;

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

    // ===== ÖDEME ÖZETİ =====
    const tlTotal = allPayments.filter((p: any) => (p.currency || "TL") === "TL").reduce((a: number, p: any) => a + Number(p.tutar), 0);
    const eurTotal = allPayments.filter((p: any) => p.currency === "EUR").reduce((a: number, p: any) => a + Number(p.tutar), 0);
    const usdTotal = allPayments.filter((p: any) => p.currency === "USD").reduce((a: number, p: any) => a + Number(p.tutar), 0);
    const paymentSummary = `Toplam: ${allPayments.length} tahsilat | ${tlTotal.toLocaleString("tr-TR")} TL | ${eurTotal.toLocaleString("tr-TR")} EUR | ${usdTotal.toLocaleString("tr-TR")} USD`;

    // ===== MÜŞTERİ ÖZETİ =====
    const customerMap = new Map<string, { ad: string; telefon: string | null; dosyaSayisi: number; sonOnay: number; sonRed: number }>();
    for (const f of allFiles as any[]) {
      const key = (f.pasaport_no || "").toUpperCase();
      if (!key) continue;
      const c = customerMap.get(key);
      if (c) {
        c.dosyaSayisi++;
        if (f.sonuc === "vize_onay") c.sonOnay++;
        if (f.sonuc === "red") c.sonRed++;
        if (f.musteri_telefon) c.telefon = f.musteri_telefon;
      } else {
        customerMap.set(key, {
          ad: f.musteri_ad,
          telefon: f.musteri_telefon,
          dosyaSayisi: 1,
          sonOnay: f.sonuc === "vize_onay" ? 1 : 0,
          sonRed: f.sonuc === "red" ? 1 : 0,
        });
      }
    }
    const customerSummary = `Toplam ${customerMap.size} benzersiz müşteri.\n` +
      Array.from(customerMap.entries())
        .slice(0, 50)
        .map(([pp, c]) => `- ${c.ad} (${pp})${c.telefon ? ` Tel:${c.telefon}` : ""} | ${c.dosyaSayisi} dosya, ${c.sonOnay} onay, ${c.sonRed} red`)
        .join("\n");

    // ===== RANDEVU ÖZETİ =====
    const nowMs = Date.now();
    const upcoming = (allFiles as any[])
      .filter((f) => f.randevu_tarihi && !f.sonuc && new Date(f.randevu_tarihi).getTime() > nowMs - 86400000)
      .sort((a, b) => new Date(a.randevu_tarihi).getTime() - new Date(b.randevu_tarihi).getTime())
      .slice(0, 20);

    const appointmentSummary = upcoming.length === 0
      ? "Yaklaşan randevu bulunmuyor."
      : `${upcoming.length} yaklaşan randevu:\n` +
        upcoming.map((f: any) => {
          const d = new Date(f.randevu_tarihi);
          const diff = Math.ceil((d.getTime() - nowMs) / 86400000);
          const diffLabel = diff <= 0 ? "BUGÜN" : diff === 1 ? "YARIN" : `${diff} gün sonra`;
          return `- ${f.musteri_ad} → ${f.hedef_ulke} | ${d.toLocaleDateString("tr-TR")} (${diffLabel})`;
        }).join("\n");

    // ===== CARİ HESAP ÖZETİ =====
    const odenmemis = (allFiles as any[]).filter((f) => f.odeme_durumu === "odenmedi" && !f.sonuc && !f.arsiv_mi);
    const cariToplam = new Map<string, number>();
    for (const f of odenmemis) {
      const cur = f.ucret_currency || "TL";
      cariToplam.set(cur, (cariToplam.get(cur) || 0) + Number(f.ucret || 0));
    }
    const cariSummary = odenmemis.length === 0
      ? "Ödenmemiş dosya bulunmuyor."
      : `${odenmemis.length} ödenmemiş dosya. Toplam: ${Array.from(cariToplam.entries()).map(([c, a]) => `${a.toLocaleString("tr-TR")} ${c}`).join(" + ")}`;

    // ===== SYSTEM PROMPT =====
    const systemPrompt = buildSystemPrompt(
      userName,
      userRole,
      orgName,
      fileList,
      staffSummary,
      paymentSummary,
      customerSummary,
      appointmentSummary,
      cariSummary,
    );

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
        max_tokens: 2000,
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

    const fileRefs: string[] = [];
    const fileRegex = /\[\[DOSYA:([a-f0-9-]+)\]\]/gi;
    let match;
    while ((match = fileRegex.exec(aiMessage)) !== null) {
      fileRefs.push(match[1]);
    }

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

    const cleanContent = aiMessage.replace(/\s*\[\[DOSYA:[a-f0-9-]+\]\]/gi, "").trim();

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
