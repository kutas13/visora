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
        <div>
          <h1 className="text-xl font-bold text-navy-900">Raporlarım</h1>
          <p className="text-navy-500 text-sm">{staffName} - kişisel performans ve istatistikler</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-1 bg-navy-100 rounded-lg p-0.5">
            {(["week", "month", "quarter", "year", "custom"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700"
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
                className="px-2.5 py-1.5 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-navy-400 text-xs">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Period Summary */}
      <p className="text-xs text-navy-400 font-medium uppercase tracking-wider">{activeLabel} · {filteredFiles.length} dosya · {filteredPayments.length} tahsilat</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Dosyalarım</p>
          <p className="text-2xl font-black text-navy-900 mt-1">{kpis.totalFiles}</p>
          <p className="text-[10px] text-navy-400">{kpis.pending} aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Onay / Red</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-green-600">{kpis.approved}</span>
            <span className="text-navy-300">/</span>
            <span className="text-2xl font-black text-red-500">{kpis.rejected}</span>
          </div>
          <p className="text-[10px] text-green-500">%{kpis.successRate} başarı</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Tahsilatlarım</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{kpis.totalPayments}</p>
          <p className="text-[10px] text-navy-400">{kpis.pesin} peşin · {kpis.tahsilat} cari</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Gelirim</p>
          <div className="mt-1 space-y-0.5">
            {Object.entries(kpis.revenue).map(([curr, val]) => val > 0 && (
              <p key={curr} className="text-sm font-bold text-navy-800">{val.toLocaleString("tr-TR")} {getCurrencySymbol(curr)}</p>
            ))}
            {Object.values(kpis.revenue).every((v) => v === 0) && <p className="text-sm text-navy-400">—</p>}
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
