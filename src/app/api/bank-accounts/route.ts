import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit, validateOrigin, sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * GET /api/bank-accounts
 *   - Cagiranin sirketinin (organization_id) tum banka hesaplarini doner.
 *   - is_active=false olanlar da listede ama varsayilan filtrelenmez —
 *     UI tarafinda gostermeyiz. Admin sayfasinda gorulebilir.
 */
export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const url = new URL(request.url);
    const onlyActive = url.searchParams.get("active") !== "false";

    const { data: profile } = await authClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id as string | null | undefined;
    if (!orgId) {
      return NextResponse.json({ data: [] });
    }

    let query = authClient
      .from("bank_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (onlyActive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) {
      console.error("Bank accounts fetch error:", error);
      return NextResponse.json({ error: "Banka hesapları alınamadı." }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error("Bank accounts API error:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bank-accounts
 *   - Sadece admin (Genel Mudur) yeni hesap olusturabilir.
 *   - Body: { name, bank_name?, iban?, currency?, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`bank_accounts:${clientIp}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
    }

    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const name = sanitizeInput(body?.name || "", 120).trim();
    const bankName = sanitizeInput(body?.bank_name || "", 120).trim() || null;
    const iban = sanitizeInput(body?.iban || "", 50).replace(/\s+/g, "").toUpperCase().trim() || null;
    const currencyRaw = String(body?.currency || "TL").toUpperCase();
    const currency = ["TL", "EUR", "USD"].includes(currencyRaw) ? currencyRaw : "TL";
    const notes = sanitizeInput(body?.notes || "", 500).trim() || null;

    if (!name) {
      return NextResponse.json({ error: "Hesap sahibi adı zorunludur." }, { status: 400 });
    }

    const { data: profile } = await authClient
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id as string | null | undefined;
    if (!orgId) {
      return NextResponse.json({ error: "Şirket bağlamı bulunamadı." }, { status: 403 });
    }
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Yalnızca Genel Müdür banka hesabı oluşturabilir." }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({
        organization_id: orgId,
        name,
        bank_name: bankName,
        iban,
        currency,
        notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Bank account create error:", error);
      const friendly =
        error.code === "23505"
          ? "Bu isimde bir banka hesabı zaten mevcut."
          : "Banka hesabı oluşturulamadı.";
      return NextResponse.json({ error: friendly }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Bank accounts POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}
