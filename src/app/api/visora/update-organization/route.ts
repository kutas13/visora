import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/platform/auth";
import { sanitizeInput } from "@/lib/security";

export const dynamic = "force-dynamic";

const ORG_STATUSES = new Set(["active", "suspended", "cancelled"]);
const SUB_STATUSES = new Set(["active", "paused", "cancelled"]);

export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { userClient } = auth.ctx;

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId gerekli." }, { status: 400 });
  }

  const monthlyFee = body?.monthlyFee !== undefined ? Number(body.monthlyFee) : null;
  const planName = body?.planName !== undefined ? sanitizeInput(body.planName, 50) : null;
  const subscriptionStatus =
    typeof body?.subscriptionStatus === "string" && SUB_STATUSES.has(body.subscriptionStatus)
      ? body.subscriptionStatus
      : null;
  const orgStatus =
    typeof body?.orgStatus === "string" && ORG_STATUSES.has(body.orgStatus) ? body.orgStatus : null;

  if (orgStatus) {
    const { error: oErr } = await userClient
      .from("organizations")
      .update({ status: orgStatus })
      .eq("id", organizationId);
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
  }

  const subPatch: Record<string, unknown> = {};
  if (monthlyFee !== null && Number.isFinite(monthlyFee) && monthlyFee >= 0) subPatch.monthly_fee = monthlyFee;
  if (planName) subPatch.plan_name = planName;
  if (subscriptionStatus) subPatch.status = subscriptionStatus;

  if (Object.keys(subPatch).length > 0) {
    const { data: existing } = await userClient
      .from("platform_subscriptions")
      .select("id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existing?.id) {
      const { error: uErr } = await userClient
        .from("platform_subscriptions")
        .update(subPatch)
        .eq("id", existing.id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    } else {
      const { error: iErr } = await userClient.from("platform_subscriptions").insert({
        organization_id: organizationId,
        monthly_fee: subPatch.monthly_fee ?? 0,
        plan_name: (subPatch.plan_name as string) || "standart",
        status: (subPatch.status as string) || "active",
      });
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
