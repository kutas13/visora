import { NextRequest, NextResponse } from "next/server";

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
  // KARA LISTE: Spyke Turizm'e hicbir mail gonderilmemesi icin bu
  // endpoint disabled. Mailer.ts seviyesinde de pattern bazli engel var,
  // burada erken donerek zaman da kazaniyoruz.
  return NextResponse.json(
    {
      ok: false,
      skipped: true,
      reason: "Spyke Turizm kara listede; hicbir mail gonderilemez.",
    },
    { status: 410 }
  );
  // eski kod (referans icin):
  // const result = await sendWelcomeEmail({ ... });
}
