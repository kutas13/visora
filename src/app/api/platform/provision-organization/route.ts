import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";
import { DEFAULT_COMMISSION_ROWS } from "@/lib/saas/defaultCommissionRates";

export const dynamic = "force-dynamic";

function secretsMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const hp = createHash("sha256").update(provided, "utf8").digest();
  const he = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(hp, he);
}

/**
 * Sadece platform sahibi: yeni firma (organization) + tek genel müdür (admin) hesabı.
 * Header: x-visora-platform-secret = VISORA_PLATFORM_SETUP_SECRET
 */
export async function POST(request: NextRequest) {
  const secret = process.env.VISORA_PLATFORM_SETUP_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
  }

  const headerSecret = request.headers.get("x-visora-platform-secret") || "";
  if (!secretsMatch(headerSecret, secret)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationName = typeof body?.organizationName === "string" ? body.organizationName.trim() : "";
  const adminName = typeof body?.adminName === "string" ? body.adminName.trim() : "";
  const adminEmail = typeof body?.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : "";
  const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword : "";

  if (!organizationName || !adminName || !adminEmail || adminPassword.length < 8) {
    return NextResponse.json(
      { error: "organizationName, adminName, adminEmail ve en az 8 karakter adminPassword gerekli." },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: organizationName })
    .select("id")
    .single();

  if (orgErr || !org?.id) {
    return NextResponse.json({ error: orgErr?.message || "Organizasyon oluşturulamadı." }, { status: 500 });
  }

  const organizationId = org.id as string;

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      name: adminName,
      role: "admin",
      organization_id: organizationId,
    },
  });

  if (authError || !authUser?.user?.id) {
    await supabase.from("organizations").delete().eq("id", organizationId);
    return NextResponse.json(
      { error: authError?.message || "Admin kullanıcı oluşturulamadı." },
      { status: 400 }
    );
  }

  const rows = DEFAULT_COMMISSION_ROWS.map((r) => ({
    organization_id: organizationId,
    country: r.country,
    amount: r.amount,
    currency: r.currency,
  }));

  const { error: seedErr } = await supabase.from("commission_rates").insert(rows);
  if (seedErr) {
    await supabase.auth.admin.deleteUser(authUser.user.id);
    await supabase.from("organizations").delete().eq("id", organizationId);
    return NextResponse.json({ error: seedErr.message }, { status: 500 });
  }

  return NextResponse.json({
    organizationId,
    adminUserId: authUser.user.id,
    message: "Firma ve genel müdür hesabı oluşturuldu.",
  });
}
