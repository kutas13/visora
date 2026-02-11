import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit, validateOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Origin kontrolü (CSRF koruması)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    // Rate limit: dakikada max 20 silme isteği (IP bazlı)
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`delete-file:${clientIp}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Çok fazla silme isteği gönderdiniz. Lütfen biraz bekleyin." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const fileId = body?.fileId as string | undefined;

    if (!fileId || typeof fileId !== "string") {
      return NextResponse.json({ error: "Geçersiz dosya ID." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("delete-visa-file: Supabase yapılandırması eksik");
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    // Oturumdaki kullanıcıyı bul (anon key ile, RLS açık)
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    // Service role ile tam yetkili client
    const supabase = createClient(supabaseUrl, serviceKey);

    // Kullanıcı profilini al (rol kontrolü için)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("delete-visa-file: profil bulunamadı veya hata:", profileError?.message);
      return NextResponse.json({ error: "Profil bulunamadı." }, { status: 403 });
    }

    const role = profile.role as "admin" | "staff";

    // Staff ise sadece kendi dosyasını silebilsin
    if (role !== "admin") {
      const { data: fileOwner, error: ownerError } = await supabase
        .from("visa_files")
        .select("assigned_user_id")
        .eq("id", fileId)
        .single();

      if (ownerError || !fileOwner) {
        return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
      }

      if (fileOwner.assigned_user_id !== user.id) {
        return NextResponse.json(
          { error: "Bu dosyayı silme yetkiniz yok." },
          { status: 403 }
        );
      }
    }

    // İlgili tüm kayıtları sil
    // payments
    const { error: payErr } = await supabase.from("payments").delete().eq("file_id", fileId);
    if (payErr) {
      console.error("delete-visa-file: payments silme hatası:", payErr.message);
    }

    // activity_logs
    const { error: logErr } = await supabase.from("activity_logs").delete().eq("file_id", fileId);
    if (logErr) {
      console.error("delete-visa-file: activity_logs silme hatası:", logErr.message);
    }

    // notifications
    const { error: notifErr } = await supabase.from("notifications").delete().eq("file_id", fileId);
    if (notifErr) {
      console.error("delete-visa-file: notifications silme hatası:", notifErr.message);
    }

    // visa_group_members
    const { error: gmErr } = await supabase
      .from("visa_group_members")
      .delete()
      .eq("visa_file_id", fileId);
    if (gmErr) {
      console.error("delete-visa-file: group_members silme hatası:", gmErr.message);
    }

    // Son olarak dosyayı sil
    const { error: fileErr } = await supabase.from("visa_files").delete().eq("id", fileId);
    if (fileErr) {
      console.error("delete-visa-file: visa_files silme hatası:", fileErr.message);
      return NextResponse.json(
        { error: "Dosya silinirken hata oluştu." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("delete-visa-file: genel hata:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}

