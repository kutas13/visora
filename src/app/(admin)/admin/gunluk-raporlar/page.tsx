"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface ExcelRow {
  biletNo: number;
  hyKodu: string;
  id: string;
  acenta: string;
  yolcuAdi: string;
  tarih: string;
  biletTut: number;
  servis: number;
  toplam: number;
  parkur1: string;
  parkur2: string;
  parkur3: string;
  satisSecli: string;
  kartNo: string;
  cariAdi: string;
  uyelikNo: string;
  not: string;
}

interface Report {
  id: string;
  personel: string;
  tarih: string;
  kayit_sayisi: number;
  musteri_sayisi: number;
  is_revize: boolean;
  created_at: string;
  rows: ExcelRow[];
}

function formatTarih(t: string) {
  if (!t) return "";
  const d = new Date(t);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtNum(n: number) {
  return (n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relativeTime(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;
  return formatTarih(dateStr);
}

const PERSONEL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  YUSUF: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  DAVUT: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  SIRRI: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  ERCAN: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  BAHAR: { bg: "bg-pink-50", text: "text-pink-700", dot: "bg-pink-500" },
};

function getPersonelColor(name: string) {
  return PERSONEL_COLORS[name] || { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" };
}

export default function AdminGunlukRaporlarPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [filterPersonel, setFilterPersonel] = useState("all");

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gunluk-rapor/list?all=true");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleDownload = async (report: Report) => {
    setDownloading(true);
    try {
      const res = await fetch("/api/gunluk-rapor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: report.rows, tarih: report.tarih, personel: report.personel }),
      });
      if (!res.ok) throw new Error("Excel oluşturulamadı");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.tarih.replace(/-/g, ".")}_${report.personel}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* */ }
    setDownloading(false);
  };

  const personelList = Array.from(new Set(reports.map(r => r.personel))).sort();

  const filtered = filterPersonel === "all"
    ? reports
    : reports.filter(r => r.personel === filterPersonel);

  const stats = useMemo(() => {
    const totalRows = filtered.reduce((s, r) => s + r.kayit_sayisi, 0);
    const totalCustomers = filtered.reduce((s, r) => s + r.musteri_sayisi, 0);
    const revizeCount = filtered.filter(r => r.is_revize).length;
    return { totalRows, totalCustomers, revizeCount, reportCount: filtered.length };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 animate-pulse">Raporlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Günlük Raporlar</h1>
            <p className="text-slate-500 text-sm">Personel günlük satış raporlarını görüntüleyin</p>
          </div>
        </div>
        <button
          onClick={loadReports}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Yenile
        </button>
      </div>

      {/* İstatistik Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rapor</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.reportCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kayıt</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.totalRows}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Müşteri</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.totalCustomers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revize</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.revizeCount}</p>
        </div>
      </div>

      {/* Personel Filtre */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterPersonel("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
            filterPersonel === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          Tümü
          <span className={`ml-1.5 text-xs ${filterPersonel === "all" ? "text-slate-400" : "text-slate-400"}`}>
            {reports.length}
          </span>
        </button>
        {personelList.map(p => {
          const color = getPersonelColor(p);
          const count = reports.filter(r => r.personel === p).length;
          return (
            <button
              key={p}
              onClick={() => setFilterPersonel(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150 flex items-center gap-2 ${
                filterPersonel === p
                  ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20"
                  : `bg-white ${color.text} border-slate-200 hover:border-slate-300`
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${filterPersonel === p ? "bg-white" : color.dot}`} />
              {p}
              <span className={`text-xs ${filterPersonel === p ? "text-slate-400" : "text-slate-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rapor Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-slate-800 font-semibold text-sm flex items-center gap-2.5">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Rapor Listesi
            <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-normal">{filtered.length}</span>
          </h3>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold mb-1">Rapor bulunamadı</p>
            <p className="text-slate-500 text-sm">Henüz günlük rapor gönderilmemiş</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(r => {
              const isSelected = selectedReport?.id === r.id;
              const color = getPersonelColor(r.personel);
              return (
                <div key={r.id}>
                  <div className={`px-6 py-4 flex items-center gap-4 transition-colors cursor-pointer ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/80"}`}
                    onClick={() => setSelectedReport(isSelected ? null : r)}>
                    {/* Rapor ikonu */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color.bg}`}>
                      <svg className={`w-5 h-5 ${color.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    {/* İçerik */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-900">{formatTarih(r.tarih)}</p>
                        {r.is_revize && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-md uppercase tracking-wide">Revize</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" /></svg>
                          {r.kayit_sayisi} kayıt
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          {r.musteri_sayisi} müşteri
                        </span>
                      </div>
                    </div>

                    {/* Personel badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${color.bg}`}>
                      <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className={`text-xs font-semibold ${color.text}`}>{r.personel}</span>
                    </div>

                    {/* Butonlar */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(r); }}
                        disabled={downloading}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        title="Excel İndir"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isSelected ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Zaman */}
                    <div className="text-right min-w-[80px] flex-shrink-0">
                      <p className="text-[11px] text-slate-400">{relativeTime(r.created_at)}</p>
                    </div>
                  </div>

                  {/* Detay tablosu (accordion) */}
                  {isSelected && r.rows && r.rows.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <div className="px-6 py-3 flex items-center justify-between border-b border-slate-200/60">
                        <p className="text-xs font-medium text-slate-600">
                          {formatTarih(r.tarih)} - {r.personel}
                          {r.is_revize && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">REVİZE</span>}
                          <span className="ml-2 text-slate-400">{r.rows.length} satır</span>
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(r); }}
                          disabled={downloading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                          </svg>
                          {downloading ? "İndiriliyor..." : "Excel İndir"}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-100/80">
                              {["#","H.Y.","I-D","Acenta","Yolcu Adı","Tarih","Bilet Tut.","Servis","Toplam","P1","P2","P3","Satış","Kart No","Cari Adı","Not"].map((h,i) => (
                                <th key={i} className="py-2.5 px-2.5 text-left font-semibold text-slate-600 first:pl-6 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {r.rows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-white transition-colors">
                                <td className="py-2 px-2.5 pl-6 font-medium text-slate-800">{row.biletNo}</td>
                                <td className="py-2 px-2.5 text-slate-600">{row.hyKodu}</td>
                                <td className="py-2 px-2.5 text-slate-500">{row.id}</td>
                                <td className="py-2 px-2.5 text-slate-500">{row.acenta}</td>
                                <td className="py-2 px-2.5 text-slate-900 font-medium">{row.yolcuAdi}</td>
                                <td className="py-2 px-2.5 text-slate-500">{row.tarih ? formatTarih(row.tarih) : ""}</td>
                                <td className="py-2 px-2.5 text-right text-slate-700 font-mono">{row.biletTut ? fmtNum(row.biletTut) : ""}</td>
                                <td className="py-2 px-2.5 text-right text-slate-500 font-mono">{row.servis ? fmtNum(row.servis) : ""}</td>
                                <td className="py-2 px-2.5 text-right font-semibold text-slate-900 font-mono">{row.toplam ? fmtNum(row.toplam) : ""}</td>
                                <td className="py-2 px-2.5 text-slate-400">{row.parkur1}</td>
                                <td className="py-2 px-2.5 text-slate-400">{row.parkur2}</td>
                                <td className="py-2 px-2.5 text-slate-400">{row.parkur3}</td>
                                <td className="py-2 px-2.5 text-slate-400">{row.satisSecli}</td>
                                <td className="py-2 px-2.5 text-slate-500">{row.kartNo}</td>
                                <td className="py-2 px-2.5 text-slate-500">{row.cariAdi}</td>
                                <td className="py-2 px-2.5 text-slate-400 max-w-[150px] truncate">{row.not}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
