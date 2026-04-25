import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner, SERVICE_KEY_SETUP_HINT } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

/**
 * TEHLIKELI: Tum organizations + bagli verileri (visa_files, payments,
 * daily_reports, activity_logs, companies, notifications, profiles
 * (platform_owner haric), auth.users) siler.
 *
 * Sadece platform_owner cagirabilir. Body: { confirm: "VISORA_RESET" }
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { admin, userClient, userId } = auth.ctx;

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

  try {
    // 1) Silinecek profiller (platform_owner haric)
    const { data: doomedProfiles, error: profErr } = await admin
      .from("profiles")
      .select("id")
      .neq("role", "platform_owner");
    if (profErr) throw new Error(`profiles okunamadi: ${profErr.message}`);
    const doomedIds = (doomedProfiles ?? []).map((p) => p.id as string);

    // 2) Org'a bagli verileri tek tek temizle
    //    activity_logs (organization_id veya silinecek profil actor)
    if (doomedIds.length > 0) {
      const { error } = await admin
        .from("activity_logs")
        .delete()
        .or(`actor_id.in.(${doomedIds.join(",")}),organization_id.not.is.null`);
      if (error) throw new Error(`activity_logs: ${error.message}`);
    } else {
      const { error } = await admin
        .from("activity_logs")
        .delete()
        .not("organization_id", "is", null);
      if (error && !/no rows/i.test(error.message)) throw new Error(`activity_logs: ${error.message}`);
    }

    // notifications (silinecek profillerin)
    if (doomedIds.length > 0) {
      const { error } = await admin
        .from("notifications")
        .delete()
        .in("user_id", doomedIds);
      if (error) throw new Error(`notifications: ${error.message}`);
    }

    // payments (visa_files'a bagli; tum sil)
    {
      const { error } = await admin
        .from("payments")
        .delete()
        .gte("amount", -1e18); // hepsi
      if (error) throw new Error(`payments: ${error.message}`);
    }

    // daily_reports
    {
      const { error } = await admin
        .from("daily_reports")
        .delete()
        .not("organization_id", "is", null);
      if (error) throw new Error(`daily_reports(org): ${error.message}`);
    }
    if (doomedIds.length > 0) {
      const { error } = await admin
        .from("daily_reports")
        .delete()
        .in("user_id", doomedIds);
      if (error) throw new Error(`daily_reports(user): ${error.message}`);
    }

    // visa_files
    {
      const { error } = await admin
        .from("visa_files")
        .delete()
        .not("organization_id", "is", null);
      if (error) throw new Error(`visa_files(org): ${error.message}`);
    }
    if (doomedIds.length > 0) {
      const { error } = await admin
        .from("visa_files")
        .delete()
        .in("assigned_user_id", doomedIds);
      if (error) throw new Error(`visa_files(assigned): ${error.message}`);
    }

    // companies (cari)
    {
      const { error } = await admin.from("companies").delete().gte("created_at", "1900-01-01");
      if (error && !/no rows/i.test(error.message)) throw new Error(`companies: ${error.message}`);
    }

    // platform_payments + platform_subscriptions (orgs CASCADE da yapar ama explicit)
    {
      const { error } = await admin.from("platform_payments").delete().gte("amount", -1e18);
      if (error && !/no rows/i.test(error.message)) throw new Error(`platform_payments: ${error.message}`);
    }
    {
      const { error } = await admin.from("platform_subscriptions").delete().gte("monthly_fee", -1e18);
      if (error && !/no rows/i.test(error.message)) throw new Error(`platform_subscriptions: ${error.message}`);
    }

    // 3) profiles (platform_owner haric)
    if (doomedIds.length > 0) {
      const { error } = await admin.from("profiles").delete().in("id", doomedIds);
      if (error) throw new Error(`profiles: ${error.message}`);

      // 4) auth.users (Supabase auth) — admin api ile tek tek
      let removed = 0;
      const failed: string[] = [];
      for (const id of doomedIds) {
        if (id === userId) continue; // kendini koru (zaten owner ama yine de)
        const { error: authErr } = await admin.auth.admin.deleteUser(id);
        if (authErr) failed.push(`${id}: ${authErr.message}`);
        else removed += 1;
      }

      // 5) organizations
      const { error: orgErr } = await admin
        .from("organizations")
        .delete()
        .gte("created_at", "1900-01-01");
      if (orgErr) throw new Error(`organizations: ${orgErr.message}`);

      // userClient'in cache'ini temizlemek icin kucuk bir read tetikle
      await userClient.from("organizations").select("id").limit(1);

      return NextResponse.json({
        ok: true,
        deletedProfiles: doomedIds.length,
        deletedAuthUsers: removed,
        failedAuthUsers: failed,
      });
    }

    // Hic profil yoksa sadece organizations'i sil
    const { error: orgErr } = await admin
      .from("organizations")
      .delete()
      .gte("created_at", "1900-01-01");
    if (orgErr) throw new Error(`organizations: ${orgErr.message}`);

    return NextResponse.json({ ok: true, deletedProfiles: 0, deletedAuthUsers: 0, failedAuthUsers: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
