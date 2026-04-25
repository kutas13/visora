import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { userClient } = auth.ctx;

  const { data, error } = await userClient.rpc("ensure_all_platform_invoices");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserted: data });
}
