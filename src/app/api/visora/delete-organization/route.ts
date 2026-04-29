import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner, SERVICE_KEY_SETUP_HINT } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Visora platform sahibi: bir sirketi tamamen siler.
 *
 * - profiles + organizations.id ON DELETE CASCADE oldugu icin
 *   (021 migrationda) organizations satirinin silinmesi tum bagli
 *   satirlari (profiles, visa_files, payments, randevular,
 *   commission_rates, platform_subscriptions, ...) FK CASCADE ile
 *   temizler.
 * - Auth kullanicilari ayrica auth.admin.deleteUser ile silinir.
 *
 * Body: { organizationId: string, confirmName: string }
 *   confirmName, sirket adiyla aynen eslemeli (yanlis silmeyi onlemek icin).
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;
  if (!admin) {
    return NextResponse.json({ error: SERVICE_KEY_SETUP_HINT }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const organizationId =
    typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
  const confirmName =
    typeof body?.confirmName === "string" ? body.confirmName.trim() : "";

  if (!organizationId) {
    return NextResponse.json(
      { error: "organizationId gerekli." },
      { status: 400 }
    );
  }

  // 1) Sirket bilgisi
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org) {
    return NextResponse.json(
      { error: "Şirket bulunamadı." },
      { status: 404 }
    );
  }

  if ((org as any).name !== confirmName) {
    return NextResponse.json(
      {
        error: `Onay metni şirket adıyla eşleşmiyor. Beklenen: "${(org as any).name}"`,
      },
      { status: 400 }
    );
  }

  // 2) O sirkete bagli tum kullanicilari bul (auth.admin.deleteUser icin)
  const { data: members } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId);

  const memberIds = ((members as any[] | null) || []).map((m) => m.id as string);

  // 3) Sirketi sil — DB CASCADE ile bagli satirlar gider.
  const { error: delErr } = await admin
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (delErr) {
    return NextResponse.json(
      { error: `Şirket silinemedi: ${delErr.message}` },
      { status: 500 }
    );
  }

  // 4) Auth kullanicilarini sil. Hata olsa bile akisi bozma; Owner
  //    sonradan auth panelinden temizleyebilir.
  const authResults: { userId: string; ok: boolean; error?: string }[] = [];
  for (const uid of memberIds) {
    try {
      const { error } = await admin.auth.admin.deleteUser(uid);
      authResults.push({
        userId: uid,
        ok: !error,
        error: error?.message,
      });
    } catch (e: any) {
      authResults.push({ userId: uid, ok: false, error: e?.message });
    }
  }

  return NextResponse.json({
    ok: true,
    deletedOrganizationId: organizationId,
    deletedOrganizationName: (org as any).name,
    deletedAuthUsers: authResults.length,
    authResults,
    message: `${(org as any).name} ve bağlı tüm veriler silindi.`,
  });
}
