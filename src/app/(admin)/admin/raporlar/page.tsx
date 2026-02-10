"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Payment, Profile } from "@/lib/supabase/types";
import dynamic from "next/dynamic";

// Recharts lazy load
const RechartsCharts = dynamic(() => import("@/components/reports/ReportsCharts"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-navy-500">Grafikler yükleniyor...</p>
      </div>
    </div>
  ),
});

type Period = "week" | "month" | "quarter" | "year";

function getCurrencySymbol(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}

export default function RaporlarPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [filesRes, paymentsRes, staffRes] = await Promise.all([
        supabase.from("visa_files").select("*").returns<VisaFile[]>(),
        supabase.from("payments").select("*").eq("durum", "odendi").returns<Payment[]>(),
        supabase.from("profiles").select("*").eq("role", "staff").returns<Profile[]>(),
      ]);

      setFiles(filesRes.data || []);
      setPayments(paymentsRes.data || []);
      setStaff(staffRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Dönem filtreleme
  const periodStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === "week") d.setDate(d.getDate() - 7);
    else if (period === "month") d.setMonth(d.getMonth() - 1);
    else if (period === "quarter") d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [period]);

  const filteredPayments = useMemo(
    () => payments.filter((p) => new Date(p.created_at) >= periodStart),
    [payments, periodStart]
  );

  const filteredFiles = useMemo(
    () => files.filter((f) => new Date(f.created_at) >= periodStart),
    [files, periodStart]
  );

  // KPI Hesaplamaları
  const kpis = useMemo(() => {
    const revenue: Record<string, number> = { TL: 0, EUR: 0, USD: 0 };
    filteredPayments.forEach((p) => {
      revenue[p.currency || "TL"] = (revenue[p.currency || "TL"] || 0) + Number(p.tutar);
    });

    const totalFiles = filteredFiles.length;
    const approvedFiles = filteredFiles.filter((f) => f.sonuc === "vize_onay").length;
    const rejectedFiles = filteredFiles.filter((f) => f.sonuc === "red").length;
    const pendingFiles = filteredFiles.filter((f) => !f.sonuc && !f.arsiv_mi).length;
    const successRate = approvedFiles + rejectedFiles > 0 ? Math.round((approvedFiles / (approvedFiles + rejectedFiles)) * 100) : 0;
    const pesinCount = filteredPayments.filter((p) => p.payment_type === "pesin_satis").length;
    const tahsilatCount = filteredPayments.filter((p) => p.payment_type === "tahsilat").length;

    return { revenue, totalFiles, approvedFiles, rejectedFiles, pendingFiles, successRate, pesinCount, tahsilatCount, totalPayments: filteredPayments.length };
  }, [filteredPayments, filteredFiles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const periodLabels: Record<Period, string> = {
    week: "Son 7 Gün",
    month: "Son 1 Ay",
    quarter: "Son 3 Ay",
    year: "Son 1 Yıl",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-4xl">📊</span> Raporlar
            </h1>
            <p className="text-indigo-200 mt-2">Tahsilat, başvuru ve performans istatistikleri</p>
          </div>
          <div className="flex gap-2 bg-white/10 backdrop-blur rounded-xl p-1">
            {(["week", "month", "quarter", "year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  period === p ? "bg-white text-indigo-700 shadow-lg" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5 bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Toplam Dosya</p>
          <p className="text-3xl font-black text-navy-900 mt-2">{kpis.totalFiles}</p>
          <p className="text-xs text-navy-400 mt-1">{periodLabels[period]}</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-white to-green-50 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Onaylanan</p>
          <p className="text-3xl font-black text-green-600 mt-2">{kpis.approvedFiles}</p>
          <p className="text-xs text-green-500 mt-1">%{kpis.successRate} başarı</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-white to-red-50 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Reddedilen</p>
          <p className="text-3xl font-black text-red-600 mt-2">{kpis.rejectedFiles}</p>
          <p className="text-xs text-navy-400 mt-1">{kpis.pendingFiles} beklemede</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-white to-amber-50 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Tahsilat</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{kpis.totalPayments}</p>
          <p className="text-xs text-navy-400 mt-1">{kpis.pesinCount} peşin, {kpis.tahsilatCount} cari</p>
        </Card>

        <Card className="col-span-2 lg:col-span-1 p-5 bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Toplam Gelir</p>
          <div className="mt-2 space-y-1">
            {Object.entries(kpis.revenue).map(
              ([curr, val]) =>
                val > 0 && (
                  <p key={curr} className="text-sm font-bold text-navy-800">
                    {val.toLocaleString("tr-TR")} {getCurrencySymbol(curr)}
                  </p>
                )
            )}
            {Object.values(kpis.revenue).every((v) => v === 0) && (
              <p className="text-sm text-navy-400">Henüz gelir yok</p>
            )}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <RechartsCharts
        files={filteredFiles}
        allFiles={files}
        payments={filteredPayments}
        allPayments={payments}
        staff={staff}
        period={period}
        periodStart={periodStart}
      />
    </div>
  );
}
