import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Giriş / Çıkış audit log yardımcıları.
 *
 * - Sadece 'admin' (Genel Müdür) ve 'staff' (Personel) için yazılır.
 *   Platform owner'lar için log tutulmaz (talep gereği).
 * - Hata durumunda sessiz kalır — auth akışını bloklamamak için.
 * - activity_logs tablosu satır seviyesinde RLS ile korunur:
 *   "Users can insert own logs" policy'si actor_id = auth.uid() koşulunu
 *   sağladığımız için yetkili olur.
 */

export type AuthLogType = "login" | "logout";

type Profile = {
  id: string;
  role: string | null;
  name: string | null;
  organization_id: string | null;
};

async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, role, name, organization_id")
    .eq("id", userId)
    .single();
  return (data as Profile | null) || null;
}

/**
 * Giriş/Çıkış olayını activity_logs tablosuna yazar.
 * Platform owner için yazmaz.
 */
export async function logAuthEvent(
  supabase: SupabaseClient,
  type: AuthLogType,
  options?: { userId?: string; userAgent?: string }
) {
  try {
    let userId = options?.userId;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
    }

    const profile = await getProfile(supabase, userId);
    if (!profile) return;
    if (profile.role === "platform_owner") return;

    const roleLabel =
      profile.role === "admin" ? "Genel müdür" :
      profile.role === "staff" ? "Personel" :
      profile.role === "muhasebe" ? "Muhasebe" :
      "Kullanıcı";

    const verb = type === "login" ? "giriş yaptı" : "çıkış yaptı";
    const message = `${profile.name || roleLabel} (${roleLabel.toLowerCase()}) sisteme ${verb}.`;

    await supabase.from("activity_logs").insert({
      type,
      message,
      actor_id: userId,
      organization_id: profile.organization_id,
    });
  } catch {
    // Audit logu auth akışını bloklayamaz — sessizce yut.
  }
}

export const logLogin = (supabase: SupabaseClient, userId?: string) =>
  logAuthEvent(supabase, "login", userId ? { userId } : undefined);

export const logLogout = (supabase: SupabaseClient, userId?: string) =>
  logAuthEvent(supabase, "logout", userId ? { userId } : undefined);
