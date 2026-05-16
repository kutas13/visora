import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { registerReportPdfFonts } from "@/lib/reports/registerReportPdfFonts";
import { StatementPdfDocument } from "./StatementPdfDocument";
import { buildStatement } from "./buildStatement";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signStatementToken } from "./token";
import { COMPANY_STAMP_DATA_URL } from "./companyStamp";

/**
 * Sirket kasesi build-time'da `scripts/gen-company-stamp.mjs` ile
 * public/seal/company-stamp.png'den uretilip src/lib/statement/companyStamp.ts
 * dosyasina 240x240 optimize PNG olarak gomuluyor.
 *
 * Build sirasinda `prebuild` hook'u otomatik olarak yeniden uretiyor; yerelde
 * `npm run gen:stamp` ile manuel de tetiklenebilir. Bu yontem Vercel/serverless
 * gibi `public/` runtime'a alinmayan ortamlarda da %100 calisir.
 */
function loadCompanyStamp(): string | null {
  return COMPANY_STAMP_DATA_URL || null;
}

/**
 * Bir banka hesabi icin imzali bir public ekstre URL'i + onu icinde QR olarak
 * gomulu PDF buffer'i uretir.
 */
export async function renderStatementPdf(args: {
  admin: SupabaseClient;
  bankAccountId: string;
  organizationId: string;
  months: 3 | 6 | 12;
  origin: string;
}): Promise<{ buffer: Buffer; fileName: string; publicUrl: string }> {
  const { admin, bankAccountId, organizationId, months, origin } = args;

  // 1) imzali token + public URL
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90; // 90 gun
  const token = signStatementToken({
    aid: bankAccountId,
    oid: organizationId,
    m: months,
    exp,
  });
  const publicUrl = `${origin.replace(/\/$/, "")}/api/statement/${encodeURIComponent(token)}`;

  // 2) QR kod (PNG dataURL)
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 256,
    errorCorrectionLevel: "M",
    color: { dark: "#0c1d33", light: "#ffffffff" },
  });

  // 3) Ekstre verisi + PDF render
  registerReportPdfFonts();
  const data = await buildStatement(admin, bankAccountId, months, qrDataUrl);
  data.stamp_data_url = loadCompanyStamp();
  const el = createElement(StatementPdfDocument, { data });
  const buffer = await renderToBuffer(el as never);

  const safeAcct = data.account.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 32);
  const fileName = `ekstre_${safeAcct}_${months}ay.pdf`;
  return { buffer, fileName, publicUrl };
}
