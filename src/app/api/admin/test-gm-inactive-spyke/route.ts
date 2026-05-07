import { NextRequest, NextResponse } from "next/server";
import { sendGmLoginReminderEmail } from "@/lib/mailer";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spyke Turizm Genel Müdürü için "2 gündür giriş yapılmadı" test maili.
 *
 *   GET  /api/admin/test-gm-inactive-spyke
 *
 * Mail gönderilir:
 *   TO:  Spyke Turizm GM'inin kayıtlı e-posta adresi (DB'den çekilir)
 *   CC:  gmyusuf13@gmail.com
 */

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function run() {
  // KARA LISTE: Spyke Turizm'e hicbir mail gonderilmemesi icin bu test
  // endpoint'i devre disi. Mailer.ts ve mailerServer.ts'te de pattern
  // bazli engel var; burada erken donerek hizliyiz.
  return NextResponse.json(
    {
      ok: false,
      skipped: true,
      reason: "Spyke Turizm kara listede; hicbir mail gonderilemez.",
    },
    { status: 410 }
  );

  // eslint-disable-next-line no-unreachable
  const supabase = getAdminClient();

  // Spyke Turizm organizasyonunu bul
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .ilike("name", "%spyke%")
    .maybeSingle();

  if (!org?.id) {
    return NextResponse.json(
      { ok: false, error: "Spyke Turizm organizasyonu bulunamadı." },
      { status: 404 }
    );
  }

  // Bu organizasyonun admin (GM) profilini bul
  const { data: gmProfile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("organization_id", org.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!gmProfile?.id) {
    return NextResponse.json(
      { ok: false, error: "Spyke Turizm GM profili bulunamadı." },
      { status: 404 }
    );
  }

  // GM'in auth email adresini çek
  const { data: authUser } = await supabase.auth.admin.getUserById(gmProfile.id as string);
  const gmEmail = authUser?.user?.email;

  if (!gmEmail) {
    return NextResponse.json(
      { ok: false, error: "GM e-posta adresi bulunamadı." },
      { status: 404 }
    );
  }

  // Son giriş kaydını çek (göstermek için)
  const { data: lastLoginRows } = await supabase
    .from("activity_logs")
    .select("created_at")
    .eq("actor_id", gmProfile.id as string)
    .eq("type", "login")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastSeen =
    lastLoginRows && lastLoginRows.length > 0
      ? (lastLoginRows[0] as any).created_at as string
      : null;

  try {
    const result = await sendGmLoginReminderEmail({
      gmEmail,
      gmName: (gmProfile as any).name || "Genel Müdür",
      organizationName: (org as any).name || "Spyke Turizm",
      lastSeen,
    });

    return NextResponse.json({
      ok: true,
      sentTo: gmEmail,
      ownerCopySentTo: "gmyusuf13@gmail.com (ayrı kopya)",
      orgName: (org as any).name,
      lastSeen,
      result,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest) {
  return run();
}

export async function POST(_req: NextRequest) {
  return run();
}
