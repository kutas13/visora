"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";

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

const USER_AVATARS: Record<string, string> = {};

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
      // Personel filtresine Genel Mudur (admin) de dahil edildi: artik raporlar
      // sayfasinda admin de bir secenek olarak gorunur ve karsilastirilabilir.
      const [filesRes, paymentsRes, staffRes, firmaCariRes] = await Promise.all([
        supabase.from("visa_files").select("*").returns<VisaFile[]>(),
        supabase.from("payments").select("*").eq("durum", "odendi").returns<Payment[]>(),
        supabase
          .from("profiles")
          .select("*")
          .in("role", ["admin", "staff"])
          .returns<Profile[]>(),
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
      // Admin'i (Genel Mudur) listenin basina al, sonra alfabetik personeller.
      const profiles = (staffRes.data || []) as Profile[];
      profiles.sort((a, b) => {
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        return (a.name || "").localeCompare(b.name || "", "tr");
      });
      setStaff(profiles);
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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Analiz</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Raporlar</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Ofis geneli tahsilat, başvuru ve performans istatistiklerini dönemsel olarak incele ve karşılaştır.
            </p>
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
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
              <span className="text-slate-400 text-xs">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
          )}
        </div>
      </div>

      {/* Staff Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Personel:</span>
        <button
          onClick={() => setSelectedStaffId("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            selectedStaffId === "all"
              ? "bg-slate-800 text-white border-slate-800 shadow-md"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
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
          const isAdmin = s.role === "admin";
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStaffId(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? "bg-slate-800 text-white border-slate-800 shadow-md"
                  : isAdmin
                    ? "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-900 border-amber-300 hover:border-amber-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
              title={isAdmin ? "Genel Müdür — kendi atanan dosyalari" : "Personel"}
            >
              {avatarSrc ? (
                <div className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ${isActive ? "ring-1 ring-white" : "ring-1 ring-slate-200"}`}>
                  <Image src={avatarSrc} alt={s.name} width={20} height={20} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${isActive ? "bg-white/20 text-white" : isAdmin ? "bg-amber-200 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                  {s.name.charAt(0)}
                </div>
              )}
              <span>{s.name}</span>
              {isAdmin && (
                <span
                  className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    isActive ? "bg-amber-300/30 text-amber-100" : "bg-amber-200/70 text-amber-900"
                  }`}
                >
                  GM
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Period Label */}
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        {selectedStaffName} · {activeLabel} · {filteredFiles.length} dosya · {filteredPayments.length} tahsilat
      </p>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide">DOSYA</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.totalFiles}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-green-500 uppercase tracking-wide">ONAY</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.approvedFiles}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">%{kpis.successRate} başarı</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">RED</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.rejectedFiles}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{kpis.pendingFiles} beklemede</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">TAHSİLAT</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.totalPayments}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{kpis.pesinCount} peşin · {kpis.tahsilatCount} cari · {kpis.firmaCariCount} firma</p>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">GELİR</span>
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
