import { NextRequest, NextResponse } from "next/server";
import { parseIdataEmail, isIdataAssignmentEmail } from "@/lib/idata-parser";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Kullanıcı oturumu kontrolü (sadece giriş yapmış kullanıcılar test edebilsin)
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Test için giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await request.json();
    const { testEmail, testSubject } = body;

    if (!testEmail || !testSubject) {
      return NextResponse.json({ error: "testEmail ve testSubject gerekli." }, { status: 400 });
    }

    console.log("🧪 iDATA Parser Test:");
    console.log("Subject:", testSubject);
    console.log("Body:", testEmail.substring(0, 200) + "...");

    // 1. Email'in iDATA ataması olup olmadığını kontrol et
    const isAssignment = isIdataAssignmentEmail("noreply@idata.com.tr", testSubject);
    console.log("📧 Is iDATA assignment email:", isAssignment);

    if (!isAssignment) {
      return NextResponse.json({
        success: false,
        message: "Bu email iDATA randevu ataması olarak tanınmadı.",
        isAssignment: false,
      });
    }

    // 2. Email içeriğini parse et
    const parsed = parseIdataEmail(testEmail, testSubject);
    console.log("📝 Parsed result:", parsed);

    if (!parsed) {
      return NextResponse.json({
        success: false,
        message: "Email içeriği parse edilemedi. PNR bulunamadı.",
        isAssignment: true,
        parsed: null,
      });
    }

    // 3. Test amaçlı Supabase'e kaydet (gerçek uid yerine test uid)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      const testEmailData = {
        musteri_ad: parsed.musteriAd,
        pnr: parsed.pnr,
        ulke_amac: parsed.ulkeAmac,
        ofis: parsed.ofis,
        randevu_baslangic: parsed.randevuBaslangic,
        randevu_bitis: parsed.randevuBitis,
        son_kayit_tarihi: parsed.sonKayitTarihi,
        email_hesabi: "test@test.com", // Test email hesabı
        email_uid: `test-${Date.now()}`, // Test UID
        durum: "yeni" as const,
        whatsapp_bildirim: false, // Test'te WhatsApp gönderme
      };

      const { data: insertedData, error: insertError } = await supabase
        .from("idata_assignments")
        .insert(testEmailData)
        .select()
        .single();

      if (insertError) {
        console.error("❌ Test verisi Supabase'e kaydedilemedi:", insertError.message);
        return NextResponse.json({
          success: true,
          message: "Parse başarılı ama test verisi kaydedilemedi.",
          isAssignment: true,
          parsed: parsed,
          supabaseError: insertError.message,
        });
      }

      console.log("✅ Test verisi Supabase'e kaydedildi:", insertedData.id);

      return NextResponse.json({
        success: true,
        message: "Email başarıyla parse edildi ve test olarak kaydedildi!",
        isAssignment: true,
        parsed: parsed,
        supabaseId: insertedData.id,
      });
    } else {
      return NextResponse.json({
        success: true,
        message: "Parse başarılı ama Supabase yapılandırması eksik.",
        isAssignment: true,
        parsed: parsed,
      });
    }
  } catch (err: any) {
    console.error("🚨 Test hatası:", err);
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