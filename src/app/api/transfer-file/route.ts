import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit, validateOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`transfer-file:${clientIp}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const fileId = body?.fileId as string | undefined;
    const newAssigneeId = body?.newAssigneeId as string | undefined;

    if (!fileId || typeof fileId !== "string") {
      return NextResponse.json({ error: "Geçersiz dosya ID." }, { status: 400 });
    }
    if (!newAssigneeId || typeof newAssigneeId !== "string") {
      return NextResponse.json({ error: "Geçersiz personel ID." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("transfer-file: Supabase yapılandırması eksik");
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id, role, organization_id, name")
      .eq("id", user.id)
      .maybeSingle();

    if (meError || !me) {
      console.error("transfer-file: profil bulunamadı", meError?.message);
      return NextResponse.json({ error: "Profil bulunamadı." }, { status: 403 });
    }

    if (me.role !== "admin") {
      return NextResponse.json(
        { error: "Sadece genel müdür dosya ataması yapabilir." },
        { status: 403 }
      );
    }

    if (!me.organization_id) {
      return NextResponse.json(
        { error: "Hesabınız bir şirkete bağlı değil. Yöneticiye iletin." },
        { status: 400 }
      );
    }

    const { data: file, error: fileError } = await supabase
      .from("visa_files")
      .select("id, musteri_ad, hedef_ulke, assigned_user_id")
      .eq("id", fileId)
      .maybeSingle();

    if (fileError || !file) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
    }

    const { data: targetStaff, error: targetError } = await supabase
      .from("profiles")
      .select("id, role, organization_id, name")
      .eq("id", newAssigneeId)
      .maybeSingle();

    if (targetError || !targetStaff) {
      return NextResponse.json({ error: "Hedef personel bulunamadı." }, { status: 404 });
    }

    if (targetStaff.organization_id !== me.organization_id) {
      return NextResponse.json(
        { error: "Hedef personel sizin şirketinize bağlı değil." },
        { status: 403 }
      );
    }

    if (file.assigned_user_id) {
      const { data: currentOwner } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", file.assigned_user_id)
        .maybeSingle();

      if (currentOwner && currentOwner.organization_id && currentOwner.organization_id !== me.organization_id) {
        return NextResponse.json(
          { error: "Bu dosya sizin şirketinize ait değil." },
          { status: 403 }
        );
      }
    }

    if (file.assigned_user_id === newAssigneeId) {
      return NextResponse.json(
        { error: "Dosya zaten bu personele atanmış." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("visa_files")
      .update({ assigned_user_id: newAssigneeId })
      .eq("id", fileId);

    if (updateError) {
      console.error("transfer-file: update error", updateError.message);
      return NextResponse.json(
        { error: "Atama veritabanına yazılamadı: " + updateError.message },
        { status: 500 }
      );
    }

    await supabase.from("activity_logs").insert({
      type: "transfer",
      message: `${file.musteri_ad} dosyasını ${targetStaff.name || "personel"} kullanıcısına atadı`,
      file_id: fileId,
      actor_id: user.id,
    });

    return NextResponse.json({
      success: true,
      oldAssigneeId: file.assigned_user_id,
      newAssigneeId,
      newAssigneeName: targetStaff.name || "Personel",
      adminName: me.name || "Yönetici",
      musteriAd: file.musteri_ad,
      hedefUlke: file.hedef_ulke,
    });
  } catch (err: any) {
    console.error("transfer-file: genel hata", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}
