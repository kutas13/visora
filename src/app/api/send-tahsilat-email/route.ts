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

    const { senderEmail, senderName, musteriAd, hedefUlke, tutar, currency, yontem, emailType, hesapSahibi, companyInfo, faturaTipi, notlar, onOdemeGecmisi, dekontBase64, dekontName, tlKarsiligi, dosyaCurrency, dosyaTutar, paymentBreakdown, ucretDetay } = body;

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
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    // Toplu tahsilat desteği
    const customers = body.customers as Array<{ musteriAd: string; hedefUlke: string; tutar: number; currency: string; dosyaCurrency?: string; dosyaTutar?: number; ucretDetay?: any }> | undefined;
    if (customers && customers.length > 0) {
      const totalAmt = Number(tutar).toLocaleString("tr-TR");
      const totalCs = cSym(currency);
      const tarih = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
      const methodLabel = yontem === "nakit" ? "Nakit" : `Hesaba${hesapSahibi && hesapSahibi !== "DAVUT_TURGUT" ? ` (${hesapSahibi === "SIRRI_TURGUT" ? "Sırrı Turgut hesabı" : ""})` : ""}`;

      const bulkSubject = `TOPLU TAHSİLAT \u2022 ${customers.length} müşteri \u2022 ${totalAmt}${totalCs}`;

      const customerLines = customers.map(c => {
        const cAmt = Number(c.tutar).toLocaleString("tr-TR");
        return `${c.musteriAd} ${c.hedefUlke} vize ücreti ${cAmt} ${cText(c.currency)} ${yontem === "nakit" ? "nakit olarak alınmıştır" : "hesaba ödenmiştir"} carimden çıkartabiliriz`;
      });
      const bulkPlain = customerLines.join("\n\n") + (notlar ? `\n\nPersonel Notu: ${notlar}` : "");

      const customerCards = customers.map(c => {
        const cAmt = Number(c.tutar).toLocaleString("tr-TR");
        const cCs = cSym(c.currency);
        return `<div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <p style="margin:0;font-size:14px;color:#f1f5f9;font-weight:600;">${c.musteriAd}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${c.hedefUlke}</p>
            </div>
            <p style="margin:0;font-size:18px;font-weight:800;color:#10b981;">${cAmt}${cCs}</p>
          </div>
        </div>`;
      }).join("");

      const notlarHtml = notlar ? `<div style="padding:0 32px 24px;">
        <div style="background:rgba(251,191,36,0.1);border-radius:12px;padding:16px;border:1px solid rgba(251,191,36,0.2);">
          <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#d97706;font-weight:700;">Personel Notu</p>
          <p style="margin:0;font-size:13px;color:#fbbf24;font-style:italic;">"${notlar}"</p>
        </div>
      </div>` : "";

      const bulkHtml = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080d19;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:500px;margin:0 auto;padding:40px 16px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Fox Turizm</div>
  </div>
  <div style="background:linear-gradient(145deg,#111827,#1e293b);border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 32px 64px rgba(0,0,0,0.5);">
    <div style="height:3px;background:linear-gradient(90deg,#f97316,#ef4444,#f97316);"></div>
    <div style="text-align:center;padding:36px 32px 8px;">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:20px;background:linear-gradient(135deg,#f97316,#ef4444);font-size:28px;text-align:center;box-shadow:0 12px 32px rgba(249,115,22,0.3);">&#x1F4B0;</div>
      <div style="margin-top:16px;">
        <span style="display:inline-block;background:rgba(249,115,22,0.12);color:#ea580c;font-size:10px;font-weight:800;padding:5px 16px;border-radius:20px;letter-spacing:3px;">TOPLU TAHSİLAT</span>
      </div>
    </div>
    <div style="text-align:center;padding:20px 32px 28px;">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:500;letter-spacing:2px;text-transform:uppercase;">Toplam Tutar</p>
      <p style="margin:0;font-size:48px;font-weight:900;color:#ffffff;letter-spacing:-2px;line-height:1;">${totalAmt}<span style="font-size:32px;font-weight:700;color:#f97316;margin-left:4px;">${totalCs}</span></p>
      <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">${customers.length} m\u00fc\u015fteri \u2022 ${methodLabel}</p>
    </div>
    <div style="margin:0 32px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);"></div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">M\u00fc\u015fteriler</p>
      ${customerCards}
    </div>
    ${notlarHtml}
    <div style="padding:4px 32px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">\u0130\u015flemi Yapan</span></td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;"><span style="font-size:14px;color:#f1f5f9;font-weight:600;">${senderName}</span><br><span style="font-size:11px;color:#64748b;">${senderEmail}</span></td>
        </tr>
        <tr>
          <td style="padding:14px 0;"><span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Tarih</span></td>
          <td style="padding:14px 0;text-align:right;"><span style="font-size:14px;color:#e2e8f0;font-weight:500;">${tarih}</span></td>
        </tr>
      </table>
    </div>
    <div style="height:2px;background:linear-gradient(90deg,#f97316,#ef4444,#f97316);opacity:0.3;"></div>
  </div>
  <div style="text-align:center;padding:24px 0 8px;">
    <p style="margin:0 0 6px;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;">Bu e-posta <span style="color:rgba(255,255,255,0.75);font-weight:600;">Fox Turizm Vize Y\u00f6netim Sistemi</span> taraf\u0131ndan otomatik g\u00f6nderilmi\u015ftir.</p>
  </div>
</div></body></html>`;

      const toMuhasebe = body.testTo || "Muhasebe@foxturizm.com";
      const bulkAttachments: any[] = [];
      if (dekontBase64 && dekontName) {
        const matches = dekontBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches) bulkAttachments.push({ filename: dekontName, content: matches[2], encoding: "base64", contentType: matches[1] });
      }
      await transporter.sendMail({
        from: { name: senderName, address: senderEmail },
        to: [toMuhasebe, senderEmail],
        subject: bulkSubject,
        text: bulkPlain,
        html: bulkHtml,
        encoding: "utf-8" as const,
        attachments: bulkAttachments.length > 0 ? bulkAttachments : undefined,
      });
      return NextResponse.json({ success: true });
    }

    const amt = Number(tutar).toLocaleString("tr-TR");
    const ct = cText(currency);
    const cs = cSym(currency);
    const isPesin = emailType === "pesin_satis";
    const isOnOdeme = emailType === "on_odeme";
    const isFirmaCari = emailType === "firma_cari";
    const tarih = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

    const tag = isPesin ? "PE\u015e\u0130N SATI\u015e" : isOnOdeme ? "\u00d6N \u00d6DEME" : isFirmaCari ? "F\u0130RMA CAR\u0130" : "TAHS\u0130LAT";
    const subject = `${tag} \u2022 ${musteriAd} \u2022 ${hedefUlke} \u2022 ${amt}${cs}`;
    const ucretDetayText = ucretDetay?.davetiyeTutar
      ? `${Number(ucretDetay.vizeTutar || 0).toLocaleString("tr-TR")} ${cText(ucretDetay.vizeCurrency)} vize + ${Number(ucretDetay.davetiyeTutar || 0).toLocaleString("tr-TR")} ${cText(ucretDetay.davetiyeCurrency)} davetiye ücretidir`
      : null;

    // Hesap bilgisi
    const hesapBilgisi = hesapSahibi && hesapSahibi !== "DAVUT_TURGUT" ? ` (${hesapSahibi === "SIRRI_TURGUT" ? "Sırrı Turgut hesabı" : ""})` : "";

    // Firma bilgisi
    const firmaBilgisi = companyInfo ? ` - ${companyInfo.firma_adi}` : "";
    const faturaBilgisi = faturaTipi ? ` (${faturaTipi === "isimli" ? "İsimli" : "İsimsiz"} Fatura)` : "";

    let plainBody: string;
    if (isPesin) {
      const tlEkPesin = tlKarsiligi ? ` (TL karşılığı ${Number(tlKarsiligi).toLocaleString("tr-TR")} TL olarak alınmıştır)` : "";
      if (yontem === "nakit") {
        plainBody = `${musteriAd}${firmaBilgisi} ${hedefUlke} vize ücreti ${amt} ${ct} peşin nakit olarak alınmıştır${ucretDetayText ? ` (${ucretDetayText})` : ""}${tlEkPesin}${faturaBilgisi}`;
      } else {
        plainBody = `${musteriAd}${firmaBilgisi} ${hedefUlke} vize ücreti ${amt} ${ct} peşin hesaba ödenmiştir${hesapBilgisi}${ucretDetayText ? ` (${ucretDetayText})` : ""}${tlEkPesin}${faturaBilgisi}`;
      }
    } else if (isOnOdeme) {
      plainBody = `${musteriAd}${firmaBilgisi} ${hedefUlke} vize işlemi için ${amt} ${ct} ön ödeme alınmıştır (cari hesapta kalan tutar takip edilecek)`;
    } else if (isFirmaCari) {
      plainBody = `${musteriAd} ${hedefUlke} vize işlemi${firmaBilgisi} firma cariye eklenmiştir${faturaBilgisi} (${amt} ${ct} - cari hesapta takip edilecek)`;
    } else if (yontem === "nakit") {
      const onOdemeEk = onOdemeGecmisi ? ` (${new Date(onOdemeGecmisi.tarih).toLocaleDateString("tr-TR")} tarihinde ${onOdemeGecmisi.tutar} ${onOdemeGecmisi.currency} ön ödeme alınmıştı)` : "";
      const tlEk = tlKarsiligi ? ` (${dosyaTutar} ${dosyaCurrency} karşılığı ${Number(tlKarsiligi).toLocaleString("tr-TR")} TL olarak tahsil edildi)` : "";
      const breakdownEk = paymentBreakdown && paymentBreakdown.length > 1 ? ` (Ödeme detayı: ${paymentBreakdown.map((p: any) => `${Number(p.tutar).toLocaleString("tr-TR")} ${cSym(p.currency)}`).join(" + ")})` : "";
      plainBody = `${musteriAd}${firmaBilgisi} ${hedefUlke} vize ücreti ${amt} ${ct} nakit olarak alınmıştır carimden çıkartabiliriz${ucretDetayText ? ` (${ucretDetayText})` : ""}${tlEk}${breakdownEk}${onOdemeEk}`;
    } else {
      const onOdemeEk = onOdemeGecmisi ? ` (${new Date(onOdemeGecmisi.tarih).toLocaleDateString("tr-TR")} tarihinde ${onOdemeGecmisi.tutar} ${onOdemeGecmisi.currency} ön ödeme alınmıştı)` : "";
      const tlEk = tlKarsiligi ? ` (${dosyaTutar} ${dosyaCurrency} karşılığı ${Number(tlKarsiligi).toLocaleString("tr-TR")} TL olarak tahsil edildi)` : "";
      const breakdownEk = paymentBreakdown && paymentBreakdown.length > 1 ? ` (Ödeme detayı: ${paymentBreakdown.map((p: any) => `${Number(p.tutar).toLocaleString("tr-TR")} ${cSym(p.currency)}`).join(" + ")})` : "";
      plainBody = `${musteriAd}${firmaBilgisi} ${hedefUlke} vize ücreti ${amt} ${ct} hesaba ödenmiştir${hesapBilgisi} carimden çıkartabiliriz${ucretDetayText ? ` (${ucretDetayText})` : ""}${tlEk}${breakdownEk}${onOdemeEk}`;
    }

    // Renkler ve ikonlar
    let grad1, grad2, badgeBg, badgeClr, methodLabel, icon;
    
    if (isPesin) {
      if (yontem === "nakit") {
        grad1 = "#16a34a"; grad2 = "#059669";
        badgeBg = "rgba(22,163,74,0.12)"; badgeClr = "#16a34a";
        methodLabel = "Nakit (Cariden Düşüş)";
        icon = "&#x1F4B5;";
      } else {
        grad1 = "#2563eb"; grad2 = "#3b82f6";
        badgeBg = "rgba(37,99,235,0.12)"; badgeClr = "#2563eb";
        methodLabel = `Hesaba${hesapBilgisi}`;
        icon = "&#x1F3E6;";
      }
    } else if (isOnOdeme) {
      grad1 = "#8b5cf6"; grad2 = "#a78bfa";
      badgeBg = "rgba(139,92,246,0.12)"; badgeClr = "#8b5cf6";
      methodLabel = "Ön Ödeme";
      icon = "&#x1F4B3;";
    } else if (isFirmaCari) {
      grad1 = "#7c3aed"; grad2 = "#8b5cf6";
      badgeBg = "rgba(124,58,237,0.12)"; badgeClr = "#7c3aed";
      methodLabel = "Firma Cari";
      icon = "&#x1F3E2;";
    } else {
      grad1 = "#f97316"; grad2 = "#ef4444";
      badgeBg = "rgba(249,115,22,0.12)"; badgeClr = "#ea580c";
      methodLabel = yontem === "nakit" ? "Nakit (Cariden Düşüş)" : `Hesaba${hesapBilgisi}`;
      icon = companyInfo ? "&#x1F3E2;" : "&#x1F4B0;";
    }

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
        ${icon}
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
        ${companyInfo ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Firma</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${companyInfo.firma_adi}</span>
            ${faturaTipi ? `<br><span style="font-size:11px;color:#64748b;">${faturaTipi === "isimli" ? "\u0130simli" : "\u0130simsiz"} Fatura</span>` : ""}
          </td>
        </tr>` : ""}
        ${hesapSahibi && yontem === "hesaba" ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Hesap</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${hesapSahibi === "DAVUT_TURGUT" ? "Davut Turgut" : "S\u0131rr\u0131 Turgut"}</span>
          </td>
        </tr>` : ""}
        ${onOdemeGecmisi ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">\u00d6n \u00d6deme</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:13px;color:#e2e8f0;">${onOdemeGecmisi.tutar} ${onOdemeGecmisi.currency}</span>
            <br><span style="font-size:11px;color:#64748b;">${new Date(onOdemeGecmisi.tarih).toLocaleDateString("tr-TR")} tarihinde al\u0131nm\u0131\u015ft\u0131</span>
          </td>
        </tr>` : ""}
        ${paymentBreakdown && paymentBreakdown.length > 1 ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">\u00d6deme Detay\u0131</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#10b981;font-weight:700;">${paymentBreakdown.map((p: any) => `${Number(p.tutar).toLocaleString("tr-TR")} ${cSym(p.currency)}`).join(" + ")}</span>
            <br><span style="font-size:11px;color:#64748b;">Kar\u0131\u015f\u0131k d\u00f6viz \u00f6demesi</span>
          </td>
        </tr>` : ""}
        ${ucretDetayText ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Ücret Detayı</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:13px;color:#e2e8f0;">${ucretDetayText}</span>
          </td>
        </tr>` : ""}
        ${tlKarsiligi ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">TL Kar\u015f\u0131l\u0131\u011f\u0131</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#10b981;font-weight:700;">${Number(tlKarsiligi).toLocaleString("tr-TR")} \u20ba</span>
            <br><span style="font-size:11px;color:#64748b;">${dosyaTutar} ${dosyaCurrency} kar\u015f\u0131l\u0131\u011f\u0131</span>
          </td>
        </tr>` : ""}
        ${notlar ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Not</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:13px;color:#e2e8f0;font-style:italic;">"${notlar}"</span>
          </td>
        </tr>` : ""}
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

    const attachments: any[] = [];
    if (dekontBase64 && dekontName) {
      const matches = dekontBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        attachments.push({
          filename: dekontName,
          content: matches[2],
          encoding: "base64",
          contentType: matches[1],
        });
      }
    }

    await transporter.sendMail({
      from: { name: senderName, address: senderEmail },
      to: recipients,
      subject,
      text: plainBody,
      html,
      encoding: "utf-8" as const,
      attachments: attachments.length > 0 ? attachments : undefined,
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
