import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { STAFF_USERS, ADMIN_USER } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Origin ve rate limit kontrolü
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`whatsapp-remind:${clientIp}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla hatırlatma isteği." }, { status: 429 });
    }

    // Kullanıcı oturumu kontrolü
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { type, recipients } = body as { type: "randevu" | "vize_bitis" | "vize_bitis_customers"; recipients?: string[] };

    if (!type || !["randevu", "vize_bitis", "vize_bitis_customers"].includes(type)) {
      return NextResponse.json({ error: "Geçerli tip belirtiniz." }, { status: 400 });
    }

    // Alıcı listesi (müşteri mesajı için değil, sadece randevu/vize_bitis için)
    const targetNumbers = recipients && recipients.length > 0 ? recipients : [whatsappTo];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const whatsappTo = process.env.WHATSAPP_NOTIFY_NUMBER;

    console.log("Environment check:", { 
      supabaseUrl: !!supabaseUrl, 
      serviceKey: !!serviceKey, 
      whatsappTo: !!whatsappTo 
    });

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase yapılandırması eksik." }, { status: 500 });
    }

    if (!whatsappTo) {
      return NextResponse.json({ 
        error: "WHATSAPP_NOTIFY_NUMBER tanımlı değil.",
        hint: "Vercel environment variables'da WHATSAPP_NOTIFY_NUMBER ekleyin."
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    let targetFiles: any[] = [];
    let messageText = "";

    if (type === "randevu") {
      // Gelecek 3 günün randevularını bul (bugün dahil)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      const { data } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .eq("islem_tipi", "randevulu")
        .not("randevu_tarihi", "is", null)
        .eq("arsiv_mi", false)
        .gte("randevu_tarihi", today.toISOString())
        .lt("randevu_tarihi", threeDaysLater.toISOString())
        .order("randevu_tarihi", { ascending: true });

      targetFiles = data || [];

      messageText = `🗓️ YAKLAŞAN RANDEVULAR (3 GÜN)\n\n`;
      if (targetFiles.length === 0) {
        messageText += "📅 Gelecek 3 günde randevu bulunmuyor.\n";
      } else {
        messageText += `📊 Toplam ${targetFiles.length} randevu:\n\n`;
        
        targetFiles.forEach((file, index) => {
          const randevuTarihi = new Date(file.randevu_tarihi);
          const tarihSaat = randevuTarihi.toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
          
          messageText += `${index + 1}. ${file.musteri_ad}\n`;
          messageText += `   📅 ${tarihSaat}\n`;
          messageText += `   🌍 ${file.hedef_ulke}\n`;
          messageText += `   👤 ${file.profiles?.name || "?"}\n\n`;
        });
      }
      messageText += `📱 Fox Turizm Vize Sistemi`;

    } else if (type === "vize_bitis_customers") {
      // Müşterilere direkt vize bitiş mesajı (60 gün kala)
      const today = new Date();
      const sixtyDaysLater = new Date();
      sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);

      const { data, error: queryError } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .not("vize_bitis_tarihi", "is", null)
        .eq("sonuc", "vize_onay")
        .eq("arsiv_mi", false)
        .gte("vize_bitis_tarihi", today.toISOString())
        .lte("vize_bitis_tarihi", sixtyDaysLater.toISOString())
        .order("vize_bitis_tarihi", { ascending: true });

      if (queryError) {
        console.error("Müşteri sorgu hatası:", queryError);
        return NextResponse.json({ error: "Müşteri verileri alınamadı." }, { status: 500 });
      }

      // Telefon numarası olan müşterileri filtrele
      const customersWithPhone = (data || []).filter(f => f.musteri_telefon && f.musteri_telefon.length >= 10);
      console.log(`Toplam vize bitiş: ${data?.length || 0}, telefon numarası olan: ${customersWithPhone.length}`);
      
      // Her müşteriye kendi bilgisiyle mesaj gönder (5 günde bir limit)
      let sentCount = 0;
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      for (const file of customersWithPhone) {
        // 5 gün içinde bu müşteriye mesaj gönderilmiş mi kontrol et (tablo yoksa skip)
        let skipThisCustomer = false;
        try {
          const { data: recentMessages } = await supabase
            .from("whatsapp_messages")
            .select("id")
            .eq("file_id", file.id)
            .eq("message_type", "vize_bitis")
            .gte("sent_at", fiveDaysAgo.toISOString())
            .limit(1);

          if (recentMessages && recentMessages.length > 0) {
            console.log(`Müşteriye 5 gün içinde mesaj gönderilmiş, atlanıyor: ${file.musteri_ad}`);
            skipThisCustomer = true;
          }
        } catch (trackingErr) {
          console.log("Tracking tablosu yok, spam koruması atlanıyor:", (trackingErr as any).message);
        }

        if (skipThisCustomer) continue;

        const bitisDate = new Date(file.vize_bitis_tarihi!);
        const kalanGun = Math.ceil((bitisDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const personelName = file.profiles?.name || "Fox Turizm";
        
        // Personel bilgilerini bul (hitap + telefon)
        const allUsers = [...STAFF_USERS, ADMIN_USER];
        const personelInfo = allUsers.find(u => u.name === personelName);
        const personelHitap = personelInfo?.hitap || personelName;
        const personelTelefon = personelInfo?.phone || "0212 xxx xx xx";
        
        const personalMessage = `🇹🇷 Sayın ${file.musteri_ad},

${file.hedef_ulke} vizenizin süresi ${kalanGun} gün sonra (${bitisDate.toLocaleDateString("tr-TR")}) tarihinde sona erecek.

Vizenizin süresinin dolmaması için yenileme işlemlerinizi en kısa sürede başlatmanızı öneriyoruz.

Detaylı bilgi ve randevu için bizimle iletişime geçebilirsiniz:

📞 ${personelHitap}
☎️ ${personelTelefon}

🏢 Fox Turizm Vize Hizmetleri
💼 Profesyonel vize danışmanlığı`;

        // Telefon numarasını WhatsApp formatına çevir (+90 ile başlamalı)
        const whatsappPhone = file.musteri_telefon.startsWith("90") 
          ? "+" + file.musteri_telefon 
          : file.musteri_telefon.startsWith("+") 
            ? file.musteri_telefon 
            : "+90" + file.musteri_telefon;

        console.log(`📱 Müşteri: ${file.musteri_ad}`);
        console.log(`📞 Telefon: ${file.musteri_telefon} → ${whatsappPhone}`);
        console.log(`👤 Personel: ${personelName} (${personelTelefon})`);
        console.log(`⏱ Vize bitiş: ${kalanGun} gün kala`);

        try {
          const wpRes = await fetch(`${serviceUrl}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: whatsappPhone,
              message: personalMessage,
            }),
            signal: AbortSignal.timeout(15000),
          });

          const wpResult = await wpRes.json().catch(() => ({}));
          console.log(`WhatsApp cevabı ${file.musteri_ad}:`, { status: wpRes.status, data: wpResult });

          if (wpRes.ok) {
            sentCount++;
            console.log(`✅ Mesaj başarılı: ${file.musteri_ad}`);
            
            // Mesaj gönderim kaydını tut (spam koruması için) - tablo yoksa ignore
            try {
              await supabase.from("whatsapp_messages").insert({
                file_id: file.id,
                phone_number: file.musteri_telefon,
                message_type: "vize_bitis",
                message_content: personalMessage.substring(0, 500),
                sent_at: new Date().toISOString(),
              });
              console.log(`Mesaj kaydı oluşturuldu: ${file.musteri_ad}`);
            } catch (logErr) {
              console.log("WhatsApp tracking tablosu yok, log atlanıyor:", (logErr as any).message);
            }
          } else {
            console.error(`❌ Mesaj başarısız ${file.musteri_ad}:`, wpResult);
          }
        } catch (err: any) {
          console.error(`Müşteri ${file.musteri_ad} bağlantı hatası:`, err.message);
        }
      }

      return NextResponse.json({ 
        success: true, 
        count: customersWithPhone.length,
        sentTo: sentCount
      });

    } else if (type === "vize_bitis") {
      // 30 gün içinde vize süresi dolacakların listesi
      const today = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      const { data } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .not("vize_bitis_tarihi", "is", null)
        .eq("arsiv_mi", false)
        .gte("vize_bitis_tarihi", today.toISOString())
        .lte("vize_bitis_tarihi", thirtyDaysLater.toISOString())
        .order("vize_bitis_tarihi", { ascending: true });

      targetFiles = data || [];

      messageText = `⚠️ VİZE BİTİŞ HATIRLATMASI\n\n`;
      if (targetFiles.length === 0) {
        messageText += "✅ 30 gün içinde vize süresi dolacak müşteri yok.\n";
      } else {
        messageText += `📊 ${targetFiles.length} müşterinin vize süresi 30 gün içinde dolacak:\n\n`;
        targetFiles.forEach((file, index) => {
          const bitisTarihi = new Date(file.vize_bitis_tarihi).toLocaleDateString("tr-TR");
          const kalanGun = Math.ceil((new Date(file.vize_bitis_tarihi).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          messageText += `${index + 1}. ${file.musteri_ad}\n`;
          messageText += `   📅 Bitiş: ${bitisTarihi} (${kalanGun} gün kaldı)\n`;
          messageText += `   🌍 ${file.hedef_ulke}\n`;
          messageText += `   👤 ${file.profiles?.name || "?"}\n\n`;
        });
      }
      messageText += `📱 Fox Turizm Vize Sistemi`;
    }

    // WhatsApp mesajını çoklu alıcıya gönder
    console.log("WhatsApp mesajı gönderiliyor:", { recipients: targetNumbers, messageLength: messageText.length });
    
    let successCount = 0;
    let errors: string[] = [];
    
    try {
      // Önce bağlantı kontrol et
      const statusRes = await fetch(`${serviceUrl}/status`, { signal: AbortSignal.timeout(3000) });
      const statusData = await statusRes.json().catch(() => ({}));

      if (!statusData.connected) {
        return NextResponse.json({ 
          error: "WhatsApp servisi bağlı değil.", 
          hint: "QR kodu tarayın veya whatsapp-service'i yeniden başlatın."
        }, { status: 503 });
      }

      // Her alıcıya mesaj gönder
      for (const phoneNumber of targetNumbers) {
        if (!phoneNumber || phoneNumber === "all") continue;
        
        try {
          const wpRes = await fetch(`${serviceUrl}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: phoneNumber,
              message: messageText,
            }),
            signal: AbortSignal.timeout(15000),
          });

          const wpData = await wpRes.json().catch(() => ({}));
          
          if (wpRes.ok) {
            successCount++;
            console.log(`✅ Mesaj gönderildi: ${phoneNumber}`);
          } else {
            errors.push(`${phoneNumber}: ${wpData.error || "Hata"}`);
            console.error(`❌ Mesaj gönderilemedi: ${phoneNumber}`, wpData);
          }
        } catch (singleErr: any) {
          errors.push(`${phoneNumber}: ${singleErr.message}`);
        }
      }

      if (successCount > 0) {
        return NextResponse.json({ 
          success: true, 
          count: targetFiles.length,
          sentTo: successCount,
          errors: errors.length > 0 ? errors : undefined
        });
      } else {
        return NextResponse.json({ 
          error: "Hiçbir numaraya gönderilemedi.",
          details: errors
        }, { status: 500 });
      }

    } catch (wpErr: any) {
      console.error("WhatsApp servisi bağlantı hatası:", wpErr);
      return NextResponse.json({ 
        error: "WhatsApp servisi ile bağlantı kurulamadı.",
        hint: "whatsapp-service klasöründe 'node index.js' ile başlatın.",
        details: wpErr.message 
      }, { status: 503 });
    }

  } catch (err: any) {
    console.error("WhatsApp hatırlatma hatası:", err);
    return NextResponse.json({ error: err?.message || "Sunucu hatası." }, { status: 500 });
  }
}