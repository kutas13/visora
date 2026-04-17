"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Checkbox, Modal, Badge, CustomerAvatar, resolveAvatarStatus } from "@/components/ui";
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
import { TARGET_COUNTRIES, ISLEM_TIPLERI, PARA_BIRIMLERI } from "@/lib/constants";
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterIslemTipi, setFilterIslemTipi] = useState("all");
  const [filterUlke, setFilterUlke] = useState("all");
  const [isManualCountry, setIsManualCountry] = useState(false);
  const [manualCountryFilter, setManualCountryFilter] = useState("");
  const [stepFilter, setStepFilter] = useState<string>("all");

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

  const islemTipiOptions = [{ value: "all", label: "Tümü" }, ...ISLEM_TIPLERI];

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Vize Dosyaları</h1>
            <p className="text-slate-500 text-sm">Yeni dosya oluşturun, mevcut dosyaları düzenleyin, evrak/ödeme/randevu durumlarını takip edin ve işlemden çıkarın</p>
          </div>
        </div>
        <Button onClick={() => router.push("/app/files/new")} className="shadow-lg hover:shadow-xl transition-shadow">
          <span className="mr-2">+</span> Yeni Dosya
        </Button>
      </div>

      {/* Filtre Kartı */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-700 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtreler
            </h3>
            <button onClick={() => { setSearchTerm(""); setFilterIslemTipi("all"); setFilterUlke("all"); }} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              Temizle
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input label="Arama" placeholder="İsim veya pasaport no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Select label="İşlem Tipi" options={islemTipiOptions} value={filterIslemTipi} onChange={(e) => setFilterIslemTipi(e.target.value)} />
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Hedef Ülke</label>
                <button type="button" onClick={() => setIsManualCountry(!isManualCountry)} className="text-xs text-primary-600 hover:text-primary-700">{isManualCountry ? "Listeden seç" : "Manuel giriş"}</button>
              </div>
              {isManualCountry ? <Input placeholder="Ülke adı..." value={manualCountryFilter} onChange={(e) => setManualCountryFilter(e.target.value)} /> : <Select options={TARGET_COUNTRIES} value={filterUlke} onChange={(e) => setFilterUlke(e.target.value)} />}
            </div>
            <div className="flex flex-col justify-end gap-3">
              <Button onClick={loadFiles} className="w-full">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Filtrele
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Aktif / Sonuçlanan Toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setStepFilter("all")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            stepFilter !== "sonuclanan"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Aktif Dosyalar
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stepFilter !== "sonuclanan" ? "bg-slate-100 text-slate-600" : "bg-slate-200/60 text-slate-400"}`}>
            {files.filter(f => !f.sonuc).length}
          </span>
        </button>
        <button
          onClick={() => setStepFilter("sonuclanan")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            stepFilter === "sonuclanan"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Sonuçlanan
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stepFilter === "sonuclanan" ? "bg-white/20" : "bg-slate-200/60 text-slate-400"}`}>
            {files.filter(f => !!f.sonuc).length}
          </span>
        </button>
      </div>

      {/* Alt Adım Filtreleri - Sadece Aktif görünümde */}
      {stepFilter !== "sonuclanan" && (
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all", label: "Hepsi", color: "slate" },
          { key: "yeni", label: "Yeni", color: "slate" },
          { key: "evrak_eksik", label: "Evrak Eksik", color: "orange" },
          { key: "dosya_hazir", label: "Dosya Hazır", color: "blue" },
          { key: "islemde", label: "İşleme Girdi", color: "indigo" },
        ].map((step) => {
          const activeFiles = files.filter(f => !f.sonuc);
          const count = step.key === "all" ? activeFiles.length
            : step.key === "yeni" ? activeFiles.filter(f => !f.dosya_hazir && !f.basvuru_yapildi && !f.islemden_cikti && !f.evrak_eksik_mi).length
            : step.key === "evrak_eksik" ? activeFiles.filter(f => f.evrak_eksik_mi && !f.dosya_hazir).length
            : step.key === "dosya_hazir" ? activeFiles.filter(f => f.dosya_hazir && !f.basvuru_yapildi).length
            : activeFiles.filter(f => f.basvuru_yapildi && !f.islemden_cikti).length;
          return (
            <button
              key={step.key}
              onClick={() => setStepFilter(step.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                stepFilter === step.key
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-400"
              }`}
            >
              {step.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stepFilter === step.key ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{count}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* Dosya Listesi */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-700 font-semibold flex items-center gap-2">
              Dosyalar
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-sm">{files.length}</span>
            </h3>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
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
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Dosya Bulunamadı</h3>
              <p className="text-slate-500 mb-4">Aramanıza uygun dosya yok veya henüz dosya oluşturmadınız.</p>
              <Button onClick={() => setShowForm(true)}>İlk Dosyayı Oluştur</Button>
            </div>
          ) : (
            <>
              {/* Desktop Tablo */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ülke</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ücret</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Randevu</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayFiles.map((file, index) => (
                      <tr 
                        key={file.id} 
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <CustomerAvatar name={file.musteri_ad} size="md" status={resolveAvatarStatus(file)} />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{file.musteri_ad}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{file.pasaport_no}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant={file.islem_tipi === "randevulu" ? "info" : "default"}>{file.hedef_ulke}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-slate-800 text-sm">{((file.ucret || 0) + (file.davetiye_ucreti || 0)).toLocaleString('tr-TR')} {getCurrencySymbol(file.ucret_currency)}</span>
                            {(file.davetiye_ucreti || 0) > 0 && (
                              <span className="text-xs text-slate-400">{file.ucret?.toLocaleString('tr-TR')} + {file.davetiye_ucreti?.toLocaleString('tr-TR')} dav.</span>
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
                        <td className="py-4 px-4 text-sm text-slate-600">{formatDateTime(file.randevu_tarihi)}</td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(file)}
                            {file.evrak_eksik_mi && <Badge variant="error" size="sm">Eksik Var</Badge>}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-1 flex-wrap items-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDetail(file.id)}
                                className="text-[11px] h-8 px-2.5 shrink-0 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300"
                              >
                                Görüntüle
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(file)} className="hover:bg-blue-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(file)}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </Button>
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
              <div className="md:hidden space-y-4">
                {displayFiles.map((file) => (
                  <Card key={file.id} className="p-4 hover:shadow-lg transition-shadow border-l-4 border-l-primary-500">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={file.musteri_ad} size="lg" status={resolveAvatarStatus(file)} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{file.musteri_ad}</p>
                          <p className="text-sm text-slate-400 font-mono">{file.pasaport_no}</p>
                        </div>
                      </div>
                      {getStatusBadge(file)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <span className="text-slate-500 text-xs">Ülke</span>
                        <p className="font-medium">{file.hedef_ulke}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <span className="text-slate-500 text-xs">Ücret</span>
                        <p className="font-bold">{((file.ucret || 0) + (file.davetiye_ucreti || 0)).toLocaleString('tr-TR')} {getCurrencySymbol(file.ucret_currency)}</p>
                        {(file.davetiye_ucreti || 0) > 0 && (
                          <p className="text-xs text-slate-400">{file.ucret?.toLocaleString('tr-TR')} + {file.davetiye_ucreti?.toLocaleString('tr-TR')} dav.</p>
                        )}
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
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <Button size="sm" variant="outline" onClick={() => handleDetail(file.id)} className="flex-1 text-xs">Görüntüle</Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(file)} className="flex-1">Düzenle</Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteClick(file)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                    <FileActions file={file} onUpdate={loadFiles} />
                  </Card>
                ))}
              </div>
            </>
          );
          })()}
        </div>
      </Card>

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
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-red-900 text-lg mb-2">Emin misiniz?</h3>
              <p className="text-sm text-red-700">
                <strong>{fileToDelete.musteri_ad}</strong> dosyası ve ilgili tüm veriler (ödemeler, loglar, bildirimler) kalıcı olarak silinecek.
              </p>
              <p className="text-xs text-red-500 mt-3 bg-red-100 rounded-lg py-2">⚠️ Bu işlem geri alınamaz!</p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }} className="flex-1">İptal</Button>
              <Button variant="ghost" className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
