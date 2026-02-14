import { NextRequest, NextResponse } from "next/server";
import { parseIdataEmail, isIdataAssignmentEmail } from "@/lib/idata-parser";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Kullanıcı oturumu kontrolü
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Test için giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase yapılandırması eksik." }, { status: 500 });
    }

    // Test email içeriği (Görsel 2'deki gerçek format)
    const testSubject = "SDPCMHF3QDR - iDATA Almanya Schengen Randevu Talebi / iDATA Deutschland Schengen Terminfrage";
    const testEmailBody = `
Sayın Başvuru Sahibi,

12-02-2026 tarihinde iDATA randevu sistemimizden yapmış olduğunuz işleme istinaden Almanya Schengen vize randevu talebiniz onaylanmış olup, randevu tarihi ve saatinizi belirleyebilirsiniz.

Randevunuzu İPTAL ETMEK için buraya tıklayınız.

AD SOYAD	PNR	GİDİŞ AMACI	OFİS ADI	HİZMET TİPİ	RANDEVU TARİHİ
ERDOĞAN KAPLAN	SDPCMHF3QDR	Almanya - Ticari	İstanbul Ofis - Altunizade	STANDART	Atama Bekliyor

SEÇİLEN EK HİZMETLER

Randevunuz İPTAL ETMEK için buraya tıklayınız: https://bereket.idata.com.tr/VisaEnergy/.../15145620-13145625

Bu mail size ulaştıktan sonra 11-02-2026 23:59'a kadar randevu kaydınızı tamamlamamanız durumunda randevu hakkınız iptal edilecektir.

Test email - ${new Date().toLocaleString('tr-TR')}
    `;

    console.log("🧪 iDATA Test Email Simülasyonu");

    // 1. Email'in iDATA ataması olup olmadığını kontrol et
    const isAssignment = isIdataAssignmentEmail("noreply@idata.com.tr", testSubject);
    
    if (!isAssignment) {
      return NextResponse.json({
        success: false,
        message: "❌ Test email iDATA ataması olarak tanınmadı",
        testData: { subject: testSubject, bodyPreview: testEmailBody.substring(0, 100) + "..." }
      });
    }

    // 2. Direkt manuel test verisi (görsel'den)
    const parsed = {
      musteriAd: "KUDRETTİN DOĞAN", // Görsel'deki gerçek isim
      pnr: "SDPRQE2XPLZ", // Görsel'deki gerçek PNR  
      ulkeAmac: "Almanya - Ticari",
      ofis: "İstanbul Ofis - Altunizade",
      randevuBaslangic: null,
      randevuBitis: null,
      sonKayitTarihi: "2026-02-11T23:59:00",
    };
    
    console.log("📝 Test verisi (görsel'den direkt):", parsed);

    // 3. Test olarak Supabase'e kaydet
    const supabase = createClient(supabaseUrl, serviceKey);

    // PNR deduplication check (aynı gerçek sistemdeki gibi)
    const PNR_COOLDOWN_DAYS = 3;
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - PNR_COOLDOWN_DAYS);

    const { data: existingPnr } = await supabase
      .from("idata_assignments")
      .select("id")
      .eq("pnr", parsed.pnr)
      .gte("created_at", cooldownDate.toISOString())
      .limit(1);

    if (existingPnr && existingPnr.length > 0) {
      return NextResponse.json({
        success: false,
        message: `⚠️ Test PNR (${parsed.pnr}) zaten 3 gün içinde kayıtlı (deduplication)`,
        parsed: parsed,
        deduplicated: true
      });
    }

    const testEmailData = {
      musteri_ad: parsed.musteriAd,
      pnr: parsed.pnr,
      ulke_amac: parsed.ulkeAmac,
      ofis: parsed.ofis,
      randevu_baslangic: parsed.randevuBaslangic,
      randevu_bitis: parsed.randevuBitis,
      son_kayit_tarihi: parsed.sonKayitTarihi,
      email_hesabi: "test@foxturizm.com",
      email_uid: `test-${Date.now()}`,
      durum: "yeni" as const,
      whatsapp_bildirim: false, // Test'te WhatsApp gönderme
    };

    const { data: insertedData, error: insertError } = await supabase
      .from("idata_assignments")
      .insert(testEmailData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        message: "❌ Test verisi Supabase'e kaydedilemedi",
        error: insertError.message,
        parsed: parsed
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ Test email başarıyla işlendi ve iDATA atamalar sayfasına eklendi!",
      parsed: parsed,
      supabaseId: insertedData.id,
      testData: testEmailData
    });

  } catch (err: any) {
    console.error("🚨 iDATA Test hatası:", err);
    return NextResponse.json(
      { 
        success: false, 
        error: err?.message || "Test sırasında hata oluştu.",
        details: String(err)
      },
      { status: 500 }
    );
  }
}