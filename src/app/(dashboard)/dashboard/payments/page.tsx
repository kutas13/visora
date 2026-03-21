"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AppPayment {
  id: string; country: string; visa_type: string;
  ucret: number | null; ucret_currency: string | null;
  odeme_plani: string | null; odeme_durumu: string | null;
  cari_tipi: string | null; cari_sahibi: string | null;
  created_at: string; assigned_user_id: string | null;
  clients?: any;
}

const PLAN_LABELS: Record<string,string> = { pesin:"Peşin", cari:"Cari", firma_cari:"Firma Cari" };
const PLAN_COLORS: Record<string,string> = { pesin:"bg-green-100 text-green-700", cari:"bg-blue-100 text-blue-700", firma_cari:"bg-purple-100 text-purple-700" };

function sym(c: string | null) { return c === "USD" ? "$" : c === "EUR" ? "€" : "₺"; }
function fmt(v: number, c: string | null) { return `${sym(c)}${v.toLocaleString("tr-TR")}`; }

function sumByCurrency(items: AppPayment[]) {
  const map: Record<string, number> = {};
  items.forEach(a => {
    const cur = a.ucret_currency || "TL";
    map[cur] = (map[cur] || 0) + Number(a.ucret || 0);
  });
  return Object.entries(map).map(([cur, total]) => ({ cur, total }));
}

export default function PaymentsPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [apps, setApps] = useState<AppPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => { setAgencyId(localStorage.getItem("agency_id")); setUserRole(localStorage.getItem("user_role")); setUserId(localStorage.getItem("user_id")); }, []);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    let q = supabase.from("applications").select("id, country, visa_type, ucret, ucret_currency, odeme_plani, odeme_durumu, cari_tipi, cari_sahibi, created_at, assigned_user_id, clients(full_name)").eq("agency_id", agencyId).not("ucret", "is", null).order("created_at", { ascending: false });
    if (userRole === "staff" && userId) q = q.eq("assigned_user_id", userId);
    const { data } = await q;
    setApps(data || []); setLoading(false);
  }, [agencyId, supabase, userRole, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = filter === "all" ? apps : apps.filter(a => a.odeme_plani === filter);

  const pesinItems = apps.filter(a => a.odeme_plani === "pesin");
  const cariItems = apps.filter(a => a.odeme_plani === "cari");
  const firmaItems = apps.filter(a => a.odeme_plani === "firma_cari");

  const toggleOdeme = async (id: string, current: string | null) => {
    await supabase.from("applications").update({ odeme_durumu: current === "odendi" ? "odenmedi" : "odendi" }).eq("id", id);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/20">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div><h1 className="text-xl font-bold text-navy-900">Ödemeler</h1><p className="text-xs text-navy-400">{apps.length} dosya</p></div>
      </div>

      {/* Summary by currency */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["TL", "EUR", "USD"] as const).map(cur => {
          const curApps = apps.filter(a => (a.ucret_currency || "TL") === cur);
          const total = curApps.reduce((s, a) => s + Number(a.ucret || 0), 0);
          const odenen = curApps.filter(a => a.odeme_durumu === "odendi").reduce((s, a) => s + Number(a.ucret || 0), 0);
          const bekleyen = total - odenen;
          const curSym = cur === "USD" ? "$" : cur === "EUR" ? "€" : "₺";
          const colors = cur === "TL" ? "from-green-500 to-green-600" : cur === "EUR" ? "from-blue-500 to-blue-600" : "from-amber-500 to-amber-600";
          return (
            <div key={cur} className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
              <div className={`bg-gradient-to-r ${colors} px-5 py-3 flex items-center justify-between`}>
                <span className="text-sm font-bold text-white">{cur}</span>
                <span className="text-2xl font-black text-white/90">{curSym}</span>
              </div>
              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-navy-500">Toplam</span>
                  <span className="text-lg font-bold text-navy-900">{curSym}{total.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600">Ödenen</span>
                  <span className="text-sm font-semibold text-green-600">{curSym}{odenen.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-500">Bekleyen</span>
                  <span className="text-sm font-semibold text-red-500">{curSym}{bekleyen.toLocaleString("tr-TR")}</span>
                </div>
                <div className="mt-1 text-[10px] text-navy-400 text-right">{curApps.length} dosya</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[{ k:"all",l:"Tümü" },{ k:"pesin",l:"Peşin" },{ k:"cari",l:"Cari" },{ k:"firma_cari",l:"Firma Cari" }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${filter === f.k ? "bg-navy-800 text-white" : "bg-white text-navy-500 border border-navy-200"}`}>{f.l}</button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
        : filtered.length === 0 ? <div className="py-16 text-center text-sm text-navy-400">Ödeme kaydı bulunamadı.</div>
        : <table className="w-full"><thead><tr className="border-b border-navy-100 bg-navy-50/50">
          <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Müşteri</th>
          <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ülke</th>
          <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tutar</th>
          <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Plan</th>
          <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Cari</th>
          <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Durum</th>
          <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tarih</th>
        </tr></thead><tbody className="divide-y divide-navy-50">
          {filtered.map(a => (
            <tr key={a.id} className="hover:bg-primary-50/20 transition-colors">
              <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-50 text-xs font-bold text-green-700">{(a.clients?.full_name||"?")[0]}</div><span className="font-semibold text-navy-900">{a.clients?.full_name||"—"}</span></div></td>
              <td className="px-4 py-4 text-sm text-navy-600">{a.country}</td>
              <td className="px-4 py-4"><span className="text-lg font-bold text-navy-900">{fmt(Number(a.ucret), a.ucret_currency)}</span></td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${PLAN_COLORS[a.odeme_plani||""]||"bg-navy-100 text-navy-600"}`}>{PLAN_LABELS[a.odeme_plani||""]||"—"}</span></td>
              <td className="px-4 py-4 text-xs text-navy-500">{a.cari_sahibi||"—"}</td>
              <td className="px-4 py-4"><button onClick={() => toggleOdeme(a.id, a.odeme_durumu)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-all hover:shadow-md ${a.odeme_durumu === "odendi" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${a.odeme_durumu === "odendi" ? "bg-green-500" : "bg-amber-500"}`} />{a.odeme_durumu === "odendi" ? "Ödendi" : "Bekliyor"}</button></td>
              <td className="px-6 py-4 text-right text-sm text-navy-400">{new Date(a.created_at).toLocaleDateString("tr-TR")}</td>
            </tr>
          ))}
        </tbody></table>}
      </div>
    </div>
  );
}
