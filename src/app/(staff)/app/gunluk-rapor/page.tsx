"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import type { VisaFile } from "@/lib/supabase/types";

type VisaFileWithCompany = VisaFile & { companies?: { firma_adi: string } | null };
type RecordType = "VIZ" | "SIG" | "RAN" | "DAV";

interface ReportRow {
  id: string;
  fileId: string;
  type: RecordType;
  musteriAd: string;
  hedefUlke: string;
  ucret: number;
  ucretCurrency: string;
  tarih: string;
  biletTut: number;
  servis: number;
  toplam: number;
  kartNo: string;
  cariAdi: string;
  isEmpty?: boolean;
}

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

interface PastReport {
  id: string;
  tarih: string;
  personel: string;
  kayitSayisi: number;
  musteriSayisi: number;
  gonderimTarih: string;
  rows?: ExcelRow[];
}

const SCHENGEN_ULKELER = [
  "ALMANYA", "FRANSA", "ITALYA", "İTALYA", "ISPANYA", "İSPANYA",
  "HOLLANDA", "BELÇIKA", "BELCIKA", "AVUSTURYA",
  "İSVIÇRE", "ISVICRE", "İSVİÇRE", "YUNANISTAN",
  "PORTEKİZ", "PORTEKIZ", "ÇEKYA", "CEKYA", "POLONYA",
  "MACARİSTAN", "MACARISTAN", "HIRVATİSTAN", "HIRVATISTAN",
  "BULGARİSTAN", "BULGARISTAN", "ROMANYA",
  "FINLANDIYA", "FİNLANDİYA", "DANIMARKA", "DANİMARKA",
  "İSVEÇ", "ISVEC", "NORVEÇ", "NORVEC",
  "LETONYA", "LİTVANYA", "LITVANYA", "ESTONYA",
  "SLOVENYA", "SLOVAKYA", "LÜKSEMBURG", "LUKSEMBURG", "MALTA",
];

const PARKUR_MAP: Record<RecordType, { p1: string; p2: string; p3: string; satis: string }> = {
  VIZ: { p1: "KON", p2: "SO", p3: "LOS", satis: "LUK UCRETI" },
  SIG: { p1: "SI", p2: "GOR", p3: "TA", satis: "UCRETI" },
  RAN: { p1: "RAN", p2: "DE", p3: "VU", satis: "UCRETI" },
  DAV: { p1: "DA", p2: "VE", p3: "TI", satis: "YE UCRETI" },
};

const ACENTA_MAP: Record<RecordType, string | null> = {
  VIZ: null,
  SIG: "SIGORTA",
  RAN: "RANDEVU",
  DAV: "DAVETIYE",
};

function toAscii(s: string): string {
  return s
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c");
}

function isSchengen(ulke: string) {
  return SCHENGEN_ULKELER.some(s => s === ulke.toUpperCase());
}

function getCariLabel(file: VisaFileWithCompany): string {
  if (file.odeme_plani === "pesin") return "PESIN SATIS";
  if (file.cari_tipi === "firma_cari") {
    const firmaAd = file.companies?.firma_adi || "FIRMA";
    return firmaAd.toUpperCase();
  }
  if (file.cari_sahibi) return `${file.cari_sahibi.toUpperCase()} CARI`;
  return "";
}

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalize(s: string) {
  return s.toLowerCase()
    .replace(/İ/gi, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c");
}

let rowIdCounter = 0;
function nextRowId() { return `row_${++rowIdCounter}_${Date.now()}`; }

async function fetchPastReports(): Promise<PastReport[]> {
  try {
    const res = await fetch("/api/gunluk-rapor/list");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.reports || []).map((r: any) => ({
      id: r.id,
      tarih: r.tarih,
      personel: r.personel,
      kayitSayisi: r.kayit_sayisi,
      musteriSayisi: r.musteri_sayisi,
      gonderimTarih: r.created_at,
      rows: r.rows,
    }));
  } catch { return []; }
}

async function savePastReportToDb(report: { tarih: string; kayitSayisi: number; musteriSayisi: number; rows: ExcelRow[]; isRevize: boolean }) {
  await fetch("/api/gunluk-rapor/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
}

async function deletePastReportFromDb(id: string) {
  await fetch("/api/gunluk-rapor/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export default function GunlukRaporPage() {
  const [userFiles, setUserFiles] = useState<VisaFileWithCompany[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<VisaFileWithCompany[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eurRate, setEurRate] = useState(0);
  const [usdRate, setUsdRate] = useState(0);
  const [raporTarih, setRaporTarih] = useState(toDateStr(new Date()));
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ExcelRow[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [activeTab, setActiveTab] = useState<"rapor" | "gecmis">("rapor");
  const [hasDraft, setHasDraft] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profile) {
      setUserName(profile.name || "");
      setUserEmail(profile.email || user.email || "");
    }

    const { data: files } = await supabase
      .from("visa_files")
      .select("*, companies(firma_adi)")
      .eq("assigned_user_id", user.id)
      .eq("arsiv_mi", false)
      .order("created_at", { ascending: false });

    if (files) setUserFiles(files as VisaFileWithCompany[]);

    try {
      const res = await fetch("/api/exchange-rates");
      if (res.ok) {
        const data = await res.json();
        setEurRate(data.rates?.EUR || 38);
        setUsdRate(data.rates?.USD || 36);
      }
    } catch { /* fallback */ }

    fetchPastReports().then(setPastReports);
    try {
      const draft = localStorage.getItem("gunluk_rapor_taslak");
      if (draft) setHasDraft(true);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const q = normalize(searchTerm.trim());
    const addedFileIds = new Set(rows.map(r => r.fileId));
    const filtered = userFiles.filter(f =>
      !addedFileIds.has(f.id) && (
        normalize(f.musteri_ad || "").includes(q) ||
        normalize(f.pasaport_no || "").includes(q) ||
        normalize(f.hedef_ulke || "").includes(q)
      )
    );
    setSearchResults(filtered.slice(0, 10));
  }, [searchTerm, userFiles, rows]);

  const getTlAmount = useCallback((file: VisaFileWithCompany) => {
    const amount = Number(file.ucret) || 0;
    if (file.ucret_currency === "EUR") return Math.round(amount * eurRate * 100) / 100;
    if (file.ucret_currency === "USD") return Math.round(amount * usdRate * 100) / 100;
    return amount;
  }, [eurRate, usdRate]);

  const addCustomer = useCallback((file: VisaFileWithCompany) => {
    const schengen = isSchengen(file.hedef_ulke || "");
    const biletTut = schengen ? Math.round(90 * eurRate * 100) / 100 : 0;
    const satisTL = getTlAmount(file);
    const cariLabel = getCariLabel(file);
    const currencyLabel = file.ucret_currency === "EUR" ? "EURO" : file.ucret_currency === "USD" ? "DOLAR" : "TL";

    const vizRow: ReportRow = {
      id: nextRowId(), fileId: file.id, type: "VIZ",
      musteriAd: file.musteri_ad || "", hedefUlke: file.hedef_ulke || "",
      ucret: Number(file.ucret) || 0, ucretCurrency: currencyLabel,
      tarih: toDateStr(new Date()), biletTut,
      servis: Math.round((satisTL - biletTut) * 100) / 100,
      toplam: satisTL, kartNo: "NAKIT", cariAdi: cariLabel,
    };
    setRows(prev => [...prev, vizRow]);
    setSearchTerm("");
    setShowSearch(false);
  }, [eurRate, getTlAmount]);

  const addSubRow = useCallback((fileId: string, type: RecordType) => {
    const parentRows = rows.filter(r => r.fileId === fileId);
    if (!parentRows.length) return;
    const parent = parentRows[0];

    const newRow: ReportRow = {
      id: nextRowId(), fileId, type,
      musteriAd: parent.musteriAd, hedefUlke: parent.hedefUlke,
      ucret: 0, ucretCurrency: parent.ucretCurrency,
      tarih: toDateStr(new Date()), biletTut: 0, servis: 0, toplam: 0,
      kartNo: type === "SIG" ? "FK-0491" : type === "RAN" ? "" : "NAKIT",
      cariAdi: parent.cariAdi,
    };

    let lastIndex = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].fileId === fileId) { lastIndex = i; break; }
    }
    const updated = [...rows];
    updated.splice(lastIndex + 1, 0, newRow);
    setRows(updated);
  }, [rows]);

  const addEmptyRow = useCallback((fileId: string) => {
    const newRow: ReportRow = {
      id: nextRowId(), fileId, type: "VIZ",
      musteriAd: "", hedefUlke: "",
      ucret: 0, ucretCurrency: "", tarih: "",
      biletTut: 0, servis: 0, toplam: 0,
      kartNo: "", cariAdi: "", isEmpty: true,
    };
    let lastIndex = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].fileId === fileId) { lastIndex = i; break; }
    }
    const updated = [...rows];
    updated.splice(lastIndex + 1, 0, newRow);
    setRows(updated);
  }, [rows]);

  const updateRow = useCallback((rowId: string, field: keyof ReportRow, value: any) => {
    setRows(prev => {
      const updated = prev.map(r => {
        if (r.id !== rowId) return r;
        const newRow = { ...r, [field]: value };
        if (field === "biletTut" && (r.type === "SIG" || r.type === "RAN")) {
          newRow.toplam = Number(value) || 0;
          newRow.servis = 0;
        }
        return newRow;
      });
      return recalcServis(updated);
    });
  }, []);

  const recalcServis = (allRows: ReportRow[]): ReportRow[] => {
    const fileGroups = new Map<string, ReportRow[]>();
    allRows.forEach(r => {
      const arr = fileGroups.get(r.fileId);
      if (arr) arr.push(r); else fileGroups.set(r.fileId, [r]);
    });
    return allRows.map(r => {
      if (r.type !== "VIZ") return r;
      const group = fileGroups.get(r.fileId) || [];
      const sigBilet = group.filter(g => g.type === "SIG").reduce((s, g) => s + (Number(g.biletTut) || 0), 0);
      const ranBilet = group.filter(g => g.type === "RAN").reduce((s, g) => s + (Number(g.biletTut) || 0), 0);
      const vizBilet = Number(r.biletTut) || 0;
      const servis = Math.round((r.toplam - vizBilet - sigBilet - ranBilet) * 100) / 100;
      return { ...r, servis };
    });
  };

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => {
      const row = prev.find(r => r.id === rowId);
      if (!row) return prev;
      if (row.type === "VIZ") return prev.filter(r => r.fileId !== row.fileId);
      return recalcServis(prev.filter(r => r.id !== rowId));
    });
  }, []);

  const numberedRows = useMemo(() => rows.map((r, i) => ({ ...r, biletNo: i + 1 })), [rows]);

  const uniqueFileIds = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    rows.forEach(r => { if (!seen.has(r.fileId)) { seen.add(r.fileId); result.push(r.fileId); } });
    return result;
  }, [rows]);

  const buildExcelRows = useCallback((): ExcelRow[] => {
    return numberedRows.map(r => {
      const acenta = r.isEmpty ? (r.hedefUlke?.split("|")[0] || "") : (ACENTA_MAP[r.type] || r.hedefUlke.toUpperCase());
      const yolcuAdi = r.type === "VIZ" ? `${r.musteriAd} (${r.ucret} ${r.ucretCurrency})` : (r.musteriAd || "");
      return {
        biletNo: r.biletNo, hyKodu: r.type, id: "I",
        acenta: toAscii(acenta),
        yolcuAdi: toAscii(yolcuAdi),
        tarih: r.tarih, biletTut: r.biletTut, servis: r.servis, toplam: r.toplam,
        parkur1: toAscii(r.isEmpty ? (r.hedefUlke?.split("|")[1] || "") : PARKUR_MAP[r.type].p1),
        parkur2: toAscii(r.isEmpty ? (r.hedefUlke?.split("|")[2] || "") : PARKUR_MAP[r.type].p2),
        parkur3: toAscii(r.isEmpty ? (r.hedefUlke?.split("|")[3] || "") : PARKUR_MAP[r.type].p3),
        satisSecli: toAscii(r.isEmpty ? (r.hedefUlke?.split("|")[4] || "") : PARKUR_MAP[r.type].satis),
        kartNo: toAscii(r.kartNo), cariAdi: toAscii(r.cariAdi),
        uyelikNo: "", not: "",
      };
    });
  }, [numberedRows]);

  const saveDraft = useCallback(() => {
    try {
      const draft = { raporTarih, rows };
      localStorage.setItem("gunluk_rapor_taslak", JSON.stringify(draft));
      setHasDraft(true);
      setStatusMsg({ type: "success", text: "Taslak kaydedildi!" });
      setTimeout(() => setStatusMsg(null), 2000);
    } catch { /* */ }
  }, [raporTarih, rows]);

  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem("gunluk_rapor_taslak");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.raporTarih) setRaporTarih(draft.raporTarih);
      if (draft.rows) setRows(draft.rows);
      setStatusMsg({ type: "success", text: "Taslak yüklendi!" });
      setTimeout(() => setStatusMsg(null), 2000);
    } catch { /* */ }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem("gunluk_rapor_taslak");
    setHasDraft(false);
  }, []);

  const openPreview = () => {
    setPreviewRows(buildExcelRows());
    setPreviewOpen(true);
  };

  const updatePreviewRow = (idx: number, field: keyof ExcelRow, value: any) => {
    setPreviewRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleDownload = async (data?: ExcelRow[]) => {
    const payload = data || buildExcelRows();
    if (payload.length === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/gunluk-rapor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, tarih: raporTarih, personel: userName }),
      });
      if (!res.ok) throw new Error("Excel oluşturulamadı");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${raporTarih.replace(/-/g, ".")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg({ type: "success", text: "Excel indirildi!" });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Hata oluştu" });
    } finally {
      setDownloading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleSendEmail = async (data?: ExcelRow[], isRevize?: boolean) => {
    const payload = data || buildExcelRows();
    if (payload.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/gunluk-rapor/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, tarih: raporTarih, personel: userName, senderEmail: userEmail, isRevize: !!isRevize }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Mail gönderilemedi");
      }
      const customerCount = new Set(payload.filter(r => r.yolcuAdi).map(r => r.yolcuAdi)).size || uniqueFileIds.length;
      await savePastReportToDb({
        tarih: raporTarih,
        kayitSayisi: payload.length,
        musteriSayisi: customerCount,
        rows: payload,
        isRevize: !!isRevize,
      });
      fetchPastReports().then(setPastReports);
      clearDraft();
      setStatusMsg({ type: "success", text: isRevize ? "Revize rapor gönderildi!" : "Mail muhasebeye gönderildi!" });
      setPreviewOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Hata oluştu" });
    } finally {
      setSending(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* Tab Seçimi */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-200 w-fit">
        <button
          onClick={() => setActiveTab("rapor")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "rapor" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Yeni Rapor
        </button>
        <button
          onClick={() => setActiveTab("gecmis")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "gecmis" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Geçmiş Raporlarım
          {pastReports.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === "gecmis" ? "bg-white/20" : "bg-gray-100"
            }`}>{pastReports.length}</span>
          )}
        </button>
      </div>

      {activeTab === "gecmis" ? (
        /* Geçmiş Raporlar */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Gönderilen Raporlar</h3>
          </div>
          {pastReports.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">Henüz rapor gönderilmemiş</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pastReports.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{r.tarih.replace(/-/g, ".")}</p>
                    <p className="text-xs text-gray-500">{r.kayitSayisi} kayıt, {r.musteriSayisi} müşteri</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.rows && r.rows.length > 0 && (
                      <>
                        <button
                          onClick={() => handleDownload(r.rows)}
                          className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        >İndir</button>
                        <button
                          onClick={() => { setRaporTarih(r.tarih); setPreviewRows(r.rows!); setPreviewOpen(true); }}
                          className="px-2.5 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        >Düzenle</button>
                      </>
                    )}
                    <button
                      onClick={async () => { await deletePastReportFromDb(r.id); fetchPastReports().then(setPastReports); }}
                      className="px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                    >Sil</button>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-xs text-gray-400">
                      {new Date(r.gonderimTarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-xs text-emerald-600 font-medium">Gönderildi</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Üst Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Rapor Tarihi:</label>
                <input
                  type="date"
                  value={raporTarih}
                  onChange={(e) => setRaporTarih(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>EUR: <strong className="text-gray-900">{eurRate.toFixed(2)} TL</strong></span>
                <span>USD: <strong className="text-gray-900">{usdRate.toFixed(2)} TL</strong></span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {hasDraft && rows.length === 0 && (
                  <button onClick={loadDraft} className="px-3 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                    Taslağı Yükle
                  </button>
                )}
                <button onClick={saveDraft} disabled={rows.length === 0} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Taslak Kaydet
                </button>
                <Button variant="outline" size="sm" onClick={() => handleDownload()} disabled={rows.length === 0 || downloading} className="text-xs">
                  {downloading ? "İndiriliyor..." : "Excel İndir"}
                </Button>
                <Button
                  size="sm"
                  onClick={openPreview}
                  disabled={rows.length === 0}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Önizle ve Gönder
                </Button>
              </div>
            </div>
            {statusMsg && (
              <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                statusMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}>{statusMsg.text}</div>
            )}
          </div>

          {/* Müşteri Ekleme */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Müşteri Ekle</h3>
              <span className="text-xs text-gray-400">{rows.length} kayıt</span>
            </div>
            <div className="relative">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Müşteri adı, pasaport no veya ülke ara..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-[300px] overflow-y-auto">
                  {searchResults.map(f => (
                    <button key={f.id} onClick={() => addCustomer(f)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{f.musteri_ad}</p>
                          <p className="text-xs text-gray-500">{f.hedef_ulke} &middot; {f.pasaport_no}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800">
                            {Number(f.ucret).toLocaleString("tr-TR")} {f.ucret_currency === "EUR" ? "€" : f.ucret_currency === "USD" ? "$" : "₺"}
                          </p>
                          <p className="text-xs text-gray-400">{f.odeme_plani === "pesin" ? "Peşin" : f.cari_tipi === "firma_cari" ? "Firma Cari" : "Cari"}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Eklenen Müşteriler */}
          {uniqueFileIds.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Eklenen Müşteriler</h3>
              <div className="space-y-2">
                {uniqueFileIds.map(fileId => {
                  const fileRows = rows.filter(r => r.fileId === fileId);
                  const vizRow = fileRows.find(r => r.type === "VIZ");
                  if (!vizRow) return null;
                  const hasSig = fileRows.some(r => r.type === "SIG");
                  const hasRan = fileRows.some(r => r.type === "RAN");
                  const hasDav = fileRows.some(r => r.type === "DAV");
                  return (
                    <div key={fileId} className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-sm font-medium text-gray-800 mr-2">{vizRow.musteriAd}</span>
                      <span className="text-xs text-gray-500 mr-auto">{vizRow.hedefUlke}</span>
                      {!hasSig && <button onClick={() => addSubRow(fileId, "SIG")} className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors">+ Sigorta</button>}
                      {!hasRan && <button onClick={() => addSubRow(fileId, "RAN")} className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors">+ Randevu</button>}
                      {!hasDav && <button onClick={() => addSubRow(fileId, "DAV")} className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors">+ Davet</button>}
                      <button onClick={() => addEmptyRow(fileId)} className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">+ Boş Satır</button>
                      <button onClick={() => removeRow(vizRow.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-1" title="Müşteriyi Kaldır">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rapor Tablosu */}
          {numberedRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-900 px-5 py-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Rapor Tablosu
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{numberedRows.length} satır</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {["#","H.Y.","I-D","Acenta","Yolcu Adı","Tarih","Bilet Tut.","Servis","Toplam","P1","P2","P3","Satış","Kart No","Cari Adı",""].map((h,i) => (
                        <th key={i} className={`py-2 px-2 font-semibold text-gray-600 ${i >= 6 && i <= 8 ? "text-right" : "text-left"} ${i === 15 ? "text-center" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {numberedRows.map((r) => {
                      const parkur = PARKUR_MAP[r.type];
                      const tc: Record<RecordType, string> = { VIZ: "bg-green-50 text-green-700", SIG: "bg-blue-50 text-blue-700", RAN: "bg-purple-50 text-purple-700", DAV: "bg-amber-50 text-amber-700" };
                      return (
                        <tr key={r.id} className={`hover:bg-gray-50/50 transition-colors ${r.isEmpty ? "bg-yellow-50/40" : ""}`}>
                          <td className="py-2 px-2 font-medium text-gray-800">{r.biletNo}</td>
                          <td className="py-2 px-2">
                            {r.isEmpty ? (
                              <input type="text" value={r.type} onChange={(e) => updateRow(r.id, "type", e.target.value as RecordType)} className="w-[45px] px-1 py-0.5 border border-gray-200 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tc[r.type]}`}>{r.type}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-gray-600">I</td>
                          <td className="py-2 px-2">
                            {r.isEmpty ? (
                              <input type="text" value={r.hedefUlke?.split("|")[0] || ""} onChange={(e) => { const parts = (r.hedefUlke || "||||").split("|"); parts[0] = e.target.value; updateRow(r.id, "hedefUlke", parts.join("|")); }} className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Acenta" />
                            ) : (
                              <span className="text-gray-600">{ACENTA_MAP[r.type] || r.hedefUlke.toUpperCase()}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-gray-900 font-medium">
                            {r.type === "VIZ" && !r.isEmpty ? (
                              `${r.musteriAd} (${r.ucret} ${r.ucretCurrency})`
                            ) : (
                              <input type="text" value={r.musteriAd} onChange={(e) => updateRow(r.id, "musteriAd", e.target.value)} className="w-[200px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Yolcu adı..." />
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <input type="date" value={r.tarih} onChange={(e) => updateRow(r.id, "tarih", e.target.value)} className="w-[120px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input type="number" value={r.biletTut || ""} onChange={(e) => updateRow(r.id, "biletTut", Number(e.target.value) || 0)} className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                          </td>
                          <td className="py-2 px-2 text-right">
                            {r.isEmpty ? (
                              <input type="number" value={r.servis || ""} onChange={(e) => updateRow(r.id, "servis", Number(e.target.value) || 0)} className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                            ) : (
                              <span className="text-gray-600">{r.servis.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {r.isEmpty ? (
                              <input type="number" value={r.toplam || ""} onChange={(e) => updateRow(r.id, "toplam", Number(e.target.value) || 0)} className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold" placeholder="0" />
                            ) : (
                              <span className="font-semibold text-gray-900">{r.toplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            )}
                          </td>
                          <td className="py-2 px-2">{r.isEmpty ? <input type="text" value={r.hedefUlke?.split("|")[1] || ""} onChange={(e) => { const parts = (r.hedefUlke || "|||").split("|"); parts[1] = e.target.value; updateRow(r.id, "hedefUlke", parts.join("|")); }} className="w-[40px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="P1" /> : <span className="text-gray-500">{parkur.p1}</span>}</td>
                          <td className="py-2 px-2">{r.isEmpty ? <input type="text" value={r.hedefUlke?.split("|")[2] || ""} onChange={(e) => { const parts = (r.hedefUlke || "|||").split("|"); parts[2] = e.target.value; updateRow(r.id, "hedefUlke", parts.join("|")); }} className="w-[40px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="P2" /> : <span className="text-gray-500">{parkur.p2}</span>}</td>
                          <td className="py-2 px-2">{r.isEmpty ? <input type="text" value={r.hedefUlke?.split("|")[3] || ""} onChange={(e) => { const parts = (r.hedefUlke || "|||").split("|"); parts[3] = e.target.value; updateRow(r.id, "hedefUlke", parts.join("|")); }} className="w-[40px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="P3" /> : <span className="text-gray-500">{parkur.p3}</span>}</td>
                          <td className="py-2 px-2">{r.isEmpty ? <input type="text" value={r.hedefUlke?.split("|")[4] || ""} onChange={(e) => { const parts = (r.hedefUlke || "||||").split("|"); parts[4] = e.target.value; updateRow(r.id, "hedefUlke", parts.join("|")); }} className="w-[80px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Satış" /> : <span className="text-gray-500">{parkur.satis}</span>}</td>
                          <td className="py-2 px-2">
                            {r.isEmpty || r.type === "RAN" ? (
                              <input type="text" value={r.kartNo} onChange={(e) => updateRow(r.id, "kartNo", e.target.value)} className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Kart No" />
                            ) : <span className="text-gray-600">{r.kartNo}</span>}
                          </td>
                          <td className="py-2 px-2">
                            {r.isEmpty ? (
                              <input type="text" value={r.cariAdi} onChange={(e) => updateRow(r.id, "cariAdi", e.target.value)} className="w-[90px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Cari adı" />
                            ) : <span className="text-gray-600">{r.cariAdi}</span>}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button onClick={() => removeRow(r.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Sil">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Henüz müşteri eklenmedi</p>
              <p className="text-sm text-gray-400 mt-1">Yukarıdaki arama kutusundan müşteri seçerek rapora ekleyin</p>
            </div>
          )}
        </>
      )}

      {/* Önizle ve Düzenle Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-[95vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Excel Önizleme ve Düzenleme</h3>
                <p className="text-sm text-gray-500 mt-0.5">Tüm alanları düzenleyebilirsiniz. Düzenleme bittikten sonra gönderin.</p>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Mail Bilgileri */}
            <div className="px-6 py-3 bg-orange-50 border-b border-orange-200 flex flex-wrap items-center gap-4 text-sm">
              <div><span className="text-orange-600 font-medium">Kime:</span> <span className="font-semibold text-orange-900">Muhasebe@foxturizm.com, info@foxturizm.com</span></div>
              <div><span className="text-orange-600 font-medium">CC:</span> <span className="font-semibold text-orange-900">{userEmail}</span></div>
              <div className="flex items-center gap-1.5">
                <span className="text-orange-600 font-medium">Rapor Tarihi:</span>
                <input
                  type="date"
                  value={raporTarih}
                  onChange={(e) => setRaporTarih(e.target.value)}
                  className="px-2 py-1 border border-orange-300 rounded-md text-xs font-semibold text-orange-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div><span className="text-orange-600 font-medium">Konu:</span> <span className="font-semibold text-orange-900">{(() => { const p = raporTarih.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : raporTarih; })()} GÜNLÜK RAPORUM</span></div>
              <div><span className="text-orange-600 font-medium">Ek:</span> <span className="font-semibold text-orange-900">{(() => { const p = raporTarih.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : raporTarih; })()}.xlsx</span></div>
            </div>

            {/* Editable Table */}
            <div className="overflow-x-auto p-4">
              <table className="w-full text-xs whitespace-nowrap border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-indigo-50">
                    {["#","H.Y. Kodu","I-D","Acenta","Yolcu Adı","Tarih","Bilet Tut.","Servis","Toplam","P1","P2","P3","Satış Şekli","Kart No","Cari Adı","Not",""].map((h,i) => (
                      <th key={i} className="py-2.5 px-2 text-left font-semibold text-indigo-800 border-b border-indigo-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-1.5 px-2 text-gray-800 font-medium">{r.biletNo}</td>
                      <td className="py-1.5 px-2"><input value={r.hyKodu} onChange={e => updatePreviewRow(idx, "hyKodu", e.target.value)} className="w-[50px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.id} onChange={e => updatePreviewRow(idx, "id", e.target.value)} className="w-[30px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.acenta} onChange={e => updatePreviewRow(idx, "acenta", e.target.value)} className="w-[90px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.yolcuAdi} onChange={e => updatePreviewRow(idx, "yolcuAdi", e.target.value)} className="w-[220px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input type="date" value={r.tarih} onChange={e => updatePreviewRow(idx, "tarih", e.target.value)} className="w-[120px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input type="number" value={r.biletTut || ""} onChange={e => updatePreviewRow(idx, "biletTut", Number(e.target.value) || 0)} className="w-[70px] px-1 py-0.5 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input type="number" value={r.servis || ""} onChange={e => updatePreviewRow(idx, "servis", Number(e.target.value) || 0)} className="w-[70px] px-1 py-0.5 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input type="number" value={r.toplam || ""} onChange={e => updatePreviewRow(idx, "toplam", Number(e.target.value) || 0)} className="w-[70px] px-1 py-0.5 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.parkur1} onChange={e => updatePreviewRow(idx, "parkur1", e.target.value)} className="w-[40px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.parkur2} onChange={e => updatePreviewRow(idx, "parkur2", e.target.value)} className="w-[40px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.parkur3} onChange={e => updatePreviewRow(idx, "parkur3", e.target.value)} className="w-[40px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.satisSecli} onChange={e => updatePreviewRow(idx, "satisSecli", e.target.value)} className="w-[90px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.kartNo} onChange={e => updatePreviewRow(idx, "kartNo", e.target.value)} className="w-[80px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.cariAdi} onChange={e => updatePreviewRow(idx, "cariAdi", e.target.value)} className="w-[100px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" /></td>
                      <td className="py-1.5 px-2"><input value={r.not} onChange={e => updatePreviewRow(idx, "not", e.target.value)} className="w-[100px] px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="Not..." /></td>
                      <td className="py-1.5 px-2 text-center">
                        <button onClick={() => setPreviewRows(prev => { const updated = prev.filter((_, i) => i !== idx); return updated.map((row, i) => ({ ...row, biletNo: i + 1 })); })} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Satırı Sil">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">{previewRows.length} satır</p>
                <button
                  onClick={() => setPreviewRows(prev => [...prev, {
                    biletNo: prev.length + 1, hyKodu: "", id: "I", acenta: "", yolcuAdi: "",
                    tarih: "", biletTut: 0, servis: 0, toplam: 0,
                    parkur1: "", parkur2: "", parkur3: "", satisSecli: "",
                    kartNo: "", cariAdi: "", uyelikNo: "", not: "",
                  }])}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  + Boş Satır Ekle
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>İptal</Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload(previewRows)} disabled={downloading}>
                  {downloading ? "İndiriliyor..." : "Excel İndir"}
                </Button>
                <button
                  onClick={() => handleSendEmail(previewRows, true)}
                  disabled={sending}
                  className="px-4 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {sending ? "Gönderiliyor..." : "Revize Olarak Gönder"}
                </button>
                <Button
                  size="sm"
                  onClick={() => handleSendEmail(previewRows, false)}
                  disabled={sending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                >
                  {sending ? "Gönderiliyor..." : "Muhasebeye Gönder"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
