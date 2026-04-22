"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Modal, Badge, CustomerAvatar, resolveAvatarStatus } from "@/components/ui";
import FileActions from "@/components/files/FileActions";

const VisaFileForm = dynamic(() => import("@/components/files/VisaFileForm"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  ),
});

const FileDetailModal = dynamic(() => import("@/components/files/FileDetailModal"), { ssr: false });
import { TARGET_COUNTRIES, ISLEM_TIPLERI } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, VisaFileWithProfile } from "@/lib/supabase/types";

function getStatusBadge(file: VisaFile) {
  const isChina = file.hedef_ulke === "Çin";
  if (file.sonuc === "vize_onay") return <Badge variant="success">Vize Onay</Badge>;
  if (file.sonuc === "red") return <Badge variant="error">Reddedildi</Badge>;
  if (file.islemden_cikti) return <Badge variant="purple">{isChina ? "Çıktı" : "İşlemden Çıktı"}</Badge>;
  if (file.basvuru_yapildi) return <Badge variant="info">İşlemde</Badge>;
  if (file.dosya_hazir) return <Badge variant="info">{isChina ? "Onay Geldi" : "Dosya Hazır"}</Badge>;
  if (file.evrak_eksik_mi) return <Badge variant="warning">Evrak Eksik</Badge>;
  if (file.evrak_durumu === "gelmedi") return <Badge variant="warning">Evrak Gelmedi</Badge>;
  return <Badge variant="default">Yeni</Badge>;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return symbols[currency] || currency;
}

function norm(s: string) {
  return s.toLowerCase()
    .replace(/İ/gi, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c");
}

export default function FilesPage() {
  const router = useRouter();
  const [allFiles, setAllFiles] = useState<VisaFileWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [, setCurrentUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterIslemTipi, setFilterIslemTipi] = useState("all");
  const [filterUlke, setFilterUlke] = useState("all");
  const [isManualCountry, setIsManualCountry] = useState(false);
  const [manualCountryFilter, setManualCountryFilter] = useState("");
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<VisaFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadFiles = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) setCurrentUserId(user.id);

    let query = supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .order("created_at", { ascending: false });

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        query = query.eq("assigned_user_id", user.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Dosyalar yüklenirken hata:", error);
      setAllFiles([]);
    } else if (data) {
      const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllFiles(sorted);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    router.prefetch("/app/files/new");
  }, [router]);

  const files = useMemo(() => {
    let result = allFiles;
    const searchQ = deferredSearchTerm.trim();
    if (searchQ) {
      const q = norm(searchQ);
      result = result.filter(f =>
        norm(f.musteri_ad || "").includes(q) ||
        norm(f.pasaport_no || "").includes(q) ||
        norm(f.hedef_ulke || "").includes(q)
      );
    }
    if (filterIslemTipi !== "all") {
      result = result.filter(f => f.islem_tipi === filterIslemTipi);
    }
    const ulkeFilter = isManualCountry ? manualCountryFilter : filterUlke;
    if (ulkeFilter && ulkeFilter !== "all") {
      result = result.filter(f => f.hedef_ulke === ulkeFilter);
    }
    return result.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }, [allFiles, deferredSearchTerm, filterIslemTipi, filterUlke, isManualCountry, manualCountryFilter]);

  // İstatistikler
  const stats = useMemo(() => {
    const total = allFiles.length;
    const active = allFiles.filter(f => !f.sonuc).length;
    const approved = allFiles.filter(f => f.sonuc === "vize_onay").length;
    const rejected = allFiles.filter(f => f.sonuc === "red").length;
    const missing = allFiles.filter(f => f.evrak_eksik_mi && !f.sonuc).length;
    const ready = allFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi && !f.sonuc).length;
    return { total, active, approved, rejected, missing, ready };
  }, [allFiles]);

  const handleFormSuccess = () => { setShowForm(false); setEditingFile(null); loadFiles(); };
  const handleEdit = (file: VisaFile) => { setEditingFile(file); setShowForm(true); };
  const handleDetail = (fileId: string) => { setDetailFileId(fileId); setShowDetailModal(true); };

  const handleDeleteClick = (file: VisaFile) => { setFileToDelete(file); setShowDeleteModal(true); };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch("/api/delete-visa-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: fileToDelete.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Dosya silinemedi.");
      }

      setShowDeleteModal(false);
      setFileToDelete(null);
      loadFiles();
    } catch (err) {
      console.error("Silme hatası:", err);
      alert("Dosya silinirken hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterIslemTipi("all");
    setFilterUlke("all");
    setManualCountryFilter("");
    setIsManualCountry(false);
  };

  const hasActiveFilters = !!(searchTerm || filterIslemTipi !== "all" || filterUlke !== "all" || manualCountryFilter);

  const islemTipiOptions = [{ value: "all", label: "Tümü" }, ...ISLEM_TIPLERI];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Dekoratif arka plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary-300/30 via-primary-200/20 to-transparent blur-3xl" />
        <div className="absolute top-96 -left-28 h-96 w-96 rounded-full bg-gradient-to-tr from-navy-200/40 via-blue-100/30 to-transparent blur-3xl" />
      </div>

      <div className="relative space-y-6">
        {/* Hero Başlık */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-6 sm:p-7 shadow-xl shadow-navy-900/20">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-primary-500 blur-3xl" />
            <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-primary-400 blur-3xl" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.15),transparent_50%)]" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl blur-lg opacity-60" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center shadow-lg ring-1 ring-white/20">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Vize Dosyaları</h1>
                <p className="text-sm text-navy-200 mt-1 max-w-xl">
                  Dosyaları oluşturun, düzenleyin; evrak, ödeme ve randevu süreçlerini anlık takip edin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadFiles}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur border border-white/10 text-white text-sm font-semibold transition-all"
                title="Listeyi yenile"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">Yenile</span>
              </button>
              <button
                onClick={() => router.push("/app/files/new")}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-lg shadow-primary-500/40 hover:shadow-xl hover:shadow-primary-500/50 transition-all active:scale-[0.98] overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Yeni Dosya
              </button>
            </div>
          </div>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Toplam" value={stats.total} icon="folder" tone="navy" />
          <StatCard label="Aktif" value={stats.active} icon="clock" tone="blue" />
          <StatCard label="Dosya Hazır" value={stats.ready} icon="check-circle" tone="indigo" />
          <StatCard label="Evrak Eksik" value={stats.missing} icon="alert" tone="amber" />
          <StatCard label="Onaylandı" value={stats.approved} icon="check" tone="emerald" />
          <StatCard label="Reddedildi" value={stats.rejected} icon="x" tone="rose" />
        </div>

        {/* Arama + Filtre Toggle */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Arama */}
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Müşteri adı, pasaport veya ülke ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-navy-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 placeholder:text-navy-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-navy-100 flex items-center justify-center text-navy-400 hover:text-navy-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  showFilters || hasActiveFilters
                    ? "bg-primary-50 text-primary-700 border-primary-200"
                    : "bg-white text-navy-700 border-navy-200 hover:border-navy-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filtreler
                {hasActiveFilters && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold">
                    {[searchTerm, filterIslemTipi !== "all", filterUlke !== "all" || manualCountryFilter].filter(Boolean).length}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Temizle
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-navy-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Select label="İşlem Tipi" options={islemTipiOptions} value={filterIslemTipi} onChange={(e) => setFilterIslemTipi(e.target.value)} />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-navy-700">Hedef Ülke</label>
                  <button type="button" onClick={() => setIsManualCountry(!isManualCountry)} className="text-xs text-primary-600 hover:text-primary-700 font-semibold">{isManualCountry ? "Listeden seç" : "Manuel giriş"}</button>
                </div>
                {isManualCountry ? <Input placeholder="Ülke adı..." value={manualCountryFilter} onChange={(e) => setManualCountryFilter(e.target.value)} /> : <Select options={TARGET_COUNTRIES} value={filterUlke} onChange={(e) => setFilterUlke(e.target.value)} />}
              </div>
            </div>
          )}
        </div>

        {/* Aktif / Sonuçlanan Toggle + Durum Chipleri */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex gap-1 bg-white/70 backdrop-blur border border-white/60 rounded-2xl p-1 w-fit shadow-sm">
            <button
              onClick={() => setStepFilter("all")}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                stepFilter !== "sonuclanan"
                  ? "bg-gradient-to-br from-navy-800 to-navy-900 text-white shadow-md shadow-navy-900/30"
                  : "text-navy-500 hover:text-navy-700 hover:bg-white/60"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Aktif Dosyalar
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stepFilter !== "sonuclanan" ? "bg-white/20 text-white" : "bg-navy-100 text-navy-500"}`}>
                {files.filter(f => !f.sonuc).length}
              </span>
            </button>
            <button
              onClick={() => setStepFilter("sonuclanan")}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                stepFilter === "sonuclanan"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30"
                  : "text-navy-500 hover:text-navy-700 hover:bg-white/60"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sonuçlanan
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stepFilter === "sonuclanan" ? "bg-white/20 text-white" : "bg-navy-100 text-navy-500"}`}>
                {files.filter(f => !!f.sonuc).length}
              </span>
            </button>
          </div>

          {/* Durum Chipleri - Aktif görünümde */}
          {stepFilter !== "sonuclanan" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "all", label: "Hepsi", tone: "slate" as const },
                { key: "yeni", label: "Yeni", tone: "blue" as const },
                { key: "evrak_eksik", label: "Evrak Eksik", tone: "amber" as const },
                { key: "dosya_hazir", label: "Dosya Hazır", tone: "indigo" as const },
                { key: "islemde", label: "İşleme Girdi", tone: "violet" as const },
              ].map((step) => {
                const activeFiles = files.filter(f => !f.sonuc);
                const count = step.key === "all" ? activeFiles.length
                  : step.key === "yeni" ? activeFiles.filter(f => !f.dosya_hazir && !f.basvuru_yapildi && !f.islemden_cikti && !f.evrak_eksik_mi).length
                  : step.key === "evrak_eksik" ? activeFiles.filter(f => f.evrak_eksik_mi && !f.dosya_hazir).length
                  : step.key === "dosya_hazir" ? activeFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi).length
                  : activeFiles.filter(f => f.basvuru_yapildi && !f.islemden_cikti).length;
                const isActive = stepFilter === step.key;
                const toneClasses: Record<string, { active: string; idle: string; badge: string }> = {
                  slate:  { active: "bg-navy-800 text-white border-navy-800 shadow-md shadow-navy-900/20", idle: "bg-white text-navy-700 border-navy-200 hover:border-navy-400", badge: isActive ? "bg-white/20" : "bg-navy-100 text-navy-500" },
                  blue:   { active: "bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/30", idle: "bg-white text-navy-700 border-navy-200 hover:border-blue-300", badge: isActive ? "bg-white/20" : "bg-blue-100 text-blue-700" },
                  amber:  { active: "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30", idle: "bg-white text-navy-700 border-navy-200 hover:border-amber-300", badge: isActive ? "bg-white/20" : "bg-amber-100 text-amber-700" },
                  indigo: { active: "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/30", idle: "bg-white text-navy-700 border-navy-200 hover:border-indigo-300", badge: isActive ? "bg-white/20" : "bg-indigo-100 text-indigo-700" },
                  violet: { active: "bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/30", idle: "bg-white text-navy-700 border-navy-200 hover:border-violet-300", badge: isActive ? "bg-white/20" : "bg-violet-100 text-violet-700" },
                };
                const tone = toneClasses[step.tone];
                return (
                  <button
                    key={step.key}
                    onClick={() => setStepFilter(step.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                      isActive ? tone.active : tone.idle
                    }`}
                  >
                    {step.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tone.badge}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dosya Listesi */}
        <div className="relative rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl shadow-navy-900/5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-amber-400" />

          <div className="px-6 py-4 border-b border-navy-100 bg-gradient-to-r from-navy-50/80 to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <h3 className="text-navy-800 font-bold text-sm">Dosya Listesi</h3>
              <span className="ml-1 inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-navy-100 text-navy-700 text-xs font-bold">{files.length}</span>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-primary-100 rounded-full" />
                  <div className="absolute inset-0 w-14 h-14 border-4 border-transparent border-t-primary-500 rounded-full animate-spin" />
                </div>
              </div>
            ) : (() => {
              const activeFiles = files.filter(f => !f.sonuc);
              const displayFiles = (
                stepFilter === "sonuclanan" ? files.filter(f => !!f.sonuc)
                  : stepFilter === "all" ? activeFiles
                  : stepFilter === "yeni" ? activeFiles.filter(f => !f.dosya_hazir && !f.basvuru_yapildi && !f.islemden_cikti && !f.evrak_eksik_mi)
                  : stepFilter === "evrak_eksik" ? activeFiles.filter(f => f.evrak_eksik_mi && !f.dosya_hazir)
                  : stepFilter === "dosya_hazir" ? activeFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi)
                  : activeFiles.filter(f => f.basvuru_yapildi && !f.islemden_cikti)
              ).sort(
                (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
              );
              return displayFiles.length === 0 ? (
                <div className="text-center py-20">
                  <div className="relative w-28 h-28 mx-auto mb-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-amber-100 rounded-3xl rotate-6" />
                    <div className="absolute inset-0 bg-white rounded-3xl flex items-center justify-center border border-navy-100 shadow-sm">
                      <svg className="w-12 h-12 text-navy-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-navy-800 mb-1.5">Dosya Bulunamadı</h3>
                  <p className="text-sm text-navy-500 mb-5 max-w-sm mx-auto">
                    {hasActiveFilters ? "Filtrelere uygun dosya yok. Filtreleri temizleyip tekrar deneyin." : "Henüz dosya oluşturmadınız. Yeni dosya oluşturarak başlayın."}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="px-4 py-2 rounded-xl bg-white border border-navy-200 text-sm font-semibold text-navy-700 hover:bg-navy-50">
                        Filtreleri Temizle
                      </button>
                    )}
                    <button
                      onClick={() => router.push("/app/files/new")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-bold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Yeni Dosya Oluştur
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop Tablo */}
                  <div className="hidden md:block overflow-x-auto -mx-2">
                    <table className="w-full border-separate border-spacing-y-1.5">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-4 text-[11px] font-bold text-navy-500 uppercase tracking-wider">Müşteri</th>
                          <th className="text-left py-2 px-4 text-[11px] font-bold text-navy-500 uppercase tracking-wider">Ülke</th>
                          <th className="text-left py-2 px-4 text-[11px] font-bold text-navy-500 uppercase tracking-wider">Ücret</th>
                          <th className="text-left py-2 px-4 text-[11px] font-bold text-navy-500 uppercase tracking-wider">Randevu</th>
                          <th className="text-left py-2 px-4 text-[11px] font-bold text-navy-500 uppercase tracking-wider">Durum</th>
                          <th className="text-right py-2 px-4 text-[11px] font-bold text-navy-500 uppercase tracking-wider">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayFiles.map((file) => (
                          <tr
                            key={file.id}
                            className="group bg-white hover:bg-gradient-to-r hover:from-primary-50/40 hover:to-white transition-colors border-y border-navy-100 hover:border-primary-200"
                          >
                            <td className="py-3 px-4 rounded-l-xl border-l border-navy-100 group-hover:border-primary-200">
                              <div className="flex items-center gap-3">
                                <CustomerAvatar name={file.musteri_ad} size="md" status={resolveAvatarStatus(file)} />
                                <div className="min-w-0">
                                  <p className="font-bold text-navy-800 truncate">{file.musteri_ad}</p>
                                  <p className="text-[11px] text-navy-400 font-mono mt-0.5">{file.pasaport_no}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={file.islem_tipi === "randevulu" ? "info" : "default"}>{file.hedef_ulke}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-bold text-navy-800 text-sm">{((file.ucret || 0) + (file.davetiye_ucreti || 0)).toLocaleString('tr-TR')} {getCurrencySymbol(file.ucret_currency)}</span>
                                {(file.davetiye_ucreti || 0) > 0 && (
                                  <span className="text-[11px] text-navy-400">{file.ucret?.toLocaleString('tr-TR')} + {file.davetiye_ucreti?.toLocaleString('tr-TR')} dav.</span>
                                )}
                                <div className="flex gap-1.5 flex-wrap">
                                  <Badge variant={file.cari_tipi === "firma_cari" ? "purple" : file.odeme_plani === "pesin" ? "success" : "warning"} size="sm">
                                    {file.cari_tipi === "firma_cari" ? "Firma Cari" : file.odeme_plani === "pesin" ? "Peşin" : "Cari"}
                                  </Badge>
                                  {file.cari_tipi !== "firma_cari" && (
                                    <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm">
                                      {file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-navy-600 whitespace-nowrap">{formatDateTime(file.randevu_tarihi)}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(file)}
                                {file.evrak_eksik_mi && <Badge variant="error" size="sm">Eksik Var</Badge>}
                              </div>
                            </td>
                            <td className="py-3 px-4 rounded-r-xl border-r border-navy-100 group-hover:border-primary-200">
                              <div className="flex flex-col gap-2 items-end">
                                <div className="inline-flex items-center gap-0.5 p-0.5 bg-navy-50 group-hover:bg-white rounded-lg border border-navy-100">
                                  <button
                                    onClick={() => handleDetail(file.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-navy-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                    title="Görüntüle"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Detay
                                  </button>
                                  <button
                                    onClick={() => handleEdit(file)}
                                    className="p-1.5 rounded-md text-navy-600 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                    title="Düzenle"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(file)}
                                    className="p-1.5 rounded-md text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                                    title="Sil"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                                <FileActions file={file} onUpdate={loadFiles} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobil Kartlar */}
                  <div className="md:hidden space-y-3">
                    {displayFiles.map((file) => (
                      <div key={file.id} className="relative rounded-2xl bg-white border border-navy-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-amber-500" />
                        <div className="p-4 pl-5">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <CustomerAvatar name={file.musteri_ad} size="lg" status={resolveAvatarStatus(file)} />
                              <div className="min-w-0">
                                <p className="font-bold text-navy-800 truncate">{file.musteri_ad}</p>
                                <p className="text-xs text-navy-400 font-mono">{file.pasaport_no}</p>
                              </div>
                            </div>
                            {getStatusBadge(file)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-navy-50 rounded-lg p-2">
                              <span className="text-navy-500 text-[10px] uppercase tracking-wider font-semibold">Ülke</span>
                              <p className="font-semibold text-navy-800 text-sm mt-0.5">{file.hedef_ulke}</p>
                            </div>
                            <div className="bg-navy-50 rounded-lg p-2">
                              <span className="text-navy-500 text-[10px] uppercase tracking-wider font-semibold">Ücret</span>
                              <p className="font-bold text-navy-800 text-sm mt-0.5">{((file.ucret || 0) + (file.davetiye_ucreti || 0)).toLocaleString('tr-TR')} {getCurrencySymbol(file.ucret_currency)}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mb-3 flex-wrap">
                            <Badge variant={file.cari_tipi === "firma_cari" ? "purple" : file.odeme_plani === "pesin" ? "success" : "warning"} size="sm">
                              {file.cari_tipi === "firma_cari" ? "Firma Cari" : file.odeme_plani === "pesin" ? "Peşin" : "Cari"}
                            </Badge>
                            {file.cari_tipi !== "firma_cari" && (
                              <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm">
                                {file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi"}
                              </Badge>
                            )}
                            {file.evrak_eksik_mi && <Badge variant="error" size="sm">Eksik</Badge>}
                          </div>
                          <div className="flex gap-2 pt-3 border-t border-navy-100">
                            <button onClick={() => handleDetail(file.id)} className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">Görüntüle</button>
                            <button onClick={() => handleEdit(file)} className="flex-1 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors">Düzenle</button>
                            <button onClick={() => handleDeleteClick(file)} className="py-2 px-3 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="mt-2">
                            <FileActions file={file} onUpdate={loadFiles} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingFile(null); }} title={editingFile ? "Dosyayı Düzenle" : "Yeni Vize Dosyası"} size="xl">
          <VisaFileForm file={editingFile} onSuccess={handleFormSuccess} onCancel={() => { setShowForm(false); setEditingFile(null); }} />
        </Modal>

        <FileDetailModal
          fileId={detailFileId}
          isOpen={showDetailModal}
          onClose={() => { setShowDetailModal(false); setDetailFileId(null); }}
          scrollToHistoryOnOpen
          title="Dosya ve işlem geçmişi"
        />

        {/* Silme Onay Modal */}
        <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setFileToDelete(null); }} title="Dosyayı Sil" size="sm">
          {fileToDelete && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/30">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="font-bold text-rose-900 text-lg mb-2">Emin misiniz?</h3>
                <p className="text-sm text-rose-700">
                  <strong>{fileToDelete.musteri_ad}</strong> dosyası ve ilgili tüm veriler (ödemeler, loglar, bildirimler) kalıcı olarak silinecek.
                </p>
                <p className="text-xs text-rose-600 mt-3 bg-rose-100 rounded-lg py-2 font-semibold">Bu işlem geri alınamaz</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }} className="flex-1">İptal</Button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-lg shadow-rose-500/30 hover:shadow-rose-500/40 transition-all disabled:opacity-60"
                >
                  {deleting ? "Siliniyor..." : "Evet, Sil"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: "folder" | "clock" | "check-circle" | "alert" | "check" | "x"; tone: "navy" | "blue" | "indigo" | "amber" | "emerald" | "rose" }) {
  const tones: Record<string, { bg: string; text: string; iconBg: string; ring: string }> = {
    navy:    { bg: "from-navy-50 to-white",       text: "text-navy-900",    iconBg: "from-navy-600 to-navy-800",           ring: "ring-navy-100" },
    blue:    { bg: "from-blue-50 to-white",       text: "text-blue-700",    iconBg: "from-blue-500 to-indigo-600",         ring: "ring-blue-100" },
    indigo:  { bg: "from-indigo-50 to-white",     text: "text-indigo-700",  iconBg: "from-indigo-500 to-purple-600",       ring: "ring-indigo-100" },
    amber:   { bg: "from-amber-50 to-white",      text: "text-amber-700",   iconBg: "from-amber-500 to-orange-600",        ring: "ring-amber-100" },
    emerald: { bg: "from-emerald-50 to-white",    text: "text-emerald-700", iconBg: "from-emerald-500 to-teal-600",        ring: "ring-emerald-100" },
    rose:    { bg: "from-rose-50 to-white",       text: "text-rose-700",    iconBg: "from-rose-500 to-red-600",            ring: "ring-rose-100" },
  };
  const t = tones[tone];
  const icons: Record<string, JSX.Element> = {
    folder:        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
    clock:         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    "check-circle":<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    alert:         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
    check:         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
    x:             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
  };
  return (
    <div className={`relative rounded-2xl bg-gradient-to-br ${t.bg} border border-white/70 shadow-sm hover:shadow-md transition-all p-3.5 overflow-hidden group`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wider truncate">{label}</p>
          <p className={`text-2xl font-black mt-1 ${t.text}`}>{value.toLocaleString("tr-TR")}</p>
        </div>
        <div className={`shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${t.iconBg} flex items-center justify-center shadow-md ring-2 ${t.ring}`}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[icon]}
          </svg>
        </div>
      </div>
    </div>
  );
}
