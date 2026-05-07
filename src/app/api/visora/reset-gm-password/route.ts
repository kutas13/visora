import { NextRequest, NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

/**
 * Platform owner: GM şifresini sıfırlar ve organizations tablosuna yazar.
 *
 * POST /api/visora/reset-gm-password
 * Body: { orgId, adminId, newPassword }
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformOwner();
  if (!auth.ok) return auth.response;
  const { admin, userClient } = auth.ctx;

  if (!admin) {
    return NextResponse.json({ error: "Service role key eksik." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  let adminId = typeof body?.adminId === "string" ? body.adminId : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!orgId || newPassword.length < 8) {
    return NextResponse.json(
      { error: "orgId ve en az 8 karakter newPassword gerekli." },
      { status: 400 }
    );
  }

  // adminId verilmemişse org'un admin'ini otomatik bul
  if (!adminId) {
    const { data: foundAdmin } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("role", "admin")
      .maybeSingle();
    adminId = foundAdmin?.id as string || "";
  }

  if (!adminId) {
    return NextResponse.json({ error: "Bu şirkete bağlı GM bulunamadı." }, { status: 404 });
  }

  // GM'in gerçekten bu org'a ait admin olduğunu doğrula
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", adminId)
    .single();

  if (!profile || profile.role !== "admin" || profile.organization_id !== orgId) {
    return NextResponse.json({ error: "Geçersiz GM bilgisi." }, { status: 400 });
  }

  // Auth şifresini güncelle
  const { error: authErr } = await admin.auth.admin.updateUserById(adminId, {
    password: newPassword,
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  // organizations tablosuna kaydet
  await admin
    .from("organizations")
    .update({ admin_initial_password: newPassword })
    .eq("id", orgId);

  // must_change_password'ı da true yap ki ilk girişte değiştirsin
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", adminId);

  return NextResponse.json({ ok: true, message: "GM şifresi güncellendi." });
}
