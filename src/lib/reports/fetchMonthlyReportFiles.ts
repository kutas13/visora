import { createClient } from "@supabase/supabase-js";
import type { RawFileRow } from "./buildMonthlySummary";
import { monthBoundsISO } from "./buildMonthlySummary";

export async function fetchMonthlyReportFiles(year: number, month: number): Promise<RawFileRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service yapılandırması eksik.");

  const { start, endExclusive } = monthBoundsISO(year, month);
  const supabase = createClient(url, key);

  const { data, error } = await supabase
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
