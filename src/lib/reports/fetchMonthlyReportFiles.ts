import { createClient } from "@supabase/supabase-js";
import type { RawFileRow } from "./buildMonthlySummary";
import { monthBoundsISO } from "./buildMonthlySummary";

/**
 * Belirli bir ay icin sonuclanmis vize dosyalarini doner.
 *
 * organizationId verilirse SADECE o tenant'a ait dosyalari getirir.
 * (visa_files tablosunda dogrudan organization_id yok; atanan
 *  personelin profiles.organization_id'si uzerinden tenant cikarimi
 *  yapilir.)
 */
export async function fetchMonthlyReportFiles(
  year: number,
  month: number,
  organizationId?: string | null
): Promise<RawFileRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service yapılandırması eksik.");

  const { start, endExclusive } = monthBoundsISO(year, month);
  const supabase = createClient(url, key);

  let staffIds: string[] | null = null;
  if (organizationId) {
    const { data: orgUsers, error: orgErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId);
    if (orgErr) throw new Error(orgErr.message);
    staffIds = (orgUsers || []).map((r: any) => r.id as string);
    if (staffIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("visa_files")
    .select(
      `
      id,
      created_at,
      sonuc_tarihi,
      sonuc,
      hedef_ulke,
      ucret,
      ucret_currency,
      assigned_user_id,
      profiles:assigned_user_id (name)
    `
    )
    .gte("sonuc_tarihi", start)
    .lt("sonuc_tarihi", endExclusive)
    .in("sonuc", ["vize_onay", "red"]);

  if (staffIds) {
    query = query.in("assigned_user_id", staffIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => {
    let profiles: { name: string } | null = null;
    const p = row.profiles;
    if (p && typeof p === "object") {
      profiles = Array.isArray(p) ? p[0] ?? null : p;
    }
    return {
      id: row.id,
      created_at: row.created_at,
      sonuc_tarihi: row.sonuc_tarihi,
      sonuc: row.sonuc,
      hedef_ulke: row.hedef_ulke,
      ucret: row.ucret,
      ucret_currency: row.ucret_currency,
      assigned_user_id: row.assigned_user_id,
      profiles,
    };
  });
}
