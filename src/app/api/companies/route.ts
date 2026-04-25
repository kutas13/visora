import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimit, validateOrigin, sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Origin kontrolü
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    // Kullanıcı oturumu kontrolü
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await authClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id as string | null | undefined;
    if (!orgId) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("organization_id", orgId)
      .order("firma_adi", { ascending: true });

    if (error) {
      console.error("Companies fetch error:", error);
      return NextResponse.json({ error: "Firmalar listesi alınamadı." }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error("Companies API error:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Origin ve rate limit kontrolü
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!validateOrigin(origin, host)) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`companies:${clientIp}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
    }

    // Kullanıcı oturumu kontrolü
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const firmaAdi = sanitizeInput(body?.firma_adi || "", 100);

    if (!firmaAdi.trim()) {
      return NextResponse.json({ error: "Firma adı zorunludur." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await authClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id as string | null | undefined;
    if (!orgId) {
      return NextResponse.json({ error: "Firma bağlamı bulunamadı." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("companies")
      .insert({
        firma_adi: firmaAdi,
        created_by: user.id,
        organization_id: orgId,
      })
      .select()
      .single();

    if (error) {
      console.error("Company create error:", error);
      return NextResponse.json({ error: "Firma oluşturulamadı." }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Companies POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası." },
      { status: 500 }
    );
  }
}