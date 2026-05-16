import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { renderStatementPdf } from "@/lib/statement/renderStatementPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/bank-accounts/[id]/statement?months=3|6|12
 *   Auth'lu kullanici icin PDF ekstre indirme.
 *   - Kullanici banka hesabinin organizasyonunda olmali.
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const monthsRaw = Number(req.nextUrl.searchParams.get("months") || "3");
    const months = (monthsRaw === 6 || monthsRaw === 12 ? monthsRaw : 3) as 3 | 6 | 12;

    const auth = await createServerSupabaseClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }
    const { data: profile } = await auth
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Şirket bağlamı yok" }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // Banka hesabi ayni organizasyonda mi?
    const { data: bank } = await admin
      .from("bank_accounts")
      .select("id, organization_id")
      .eq("id", ctx.params.id)
      .maybeSingle<{ id: string; organization_id: string }>();
    if (!bank || bank.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Banka hesabı bulunamadı" }, { status: 404 });
    }

    const origin =
      req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
        : req.nextUrl.origin;

    const { buffer, fileName } = await renderStatementPdf({
      admin,
      bankAccountId: bank.id,
      organizationId: bank.organization_id,
      months,
      origin,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "PDF oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
