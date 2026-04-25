import { NextRequest, NextResponse } from "next/server";
import {
  requirePlatformOwner,
  explainAuthAdminError,
  SERVICE_KEY_SETUP_HINT,
} from "@/lib/platform/auth";
import { DEFAULT_COMMISSION_ROWS } from "@/lib/saas/defaultCommissionRates";
import { sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Visora platform sahibi tarafından çağırılır.
 * Yeni şirket + genel müdür + abonelik oluşturur.
 *
 * - DB insertleri: caller'in oturumu (RLS uyumlu, is_platform_owner() true).
 * - Auth user oluşturma: yalnızca service role admin client.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { admin, userClient } = auth.ctx;

  if (!admin) {
    return NextResponse.json({ error: SERVICE_KEY_SETUP_HINT }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const orgName = sanitizeInput(body?.orgName || "", 200);
  const adminName = sanitizeInput(body?.adminName || "", 80);
  const adminEmail = typeof body?.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : "";
  const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword : "";
  const monthlyFee = Number(body?.monthlyFee || 0);
  const planName = sanitizeInput(body?.planName || "standart", 50) || "standart";

  if (!orgName || !adminName || !adminEmail || adminPassword.length < 8) {
    return NextResponse.json(
      { error: "Şirket adı, genel müdür adı, e-posta ve en az 8 karakter şifre gerekli." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    return NextResponse.json({ error: "Aylık ücret geçersiz." }, { status: 400 });
  }

  // 1) Şirket: caller (platform_owner) oturumuyla -> RLS geçer
  const { data: org, error: orgErr } = await userClient
    .from("organizations")
    .insert({ name: orgName, billing_email: adminEmail })
    .select("id")
    .single();

  if (orgErr || !org?.id) {
    return NextResponse.json({ error: orgErr?.message || "Şirket oluşturulamadı." }, { status: 500 });
  }

  const organizationId = org.id as string;

  // 2) Auth user: service role gerekli
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      name: adminName,
      role: "admin",
      organization_id: organizationId,
    },
  });

  if (createErr || !created?.user?.id) {
    // Şirketi geri al
    await userClient.from("organizations").delete().eq("id", organizationId);
    return NextResponse.json(
      { error: explainAuthAdminError(createErr?.message || "Genel müdür hesabı oluşturulamadı.") },
      { status: 400 }
    );
  }

  // 2.b) Profile'ı garantili olarak admin yap (trigger'a guvenmek yerine).
  //      Auth'tan gelen user_metadata trigger tarafindan okunmus olabilir
  //      ama hala yanlis role/eski satir varsa burada zorla duzelt.
  const { error: profUpsertErr } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      name: adminName,
      role: "admin",
      organization_id: organizationId,
    },
    { onConflict: "id" }
  );
  if (profUpsertErr) {
    return NextResponse.json(
      { error: `Genel müdür profili yazılamadı: ${profUpsertErr.message}` },
      { status: 500 }
    );
  }

  // 3) Komisyon oranları (caller oturumuyla)
  const seedRows = DEFAULT_COMMISSION_ROWS.map((r) => ({
    organization_id: organizationId,
    country: r.country,
    amount: r.amount,
    currency: r.currency,
  }));
  const { error: comErr } = await userClient.from("commission_rates").insert(seedRows);
  if (comErr) {
    return NextResponse.json(
      { error: `Şirket oluştu, kullanıcı oluştu fakat komisyon oranları yüklenemedi: ${comErr.message}` },
      { status: 500 }
    );
  }

  // 4) Abonelik (caller oturumuyla)
  const { error: subErr } = await userClient.from("platform_subscriptions").insert({
    organization_id: organizationId,
    monthly_fee: monthlyFee,
    plan_name: planName,
    status: "active",
  });
  if (subErr) {
    return NextResponse.json(
      { error: `Şirket oluştu fakat abonelik eklenirken hata: ${subErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    organizationId,
    adminUserId: created.user.id,
    message: "Şirket, genel müdür ve abonelik oluşturuldu.",
  });
}
