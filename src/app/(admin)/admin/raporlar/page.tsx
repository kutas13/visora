"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Payment, Profile } from "@/lib/supabase/types";
import dynamic from "next/dynamic";

const RechartsCharts = dynamic(() => import("@/components/reports/ReportsCharts"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  ),
});

type Period = "week" | "month" | "quarter" | "year" | "custom";

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ZAFER: "/zafer-avatar.png",
  ERCAN: "/ercan-avatar.jpg",
  BAHAR: "/bahar-avatar.jpg",
};

function getCurrencySymbol(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function RaporlarPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");

  const today = new Date();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [customStart, setCustomStart] = useState(toDateStr(monthAgo));
  const [customEnd, setCustomEnd] = useState(toDateStr(today));

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [filesRes, paymentsRes, staffRes, firmaCariRes] = await Promise.all([
        supabase.from("visa_files").select("*").returns<VisaFile[]>(),
        supabase.from("payments").select("*").eq("durum", "odendi").returns<Payment[]>(),
        supabase.from("profiles").select("*").eq("role", "staff").returns<Profile[]>(),
        supabase.from("visa_files").select("*").eq("cari_tipi", "firma_cari").returns<VisaFile[]>(),
      ]);

      const firmaCariAsPayments = (firmaCariRes.data || []).map((file) => ({
        id: `firma_${file.id}`,
        file_id: file.id,
        tutar: file.ucret || 0,
        currency: file.ucret_currency || "TL",
        yontem: "firma_cari" as any,
        durum: "odendi" as any,
        payment_type: "firma_cari" as any,
        created_by: file.assigned_user_id,
        created_at: file.created_at,
      }));

      setFiles(filesRes.data || []);
      setPayments([...(paymentsRes.data || []), ...firmaCariAsPayments]);
      setStaff(staffRes.data || []);
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

  const filteredPayments = useMemo(() => {
    let result = payments.filter((p) => { const d = new Date(p.created_at); return d >= periodStart && d <= periodEnd; });
    if (selectedStaffId !== "all") result = result.filter((p) => p.created_by === selectedStaffId);
    return result;
  }, [payments, periodStart, periodEnd, selectedStaffId]);

  const filteredFiles = useMemo(() => {
    let result = files.filter((f) => { const d = new Date(f.created_at); return d >= periodStart && d <= periodEnd; });
    if (selectedStaffId !== "all") result = result.filter((f) => f.assigned_user_id === selectedStaffId);
    return result;
  }, [files, periodStart, periodEnd, selectedStaffId]);

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
    const firmaCariCount = filteredPayments.filter((p) => p.payment_type === "firma_cari").length;
    return { revenue, totalFiles, approvedFiles, rejectedFiles, pendingFiles, successRate, pesinCount, tahsilatCount, firmaCariCount, totalPayments: filteredPayments.length };
  }, [filteredPayments, filteredFiles]);

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

  const selectedStaffName = selectedStaffId === "all"
    ? "Tüm Personel"
    : staff.find((s) => s.id === selectedStaffId)?.name || "";

  const activeLabel = period === "custom"
    ? `${new Date(customStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} — ${new Date(customEnd).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}`
    : periodLabels[period];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Raporlar</h1>
          <p className="text-navy-500 text-sm">Tahsilat, başvuru ve performans istatistikleri</p>
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

      {/* Staff Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider mr-1">Personel:</span>
        <button
          onClick={() => setSelectedStaffId("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            selectedStaffId === "all"
              ? "bg-navy-900 text-white border-navy-900 shadow-md"
              : "bg-white text-navy-600 border-navy-200 hover:border-navy-400"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Hepsi
        </button>
        {staff.map((s) => {
          const avatarSrc = USER_AVATARS[s.name.toUpperCase()];
          const isActive = selectedStaffId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStaffId(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? "bg-navy-900 text-white border-navy-900 shadow-md"
                  : "bg-white text-navy-600 border-navy-200 hover:border-navy-400"
              }`}
            >
              {avatarSrc ? (
                <div className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ${isActive ? "ring-1 ring-white" : "ring-1 ring-navy-200"}`}>
                  <Image src={avatarSrc} alt={s.name} width={20} height={20} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-navy-100 text-navy-600"}`}>
                  {s.name.charAt(0)}
                </div>
              )}
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Period Label */}
      <p className="text-xs text-navy-400 font-medium uppercase tracking-wider">
        {selectedStaffName} · {activeLabel} · {filteredFiles.length} dosya · {filteredPayments.length} tahsilat
      </p>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Dosya</p>
          <p className="text-2xl font-black text-navy-900 mt-1">{kpis.totalFiles}</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Onay</p>
          <p className="text-2xl font-black text-green-600 mt-1">{kpis.approvedFiles}</p>
          <p className="text-[10px] text-green-500">%{kpis.successRate}</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Red</p>
          <p className="text-2xl font-black text-red-600 mt-1">{kpis.rejectedFiles}</p>
          <p className="text-[10px] text-navy-400">{kpis.pendingFiles} beklemede</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Tahsilat</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{kpis.totalPayments}</p>
          <p className="text-[10px] text-navy-400">{kpis.pesinCount} peşin · {kpis.tahsilatCount} cari · {kpis.firmaCariCount} firma</p>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-navy-200 p-4">
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">Gelir</p>
          <div className="mt-1 space-y-0.5">
            {Object.entries(kpis.revenue).map(([curr, val]) => val > 0 && (
              <p key={curr} className="text-sm font-bold text-navy-800">{val.toLocaleString("tr-TR")} {getCurrencySymbol(curr)}</p>
            ))}
            {Object.values(kpis.revenue).every((v) => v === 0) && <p className="text-sm text-navy-400">—</p>}
          </div>
        </div>
      </div>

      {/* Charts */}
      <RechartsCharts
        files={filteredFiles}
        allFiles={selectedStaffId === "all" ? files : files.filter((f) => f.assigned_user_id === selectedStaffId)}
        payments={filteredPayments}
        allPayments={selectedStaffId === "all" ? payments : payments.filter((p) => p.created_by === selectedStaffId)}
        staff={staff}
        period={period}
        periodStart={periodStart}
      />
    </div>
  );
}
