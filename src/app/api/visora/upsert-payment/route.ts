import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/platform/auth";
import { sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { userClient } = auth.ctx;

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const periodYear = Number(body?.periodYear);
  const periodMonth = Number(body?.periodMonth);
  const amount = Number(body?.amount);
  const paid = Boolean(body?.paid);
  const paymentMethod = body?.paymentMethod ? sanitizeInput(String(body.paymentMethod), 50) : null;
  const note = body?.note ? sanitizeInput(String(body.note), 500) : null;

  if (!organizationId || !Number.isInteger(periodYear) || !Number.isInteger(periodMonth)) {
    return NextResponse.json({ error: "organizationId, periodYear, periodMonth gerekli." }, { status: 400 });
  }
  if (periodMonth < 1 || periodMonth > 12) {
    return NextResponse.json({ error: "Ay 1-12 aralığında olmalı." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Tutar geçersiz." }, { status: 400 });
  }

  const { data: existing } = await userClient
    .from("platform_payments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("period_year", periodYear)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await userClient
      .from("platform_payments")
      .update({
        amount,
        paid,
        paid_at: paid ? new Date().toISOString() : null,
        payment_method: paymentMethod,
        note,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await userClient.from("platform_payments").insert({
      organization_id: organizationId,
      period_year: periodYear,
      period_month: periodMonth,
      amount,
      paid,
      paid_at: paid ? new Date().toISOString() : null,
      payment_method: paymentMethod,
      note,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
