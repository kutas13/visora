"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Payment } from "@/lib/supabase/types";
import dynamic from "next/dynamic";

const StaffReportsCharts = dynamic(() => import("@/components/reports/StaffReportsCharts"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  ),
});

function getCurrencySymbol(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Period = "week" | "month" | "quarter" | "year" | "custom";

export default function StaffRaporlarPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffName, setStaffName] = useState("");
  const [period, setPeriod] = useState<Period>("month");

  const today = new Date();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [customStart, setCustomStart] = useState(toDateStr(monthAgo));
  const [customEnd, setCustomEnd] = useState(toDateStr(today));

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      setStaffName(profile?.name || "");

      const [filesRes, paymentsRes] = await Promise.all([
        supabase.from("visa_files").select("*").eq("assigned_user_id", user.id).returns<VisaFile[]>(),
        supabase.from("payments").select("*").eq("created_by", user.id).eq("durum", "odendi").returns<Payment[]>(),
      ]);

      setFiles(filesRes.data || []);
      setPayments(paymentsRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const periodStart = useMemo(() => {
    if (period === "custom") {
      const d = new Date(customStart);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === "week") d.setDate(d.getDate() - 7);
    else if (period === "month") d.setMonth(d.getMonth() - 1);
    else if (period === "quarter") d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [period, customStart]);

  const periodEnd = useMemo(() => {
    if (period === "custom") {
      const d = new Date(customEnd);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    return new Date();
  }, [period, customEnd]);

  const filteredFiles = useMemo(
    () => files.filter((f) => { const d = new Date(f.created_at); return d >= periodStart && d <= periodEnd; }),
    [files, periodStart, periodEnd]
  );

  const filteredPayments = useMemo(
    () => payments.filter((p) => { const d = new Date(p.created_at); return d >= periodStart && d <= periodEnd; }),
    [payments, periodStart, periodEnd]
  );

  const kpis = useMemo(() => {
    const revenue: Record<string, number> = { TL: 0, EUR: 0, USD: 0 };
    filteredPayments.forEach((p) => {
      revenue[p.currency || "TL"] = (revenue[p.currency || "TL"] || 0) + Number(p.tutar);
    });
    const totalFiles = filteredFiles.length;
    const approved = filteredFiles.filter((f) => f.sonuc === "vize_onay").length;
    const rejected = filteredFiles.filter((f) => f.sonuc === "red").length;
    const pending = filteredFiles.filter((f) => !f.sonuc && !f.arsiv_mi).length;
    const successRate = approved + rejected > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;
    const pesin = filteredPayments.filter((p) => p.payment_type === "pesin_satis").length;
    const tahsilat = filteredPayments.filter((p) => p.payment_type === "tahsilat").length;
    return { revenue, totalFiles, approved, rejected, pending, successRate, pesin, tahsilat, totalPayments: filteredPayments.length };
  }, [filteredFiles, filteredPayments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const periodLabels: Record<string, string> = {
    week: "7 Gün",
    month: "1 Ay",
    quarter: "3 Ay",
    year: "1 Yıl",
    custom: "Özel",
  };

  const activeLabel = period === "custom"
    ? `${new Date(customStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} — ${new Date(customEnd).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}`
    : periodLabels[period];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Vize Raporlarım</h1>
            <p className="text-slate-500 text-sm">Dosya, tahsilat ve başvuru istatistiklerinizi dönemsel olarak inceleyin &middot; {staffName}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            {(["week", "month", "quarter", "year", "custom"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
              <span className="text-slate-400 text-xs">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
          )}
        </div>
      </div>

      {/* Period Summary */}
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{activeLabel} · {filteredFiles.length} dosya · {filteredPayments.length} tahsilat</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide">DOSYALAR</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.totalFiles}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{kpis.pending} aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">ONAY / RED</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-600">{kpis.approved}</span>
            <span className="text-slate-300">/</span>
            <span className="text-2xl font-bold text-red-500">{kpis.rejected}</span>
          </div>
          <p className="text-[11px] text-green-500 mt-0.5">%{kpis.successRate} başarı</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">TAHSİLAT</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.totalPayments}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{kpis.pesin} peşin · {kpis.tahsilat} cari</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-violet-500 uppercase tracking-wide">GELİR</span>
          </div>
          <div className="space-y-0.5">
            {Object.entries(kpis.revenue).map(([curr, val]) => val > 0 && (
              <p key={curr} className="text-sm font-bold text-slate-800">{val.toLocaleString("tr-TR")} {getCurrencySymbol(curr)}</p>
            ))}
            {Object.values(kpis.revenue).every((v) => v === 0) && <p className="text-sm text-slate-400">—</p>}
          </div>
        </div>
      </div>

      {/* Charts */}
      <StaffReportsCharts
        files={filteredFiles}
        allFiles={files}
        payments={filteredPayments}
        allPayments={payments}
        staffName={staffName}
      />
    </div>
  );
}
