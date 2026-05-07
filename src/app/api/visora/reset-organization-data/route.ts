import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner, SERVICE_KEY_SETUP_HINT } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tek bir sirketin OPERASYONEL verilerini sifirlar.
 *
 * - Sirketin kendisi (organizations) korunur.
 * - Kullanicilar (profiles + auth.users) korunur.
 * - Abonelik & platform faturalari (platform_subscriptions / platform_payments) korunur.
 *
 * Silinen veriler:
 *   - visa_files (CASCADE ile visa_file_expenses)
 *   - payments (org_id veya o sirketin file_id'lerine bagli olanlar)
 *   - daily_reports
 *   - activity_logs
 *   - randevu_talepleri
 *   - visa_groups
 *   - companies (cariler)
 *   - cash_transactions
 *   - cash_accounts (sonra default 3 nakit kasa yeniden olusturulur)
 *   - bank_accounts (CASCADE -> bank tipindeki cash_accounts da gider)
 *   - cash_movements (eski tablo, varsa)
 *   - reference_logos
 *   - commission_rates
 *   - notifications (sirket kullanicilarinin)
 *
 * Body: { organizationId: string, confirmName: string }
 * confirmName, sirket adiyla AYNEN eslesmeli.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;
  if (!admin) {
    return NextResponse.json({ error: SERVICE_KEY_SETUP_HINT }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
  const confirmName = typeof body?.confirmName === "string" ? body.confirmName.trim() : "";
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId gerekli." }, { status: 400 });
  }

  // 1) Sirketi dogrula
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr || !org) {
    return NextResponse.json({ error: "Sirket bulunamadi." }, { status: 404 });
  }
  if ((org as { name: string }).name !== confirmName) {
    return NextResponse.json(
      { error: `Onay metni sirket adiyla eslesmiyor. Beklenen: "${(org as { name: string }).name}"` },
      { status: 400 }
    );
  }

  // 2) Sirketin kullanicilarini al (notifications icin)
  const { data: members } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId);
  const memberIds = ((members as { id: string }[] | null) || []).map((m) => m.id);

  // 3) Sirketin visa_files id'lerini al (file_id'ye bagli payments icin)
  const { data: vfRows } = await admin
    .from("visa_files")
    .select("id")
    .eq("organization_id", organizationId);
  const fileIds = ((vfRows as { id: string }[] | null) || []).map((f) => f.id);

  const skipped: string[] = [];
  const counts: Record<string, number> = {};

  const tryStep = async (label: string, fn: () => Promise<number | null>) => {
    try {
      const n = await fn();
      if (n !== null) counts[label] = n;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        /relation .* does not exist/i.test(msg) ||
        /column .* does not exist/i.test(msg) ||
        /could not find the .* column/i.test(msg) ||
        /could not find the table/i.test(msg) ||
        /schema cache/i.test(msg)
      ) {
        skipped.push(`${label}: ${msg}`);
        return;
      }
      throw new Error(`${label}: ${msg}`);
    }
  };

  const delByOrg = async (table: string) => {
    const { error, count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .eq("organization_id", organizationId);
    if (error) throw error;
    return count ?? 0;
  };

  try {
    // SIRA: bagimlilik nedeniyle once cocuklar, sonra ebeveynler.
    // payments visa_files'a SET NULL'la bagli ama biz iki kanaldan da silelim.

    await tryStep("payments(by org)", () => delByOrg("payments"));
    if (fileIds.length > 0) {
      await tryStep("payments(by file_id)", async () => {
        const { error, count } = await admin
          .from("payments")
          .delete({ count: "exact" })
          .in("file_id", fileIds);
        if (error) throw error;
        return count ?? 0;
      });
    }

    await tryStep("daily_reports", () => delByOrg("daily_reports"));
    await tryStep("activity_logs", () => delByOrg("activity_logs"));
    await tryStep("randevu_talepleri", () => delByOrg("randevu_talepleri"));

    if (memberIds.length > 0) {
      await tryStep("notifications", async () => {
        const { error, count } = await admin
          .from("notifications")
          .delete({ count: "exact" })
          .in("user_id", memberIds);
        if (error) throw error;
        return count ?? 0;
      });
    }

    // visa_files -> CASCADE ile visa_file_expenses gider
    await tryStep("visa_files", () => delByOrg("visa_files"));
    await tryStep("visa_groups", () => delByOrg("visa_groups"));
    await tryStep("companies", () => delByOrg("companies"));

    // Kasa-iliskili: once transaction'lar, sonra accounts/banks
    await tryStep("cash_transactions", () => delByOrg("cash_transactions"));
    await tryStep("cash_movements", () => delByOrg("cash_movements")); // eski tablo, yoksa skipped
    await tryStep("cash_accounts", () => delByOrg("cash_accounts"));
    await tryStep("bank_accounts", () => delByOrg("bank_accounts"));

    await tryStep("reference_logos", () => delByOrg("reference_logos"));
    await tryStep("commission_rates", () => delByOrg("commission_rates"));

    // 4) 3 default nakit kasayi yeniden olustur (TL/EUR/USD).
    // cash_accounts daha onceki adimda silindigi icin direkt insert edilir.
    await tryStep("seed_default_cash_accounts", async () => {
      const { error } = await admin.from("cash_accounts").insert([
        { organization_id: organizationId, kind: "cash", currency: "TL", name: "TL Nakit Kasası", is_active: true },
        { organization_id: organizationId, kind: "cash", currency: "EUR", name: "EUR Nakit Kasası", is_active: true },
        { organization_id: organizationId, kind: "cash", currency: "USD", name: "USD Nakit Kasası", is_active: true },
      ]);
      if (error) throw error;
      return 3;
    });

    return NextResponse.json({
      ok: true,
      organizationId,
      organizationName: (org as { name: string }).name,
      counts,
      skipped,
      message: `${(org as { name: string }).name} verileri sıfırlandı. Kullanıcılar ve abonelik bilgileri korundu.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg, counts, skipped }, { status: 500 });
  }
}
