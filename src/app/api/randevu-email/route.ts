import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { isLegacyEmailEnabled, LEGACY_EMAIL_DISABLED_MESSAGE } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

// Eski hardcoded alici listesi (artik kullanilmiyor; fallback default).
// Visora'da sirket-bazli email yapilandirmasi gelene kadar bu endpoint
// ENABLE_LEGACY_EMAIL=true olmadan calismaz.
const RECIPIENTS: string[] = [];

export async function POST(request: NextRequest) {
  if (!isLegacyEmailEnabled()) {
    return NextResponse.json({ ok: true, disabled: true, message: LEGACY_EMAIL_DISABLED_MESSAGE });
  }

  try {
    const body = await request.json();
    const { dosyaAdi, ulkeler, vizeTipi, randevuTarihi, alanKisi } = body;

    if (!dosyaAdi || !randevuTarihi || !alanKisi) {
      return NextResponse.json({ error: "Eksik alanlar" }, { status: 400 });
    }

    // SMTP sifresi: yeni generic ad SMTP_PASS, eski tek-firma kalintisi
    // SMTP_PASS_DAVUT geriye donuk uyumluluk icin korunuyor.
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASS_DAVUT;
    if (!smtpPass) {
      return NextResponse.json({ error: "SMTP şifresi tanımlı değil" }, { status: 500 });
    }

    const smtpFrom = process.env.SMTP_FROM_EMAIL;
    const smtpUser = process.env.SMTP_USER || smtpFrom;
    if (!smtpUser || !smtpFrom) {
      return NextResponse.json({ error: "SMTP_USER / SMTP_FROM_EMAIL tanimli degil" }, { status: 500 });
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.yandex.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE || "true").toLowerCase() !== "false",
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    const tarih = new Date(randevuTarihi).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const subject = `RANDEVU ALINDI • ${dosyaAdi} • ${ulkeler?.join(", ") || ""} • ${tarih}`;

    const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080d19;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:500px;margin:0 auto;padding:40px 16px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Visora</div>
  </div>
  <div style="background:linear-gradient(145deg,#111827,#1e293b);border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 32px 64px rgba(0,0,0,0.5);">
    <div style="height:3px;background:linear-gradient(90deg,#10b981,#059669,#10b981);"></div>
    <div style="text-align:center;padding:36px 32px 8px;">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:20px;background:linear-gradient(135deg,#10b981,#059669);font-size:28px;text-align:center;box-shadow:0 12px 32px rgba(16,185,129,0.3);">&#x1F4C5;</div>
      <div style="margin-top:16px;">
        <span style="display:inline-block;background:rgba(16,185,129,0.12);color:#10b981;font-size:10px;font-weight:800;padding:5px 16px;border-radius:20px;letter-spacing:3px;">RANDEVU ALINDI</span>
      </div>
    </div>
    <div style="text-align:center;padding:20px 32px 28px;">
      <p style="margin:0;font-size:28px;font-weight:900;color:#ffffff;">${dosyaAdi}</p>
      <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">${ulkeler?.join(", ") || ""} • ${vizeTipi || ""}</p>
    </div>
    <div style="margin:0 32px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);"></div>
    <div style="padding:24px 32px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Randevu Tarihi</span></td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;"><span style="font-size:16px;color:#10b981;font-weight:700;">${tarih}</span></td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Randevuyu Alan</span></td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;"><span style="font-size:14px;color:#f1f5f9;font-weight:600;">${alanKisi}</span></td>
        </tr>
      </table>
    </div>
    <div style="height:2px;background:linear-gradient(90deg,#10b981,#059669,#10b981);opacity:0.3;"></div>
  </div>
  <div style="text-align:center;padding:24px 0 8px;">
    <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;">Visora Vize Yönetim Sistemi</p>
  </div>
</div></body></html>`;

    await transporter.sendMail({
      from: { name: "Visora", address: smtpFrom },
      to: RECIPIENTS,
      subject,
      text: `Randevu Alındı - ${dosyaAdi} - ${ulkeler?.join(", ")} - Tarih: ${tarih} - Alan: ${alanKisi}`,
      html,
      encoding: "utf-8" as const,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Randevu email hatası:", err);
    return NextResponse.json({ error: err?.message || "Email gönderilemedi" }, { status: 500 });
  }
}
