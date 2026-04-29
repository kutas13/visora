import { createClient } from "@supabase/supabase-js";

/**
 * Server-side mailer yardimcilari.
 *
 * Email gondermek icin organizasyonun Genel Muduru'nu (admin role) ve
 * organizasyon adini cozeriz. RLS bypass'i icin service role anahtari
 * gerekir; bu yuzden cagrilar yalniz API route'larindan olmalidir.
 */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface OrgContext {
  organizationId: string;
  organizationName: string;
  gmName: string;
  gmEmail: string;
  gmUserId: string;
}

/**
 * Bir kullanici id'si verilince o kullanicinin baglandigi
 * organizasyonun adini, GM (admin role) profilini ve auth email'ini doner.
 */
export async function resolveOrgContextFromUser(
  userId: string
): Promise<OrgContext | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data: actor } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  const orgId = (actor as { organization_id?: string | null } | null)
    ?.organization_id;
  if (!orgId) return null;

  return resolveOrgContextById(orgId);
}

export async function resolveOrgContextById(
  organizationId: string
): Promise<OrgContext | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (!org?.id) return null;

  const { data: gmProfile } = await admin
    .from("profiles")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (!gmProfile?.id) return null;

  // auth.users tablosundan email'i cek (service role ile)
  const { data: gmAuth } = await admin.auth.admin.getUserById(gmProfile.id);
  const gmEmail = gmAuth?.user?.email || "";
  if (!gmEmail) return null;

  return {
    organizationId: org.id as string,
    organizationName: (org as any).name as string,
    gmName: (gmProfile as any).name || "Genel Müdür",
    gmEmail,
    gmUserId: gmProfile.id as string,
  };
}

/**
 * Verilen profil id'sinden ad + email'i doner. Hata varsa null.
 */
export async function getProfileWithEmail(
  userId: string
): Promise<{ id: string; name: string; email: string; role: string } | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data: prof } = await admin
    .from("profiles")
    .select("id, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.id) return null;

  const { data: au } = await admin.auth.admin.getUserById(prof.id as string);
  const email = au?.user?.email || "";
  if (!email) return null;

  return {
    id: prof.id as string,
    name: ((prof as any).name as string) || "Kullanıcı",
    email,
    role: ((prof as any).role as string) || "staff",
  };
}
