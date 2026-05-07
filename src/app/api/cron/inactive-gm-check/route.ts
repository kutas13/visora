import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGmLoginReminderEmail, VISORA_OWNER_EMAIL } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron: Genel Müdür 2 Gün Giriş Yapmadı Hatırlatması
 *
 * Her gün çalıştırılmalı. Vercel Cron örneği (vercel.json):
 *   { "path": "/api/cron/inactive-gm-check", "schedule": "0 9 * * *" }
 *
 * Yetkilendirme:
 *   - CRON_SECRET env var set edilmişse Authorization: Bearer <secret> gerekir.
 *   - Vercel Cron otomatik olarak bu header'ı ekler.
 */

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  // CRON_SECRET kontrolü
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
    }
  }

  return runCheck();
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
    }
  }

  return runCheck();
}

async function runCheck(dryRun = false) {
  const supabase = getAdminClient();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff = new Date(now - TWO_DAYS_MS).toISOString();

  // Tüm admin (Genel Müdür) profilleri çek — sadece 2 günden eski hesaplar
  const { data: admins, error: adminsErr } = await supabase
    .from("profiles")
    .select("id, name, organization_id, created_at")
    .eq("role", "admin")
    .lt("created_at", cutoff);

  if (adminsErr || !admins) {
    return NextResponse.json({ ok: false, error: adminsErr?.message }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  for (const admin of admins) {
    const adminId = admin.id as string;
    const adminName = (admin as any).name as string || "Genel Müdür";
    const orgId = (admin as any).organization_id as string | null;

    // Organizasyon adını çek
    let orgName = "Şirketiniz";
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      if (org) orgName = (org as any).name || orgName;
    }

    // Bu admin'in son login kaydını bul
    const { data: lastLoginRows } = await supabase
      .from("activity_logs")
      .select("created_at")
      .eq("actor_id", adminId)
      .eq("type", "login")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastLogin =
      lastLoginRows && lastLoginRows.length > 0
        ? (lastLoginRows[0] as any).created_at as string
        : null;

    // Son giriş 2 günden eskiyse (veya hiç giriş yoksa) mail gönder
    const isInactive = !lastLogin || lastLogin < cutoff;

    if (!isInactive) {
      results[adminId] = { skipped: true, lastLogin, name: adminName };
      continue;
    }

    // GM'in auth email adresini çek
    const { data: authUser } = await supabase.auth.admin.getUserById(adminId);
    const gmEmail = authUser?.user?.email;

    if (!gmEmail) {
      results[adminId] = { error: "email bulunamadı", name: adminName };
      continue;
    }

    if (dryRun) {
      results[adminId] = { dryRun: true, gmEmail, lastLogin, name: adminName, orgName };
      continue;
    }

    try {
      await sendGmLoginReminderEmail({
        gmEmail,
        gmName: adminName,
        organizationName: orgName,
        lastSeen: lastLogin,
      });
      results[adminId] = { sent: true, gmEmail, lastLogin, name: adminName, orgName };
    } catch (e: any) {
      results[adminId] = { error: e?.message || String(e), name: adminName };
    }
  }

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString(), results });
}
