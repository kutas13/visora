import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/security";
import { SERVICE_KEY_SETUP_HINT } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

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
 * Genel mudur (admin) kendi sirketindeki personeli (staff) aktif/pasif yapar.
 *
 * Body: { staffId: string, active: boolean }
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!validateOrigin(origin, host)) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
  }

  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { data: me } = await authClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single();
  if (!me?.organization_id) {
    return NextResponse.json({ error: "Firma bilgisi bulunamadı." }, { status: 403 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Sadece genel müdür personeli devre dışı bırakabilir." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const staffId = typeof body?.staffId === "string" ? body.staffId.trim() : "";
  const active = Boolean(body?.active);
  if (!staffId) return NextResponse.json({ error: "staffId gerekli." }, { status: 400 });
  if (staffId === me.id) {
    return NextResponse.json({ error: "Kendinizi devre dışı bırakamazsınız." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !isLikelyServiceRoleKey(serviceKey)) {
    return NextResponse.json({ error: SERVICE_KEY_SETUP_HINT }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Hedef personeli dogrula: ayni org + role = staff
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, organization_id, name")
    .eq("id", staffId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
  if (target.organization_id !== me.organization_id) {
    return NextResponse.json({ error: "Bu personel sizin şirketinize ait değil." }, { status: 403 });
  }
  if (target.role !== "staff") {
    return NextResponse.json({ error: "Sadece personel hesapları pasifleştirilebilir." }, { status: 400 });
  }

  // is_active flag'i guncelle
  const { error: updErr } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", staffId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Pasif olunca auth oturumlarini bansla (banned_until) ki bir daha login olamasin
  // Ban duration: pasif iken ban; aktif yapilinca ban kaldir.
  try {
    if (active) {
      // Reaktif: ban suresini sifirla (ban_duration: 'none')
      await admin.auth.admin.updateUserById(staffId, { ban_duration: "none" } as never);
    } else {
      // Pasif: 100 yil banla (etkili olarak suresiz)
      await admin.auth.admin.updateUserById(staffId, { ban_duration: "876000h" } as never);
    }
  } catch (e: unknown) {
    // Auth ban islemi basarisiz olsa bile profile flag basariyla degisti — uyari ver
    console.warn("[toggle-staff-active] auth ban update failed:", e);
  }

  return NextResponse.json({
    ok: true,
    staffId,
    is_active: active,
    message: active ? `${target.name} aktifleştirildi.` : `${target.name} devre dışı bırakıldı.`,
  });
}
