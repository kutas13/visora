import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateOrigin, sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function authAndOrg(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!validateOrigin(origin, host)) {
    return { err: NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 }) };
  }

  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return { err: NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 }) };
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const orgId = profile?.organization_id as string | null | undefined;
  if (!orgId) {
    return { err: NextResponse.json({ error: "Şirket bağlamı bulunamadı." }, { status: 403 }) };
  }
  if (profile?.role !== "admin") {
    return { err: NextResponse.json({ error: "Yalnızca Genel Müdür değişiklik yapabilir." }, { status: 403 }) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { err: NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 }) };
  }
  return { user, orgId, supabase: createClient(supabaseUrl, serviceKey) };
}

/**
 * PATCH /api/bank-accounts/:id
 *   - Hesap sahibi adi, banka adi, IBAN, currency, notes, is_active gibi
 *     alanlari guncellemek icin. Sadece admin.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ctxRes = await authAndOrg(request);
    if ("err" in ctxRes) return ctxRes.err;
    const { orgId, supabase } = ctxRes;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") {
      const v = sanitizeInput(body.name, 120).trim();
      if (!v) return NextResponse.json({ error: "Hesap sahibi adı zorunludur." }, { status: 400 });
      update.name = v;
    }
    if (typeof body.bank_name === "string") {
      update.bank_name = sanitizeInput(body.bank_name, 120).trim() || null;
    }
    if (typeof body.iban === "string") {
      update.iban = sanitizeInput(body.iban, 50).replace(/\s+/g, "").toUpperCase().trim() || null;
    }
    if (typeof body.currency === "string") {
      const c = body.currency.toUpperCase();
      if (!["TL", "EUR", "USD"].includes(c)) {
        return NextResponse.json({ error: "Geçersiz para birimi." }, { status: 400 });
      }
      update.currency = c;
    }
    if (typeof body.notes === "string") {
      update.notes = sanitizeInput(body.notes, 500).trim() || null;
    }
    if (typeof body.is_active === "boolean") {
      update.is_active = body.is_active;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bank_accounts")
      .update(update)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) {
      console.error("Bank account patch error:", error);
      const friendly =
        error.code === "23505"
          ? "Bu isimde bir banka hesabı zaten mevcut."
          : "Banka hesabı güncellenemedi.";
      return NextResponse.json({ error: friendly }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Bank account PATCH error:", err);
    return NextResponse.json({ error: err?.message || "Sunucu hatası." }, { status: 500 });
  }
}

/**
 * DELETE /api/bank-accounts/:id
 *   - Soft-delete: is_active=false isaretler. Hesap sahibi adina baglanmis
 *     onceki ödemeler korunur, raporlama dogru kalir. Sadece admin.
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ctxRes = await authAndOrg(request);
    if ("err" in ctxRes) return ctxRes.err;
    const { orgId, supabase } = ctxRes;

    const { data, error } = await supabase
      .from("bank_accounts")
      .update({ is_active: false })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) {
      console.error("Bank account delete error:", error);
      return NextResponse.json({ error: "Banka hesabı silinemedi." }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Bank account DELETE error:", err);
    return NextResponse.json({ error: err?.message || "Sunucu hatası." }, { status: 500 });
  }
}
