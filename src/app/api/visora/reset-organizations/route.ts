import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformOwner, SERVICE_KEY_SETUP_HINT } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

/**
 * TEHLIKELI: Tum organizations + bagli verileri (visa_files, payments,
 * daily_reports, activity_logs, companies, notifications, profiles
 * (platform_owner haric), auth.users) siler.
 *
 * Sadece platform_owner cagirabilir. Body: { confirm: "VISORA_RESET" }
 *
 * Dayanikli: 023 migration uygulanmamis olsa da (organization_id kolonu
 * yoksa) calisir. Eksik tablo/kolon hatalarini sessizce gecer.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { admin, userId } = auth.ctx;

  if (!admin) {
    return NextResponse.json({ error: SERVICE_KEY_SETUP_HINT }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirm !== "VISORA_RESET") {
    return NextResponse.json(
      { error: "Onay yok. body.confirm 'VISORA_RESET' olmali." },
      { status: 400 }
    );
  }

  const skipped: string[] = [];
  const tryStep = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Eksik kolon/tablo durumunu sessizce atla, gercek hatayi yukari at
      if (
        /column .* does not exist/i.test(msg) ||
        /relation .* does not exist/i.test(msg) ||
        /could not find the .* column/i.test(msg) ||
        /could not find the table/i.test(msg)
      ) {
        skipped.push(`${label}: ${msg}`);
        return;
      }
      throw new Error(`${label}: ${msg}`);
    }
  };

  try {
    // 1) Silinecek profiller (platform_owner haric)
    const { data: doomedProfiles, error: profErr } = await admin
      .from("profiles")
      .select("id")
      .neq("role", "platform_owner");
    if (profErr) throw new Error(`profiles okunamadi: ${profErr.message}`);
    const doomedIds = (doomedProfiles ?? []).map((p) => p.id as string);

    // 2) activity_logs — actor_id ve organization_id (varsa)
    await tryStep("activity_logs.organization_id", async () => {
      const { error } = await admin
        .from("activity_logs")
        .delete()
        .not("organization_id", "is", null);
      if (error) throw error;
    });
    if (doomedIds.length > 0) {
      await tryStep("activity_logs.actor_id", async () => {
        const { error } = await admin
          .from("activity_logs")
          .delete()
          .in("actor_id", doomedIds);
        if (error) throw error;
      });
    }

    // 3) notifications
    if (doomedIds.length > 0) {
      await tryStep("notifications", async () => {
        const { error } = await admin
          .from("notifications")
          .delete()
          .in("user_id", doomedIds);
        if (error) throw error;
      });
    }

    // 4) payments — organization_id (varsa) + visa_files'a bagli olanlar
    await tryStep("payments.organization_id", async () => {
      const { error } = await admin
        .from("payments")
        .delete()
        .not("organization_id", "is", null);
      if (error) throw error;
    });
    // bagimli silme: kalan visa_files'in payments'larini sileriz (asagida visa_files silinmeden once)
    if (doomedIds.length > 0) {
      await tryStep("payments(via visa_files)", async () => {
        const { data: vfs } = await admin
          .from("visa_files")
          .select("id")
          .in("assigned_user_id", doomedIds);
        const fileIds = (vfs ?? []).map((v) => v.id as string);
        if (fileIds.length === 0) return;
        const { error } = await admin.from("payments").delete().in("file_id", fileIds);
        if (error) throw error;
      });
    }

    // 5) daily_reports
    await tryStep("daily_reports.organization_id", async () => {
      const { error } = await admin
        .from("daily_reports")
        .delete()
        .not("organization_id", "is", null);
      if (error) throw error;
    });
    if (doomedIds.length > 0) {
      await tryStep("daily_reports.user_id", async () => {
        const { error } = await admin
          .from("daily_reports")
          .delete()
          .in("user_id", doomedIds);
        if (error) throw error;
      });
    }

    // 6) visa_files
    await tryStep("visa_files.organization_id", async () => {
      const { error } = await admin
        .from("visa_files")
        .delete()
        .not("organization_id", "is", null);
      if (error) throw error;
    });
    if (doomedIds.length > 0) {
      await tryStep("visa_files.assigned_user_id", async () => {
        const { error } = await admin
          .from("visa_files")
          .delete()
          .in("assigned_user_id", doomedIds);
        if (error) throw error;
      });
    }

    // 7) companies (cari)
    await tryStep("companies", async () => {
      const { error } = await admin
        .from("companies")
        .delete()
        .gte("created_at", "1900-01-01");
      if (error) throw error;
    });

    // 8) platform_payments + platform_subscriptions
    await tryStep("platform_payments", async () => {
      const { error } = await admin
        .from("platform_payments")
        .delete()
        .gte("amount", -1e18);
      if (error) throw error;
    });
    await tryStep("platform_subscriptions", async () => {
      const { error } = await admin
        .from("platform_subscriptions")
        .delete()
        .gte("monthly_fee", -1e18);
      if (error) throw error;
    });

    // 9) profiles (platform_owner haric)
    let removedAuth = 0;
    const failedAuth: string[] = [];
    if (doomedIds.length > 0) {
      const { error } = await admin.from("profiles").delete().in("id", doomedIds);
      if (error) throw new Error(`profiles: ${error.message}`);

      // 10) auth.users — admin api ile tek tek
      removedAuth = await deleteAuthUsers(admin, doomedIds, userId, failedAuth);
    }

    // 11) organizations
    {
      const { error } = await admin
        .from("organizations")
        .delete()
        .gte("created_at", "1900-01-01");
      if (error) throw new Error(`organizations: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      deletedProfiles: doomedIds.length,
      deletedAuthUsers: removedAuth,
      failedAuthUsers: failedAuth,
      skipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg, skipped }, { status: 500 });
  }
}

async function deleteAuthUsers(
  admin: SupabaseClient,
  ids: string[],
  selfId: string,
  failed: string[]
): Promise<number> {
  let removed = 0;
  for (const id of ids) {
    if (id === selfId) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failed.push(`${id}: ${error.message}`);
    else removed += 1;
  }
  return removed;
}
