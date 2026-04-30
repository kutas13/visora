import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPasswordResetEmail } from "@/lib/mailer";

function envClean(name: string) {
  const v = process.env[name];
  if (typeof v !== "string") return undefined;
  const t = v.replace(/^[\s\r\n]+|[\s\r\n]+$/g, "");
  return t.length > 0 ? t : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "E-posta zorunlu." }, { status: 400 });
    }

    const supabaseUrl = envClean("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = envClean("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const siteUrl =
      envClean("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "") || "https://visora.com.tr";

    // Service role ile şifre sıfırlama token'ı üret
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (error) {
      // Kullanıcı bulunamasa bile güvenlik için başarı mesajı gönder
      console.error("[forgot-password] generateLink error:", error.message);
      return NextResponse.json({ ok: true });
    }

    // hashed_token kullanarak Supabase redirect ayarlarından bağımsız link oluştur.
    // action_link Supabase'in kendi domain'i üzerinden geçiyor ve Dashboard'daki
    // Site URL'e bağlı — onu kullanmak yerine token_hash'i alıp kendi URL'imizi kuruyoruz.
    const hashedToken = (data?.properties as any)?.hashed_token;
    let resetLink: string;

    if (hashedToken) {
      resetLink = `${siteUrl}/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
    } else {
      // Fallback: action_link varsa kullan
      const actionLink = (data?.properties as any)?.action_link as string | undefined;
      if (!actionLink) {
        console.error("[forgot-password] hashed_token ve action_link bulunamadi.");
        return NextResponse.json({ ok: true });
      }
      resetLink = actionLink;
    }

    // Bizim SMTP'den gönder
    await sendPasswordResetEmail({ to: email.trim(), resetLink });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ ok: false, error: err?.message || "Bir hata oluştu." }, { status: 500 });
  }
}
