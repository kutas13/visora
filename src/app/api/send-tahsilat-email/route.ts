import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const SMTP_PASSWORD_MAP: Record<string, string> = {
  "vize@foxturizm.com": "SMTP_PASS_BAHAR",
  "ercan@foxturizm.com": "SMTP_PASS_ERCAN",
  "yusuf@foxturizm.com": "SMTP_PASS_YUSUF",
  "info@foxturizm.com": "SMTP_PASS_DAVUT",
};

function cText(c: string) {
  return ({ USD: "dolar", EUR: "euro", TL: "TL" } as Record<string, string>)[c] || c;
}
function cSym(c: string) {
  return ({ USD: "$", EUR: "\u20ac", TL: "\u20ba" } as Record<string, string>)[c] || c;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: dakikada max 10 email
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`email:${clientIp}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla email gönderildi. Biraz bekleyin." }, { status: 429 });
    }

    const raw = await request.text();
    const body = JSON.parse(raw);

    const { senderEmail, senderName, musteriAd, hedefUlke, tutar, currency, yontem, emailType } = body;

    if (!senderEmail || !musteriAd || !tutar || !currency) {
      return NextResponse.json({ error: "Eksik alanlar" }, { status: 400 });
    }

    const envKey = SMTP_PASSWORD_MAP[senderEmail.toLowerCase()];
    if (!envKey) return NextResponse.json({ error: "SMTP bulunamadi" }, { status: 400 });
    const smtpPass = process.env[envKey];
    if (!smtpPass) return NextResponse.json({ error: `${envKey} tanimli degil` }, { status: 500 });

    const transporter = nodemailer.createTransport({
      host: "smtp.yandex.com",
      port: 465,
      secure: true,
      auth: { user: senderEmail, pass: smtpPass },
    });

    const amt = Number(tutar).toLocaleString("tr-TR");
    const ct = cText(currency);
    const cs = cSym(currency);
    const isPesin = emailType === "pesin_satis";
    const tarih = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

    const tag = isPesin ? "PE\u015e\u0130N SATI\u015e" : "TAHS\u0130LAT";
    const subject = `${tag} \u2022 ${musteriAd} \u2022 ${hedefUlke} \u2022 ${amt}${cs}`;

    let plainBody: string;
    if (isPesin) {
      plainBody = `${musteriAd} ${hedefUlke} vize \u00fccreti ${amt} ${ct} pe\u015fin olarak al\u0131nm\u0131\u015ft\u0131r`;
    } else if (yontem === "nakit") {
      plainBody = `${musteriAd} ${hedefUlke} vize \u00fccreti ${amt} ${ct} nakit olarak al\u0131nm\u0131\u015ft\u0131r carimden \u00e7\u0131kartabiliriz`;
    } else {
      plainBody = `${musteriAd} ${hedefUlke} vize \u00fccreti ${amt} ${ct} hesaba \u00f6denmi\u015ftir carimden \u00e7\u0131kartabiliriz`;
    }

    // Renkler
    const grad1 = isPesin ? "#2563eb" : "#f97316";
    const grad2 = isPesin ? "#7c3aed" : "#ef4444";
    const badgeBg = isPesin ? "rgba(37,99,235,0.12)" : "rgba(249,115,22,0.12)";
    const badgeClr = isPesin ? "#2563eb" : "#ea580c";
    const methodLabel = yontem === "nakit" ? "Nakit (Cariden D\u00fc\u015f\u00fc\u015f)" : "Hesaba";

    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080d19;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<div style="max-width:500px;margin:0 auto;padding:40px 16px;">

  <!-- Brand -->
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,${grad1},${grad2});-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Fox Turizm</div>
  </div>

  <!-- Main Card -->
  <div style="background:linear-gradient(145deg,#111827,#1e293b);border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 32px 64px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.05);">

    <!-- Gradient Top Bar -->
    <div style="height:3px;background:linear-gradient(90deg,${grad1},${grad2},${grad1});"></div>

    <!-- Type Badge + Icon -->
    <div style="text-align:center;padding:36px 32px 8px;">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:20px;background:linear-gradient(135deg,${grad1},${grad2});font-size:28px;text-align:center;box-shadow:0 12px 32px ${grad1}55;">
        ${isPesin ? "&#x1F4B3;" : "&#x1F4B0;"}
      </div>
      <div style="margin-top:16px;">
        <span style="display:inline-block;background:${badgeBg};color:${badgeClr};font-size:10px;font-weight:800;padding:5px 16px;border-radius:20px;letter-spacing:3px;">${tag}</span>
      </div>
    </div>

    <!-- Amount Hero -->
    <div style="text-align:center;padding:20px 32px 28px;">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:500;letter-spacing:2px;text-transform:uppercase;">\u00d6deme Tutar\u0131</p>
      <p style="margin:0;font-size:48px;font-weight:900;color:#ffffff;letter-spacing:-2px;line-height:1;">${amt}<span style="font-size:32px;font-weight:700;color:${grad1};margin-left:4px;">${cs}</span></p>
    </div>

    <!-- Divider -->
    <div style="margin:0 32px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);"></div>

    <!-- Message -->
    <div style="padding:24px 32px;">
      <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.8;font-weight:400;">
          ${plainBody}
        </p>
      </div>
    </div>

    <!-- Details Grid -->
    <div style="padding:4px 32px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">M\u00fc\u015fteri</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#f1f5f9;font-weight:600;">${musteriAd}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">\u00dclke</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${hedefUlke}</span>
          </td>
        </tr>
        ${!isPesin ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">\u00d6deme</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${methodLabel}</span>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">\u0130\u015flemi Yapan</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#f1f5f9;font-weight:600;">${senderName}</span>
            <br><span style="font-size:11px;color:#64748b;">${senderEmail}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Tarih</span>
          </td>
          <td style="padding:14px 0;text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${tarih}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Bottom gradient -->
    <div style="height:2px;background:linear-gradient(90deg,${grad1},${grad2},${grad1});opacity:0.3;"></div>

  </div><!-- /card -->

  <!-- Footer -->
  <div style="text-align:center;padding:24px 0 8px;">
    <p style="margin:0 0 6px;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;">
      Bu e-posta <span style="color:rgba(255,255,255,0.75);font-weight:600;">Fox Turizm Vize Y\u00f6netim Sistemi</span> taraf\u0131ndan otomatik g\u00f6nderilmi\u015ftir.
    </p>
    <p style="margin:0;font-size:9px;color:rgba(255,255,255,0.25);">\u00a9 ${new Date().getFullYear()} Fox Turizm</p>
  </div>

</div>
</body>
</html>`;

    // Alıcılar: Muhasebe + gönderen kullanıcının kendisi
    const toMuhasebe = body.testTo || "Muhasebe@foxturizm.com";
    const recipients = [toMuhasebe, senderEmail];

    await transporter.sendMail({
      from: { name: senderName, address: senderEmail },
      to: recipients,
      subject,
      text: plainBody,
      html,
      encoding: "utf-8" as const,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Email gonderim hatasi:", err);
    return NextResponse.json(
      { error: err?.message || "Email gonderilemedi" },
      { status: 500 }
    );
  }
}
