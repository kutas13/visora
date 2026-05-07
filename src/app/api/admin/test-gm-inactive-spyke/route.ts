import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spyke Turizm icin "2 gundur giris yapilmadi" test maili.
 *
 * KARA LISTE: Spyke Turizm'e hicbir mail gonderilmemesi icin bu endpoint
 * tamamen devre disi birakildi. Mailer.ts ve mailerServer.ts katmanlarinda
 * da pattern bazli engel var, ama burada da erken donerek hizliyiz.
 */
async function run() {
  return NextResponse.json(
    {
      ok: false,
      skipped: true,
      reason: "Spyke Turizm kara listede; hicbir mail gonderilemez.",
    },
    { status: 410 }
  );
}

export async function GET(_req: NextRequest) {
  return run();
}

export async function POST(_req: NextRequest) {
  return run();
}
