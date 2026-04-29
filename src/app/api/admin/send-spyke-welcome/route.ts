import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spyke Turizm icin tek seferlik hosgeldin maili.
 *
 *   GET  /api/admin/send-spyke-welcome
 *   POST /api/admin/send-spyke-welcome
 *
 * Modern Visora HTML hosgeldin maili, banner dahil.
 * Alici: info@spyketurizm.com (CC: VISORA_OWNER_EMAIL).
 *
 * Not: Bu endpoint sadece manuel cagrilir; otomatik bir akistan
 * tetiklenmez. URL'i bilen cagrabilir, hassas degildir.
 */
export async function GET(_req: NextRequest) {
  return run();
}

export async function POST(_req: NextRequest) {
  return run();
}

async function run() {
  try {
    const result = await sendWelcomeEmail({
      gmEmail: "info@spyketurizm.com",
      gmName: "Spyke Turizm Yetkilisi",
      organizationName: "Spyke Turizm",
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
