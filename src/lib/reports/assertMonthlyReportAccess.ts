import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Aylik ozet rapor erisim kontrolu — Visora
 *
 * - admin / muhasebe / platform_owner -> "org" modu: tum sirket raporu
 * - staff                              -> "staff" modu: sadece kendi
 *                                         atadigi dosyalar
 *
 * Eski isim-tabanli erisim kontrolu kaldirildi.
 */
export type MonthlyReportMode = "org" | "staff";

export async function assertMonthlyReportAccess() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false as const, status: 401 as const, message: "Giriş gerekli" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      ok: false as const,
      status: 403 as const,
      message: "Profil bilgisi bulunamadı.",
    };
  }

  const role = profile.role as string | null;

  // Platform owner her şirketin raporunu açıkça yönetebilir; bu raporu
  // (tek-tenant context'i olmadığı için) genelde "org" modunda döndürür.
  if (role === "platform_owner") {
    return {
      ok: true as const,
      profileName: profile.name || "Platform",
      userId: user.id,
      mode: "org" as MonthlyReportMode,
      organizationId: profile.organization_id as string | null,
    };
  }

  if (role === "admin" || role === "muhasebe") {
    return {
      ok: true as const,
      profileName: profile.name || "Yönetici",
      userId: user.id,
      mode: "org" as MonthlyReportMode,
      organizationId: profile.organization_id as string | null,
    };
  }

  // staff
  return {
    ok: true as const,
    profileName: profile.name || "Personel",
    userId: user.id,
    mode: "staff" as MonthlyReportMode,
    organizationId: profile.organization_id as string | null,
  };
}
