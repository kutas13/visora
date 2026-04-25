"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type MonthRow = {
  period_year: number;
  period_month: number;
  paid_total: number;
  unpaid_total: number;
  paid_count: number;
  unpaid_count: number;
};

const fmtTRY = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

const fmtTRYExact = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);

const monthName = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

export default function VisoraRevenuePage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [windowMonths, setWindowMonths] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc("platform_revenue_monthly", { p_months: windowMonths });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    setRows((data as MonthRow[] | null) || []);
    setLoading(false);
  }, [supabase, windowMonths]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const paidTotal = rows.reduce((s, r) => s + Number(r.paid_total), 0);
    const unpaidTotal = rows.reduce((s, r) => s + Number(r.unpaid_total), 0);
    const paidCount = rows.reduce((s, r) => s + Number(r.paid_count), 0);
    const unpaidCount = rows.reduce((s, r) => s + Number(r.unpaid_count), 0);
    const grandTotal = paidTotal + unpaidTotal;
    const collectionRate = grandTotal > 0 ? (paidTotal / grandTotal) * 100 : 0;
    const avgMonthly = rows.length > 0 ? paidTotal / rows.length : 0;
    return { paidTotal, unpaidTotal, paidCount, unpaidCount, grandTotal, collectionRate, avgMonthly };
  }, [rows]);

  const maxBar = useMemo(() => {
    let m = 0;
    for (const r of rows) {
      const total = Number(r.paid_total) + Number(r.unpaid_total);
      if (total > m) m = total;
    }
    return m;
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-primary-500 via-violet-500 to-indigo-500 text-white">
        <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">Toplam Tahsil Edilen Ciro (Kasaya Giren)</p>
        <p className="text-4xl md:text-5xl font-extrabold mt-2">{fmtTRYExact(totals.paidTotal)}</p>
        <p className="text-sm text-white/80 mt-2">
          Son {windowMonths} ay · Aylık ortalama tahsilat: <strong>{fmtTRY(totals.avgMonthly)}</strong>
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Bekleyen tahsilat</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmtTRY(totals.unpaidTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Toplam fatura</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {totals.paidCount + totals.unpaidCount}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {totals.paidCount} ödenmiş · {totals.unpaidCount} bekliyor
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Tahsilat oranı</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">%{totals.collectionRate.toFixed(1)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Brüt tahakkuk</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmtTRY(totals.grandTotal)}</p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Dönem:</span>
        {[3, 6, 12, 24].map((n) => (
          <button
            key={n}
            onClick={() => setWindowMonths(n)}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              windowMonths === n ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Son {n} ay
          </button>
        ))}
      </div>

      {err && <Card className="p-4 text-red-600 text-sm">{err}</Card>}

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Aylık Ciro Dağılımı</h2>
        <p className="text-xs text-slate-500 mb-5">Yeşil: tahsil edilen · Sarı: bekleyen</p>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Henüz veri yok.</p>
        ) : (
          <div className="space-y-2.5">
            {rows
              .slice()
              .sort((a, b) => a.period_year * 100 + a.period_month - (b.period_year * 100 + b.period_month))
              .map((r) => {
                const total = Number(r.paid_total) + Number(r.unpaid_total);
                const paidPct = maxBar > 0 ? (Number(r.paid_total) / maxBar) * 100 : 0;
                const unpaidPct = maxBar > 0 ? (Number(r.unpaid_total) / maxBar) * 100 : 0;
                return (
                  <div key={`${r.period_year}-${r.period_month}`} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-slate-600 capitalize flex-shrink-0">
                      {monthName(r.period_year, r.period_month)}
                    </div>
                    <div className="flex-1 h-7 bg-slate-100 rounded overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${paidPct}%` }}
                        title={`Tahsil: ${fmtTRYExact(Number(r.paid_total))}`}
                      />
                      <div
                        className="bg-amber-400 h-full"
                        style={{ width: `${unpaidPct}%` }}
                        title={`Bekliyor: ${fmtTRYExact(Number(r.unpaid_total))}`}
                      />
                    </div>
                    <div className="w-32 text-right text-xs text-slate-700 font-semibold flex-shrink-0">
                      {fmtTRY(total)}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Dönem</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-700">Tahsil Edilen</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-700">Bekleyen</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-700">Toplam</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-700">Faturalar</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Veri yok.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.period_year}-${r.period_month}`} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800 capitalize">
                    {monthName(r.period_year, r.period_month)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">
                    {fmtTRYExact(Number(r.paid_total))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-600">{fmtTRYExact(Number(r.unpaid_total))}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-bold">
                    {fmtTRYExact(Number(r.paid_total) + Number(r.unpaid_total))}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                    <span className="text-emerald-600 font-semibold">{r.paid_count}</span> /{" "}
                    <span className="text-amber-600 font-semibold">{r.unpaid_count}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
