"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Badge } from "@/components/ui";
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
  editable: {
    tarih: boolean;
    biletTut: boolean;
    kartNo: boolean;
  };
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
  VIZ: null, // ulke adı kullanılacak
  SIG: "SIGORTA",
  RAN: "RANDEVU",
  DAV: "DAVETIYE",
};

function isSchengen(ulke: string) {
  return SCHENGEN_ULKELER.some(s => s === ulke.toUpperCase());
}

function getCariLabel(file: VisaFileWithCompany): string {
  if (file.odeme_plani === "pesin") return "PESIN SATIS";
  if (file.cari_tipi === "firma_cari") {
    const firmaAd = file.companies?.firma_adi || "FIRMA";
    return `${firmaAd.toUpperCase()} CARI`;
  }
  if (file.cari_sahibi) return `${file.cari_sahibi.toUpperCase()} CARI`;
  return "";
}

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let rowIdCounter = 0;
function nextRowId() { return `row_${++rowIdCounter}_${Date.now()}`; }

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
  const [emailPreview, setEmailPreview] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    } catch { /* fallback values already set */ }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchTerm.toLowerCase().trim()
      .replace(/İ/gi, "i").replace(/I/g, "i").replace(/ı/g, "i")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ö/g, "o").replace(/ç/g, "c");

    const normalize = (s: string) => s.toLowerCase()
      .replace(/İ/gi, "i").replace(/I/g, "i").replace(/ı/g, "i")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ö/g, "o").replace(/ç/g, "c");

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
      id: nextRowId(),
      fileId: file.id,
      type: "VIZ",
      musteriAd: file.musteri_ad || "",
      hedefUlke: file.hedef_ulke || "",
      ucret: Number(file.ucret) || 0,
      ucretCurrency: currencyLabel,
      tarih: "",
      biletTut,
      servis: Math.round((satisTL - biletTut) * 100) / 100,
      toplam: satisTL,
      kartNo: "NAKIT",
      cariAdi: cariLabel,
      editable: { tarih: true, biletTut: true, kartNo: false },
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
      id: nextRowId(),
      fileId,
      type,
      musteriAd: parent.musteriAd,
      hedefUlke: parent.hedefUlke,
      ucret: 0,
      ucretCurrency: parent.ucretCurrency,
      tarih: "",
      biletTut: 0,
      servis: 0,
      toplam: 0,
      kartNo: type === "SIG" ? "FK-0491" : type === "RAN" ? "" : "NAKIT",
      cariAdi: parent.cariAdi,
      editable: {
        tarih: true,
        biletTut: true,
        kartNo: type === "RAN",
      },
    };

    const lastIndex = rows.findLastIndex(r => r.fileId === fileId);
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
      if (!fileGroups.has(r.fileId)) fileGroups.set(r.fileId, []);
      fileGroups.get(r.fileId)!.push(r);
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
      if (row.type === "VIZ") {
        return prev.filter(r => r.fileId !== row.fileId);
      }
      const updated = prev.filter(r => r.id !== rowId);
      return recalcServis(updated);
    });
  }, []);

  const numberedRows = useMemo(() => {
    return rows.map((r, i) => ({ ...r, biletNo: i + 1 }));
  }, [rows]);

  const handleDownload = async () => {
    if (rows.length === 0) return;
    setDownloading(true);
    try {
      const payload = numberedRows.map(r => ({
        biletNo: r.biletNo,
        hyKodu: r.type,
        id: "I",
        acenta: ACENTA_MAP[r.type] || r.hedefUlke.toUpperCase(),
        yolcuAdi: (r.type === "VIZ" || r.type === "DAV")
          ? `${r.musteriAd} (${r.ucret} ${r.ucretCurrency})`
          : "",
        tarih: r.tarih,
        biletTut: r.biletTut,
        servis: r.servis,
        toplam: r.toplam,
        parkur1: PARKUR_MAP[r.type].p1,
        parkur2: PARKUR_MAP[r.type].p2,
        parkur3: PARKUR_MAP[r.type].p3,
        satisSecli: PARKUR_MAP[r.type].satis,
        kartNo: r.kartNo,
        cariAdi: r.cariAdi,
        uyelikNo: "",
        pnr: "",
        odeme: "",
        mil: "",
        not: "",
      }));

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

  const handleSendEmail = async () => {
    if (rows.length === 0) return;
    setSending(true);
    try {
      const payload = numberedRows.map(r => ({
        biletNo: r.biletNo,
        hyKodu: r.type,
        id: "I",
        acenta: ACENTA_MAP[r.type] || r.hedefUlke.toUpperCase(),
        yolcuAdi: (r.type === "VIZ" || r.type === "DAV")
          ? `${r.musteriAd} (${r.ucret} ${r.ucretCurrency})`
          : "",
        tarih: r.tarih,
        biletTut: r.biletTut,
        servis: r.servis,
        toplam: r.toplam,
        parkur1: PARKUR_MAP[r.type].p1,
        parkur2: PARKUR_MAP[r.type].p2,
        parkur3: PARKUR_MAP[r.type].p3,
        satisSecli: PARKUR_MAP[r.type].satis,
        kartNo: r.kartNo,
        cariAdi: r.cariAdi,
        uyelikNo: "",
        pnr: "",
        odeme: "",
        mil: "",
        not: "",
      }));

      const res = await fetch("/api/gunluk-rapor/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: payload,
          tarih: raporTarih,
          personel: userName,
          senderEmail: userEmail,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Mail gönderilemedi");
      }

      setStatusMsg({ type: "success", text: "Mail muhasebeye gönderildi!" });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Hata oluştu" });
    } finally {
      setSending(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const uniqueFileIds = useMemo(() => [...new Set(rows.map(r => r.fileId))], [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Üst Bar: Tarih + Kur + Aksiyonlar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={rows.length === 0 || downloading}
              className="text-xs"
            >
              {downloading ? "İndiriliyor..." : "Excel İndir"}
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmail}
              disabled={rows.length === 0 || sending}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {sending ? "Gönderiliyor..." : "Muhasebeye Mail At"}
            </Button>
          </div>
        </div>

        {statusMsg && (
          <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
            statusMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {statusMsg.text}
          </div>
        )}
      </div>

      {/* Müşteri Ekleme */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Müşteri Ekle</h3>
          <span className="text-xs text-gray-400">{rows.length} kayıt eklendi</span>
        </div>

        <div className="relative">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Müşteri adı, pasaport no veya ülke ile ara..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {showSearch && searchResults.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-[300px] overflow-y-auto">
              {searchResults.map(f => (
                <button
                  key={f.id}
                  onClick={() => addCustomer(f)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.musteri_ad}</p>
                      <p className="text-xs text-gray-500">{f.hedef_ulke} &middot; {f.pasaport_no}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        {Number(f.ucret).toLocaleString("tr-TR")} {f.ucret_currency === "EUR" ? "€" : f.ucret_currency === "USD" ? "$" : "₺"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {f.odeme_plani === "pesin" ? "Peşin" : f.cari_tipi === "firma_cari" ? "Firma Cari" : "Cari"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Eklenen Müşteriler - Alt kayıt butonları */}
      {uniqueFileIds.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
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

                  {!hasSig && (
                    <button
                      onClick={() => addSubRow(fileId, "SIG")}
                      className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      + Sigorta
                    </button>
                  )}
                  {!hasRan && (
                    <button
                      onClick={() => addSubRow(fileId, "RAN")}
                      className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors"
                    >
                      + Randevu
                    </button>
                  )}
                  {!hasDav && (
                    <button
                      onClick={() => addSubRow(fileId, "DAV")}
                      className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors"
                    >
                      + Davet
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rapor Tablosu Önizleme */}
      {numberedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel Önizleme
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{numberedRows.length} satır</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">#</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">H.Y.</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">I-D</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Acenta</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Yolcu Adı</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Tarih</th>
                  <th className="py-2 px-2 text-right font-semibold text-gray-600">Bilet Tut.</th>
                  <th className="py-2 px-2 text-right font-semibold text-gray-600">Servis</th>
                  <th className="py-2 px-2 text-right font-semibold text-gray-600">Toplam</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">P1</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">P2</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">P3</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Satış Şekli</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Kart No</th>
                  <th className="py-2 px-2 text-left font-semibold text-gray-600">Cari Adı</th>
                  <th className="py-2 px-2 text-center font-semibold text-gray-600">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {numberedRows.map((r) => {
                  const parkur = PARKUR_MAP[r.type];
                  const typeColors: Record<RecordType, string> = {
                    VIZ: "bg-green-50 text-green-700",
                    SIG: "bg-blue-50 text-blue-700",
                    RAN: "bg-purple-50 text-purple-700",
                    DAV: "bg-amber-50 text-amber-700",
                  };

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2 px-2 font-medium text-gray-800">{r.biletNo}</td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${typeColors[r.type]}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-600">I</td>
                      <td className="py-2 px-2 text-gray-600">{ACENTA_MAP[r.type] || r.hedefUlke.toUpperCase()}</td>
                      <td className="py-2 px-2 text-gray-900 font-medium">
                        {(r.type === "VIZ" || r.type === "DAV")
                          ? `${r.musteriAd} (${r.ucret} ${r.ucretCurrency})`
                          : ""}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={r.tarih}
                          onChange={(e) => updateRow(r.id, "tarih", e.target.value)}
                          className="w-[120px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        {r.editable.biletTut ? (
                          <input
                            type="number"
                            value={r.biletTut || ""}
                            onChange={(e) => updateRow(r.id, "biletTut", Number(e.target.value) || 0)}
                            className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-gray-800">{r.biletTut.toLocaleString("tr-TR")}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-600">{r.servis.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">{r.toplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-gray-500">{parkur.p1}</td>
                      <td className="py-2 px-2 text-gray-500">{parkur.p2}</td>
                      <td className="py-2 px-2 text-gray-500">{parkur.p3}</td>
                      <td className="py-2 px-2 text-gray-500">{parkur.satis}</td>
                      <td className="py-2 px-2">
                        {r.editable.kartNo ? (
                          <input
                            type="text"
                            value={r.kartNo}
                            onChange={(e) => updateRow(r.id, "kartNo", e.target.value)}
                            className="w-[80px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Kart No"
                          />
                        ) : (
                          <span className="text-gray-600">{r.kartNo}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-600">{r.cariAdi}</td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => removeRow(r.id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Sil"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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

      {/* Mail Önizleme Modal */}
      {emailPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEmailPreview(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Mail Önizleme</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span className="font-medium text-gray-500 w-16">Kime:</span>
                <span className="text-gray-900">Muhasebe@foxturizm.com</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-gray-500 w-16">CC:</span>
                <span className="text-gray-900">{userEmail}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-gray-500 w-16">Konu:</span>
                <span className="text-gray-900">Günlük Rapor - {raporTarih.replace(/-/g, ".")} - {userName}</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-gray-600">
                  {userName} personelinin {raporTarih.replace(/-/g, ".")} tarihli günlük raporu ektedir.
                </p>
                <p className="text-gray-500 mt-2">
                  Toplam {numberedRows.length} kayıt, {uniqueFileIds.length} müşteri.
                </p>
              </div>
              <div className="flex gap-2 items-center text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>{raporTarih.replace(/-/g, ".")}.xlsx</span>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" size="sm" onClick={() => setEmailPreview(false)} className="flex-1">
                Kapat
              </Button>
              <Button
                size="sm"
                onClick={() => { setEmailPreview(false); handleSendEmail(); }}
                disabled={sending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Gönder
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Boş durum */}
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
    </div>
  );
}
