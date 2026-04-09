"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Button, Card, Badge, Input } from "@/components/ui";
import MuhasebeFileDetailModal from "@/components/muhasebe/MuhasebeFileDetailModal";
import type { Profile, VisaFile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles?: { name: string } | null };
const MUHASEBE_FILTERS = [
  { value: "all", label: "Hepsi" },
  { value: "BAHAR", label: "BAHAR" },
  { value: "ERCAN", label: "ERCAN" },
  { value: "YUSUF", label: "YUSUF" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "Hepsi", icon: "📁" },
  { value: "devam", label: "İşlemi devam edenler", icon: "🔄" },
  { value: "sonuclanan", label: "Sonuçlananlar", icon: "✅" },
] as const;

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ERCAN: "/ercan-avatar.jpg",
  BAHAR: "/bahar-avatar.jpg",
};

function getCurrencySymbol(c: string) {
  const s: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return s[c] || c;
}

function fmt(amount: number, currency: string) {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getCurrencySymbol(currency)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function normalize(str: string) {
  return str
    .toLowerCase()
    .replace(/İ/gi, "i").replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c");
}

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function MuhasebePage() {
  const [allFiles, setAllFiles] = useState<VisaFileWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [dateStart, setDateStart] = useState(toDateStr(monthAgo));
  const [dateEnd, setDateEnd] = useState(toDateStr(today));
  const [dateFilterActive, setDateFilterActive] = useState(false);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/muhasebe/user-stats");
      if (res.ok) {
        const data = await res.json();
        const staffList = data.staffList || [];
        const files: VisaFileWithProfile[] = [];
        staffList.forEach((s: { files: VisaFileWithProfile[] }) => {
          files.push(...s.files);
        });
        setAllFiles(files);
        setProfiles(staffList.map((s: { profile: Profile }) => s.profile));
      }
    } catch (err) {
      console.error("Muhasebe veri hatası:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCariKey = useCallback((f: VisaFileWithProfile) => {
    if (f.cari_sahibi) return f.cari_sahibi.toUpperCase();
    const prof = profiles.find(p => p.id === f.assigned_user_id);
    return prof?.name?.toUpperCase() || "";
  }, [profiles]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    allFiles.forEach(f => { if (f.hedef_ulke) set.add(f.hedef_ulke.toUpperCase()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [allFiles]);

  const getPaymentStatus = useCallback((f: VisaFileWithProfile) => {
    if (f.odeme_durumu === "odendi") return "odendi";
    if (f.cari_tipi === "firma_cari") return "firma_cari";
    return "odenmedi";
  }, []);

  const filteredFiles = useMemo(() => {
    let result = allFiles;
    if (filterStaff !== "all") {
      result = result.filter(f => getCariKey(f) === filterStaff);
    }
    if (filterStatus === "devam") {
      result = result.filter(f => !f.sonuc);
    } else if (filterStatus === "sonuclanan") {
      result = result.filter(f => f.sonuc !== null);
    }
    if (filterCountry !== "all") {
      result = result.filter(f => (f.hedef_ulke || "").toUpperCase() === filterCountry);
    }
    if (filterPayment !== "all") {
      result = result.filter(f => getPaymentStatus(f) === filterPayment);
    }
    if (searchTerm.trim()) {
      const q = normalize(searchTerm.trim());
      result = result.filter(f =>
        normalize(f.musteri_ad || "").includes(q) ||
        normalize(f.pasaport_no || "").includes(q) ||
        normalize(f.hedef_ulke || "").includes(q)
      );
    }
    if (dateFilterActive && dateStart && dateEnd) {
      const start = new Date(dateStart); start.setHours(0, 0, 0, 0);
      const end = new Date(dateEnd); end.setHours(23, 59, 59, 999);
      result = result.filter(f => {
        const d = new Date(f.created_at);
        return d >= start && d <= end;
      });
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allFiles, filterStaff, filterStatus, filterCountry, filterPayment, searchTerm, dateFilterActive, dateStart, dateEnd, getCariKey, getPaymentStatus]);

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-navy-500 text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const devamCount = allFiles.filter(f => !f.sonuc).length;
  const sonuclananCount = allFiles.filter(f => f.sonuc !== null).length;
  const statusCounts: Record<string, number> = {
    all: allFiles.length,
    devam: devamCount,
    sonuclanan: sonuclananCount,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">₺</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Muhasebe</h1>
              <p className="text-xs text-gray-500">Fox Turizm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/muhasebe/firmalar"}
              className="text-xs"
            >
              Firmalar
            </Button>
            <button
              onClick={loadData}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Yenile"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <span className="text-sm font-medium text-gray-700">SIRRI</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-5">
        {/* Durum Sekmeleri */}
        <div className="flex items-center gap-1 mb-5 bg-white rounded-xl p-1 border border-gray-200 w-fit">
          {STATUS_FILTERS.map((s) => {
            const isActive = filterStatus === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setFilterStatus(s.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                <span>{s.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                  isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {statusCounts[s.value] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Araç Çubuğu */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Personel Filtreleri */}
            <div className="flex items-center gap-1.5">
              {MUHASEBE_FILTERS.map((f) => {
                const isActive = filterStaff === f.value;
                const avatarKey = f.value !== "all" ? f.value : "";
                return (
                  <button
                    key={f.value}
                    onClick={() => setFilterStaff(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      isActive
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {avatarKey && USER_AVATARS[avatarKey] ? (
                      <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                        <Image src={USER_AVATARS[avatarKey]} alt={f.label} width={20} height={20} className="w-full h-full object-cover" />
                      </div>
                    ) : null}
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* Arama */}
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="İsim, pasaport, ülke..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
              />
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* Ülke Filtresi */}
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className={`px-3 py-2 border rounded-lg text-xs font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                filterCountry !== "all"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <option value="all">Tüm Ülkeler</option>
              {countryOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Ödeme Durumu Filtresi */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className={`px-3 py-2 border rounded-lg text-xs font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                filterPayment !== "all"
                  ? filterPayment === "odendi" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : filterPayment === "firma_cari" ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <option value="all">Tüm Ödemeler</option>
              <option value="odendi">Ödendi</option>
              <option value="odenmedi">Ödenmedi</option>
              <option value="firma_cari">Firma Cari</option>
            </select>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* Tarih Aralığı */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
              <span className="text-gray-300 text-sm">–</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
              <button
                onClick={() => setDateFilterActive(!dateFilterActive)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  dateFilterActive
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {dateFilterActive ? "Aktif" : "Filtrele"}
              </button>
              {dateFilterActive && (
                <button
                  onClick={() => { setDateFilterActive(false); setDateStart(toDateStr(monthAgo)); setDateEnd(toDateStr(today)); }}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="Temizle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dosya Sayısı */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{filteredFiles.length}</span> dosya listeleniyor
          </p>
        </div>

        {/* Dosya Tablosu */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            {filteredFiles.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">Dosya bulunamadı</p>
                <p className="text-sm text-gray-400 mt-1">Filtre ayarlarını değiştirmeyi deneyin</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Müşteri</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ülke</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ücret</th>
                    <th className="text-center py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ödeme</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Personel</th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th className="text-center py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredFiles.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="py-3.5 px-5">
                        <p className="font-medium text-gray-900">{f.musteri_ad}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{f.pasaport_no}</p>
                      </td>
                      <td className="py-3.5 px-5 text-gray-600">{f.hedef_ulke}</td>
                      <td className="py-3.5 px-5 text-right font-semibold text-gray-900">
                        {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {f.odeme_durumu === "odendi" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ödendi
                          </span>
                        ) : f.cari_tipi === "firma_cari" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Firma Cari
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Ödenmedi
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-gray-600">{f.profiles?.name || "—"}</span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-gray-500 text-xs">{formatDate(f.created_at)}</td>
                      <td className="py-3.5 px-5 text-center">
                        <button
                          onClick={() => { setDetailFileId(f.id); setShowDetailModal(true); }}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
                        >
                          Görüntüle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <MuhasebeFileDetailModal fileId={detailFileId} isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setDetailFileId(null); }} />
    </div>
  );
}
