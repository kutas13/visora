"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

const PIE_COLORS = ["#6C63FF", "#00C2A8", "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF922B", "#845EF7", "#F06595", "#20C997"];

interface Application {
  id: string;
  country: string;
  visa_result: string | null;
  status: string;
  created_at: string;
  ucret: number | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  payment_type: string;
  status: string;
  created_at: string;
}

type Period = "7d" | "1m" | "3m" | "1y";

function subtractPeriod(period: Period): Date {
  const d = new Date();
  if (period === "7d") d.setDate(d.getDate() - 7);
  else if (period === "1m") d.setMonth(d.getMonth() - 1);
  else if (period === "3m") d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

export default function ReportsPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("3m");

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const since = subtractPeriod(period).toISOString();
    const [appRes, payRes] = await Promise.all([
      supabase.from("applications").select("id, country, visa_result, status, created_at, ucret").eq("agency_id", agencyId).gte("created_at", since).order("created_at"),
      supabase.from("payments").select("id, amount, payment_type, status, created_at").eq("agency_id", agencyId).gte("created_at", since).order("created_at"),
    ]);
    setApplications(appRes.data || []);
    setPayments(payRes.data || []);
    setLoading(false);
  }, [agencyId, supabase, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalFiles = applications.length;
  const approved = applications.filter((a) => a.visa_result === "vize_onay").length;
  const rejected = applications.filter((a) => a.visa_result === "red").length;
  const revenue = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const successRate = totalFiles > 0 ? Math.round((approved / Math.max(approved + rejected, 1)) * 100) : 0;

  const kpis = [
    { title: "Toplam Dosya", value: totalFiles, gradient: "from-primary-500 to-primary-600" },
    { title: "Onaylanan", value: approved, gradient: "from-green-500 to-green-600" },
    { title: "Reddedilen", value: rejected, gradient: "from-red-500 to-red-600" },
    { title: "Gelir", value: `₺${revenue.toLocaleString("tr-TR")}`, gradient: "from-amber-400 to-amber-500" },
    { title: "Başarı Oranı", value: `%${successRate}`, gradient: "from-accent-500 to-green-500" },
  ];

  // Monthly performance data
  const monthlyMap = new Map<string, { files: number; revenue: number }>();
  applications.forEach((a) => {
    const m = a.created_at.slice(0, 7);
    const cur = monthlyMap.get(m) || { files: 0, revenue: 0 };
    cur.files++;
    monthlyMap.set(m, cur);
  });
  payments.filter((p) => p.status === "paid").forEach((p) => {
    const m = p.created_at.slice(0, 7);
    const cur = monthlyMap.get(m) || { files: 0, revenue: 0 };
    cur.revenue += p.amount;
    monthlyMap.set(m, cur);
  });
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // Weekly trend
  const weeklyMap = new Map<string, number>();
  applications.forEach((a) => {
    const d = new Date(a.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1);
  });
  const weeklyData = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week: new Date(week).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }), dosya: count }));

  // Country distribution
  const countryMap = new Map<string, number>();
  applications.forEach((a) => countryMap.set(a.country, (countryMap.get(a.country) || 0) + 1));
  const countryData = Array.from(countryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // Visa results
  const resultData = [
    { name: "Onay", value: approved },
    { name: "Red", value: rejected },
    { name: "Bekleyen", value: totalFiles - approved - rejected },
  ].filter((d) => d.value > 0);

  // Payment methods
  const payMethodMap = new Map<string, number>();
  payments.forEach((p) => {
    const label = p.payment_type === "nakit" ? "Nakit" : p.payment_type === "havale" ? "Havale" : p.payment_type === "kredi_karti" ? "Kredi Kartı" : p.payment_type;
    payMethodMap.set(label, (payMethodMap.get(label) || 0) + 1);
  });
  const payMethodData = Array.from(payMethodMap.entries()).map(([name, value]) => ({ name, value }));

  const periodButtons: { key: Period; label: string }[] = [
    { key: "7d", label: "7 Gün" },
    { key: "1m", label: "1 Ay" },
    { key: "3m", label: "3 Ay" },
    { key: "1y", label: "1 Yıl" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Raporlar</h1>
            <p className="text-xs text-navy-400">Performans analizi</p>
          </div>
        </div>
        <div className="flex gap-2">
          {periodButtons.map((b) => (
            <button
              key={b.key}
              onClick={() => setPeriod(b.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                period === b.key ? "bg-navy-800 text-white" : "bg-white text-navy-500 border border-navy-200 hover:bg-navy-50"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.title} className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">{k.title}</p>
                <p className="mt-1 text-3xl font-bold text-navy-900">{k.value}</p>
                <div className={`mt-2 h-1 w-12 rounded-full bg-gradient-to-r ${k.gradient}`} />
              </div>
            ))}
          </div>

          {/* Bar Chart: Monthly Performance */}
          {monthlyData.length > 0 && (
            <div className="rounded-2xl border border-navy-200/60 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-navy-900">Aylık Performans</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="files" name="Dosya" fill="#6C63FF" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revenue" name="Gelir (₺)" fill="#00C2A8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Area Chart: Weekly Trend */}
          {weeklyData.length > 0 && (
            <div className="rounded-2xl border border-navy-200/60 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-navy-900">Haftalık Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="dosya" name="Dosya" stroke="#6C63FF" fill="url(#areaGradient)" strokeWidth={2} />
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6C63FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Donut Charts */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Ülke Dağılımı", data: countryData },
              { title: "Vize Sonuçları", data: resultData },
              { title: "Ödeme Yöntemleri", data: payMethodData },
            ].map((chart) => (
              <div key={chart.title} className="rounded-2xl border border-navy-200/60 bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-navy-900">{chart.title}</h3>
                {chart.data.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-xs text-navy-400">Veri yok</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chart.data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                        {chart.data.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
