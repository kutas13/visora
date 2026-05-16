import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderStatementPdf } from "@/lib/statement/renderStatementPdf";
import { verifyStatementToken } from "@/lib/statement/token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/statement/[token]
 *   QR koddan erisilen public ekstre. Token'in icinde bankaAccount/organization +
 *   ay ve son kullanma tarihi var. Auth gerekmez; token'in kendisi ekstreye
 *   imzali bir erisim verir (90 gun gecerli).
 */
export async function GET(_req: NextRequest, ctx: { params: { token: string } }) {
  const payload = verifyStatementToken(ctx.params.token);
  if (!payload) {
    return NextResponse.json(
      { error: "Ekstre bağlantısı geçersiz veya süresi dolmuş." },
      { status: 403 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // banka hesabinin hala org'da var oldugunu dogrula
  const { data: bank } = await admin
    .from("bank_accounts")
    .select("id, organization_id")
    .eq("id", payload.aid)
    .maybeSingle<{ id: string; organization_id: string }>();
  if (!bank || bank.organization_id !== payload.oid) {
    return NextResponse.json({ error: "Hesap bulunamadı" }, { status: 404 });
  }

  const months = (payload.m === 6 || payload.m === 12 ? payload.m : 3) as 3 | 6 | 12;

  const origin = `${_req.nextUrl.protocol}//${_req.nextUrl.host}`;

  try {
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
        // Mobil tarayicida inline acilsin
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "PDF oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
