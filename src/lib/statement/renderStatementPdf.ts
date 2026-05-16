import fs from "fs";
import path from "path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { registerReportPdfFonts } from "@/lib/reports/registerReportPdfFonts";
import { StatementPdfDocument } from "./StatementPdfDocument";
import { buildStatement } from "./buildStatement";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signStatementToken } from "./token";

/** Sirket kasesi public/seal/company-stamp.png'den okunup data:url'e cevirilir.
 *  Tum ekstreler ayni kase ile imzalanir (Visora platform kasesi). */
let cachedStampDataUrl: string | null = null;
function loadCompanyStamp(): string | null {
  if (cachedStampDataUrl) return cachedStampDataUrl;
  try {
    const p = path.join(process.cwd(), "public", "seal", "company-stamp.png");
    const buf = fs.readFileSync(p);
    cachedStampDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedStampDataUrl;
  } catch {
    return null;
  }
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
