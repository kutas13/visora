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
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(f =>
        f.musteri_ad?.toLowerCase().includes(q) ||
        f.pasaport_no?.toLowerCase().includes(q) ||
        f.hedef_ulke?.toLowerCase().includes(q)
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
  }, [allFiles, filterStaff, filterStatus, searchTerm, dateFilterActive, dateStart, dateEnd, getCariKey]);

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

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Header - Admin panel stili */}
      <header className="bg-white border-b border-navy-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">₺</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy-900">Muhasebe Paneli</h1>
              <p className="text-sm text-navy-500">Fox Turizm - Dosya Görüntüleme</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/muhasebe/firmalar"}
              className="border-navy-200 text-navy-600 hover:bg-navy-50"
            >
              Firmalar
            </Button>
            <button
              onClick={loadData}
              className="p-2 rounded-lg text-navy-500 hover:bg-navy-100 hover:text-navy-700 transition-colors"
              title="Yenile"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div className="text-right border-l border-navy-200 pl-4">
              <p className="text-sm font-medium text-navy-800">SIRRI</p>
              <p className="text-xs text-navy-500">muhasebe@foxturizm.com</p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="border-navy-200 text-navy-600 hover:bg-navy-50">
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sol Panel - Durum Filtreleri */}
        <aside className="w-64 flex-shrink-0 border-r border-navy-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-3">Durum</h3>
          <div className="space-y-1 mb-6">
            {STATUS_FILTERS.map((s) => {
              const isActive = filterStatus === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setFilterStatus(s.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    isActive ? "bg-primary-100 text-primary-700 border border-primary-200" : "text-navy-600 hover:bg-navy-50 border border-transparent"
                  }`}
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center bg-white/80 text-base">{s.icon}</span>
                  <span>{s.label}</span>
                  {isActive && (
                    <svg className="w-4 h-4 ml-auto text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <h3 className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-3">Tarih Aralığı</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-navy-500 mb-1">Başlangıç</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full px-2.5 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-navy-500 mb-1">Bitiş</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full px-2.5 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDateFilterActive(!dateFilterActive)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  dateFilterActive ? "bg-primary-600 text-white" : "bg-navy-100 text-navy-600 hover:bg-navy-200"
                }`}
              >
                {dateFilterActive ? "Aktif" : "Uygula"}
              </button>
              {dateFilterActive && (
                <button
                  onClick={() => { setDateFilterActive(false); setDateStart(toDateStr(monthAgo)); setDateEnd(toDateStr(today)); }}
                  className="px-2 py-2 text-navy-500 hover:text-navy-700"
                  title="Temizle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Ana İçerik */}
        <div className="flex-1 p-4 md:p-6 max-w-5xl">
        {/* Filtreler */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Dosyalar:</span>
              {MUHASEBE_FILTERS.map((f) => {
                const isActive = filterStaff === f.value;
                const avatarKey = f.value !== "all" ? f.value : "";
                return (
                  <button
                    key={f.value}
                    onClick={() => setFilterStaff(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isActive ? "bg-navy-900 text-white border-navy-900 shadow-md" : "bg-white text-navy-600 border-navy-200 hover:border-navy-400"
                    }`}
                  >
                    {avatarKey && USER_AVATARS[avatarKey] ? (
                      <div className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ${isActive ? "ring-1 ring-white" : "ring-1 ring-navy-200"}`}>
                        <Image src={USER_AVATARS[avatarKey]} alt={f.label} width={20} height={20} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-w-0 sm:max-w-xs">
              <Input
                placeholder="İsim, pasaport veya ülke ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <p className="text-xs text-navy-400 font-medium">
            {filteredFiles.length} dosya
          </p>
        </div>

        {/* Dosya Tablosu */}
        <Card className="overflow-hidden shadow-lg border border-navy-200">
          <div className="bg-gradient-to-r from-navy-700 to-navy-800 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Dosyalar
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{filteredFiles.length}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            {filteredFiles.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-navy-500 font-medium">Dosya bulunamadı</p>
                <p className="text-sm text-navy-400 mt-1">{searchTerm || filterStaff !== "all" || dateFilterActive ? "Filtreleri değiştirmeyi deneyin" : "Henüz dosya yok"}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-200 bg-navy-50/50">
                    <th className="text-left py-3 px-4 text-navy-600 font-medium">Müşteri</th>
                    <th className="text-left py-3 px-4 text-navy-600 font-medium">Ülke</th>
                    <th className="text-right py-3 px-4 text-navy-600 font-medium">Ücret</th>
                    <th className="text-center py-3 px-4 text-navy-600 font-medium">Ödeme Durumu</th>
                    <th className="text-left py-3 px-4 text-navy-600 font-medium">Dosyayı Yapan</th>
                    <th className="text-right py-3 px-4 text-navy-600 font-medium">Tarih</th>
                    <th className="text-center py-3 px-4 text-navy-600 font-medium">Özgeçmiş</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((f) => (
                    <tr key={f.id} className="border-b border-navy-100 hover:bg-navy-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-navy-900">{f.musteri_ad}</p>
                        <p className="text-xs text-navy-400">{f.pasaport_no}</p>
                      </td>
                      <td className="py-3 px-4 text-navy-600">{f.hedef_ulke}</td>
                      <td className="py-3 px-4 text-right font-semibold text-navy-900">
                        {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {f.odeme_durumu === "odendi" ? (
                          <Badge variant="success" size="sm">Ödendi</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Ödenmedi</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-navy-600">{f.profiles?.name || "-"}</td>
                      <td className="py-3 px-4 text-right text-navy-500">{formatDate(f.created_at)}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => { setDetailFileId(f.id); setShowDetailModal(true); }}
                          className="px-2 py-1.5 text-xs font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-lg transition-colors"
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
        </Card>
        </div>
      </div>

      <MuhasebeFileDetailModal fileId={detailFileId} isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setDetailFileId(null); }} />
    </div>
  );
}
