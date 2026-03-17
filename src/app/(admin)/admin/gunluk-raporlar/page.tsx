"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Personel:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterPersonel("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filterPersonel === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >Hepsi</button>
          {personelList.map(p => (
            <button
              key={p}
              onClick={() => setFilterPersonel(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filterPersonel === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >{p}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={loadReports} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Yenile">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <span className="text-xs text-gray-400">{filtered.length} rapor</span>
      </div>

      {/* Rapor Listesi */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Henüz günlük rapor gönderilmemiş</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{formatTarih(r.tarih)}</p>
                    {r.is_revize && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">REVİZE</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{r.kayit_sayisi} kayıt &middot; {r.musteri_sayisi} müşteri</p>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">{r.personel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    {selectedReport?.id === r.id ? "Kapat" : "İçeriği Gör"}
                  </button>
                  <button
                    onClick={() => handleDownload(r)}
                    disabled={downloading}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >İndir</button>
                </div>
                <div className="text-right min-w-[90px]">
                  <p className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seçili Raporun İçeriği */}
      {selectedReport && selectedReport.rows && selectedReport.rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              {formatTarih(selectedReport.tarih)} - {selectedReport.personel}
              {selectedReport.is_revize && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded">REVİZE</span>}
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{selectedReport.rows.length} satır</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedReport)}
                disabled={downloading}
                className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >{downloading ? "İndiriliyor..." : "Excel İndir"}</button>
              <button onClick={() => setSelectedReport(null)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-orange-50 border-b border-orange-200">
                  {["#","H.Y.","I-D","Acenta","Yolcu Adı","Tarih","Bilet Tut.","Servis","Toplam","P1","P2","P3","Satış","Kart No","Cari Adı","Not"].map((h,i) => (
                    <th key={i} className="py-2.5 px-2 text-left font-semibold text-orange-800">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selectedReport.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-2 font-medium text-gray-800">{r.biletNo}</td>
                    <td className="py-2 px-2 text-gray-700">{r.hyKodu}</td>
                    <td className="py-2 px-2 text-gray-600">{r.id}</td>
                    <td className="py-2 px-2 text-gray-600">{r.acenta}</td>
                    <td className="py-2 px-2 text-gray-900 font-medium">{r.yolcuAdi}</td>
                    <td className="py-2 px-2 text-gray-600">{r.tarih ? formatTarih(r.tarih) : ""}</td>
                    <td className="py-2 px-2 text-right text-gray-800">{r.biletTut ? fmtNum(r.biletTut) : ""}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{r.servis ? fmtNum(r.servis) : ""}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900">{r.toplam ? fmtNum(r.toplam) : ""}</td>
                    <td className="py-2 px-2 text-gray-500">{r.parkur1}</td>
                    <td className="py-2 px-2 text-gray-500">{r.parkur2}</td>
                    <td className="py-2 px-2 text-gray-500">{r.parkur3}</td>
                    <td className="py-2 px-2 text-gray-500">{r.satisSecli}</td>
                    <td className="py-2 px-2 text-gray-600">{r.kartNo}</td>
                    <td className="py-2 px-2 text-gray-600">{r.cariAdi}</td>
                    <td className="py-2 px-2 text-gray-500">{r.not}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
