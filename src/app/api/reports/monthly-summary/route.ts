import { NextRequest, NextResponse } from "next/server";
import { assertMonthlyReportAccess } from "@/lib/reports/assertMonthlyReportAccess";
import { buildMonthlySummary } from "@/lib/reports/buildMonthlySummary";
import { fetchMonthlyReportFiles } from "@/lib/reports/fetchMonthlyReportFiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const files = await fetchMonthlyReportFiles(ym.year, ym.month);
    const summary = buildMonthlySummary(ym.year, ym.month, files, {
      assignedUserId: gate.mode === "staff" ? gate.userId : undefined,
    });
    return NextResponse.json({
      summary,
      rawCount: summary.overall.total,
      mode: gate.mode,
      profileName: gate.profileName,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Rapor oluşturulamadı" }, { status: 500 });
  }
}
