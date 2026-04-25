import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { assertMonthlyReportAccess } from "@/lib/reports/assertMonthlyReportAccess";
import { buildMonthlySummary } from "@/lib/reports/buildMonthlySummary";
import { fetchMonthlyReportFiles } from "@/lib/reports/fetchMonthlyReportFiles";
import { MonthlySummaryPdfDocument } from "@/lib/reports/MonthlySummaryPdfDocument";
import { registerReportPdfFonts } from "@/lib/reports/registerReportPdfFonts";
import { asciiFilenameFallback, buildMonthlyPdfFilename } from "@/lib/reports/monthlyPdfFilename";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function parseYm(req: NextRequest) {
  const y = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear());
  const m = Number(req.nextUrl.searchParams.get("month") || new Date().getMonth() + 1);
  if (!Number.isFinite(y) || y < 2020 || y > 2100) return null;
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export async function GET(req: NextRequest) {
  const ym = parseYm(req);
  if (!ym) {
    return NextResponse.json({ error: "Geçersiz year / month" }, { status: 400 });
  }

  const gate = await assertMonthlyReportAccess();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  try {
    registerReportPdfFonts();
    const files = await fetchMonthlyReportFiles(
      ym.year,
      ym.month,
      gate.organizationId ?? null
    );
    const summary = buildMonthlySummary(ym.year, ym.month, files, {
      assignedUserId: gate.mode === "staff" ? gate.userId : undefined,
    });
    const pdfEl = createElement(MonthlySummaryPdfDocument, {
      data: summary,
      // org modunda personel toplam kirilim gosteriliyor (admin / muhasebe / owner)
      showPersonelTotals: gate.mode === "org",
    });
    const buffer = await renderToBuffer(pdfEl as any);
    const fname = buildMonthlyPdfFilename(
      gate.profileName,
      ym.year,
      ym.month,
      gate.mode
    );
    const ascii = asciiFilenameFallback(fname);
    const cd = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fname)}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": cd,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "PDF oluşturulamadı" }, { status: 500 });
  }
}
