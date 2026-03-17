import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const SMTP_PASSWORD_MAP: Record<string, string> = {
  "vize@foxturizm.com": "SMTP_PASS_BAHAR",
  "ercan@foxturizm.com": "SMTP_PASS_ERCAN",
  "yusuf@foxturizm.com": "SMTP_PASS_YUSUF",
  "info@foxturizm.com": "SMTP_PASS_DAVUT",
};

const HEADERS = [
  "bilet no ",
  "H.Y. Kodu",
  "I-D",
  "Acenta ",
  "Yolcu Adi",
  "Tarih",
  "Bilet Tut.",
  "Servis",
  "Toplam",
  "Parkur1",
  "Parkur2",
  "Parkur3",
  "Satis Sekli",
  "Kart No",
  "CARI ADI",
  "UYELIK NO",
  "PNR",
  "ODEME",
  "MIL ",
  "NOT",
];

interface ReportRowPayload {
  biletNo: number;
  hyKodu: string;
  id: string;
  acenta: string;
  yolcuAdi: string;
  tarih: string;
  biletTut: number;
  servis: number;
  toplam: number;
  parkur1: string;
  parkur2: string;
  parkur3: string;
  satisSecli: string;
  kartNo: string;
  cariAdi: string;
  uyelikNo: string;
  pnr: string;
  odeme: string;
  mil: string;
  not: string;
}

function formatDateForExcel(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

async function generateExcelBuffer(rows: ReportRowPayload[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fox Turizm";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Sayfa1");

  const headerRow = sheet.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
  });

  sheet.columns = [
    { width: 10 }, { width: 10 }, { width: 5 }, { width: 12 },
    { width: 35 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 8 }, { width: 8 }, { width: 8 },
    { width: 14 }, { width: 12 }, { width: 16 }, { width: 12 },
    { width: 10 }, { width: 10 }, { width: 8 }, { width: 12 },
  ];

  for (const row of rows) {
    const dataRow = sheet.addRow([
      row.biletNo, row.hyKodu, row.id, row.acenta, row.yolcuAdi,
      formatDateForExcel(row.tarih), row.biletTut || "", row.servis || "",
      row.toplam || "", row.parkur1, row.parkur2, row.parkur3,
      row.satisSecli, row.kartNo, row.cariAdi, row.uyelikNo,
      row.pnr, row.odeme, row.mil, row.not,
    ]);
    dataRow.eachCell((cell) => {
      cell.font = { size: 10 };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    [7, 8, 9].forEach(colIdx => {
      const cell = dataRow.getCell(colIdx);
      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0.00";
      }
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`gunluk-rapor-email:${clientIp}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla istek. Biraz bekleyin." }, { status: 429 });
    }

    const body = await request.json();
    const { rows, tarih, personel, senderEmail } = body as {
      rows: ReportRowPayload[];
      tarih: string;
      personel: string;
      senderEmail: string;
    };

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Satır verisi bulunamadı" }, { status: 400 });
    }
    if (!senderEmail) {
      return NextResponse.json({ error: "Gönderici email bulunamadı" }, { status: 400 });
    }

    const envKey = SMTP_PASSWORD_MAP[senderEmail.toLowerCase()];
    if (!envKey) {
      return NextResponse.json({ error: `SMTP ayarı bulunamadı: ${senderEmail}` }, { status: 400 });
    }
    const smtpPass = process.env[envKey];
    if (!smtpPass) {
      return NextResponse.json({ error: `${envKey} tanımlı değil` }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.yandex.com",
      port: 465,
      secure: true,
      auth: { user: senderEmail, pass: smtpPass },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    const excelBuffer = await generateExcelBuffer(rows);
    const tarihFormatted = tarih.replace(/-/g, ".");
    const fileName = `${tarihFormatted}.xlsx`;

    const vizCount = rows.filter(r => r.hyKodu === "VIZ").length;
    const totalToplam = rows.reduce((sum, r) => sum + (r.toplam || 0), 0);

    const parts = tarihFormatted.split(".");
    const tarihGunAyYil = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : tarihFormatted;
    const subject = `${tarihGunAyYil} GÜNLÜK RAPORUM`;
    const textBody = `${tarihGunAyYil} tarihli günlük rapor ektedir.\n\nToplam ${rows.length} kayıt (${vizCount} vize dosyası).\nGenel Toplam: ${totalToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL\n\nFox Turizm Vize Yönetim Sistemi`;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080d19;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:500px;margin:0 auto;padding:40px 16px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Fox Turizm</div>
  </div>
  <div style="background:linear-gradient(145deg,#111827,#1e293b);border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 32px 64px rgba(0,0,0,0.5);">
    <div style="height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#6366f1);"></div>
    <div style="text-align:center;padding:36px 32px 8px;">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-size:28px;text-align:center;box-shadow:0 12px 32px rgba(99,102,241,0.3);">&#x1F4CA;</div>
      <div style="margin-top:16px;">
        <span style="display:inline-block;background:rgba(99,102,241,0.12);color:#818cf8;font-size:10px;font-weight:800;padding:5px 16px;border-radius:20px;letter-spacing:3px;">GÜNLÜK RAPOR</span>
      </div>
    </div>
    <div style="text-align:center;padding:20px 32px 28px;">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:500;letter-spacing:2px;text-transform:uppercase;">Rapor Tarihi</p>
      <p style="margin:0;font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1;">${tarihGunAyYil}</p>
      <p style="margin:8px 0 0;font-size:16px;color:#94a3b8;font-weight:500;">GÜNLÜK RAPORUM</p>
    </div>
    <div style="margin:0 32px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);"></div>
    <div style="padding:24px 32px;">
      <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.8;">
          ${tarihGunAyYil} tarihli günlük rapor ektedir.
        </p>
      </div>
    </div>
    <div style="padding:4px 32px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Personel</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#f1f5f9;font-weight:600;">${personel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Toplam Kayıt</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${rows.length} kayıt (${vizCount} vize)</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;font-weight:700;">Ek</span>
          </td>
          <td style="padding:14px 0;text-align:right;">
            <span style="font-size:14px;color:#e2e8f0;font-weight:500;">${fileName}</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="height:2px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#6366f1);opacity:0.3;"></div>
  </div>
  <div style="text-align:center;padding:24px 0 8px;">
    <p style="margin:0 0 6px;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;">
      Bu e-posta <span style="color:rgba(255,255,255,0.75);font-weight:600;">Fox Turizm Vize Yönetim Sistemi</span> tarafından otomatik gönderilmiştir.
    </p>
    <p style="margin:0;font-size:9px;color:rgba(255,255,255,0.25);">© ${new Date().getFullYear()} Fox Turizm</p>
  </div>
</div>
</body>
</html>`;

    await transporter.sendMail({
      from: { name: personel, address: senderEmail },
      to: ["Muhasebe@foxturizm.com", "info@foxturizm.com", senderEmail],
      subject,
      text: textBody,
      html,
      encoding: "utf-8" as const,
      attachments: [
        {
          filename: fileName,
          content: excelBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Günlük rapor email hatası:", err);
    return NextResponse.json({ error: err.message || "Mail gönderilemedi" }, { status: 500 });
  }
}
