"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ExpiringVisa {
  id: string;
  country: string;
  visa_type: string;
  visa_expiry_date: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients?: any;
}

function daysRemaining(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function daysBadge(days: number) {
  if (days <= 10) return { cls: "bg-red-500 text-white animate-pulse", label: `${days} gün` };
  if (days <= 30) return { cls: "bg-red-100 text-red-700", label: `${days} gün` };
  if (days <= 60) return { cls: "bg-amber-100 text-amber-700", label: `${days} gün` };
  return { cls: "bg-green-100 text-green-700", label: `${days} gün` };
}

export default function VisaExpiryPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [data, setData] = useState<ExpiringVisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "30" | "60">("all");

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("applications")
      .select("id, country, visa_type, visa_expiry_date, clients(full_name, passport_no, phone)")
      .eq("agency_id", agencyId)
      .eq("visa_result", "vize_onay")
      .not("visa_expiry_date", "is", null)
      .order("visa_expiry_date", { ascending: true });
    setData(rows || []);
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const withDays = data.map((v) => ({ ...v, days: daysRemaining(v.visa_expiry_date) }));
  const active = withDays.filter((v) => v.days > 0);
  const critical = active.filter((v) => v.days <= 30);
  const warning = active.filter((v) => v.days > 30 && v.days <= 60);

  const filtered = (() => {
    if (filter === "30") return withDays.filter((v) => v.days > 0 && v.days <= 30);
    if (filter === "60") return withDays.filter((v) => v.days > 0 && v.days <= 60);
    return withDays.filter((v) => v.days > 0);
  })();

  const summaryCards = [
    { title: "Kritik", subtitle: "30 günden az", value: critical.length, icon: "🔴", gradient: "from-red-500 to-red-600", textColor: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    { title: "Uyarı", subtitle: "30-60 gün", value: warning.length, icon: "🟡", gradient: "from-amber-400 to-amber-500", textColor: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { title: "Toplam Aktif", subtitle: "Tüm geçerli vizeler", value: active.length, icon: "🟢", gradient: "from-green-500 to-green-600", textColor: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/20">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy-900">Vize Bitiş Takibi</h1>
          <p className="text-xs text-navy-400">Onaylı vizelerin süre takibi</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((c) => (
          <div key={c.title} className={`rounded-2xl border ${c.border} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">{c.title}</p>
                <p className="mt-1 text-3xl font-bold text-navy-900">{loading ? "..." : c.value}</p>
                <p className="mt-0.5 text-xs text-navy-400">{c.subtitle}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} text-xl text-white shadow-lg`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([["all", "Tümü"], ["30", "< 30 Gün"], ["60", "< 60 Gün"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              filter === key ? "bg-navy-800 text-white" : "bg-white text-navy-500 border border-navy-200 hover:bg-navy-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-navy-400">Bu filtreye uygun kayıt yok.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Kalan Süre</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Müşteri</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ülke</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Pasaport</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Bitiş Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {filtered.map((v) => {
                const badge = daysBadge(v.days);
                return (
                  <tr key={v.id} className="hover:bg-primary-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {v.days <= 10 && (
                          <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">ACİL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-accent-50 text-xs font-bold text-primary-600">
                          {(v.clients?.full_name || "?")[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-navy-900">{v.clients?.full_name || "—"}</p>
                          {v.clients?.phone && <p className="text-[11px] text-navy-400">{v.clients.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-navy-700">{v.country}</td>
                    <td className="px-4 py-4">
                      {v.clients?.passport_no ? (
                        <span className="rounded-lg bg-navy-50 px-2 py-1 text-xs font-medium text-navy-700">{v.clients.passport_no}</span>
                      ) : (
                        <span className="text-xs text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-navy-700">
                      {new Date(v.visa_expiry_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
