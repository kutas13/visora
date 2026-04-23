import { createServerSupabaseClient } from "@/lib/supabase/server";

const REPORT_NAMES = ["DAVUT", "YUSUF", "BAHAR", "ERCAN"] as const;
export type MonthlyReportMode = "davut" | "staff";

export async function assertMonthlyReportAccess() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false as const, status: 401 as const, message: "Giriş gerekli" };
  }
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const name = profile?.name;
  if (!name || !REPORT_NAMES.includes(name as (typeof REPORT_NAMES)[number])) {
    return {
      ok: false as const,
      status: 403 as const,
      message: "Bu rapora yalnızca Davut veya BAHAR / ERCAN / YUSUF erişebilir.",
    };
  }
  const mode: MonthlyReportMode = name === "DAVUT" ? "davut" : "staff";
  return { ok: true as const, profileName: name, userId: user.id, mode };
}
