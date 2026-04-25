import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateOrigin, sanitizeInput } from "@/lib/security";
import { explainAuthAdminError, SERVICE_KEY_SETUP_HINT } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

const STAFF_LIMIT = 3;

function isLikelyServiceRoleKey(key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== 3) return true;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    );
    return payload?.role === "service_role";
  } catch {
    return true;
  }
}

/**
 * Genel müdür (admin): firmaya en fazla 3 personel (staff) ekler.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!validateOrigin(origin, host)) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
  }

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const { data: me, error: profErr } = await authClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single();

  if (profErr || !me?.organization_id) {
    return NextResponse.json({ error: "Profil veya firma bilgisi bulunamadı." }, { status: 403 });
  }

  if (me.role !== "admin") {
    return NextResponse.json({ error: "Sadece genel müdür personel ekleyebilir." }, { status: 403 });
  }

  const { count, error: cntErr } = await authClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", me.organization_id)
    .eq("role", "staff");

  if (cntErr) {
    return NextResponse.json({ error: "Kontenjan sorgulanamadı." }, { status: 500 });
  }

  if ((count ?? 0) >= STAFF_LIMIT) {
    return NextResponse.json(
      { error: `Bu firmada en fazla ${STAFF_LIMIT} personel hesabı açılabilir.` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = sanitizeInput(body?.name || "", 80);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: "Ad, e-posta ve en az 8 karakter şifre gerekli." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !isLikelyServiceRoleKey(serviceKey)) {
    return NextResponse.json({ error: SERVICE_KEY_SETUP_HINT }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role: "staff",
      organization_id: me.organization_id,
    },
  });

  if (createErr || !created?.user?.id) {
    const msg = explainAuthAdminError(createErr?.message || "Kullanıcı oluşturulamadı.");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Profile'ı garantili olarak staff yap (trigger'a guvenmek yerine zorla).
  const { error: profUpsertErr } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      name,
      role: "staff",
      organization_id: me.organization_id,
    },
    { onConflict: "id" }
  );
  if (profUpsertErr) {
    return NextResponse.json(
      { error: `Personel profili yazılamadı: ${profUpsertErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    userId: created.user.id,
    message: "Personel hesabı oluşturuldu.",
    staffCount: (count ?? 0) + 1,
    staffLimit: STAFF_LIMIT,
  });
}
