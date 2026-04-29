import nodemailer from "nodemailer";

/**
 * Merkezi Visora Mailer.
 *
 * Tum sistem maillerini buradan gonderiyoruz. Gonderici Google Workspace
 * SMTP'siyle baglanir; FROM her zaman destek@destekvisora.com olur.
 *
 * Vercel env vars (gerekli):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD,
 *   SMTP_FROM_EMAIL, SMTP_FROM_NAME, VISORA_OWNER_EMAIL,
 *   NEXT_PUBLIC_SITE_URL (banner gorseli icin), ENABLE_LEGACY_EMAIL=true
 */

/**
 * Tum env vars'lardan whitespace/newline trimle.
 * Vercel UI'sinda kullanici Enter ile yapistirinca trailing \n eklenebilir,
 * "smtp.gmail.com\n" gibi degerler DNS resolve'da getaddrinfo EBUSY hatasina
 * yol acar. Bunu kaynakta temizliyoruz.
 */
function envClean(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v !== "string") return undefined;
  const trimmed = v.replace(/^[\s\r\n]+|[\s\r\n]+$/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

export const VISORA_OWNER_EMAIL =
  envClean("VISORA_OWNER_EMAIL") || "gmyusuf13@gmail.com";

export const SITE_URL =
  envClean("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "") ||
  "https://visora.com.tr";

const FROM_EMAIL = envClean("SMTP_FROM_EMAIL") || "destek@destekvisora.com";
const FROM_NAME = envClean("SMTP_FROM_NAME") || "Visora";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = envClean("SMTP_HOST") || "smtp.gmail.com";
  const port = Number(envClean("SMTP_PORT") || 465);
  const secure =
    (envClean("SMTP_SECURE") || "true").toLowerCase() === "true";
  const user = envClean("SMTP_USER");
  const pass = envClean("SMTP_PASSWORD");

  if (!user || !pass) {
    throw new Error(
      "SMTP_USER veya SMTP_PASSWORD tanimli degil. Vercel env vars'a ekleyin."
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

interface SendArgs {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

/**
 * Mail kontrolu:
 *  - ENABLE_LEGACY_EMAIL=true ise her zaman gonderir (eski feature flag).
 *  - ENABLE_LEGACY_EMAIL=false ise: SMTP_USER + SMTP_PASSWORD ikisi de
 *    set ise yine de gonderir (Visora yeni mail akisi). Boylece eski
 *    flag'e ihtiyac duymadan modern entegrasyon calisir.
 *  - Hicbiri yoksa skip eder; build/test guvenligi.
 */
function isMailEnabled(): boolean {
  if (envClean("ENABLE_LEGACY_EMAIL")?.toLowerCase() === "true") return true;
  if (envClean("ENABLE_VISORA_EMAIL")?.toLowerCase() === "false") return false;
  return Boolean(envClean("SMTP_USER") && envClean("SMTP_PASSWORD"));
}

export async function sendVisoraEmail(args: SendArgs) {
  if (!isMailEnabled()) {
    console.warn(
      "[mailer] SMTP_USER/SMTP_PASSWORD bulunamadi veya ENABLE_VISORA_EMAIL=false. Mail atlanir."
    );
    return { skipped: true } as const;
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: args.to,
    cc: args.cc,
    subject: args.subject,
    html: args.html,
    text: args.text,
    attachments: args.attachments,
  });
  return { skipped: false, messageId: info.messageId } as const;
}

/* =========================================================
 *  HTML SABLON HELPER'LARI
 * =========================================================
 *
 * Tum maillerde ortak header (banner) + footer (destek mail) +
 * tek-renk indigo/violet vurgu kullanilir. Email client'larin
 * cogu CSS'i sınırlı destekledigi icin inline style kullaniyoruz.
 */

const BANNER_URL = `${SITE_URL}/visora-banner.png`;

function baseTemplate(content: string, opts?: { preheader?: string }) {
  const preheader = opts?.preheader || "";
  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Visora</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7ff;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(79,70,229,0.10);max-width:600px;width:100%;">
            <tr>
              <td style="padding:0;">
                <img src="${BANNER_URL}" alt="Visora" style="display:block;width:100%;max-width:600px;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;border-top:1px solid #eef2ff;">
                <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;">
                  Bu maili Visora otomasyon sistemi gönderdi. Cevap için
                  <a href="mailto:${FROM_EMAIL}" style="color:#4f46e5;text-decoration:none;">${FROM_EMAIL}</a>
                  adresine yazabilirsiniz.
                </p>
                <p style="margin:0;font-size:11px;color:#94a3b8;">
                  © ${new Date().getFullYear()} Visora · <a href="${SITE_URL}" style="color:#94a3b8;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function badge(text: string, color: "indigo" | "emerald" | "amber" | "rose" | "sky") {
  const colors: Record<string, { bg: string; fg: string }> = {
    indigo: { bg: "#eef2ff", fg: "#4338ca" },
    emerald: { bg: "#ecfdf5", fg: "#047857" },
    amber: { bg: "#fffbeb", fg: "#b45309" },
    rose: { bg: "#fff1f2", fg: "#be123c" },
    sky: { bg: "#f0f9ff", fg: "#0369a1" },
  };
  const c = colors[color];
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${c.bg};color:${c.fg};font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">${text}</span>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

function moneyFmt(n: number, c: string) {
  const sym = ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
  return `${Math.round(n).toLocaleString("tr-TR")} ${sym}`;
}

function dateFmt(d?: string | Date) {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
 *  1) HOSGELDIN MAILI (yeni GM hesabi)
 * ========================================================= */

export interface WelcomeEmailArgs {
  gmEmail: string;
  gmName: string;
  organizationName: string;
  loginUrl?: string;
}

export async function sendWelcomeEmail(args: WelcomeEmailArgs) {
  const { gmEmail, gmName, organizationName, loginUrl } = args;
  const url = loginUrl || `${SITE_URL}/login`;

  const html = baseTemplate(
    `
    ${badge("Hoş geldiniz", "indigo")}
    <h1 style="margin:14px 0 8px 0;font-size:22px;font-weight:800;color:#0f172a;">Visora ailesine hoş geldiniz, ${gmName}!</h1>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
      <strong>${organizationName}</strong> firmanız için Visora hesabınız hazır.
      Vize başvuruları, müşteri kayıtları, tahsilat takibi ve ekip yönetimi —
      hepsi tek bir yerden.
    </p>

    <div style="background:linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%);border:1px solid #e0e7ff;border-radius:14px;padding:18px 20px;margin:18px 0;">
      <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.08em;">Başlamanız için 3 adım</p>
      <ol style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.7;color:#1e293b;">
        <li>Aşağıdaki <strong>“Panele Giriş Yap”</strong> butonuyla giriş yapın.</li>
        <li><strong>Banka Hesapları</strong> sayfasından kendi hesaplarınızı tanımlayın.</li>
        <li><strong>Personel</strong> ekleyip ilk vize dosyanızı oluşturun.</li>
      </ol>
    </div>

    <div style="text-align:center;margin:22px 0 8px 0;">
      <a href="${url}"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(79,70,229,0.30);">
        Panele Giriş Yap →
      </a>
    </div>

    <p style="margin:18px 0 0 0;font-size:12px;color:#94a3b8;">
      Yardıma mı ihtiyacınız var? <a href="mailto:${FROM_EMAIL}" style="color:#4f46e5;">${FROM_EMAIL}</a>
    </p>
  `,
    { preheader: `Visora hesabınız hazır, ${gmName}` }
  );

  return sendVisoraEmail({
    to: gmEmail,
    cc: VISORA_OWNER_EMAIL,
    subject: `Visora'ya hoş geldiniz — ${organizationName}`,
    html,
  });
}

/* =========================================================
 *  2) TAHSILAT ALINDI
 * ========================================================= */

export interface TahsilatEmailArgs {
  gmEmail: string;
  actorName: string; // Tahsilatı kim aldı
  musteriAd: string;
  hedefUlke?: string | null;
  tutar: number;
  currency: string;
  yontem: "nakit" | "hesaba" | "pos" | string;
  hesapSahibi?: string | null;
  tlKarsilik?: number | null;
  notlar?: string | null;
}

export async function sendTahsilatEmail(args: TahsilatEmailArgs) {
  const {
    gmEmail,
    actorName,
    musteriAd,
    hedefUlke,
    tutar,
    currency,
    yontem,
    hesapSahibi,
    tlKarsilik,
    notlar,
  } = args;

  const yontemLabel =
    yontem === "nakit"
      ? "Nakit"
      : yontem === "pos"
      ? "POS"
      : yontem === "hesaba"
      ? `Hesaba (${hesapSahibi || "-"})`
      : yontem;

  const tlSatiri =
    typeof tlKarsilik === "number" && tlKarsilik > 0 && currency !== "TL"
      ? `<p style="margin:6px 0 0 0;font-size:12px;color:#b45309;font-weight:600;">TL karşılığı alınmıştır: ${Math.round(
          tlKarsilik
        ).toLocaleString("tr-TR")} ₺</p>`
      : "";

  const html = baseTemplate(
    `
    ${badge("Tahsilat alındı", "emerald")}
    <h1 style="margin:14px 0 6px 0;font-size:20px;font-weight:800;color:#0f172a;">${musteriAd} için ödeme alındı</h1>
    <p style="margin:0 0 16px 0;font-size:13.5px;color:#64748b;">${actorName} tarafından, ${dateFmt()} itibarıyla.</p>

    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:18px 20px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:.08em;">Tahsilat Tutarı</p>
      <p style="margin:6px 0 0 0;font-size:30px;font-weight:900;color:#047857;">${moneyFmt(tutar, currency)}</p>
      ${tlSatiri}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      ${infoRow("Müşteri", musteriAd)}
      ${hedefUlke ? infoRow("Vize ülkesi", hedefUlke) : ""}
      ${infoRow("Yöntem", yontemLabel)}
      ${infoRow("Tahsilatı alan", actorName)}
      ${notlar ? infoRow("Not", notlar) : ""}
    </table>
  `,
    { preheader: `${musteriAd} — ${moneyFmt(tutar, currency)} tahsil edildi` }
  );

  return sendVisoraEmail({
    to: gmEmail,
    cc: VISORA_OWNER_EMAIL,
    subject: `Tahsilat alındı — ${musteriAd} (${moneyFmt(tutar, currency)})`,
    html,
  });
}

/* =========================================================
 *  3) DOSYA OLUSTURULDU (cari veya pesin tek bildirim)
 * ========================================================= */

export interface DosyaEmailArgs {
  gmEmail: string;
  actorName: string;
  musteriAd: string;
  hedefUlke: string;
  ucret: number;
  currency: string;
  odemePlani: "pesin" | "cari" | "firma_cari" | string;
  // Pesin akisi: dosya olusturulurken otomatik tahsilat
  pesinTahsilat?: {
    tutar: number;
    currency: string;
    yontem: string;
    hesapSahibi?: string | null;
    tlKarsilik?: number | null;
  };
  onOdeme?: { tutar: number; currency: string } | null;
  notlar?: string | null;
}

export async function sendDosyaOlusturulduEmail(args: DosyaEmailArgs) {
  const {
    gmEmail,
    actorName,
    musteriAd,
    hedefUlke,
    ucret,
    currency,
    odemePlani,
    pesinTahsilat,
    onOdeme,
    notlar,
  } = args;

  const planLabel =
    odemePlani === "pesin"
      ? "Peşin Satış"
      : odemePlani === "firma_cari"
      ? "Firma Cari"
      : "Cari";

  const pesinBlock = pesinTahsilat
    ? `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:18px 20px;margin-top:14px;">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:.08em;">Aynı anda peşin tahsilat alındı</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:#047857;">${moneyFmt(
          pesinTahsilat.tutar,
          pesinTahsilat.currency
        )}</p>
        <p style="margin:4px 0 0 0;font-size:12.5px;color:#065f46;">Yöntem: ${
          pesinTahsilat.yontem === "hesaba"
            ? `Hesaba (${pesinTahsilat.hesapSahibi || "-"})`
            : pesinTahsilat.yontem === "pos"
            ? "POS"
            : "Nakit"
        }</p>
        ${
          typeof pesinTahsilat.tlKarsilik === "number" &&
          pesinTahsilat.tlKarsilik > 0 &&
          pesinTahsilat.currency !== "TL"
            ? `<p style="margin:4px 0 0 0;font-size:12px;color:#b45309;font-weight:600;">TL karşılığı alınmıştır: ${Math.round(
                pesinTahsilat.tlKarsilik
              ).toLocaleString("tr-TR")} ₺</p>`
            : ""
        }
      </div>`
    : "";

  const onOdemeRow = onOdeme
    ? infoRow("Ön ödeme", moneyFmt(onOdeme.tutar, onOdeme.currency))
    : "";

  const html = baseTemplate(
    `
    ${badge("Yeni dosya", "indigo")}
    <h1 style="margin:14px 0 6px 0;font-size:20px;font-weight:800;color:#0f172a;">${musteriAd} için dosya oluşturuldu</h1>
    <p style="margin:0 0 14px 0;font-size:13.5px;color:#64748b;">${actorName} tarafından, ${dateFmt()} itibarıyla.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
      ${infoRow("Müşteri", musteriAd)}
      ${infoRow("Vize ülkesi", hedefUlke)}
      ${infoRow("Plan", planLabel)}
      ${infoRow("Dosya ücreti", moneyFmt(ucret, currency))}
      ${onOdemeRow}
      ${notlar ? infoRow("Not", notlar) : ""}
    </table>

    ${pesinBlock}
  `,
    { preheader: `${musteriAd} — ${planLabel} (${moneyFmt(ucret, currency)})` }
  );

  return sendVisoraEmail({
    to: gmEmail,
    cc: VISORA_OWNER_EMAIL,
    subject: `Yeni dosya: ${musteriAd} — ${planLabel}${
      pesinTahsilat ? " · Tahsilat alındı" : ""
    }`,
    html,
  });
}

/* =========================================================
 *  4) AYLIK RAPOR (PDF eki)
 * ========================================================= */

export interface AylikRaporEmailArgs {
  gmEmail: string;
  organizationName: string;
  ay: string; // ornek: "Nisan 2026"
  ozet: { tlGelir: number; eurGelir: number; usdGelir: number; dosyaSayisi: number };
  pdfBuffer: Buffer;
  pdfFilename?: string;
}

export async function sendAylikRaporEmail(args: AylikRaporEmailArgs) {
  const { gmEmail, organizationName, ay, ozet, pdfBuffer, pdfFilename } = args;

  const html = baseTemplate(
    `
    ${badge("Aylık rapor", "sky")}
    <h1 style="margin:14px 0 6px 0;font-size:22px;font-weight:800;color:#0f172a;">${ay} Raporu</h1>
    <p style="margin:0 0 14px 0;font-size:13.5px;color:#475569;">
      <strong>${organizationName}</strong> için ${ay} dönemine ait özet rapor ektedir.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow("Toplam dosya", ozet.dosyaSayisi.toLocaleString("tr-TR"))}
      ${infoRow("TL ciro", `${ozet.tlGelir.toLocaleString("tr-TR")} ₺`)}
      ${infoRow("EUR ciro", `${ozet.eurGelir.toLocaleString("tr-TR")} €`)}
      ${infoRow("USD ciro", `${ozet.usdGelir.toLocaleString("tr-TR")} $`)}
    </table>

    <p style="margin:18px 0 0 0;font-size:12.5px;color:#64748b;">
      Detaylı kırılımlar ekteki PDF dosyasındadır. Dilerseniz panelden de
      <a href="${SITE_URL}/admin/raporlar" style="color:#4f46e5;text-decoration:none;">Raporlar</a> sayfasını ziyaret edebilirsiniz.
    </p>
  `,
    { preheader: `${ay} aylık rapor — ${organizationName}` }
  );

  return sendVisoraEmail({
    to: gmEmail,
    cc: VISORA_OWNER_EMAIL,
    subject: `${organizationName} — ${ay} Aylık Rapor`,
    html,
    attachments: [
      {
        filename: pdfFilename || `visora-rapor-${ay.replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

/* =========================================================
 *  5) GIRIS YAPILMADI (24 saatten fazla)
 * ========================================================= */

export interface InactivityEmailArgs {
  gmEmail: string;
  inactiveUserName: string;
  inactiveUserRole: "admin" | "staff" | string;
  lastSeen?: string | null; // ISO
}

export async function sendInactivityEmail(args: InactivityEmailArgs) {
  const { gmEmail, inactiveUserName, inactiveUserRole, lastSeen } = args;

  const roleLabel = inactiveUserRole === "admin" ? "Genel Müdür" : "Personel";
  const lastStr = lastSeen ? dateFmt(lastSeen) : "—";

  const html = baseTemplate(
    `
    ${badge("Giriş hatırlatması", "amber")}
    <h1 style="margin:14px 0 6px 0;font-size:20px;font-weight:800;color:#0f172a;">${inactiveUserName} 24 saattir giriş yapmadı</h1>
    <p style="margin:0 0 16px 0;font-size:13.5px;color:#475569;">
      Bilgilendirme amaçlıdır. Hesap durumunda kontrol etmek isteyebilirsiniz.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow("Kullanıcı", inactiveUserName)}
      ${infoRow("Rol", roleLabel)}
      ${infoRow("Son giriş", lastStr)}
    </table>

    <div style="text-align:center;margin:22px 0 4px 0;">
      <a href="${SITE_URL}/visora/logs"
         style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">
        Giriş Loglarını Gör
      </a>
    </div>
  `,
    { preheader: `${inactiveUserName} 24 saattir giriş yapmadı` }
  );

  return sendVisoraEmail({
    to: gmEmail,
    cc: VISORA_OWNER_EMAIL,
    subject: `Hatırlatma — ${inactiveUserName} 24 saattir giriş yapmadı`,
    html,
  });
}
