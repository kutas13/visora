"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";

function norm(s: string) {
  return s.toLowerCase()
    .replace(/İ/gi, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c");
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface UploadedImage {
  id: string;
  user_id: string;
  gorsel_url: string;
  gorsel_adi: string;
  sira_no: number;
  created_at: string;
}

type GalleryItem =
  | { kind: "visa"; file: VisaFile }
  | { kind: "upload"; upload: UploadedImage };

export default function VizeGorselleriPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [tab, setTab] = useState<"visa" | "uploads">("visa");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("sonuc", "vize_onay")
      .not("vize_gorseli", "is", null)
      .order("sonuc_tarihi", { ascending: false });

    setFiles(data || []);
  }, []);

  const loadUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/vize-gorselleri");
      if (res.ok) {
        const json = await res.json();
        setUploads(json.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadFiles(), loadUploads()]).finally(() => setLoading(false));
  }, [loadFiles, loadUploads]);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (filterCountry !== "all") result = result.filter(f => f.hedef_ulke === filterCountry);
    if (search.trim().length >= 2) {
      const term = norm(search.trim());
      result = result.filter(f => norm(f.musteri_ad).includes(term) || norm(f.pasaport_no).includes(term));
      result.sort((a, b) => {
        const aStart = norm(a.musteri_ad).startsWith(term) ? 0 : 1;
        const bStart = norm(b.musteri_ad).startsWith(term) ? 0 : 1;
        return aStart - bStart;
      });
    }
    return result;
  }, [files, search, filterCountry]);

  const filteredUploads = useMemo(() => {
    if (search.trim().length < 2) return uploads;
    const term = norm(search.trim());
    return uploads.filter(u => norm(u.gorsel_adi).includes(term));
  }, [uploads, search]);

  const countries = useMemo(() => {
    const set = new Set(files.map(f => f.hedef_ulke));
    return Array.from(set).sort();
  }, [files]);

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "jpg";
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${name.replace(/\s+/g, "_")}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    const filesArr = Array.from(selected);
    const previews = filesArr.map(f => URL.createObjectURL(f));
    setPendingFiles(prev => [...prev, ...filesArr]);
    setPendingPreviews(prev => [...prev, ...previews]);
    setShowUploadModal(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelUpload = () => {
    pendingPreviews.forEach(url => URL.revokeObjectURL(url));
    setPendingFiles([]);
    setPendingPreviews([]);
    setShowUploadModal(false);
  };

  const removePendingFile = (idx: number) => {
    URL.revokeObjectURL(pendingPreviews[idx]);
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    setPendingPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const confirmUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("action", "upload");
      pendingFiles.forEach(f => formData.append("files", f));

      const res = await fetch("/api/vize-gorselleri", { method: "POST", body: formData });
      if (res.ok) {
        await loadUploads();
        setTab("uploads");
      }
    } catch {}
    pendingPreviews.forEach(url => URL.revokeObjectURL(url));
    setPendingFiles([]);
    setPendingPreviews([]);
    setShowUploadModal(false);
    setUploading(false);
  };

  const handleRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const formData = new FormData();
    formData.append("action", "rename");
    formData.append("id", id);
    formData.append("name", newName.trim());

    try {
      const res = await fetch("/api/vize-gorselleri", { method: "POST", body: formData });
      if (res.ok) {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, gorsel_adi: newName.trim() } : u));
      }
    } catch {}
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu görseli silmek istediğinize emin misiniz?")) return;
    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("id", id);

    try {
      const res = await fetch("/api/vize-gorselleri", { method: "POST", body: formData });
      if (res.ok) {
        setUploads(prev => prev.filter(u => u.id !== id));
        if (lightbox?.kind === "upload" && lightbox.upload.id === id) setLightbox(null);
      }
    } catch {}
  };

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 animate-pulse">Görseller yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Başlık + Upload */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Vize Görselleri</h1>
            <p className="text-slate-500 text-sm">Görselleri görüntüleyin, yükleyin ve indirin</p>
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Görsel Yükle
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Seçimi */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("visa")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "visa" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Vize Dosyaları
          {files.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">{files.length}</span>}
        </button>
        <button
          onClick={() => setTab("uploads")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "uploads" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Yüklenen Görseller
          {uploads.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600">{uploads.length}</span>}
        </button>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={tab === "visa" ? "Müşteri adı veya pasaport no..." : "Görsel adı ara..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>
        {tab === "visa" && (
          <select
            value={filterCountry}
            onChange={e => setFilterCountry(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-w-[160px]"
          >
            <option value="all">Tüm Ülkeler</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="text-xs text-slate-400">
          {tab === "visa" ? `${filteredFiles.length} / ${files.length}` : `${filteredUploads.length} / ${uploads.length}`} görsel
        </div>
      </div>

      {/* Vize Dosyaları Tab */}
      {tab === "visa" && (
        <>
          {filteredFiles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-600">Vize görseli bulunamadı</p>
              <p className="text-xs text-slate-400 mt-1">Onaylanan dosyalara eklenen görseller burada görünür</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map(file => (
                <div key={file.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
                  <div className="relative aspect-[3/4] bg-slate-50 cursor-pointer overflow-hidden" onClick={() => setLightbox({ kind: "visa", file })}>
                    <img src={file.vize_gorseli!} alt={`${file.musteri_ad} - ${file.hedef_ulke}`} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-md">{file.hedef_ulke}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800 truncate">{file.musteri_ad}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{file.pasaport_no}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[10px] text-slate-400">{file.sonuc_tarihi ? formatDate(file.sonuc_tarihi) : ""}</span>
                      <button onClick={() => handleDownload(file.vize_gorseli!, `${file.musteri_ad}_${file.hedef_ulke}_Vizesi`)} className="p-1.5 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="İndir">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Yüklenen Görseller Tab */}
      {tab === "uploads" && (
        <>
          {filteredUploads.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
              <div className="w-16 h-16 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-600">Henüz görsel yüklenmedi</p>
              <p className="text-xs text-slate-400 mt-1">Yukarıdaki "Görsel Yükle" butonuna tıklayarak görsel ekleyebilirsiniz</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredUploads.map(u => (
                <div key={u.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
                  <div className="relative aspect-[3/4] bg-slate-50 cursor-pointer overflow-hidden" onClick={() => setLightbox({ kind: "upload", upload: u })}>
                    <img src={u.gorsel_url} alt={u.gorsel_adi} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-purple-500/80 backdrop-blur text-white text-[10px] font-medium rounded-md">#{u.sira_no}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    {editingId === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleRename(u.id, editName); if (e.key === "Escape") setEditingId(null); }}
                          className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                        <button onClick={() => handleRename(u.id, editName)} className="p-1 rounded text-green-600 hover:bg-green-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.gorsel_adi}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(u.created_at)}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <button
                        onClick={() => { setEditingId(u.id); setEditName(u.gorsel_adi); }}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        title="İsim Değiştir"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDownload(u.gorsel_url, u.gorsel_adi)} className="p-1.5 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="İndir">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Sil">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div>
                {lightbox.kind === "visa" ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{lightbox.file.musteri_ad}</p>
                    <p className="text-xs text-slate-400">{lightbox.file.hedef_ulke} &middot; {lightbox.file.pasaport_no}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{lightbox.upload.gorsel_adi}</p>
                    <p className="text-xs text-slate-400">#{lightbox.upload.sira_no} &middot; {formatDate(lightbox.upload.created_at)}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (lightbox.kind === "visa") handleDownload(lightbox.file.vize_gorseli!, `${lightbox.file.musteri_ad}_${lightbox.file.hedef_ulke}_Vizesi`);
                    else handleDownload(lightbox.upload.gorsel_url, lightbox.upload.gorsel_adi);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  İndir
                </button>
                <button onClick={() => setLightbox(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center bg-slate-50 p-4">
              <img
                src={lightbox.kind === "visa" ? lightbox.file.vize_gorseli! : lightbox.upload.gorsel_url}
                alt={lightbox.kind === "visa" ? lightbox.file.musteri_ad : lightbox.upload.gorsel_adi}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            {lightbox.kind === "visa" && lightbox.file.vize_bitis_tarihi && (
              <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-500">
                Vize Bitiş: <span className="font-medium text-slate-700">{formatDate(lightbox.file.vize_bitis_tarihi)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Önizleme Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={cancelUpload}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Görsel Önizleme</h3>
                <p className="text-sm text-slate-500 mt-0.5">{pendingFiles.length} görsel seçildi</p>
              </div>
              <button onClick={cancelUpload} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {pendingPreviews.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Görsel seçilmedi</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {pendingPreviews.map((preview, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <div className="aspect-square">
                        <img src={preview} alt={`Önizleme ${idx + 1}`} className="w-full h-full object-contain" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 bg-purple-500/90 text-white text-xs font-bold rounded-md">{idx + 1}</span>
                      </div>
                      <button
                        onClick={() => removePendingFile(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <div className="px-3 py-2 border-t border-slate-100">
                        <p className="text-xs text-slate-600 truncate">{pendingFiles[idx]?.name}</p>
                        <p className="text-[10px] text-slate-400">{pendingFiles[idx] ? (pendingFiles[idx].size / 1024).toFixed(0) + " KB" : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                + Daha Fazla Ekle
              </button>
              <div className="flex items-center gap-3">
                <button onClick={cancelUpload} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                  İptal
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={uploading || pendingFiles.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-medium rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Yükleniyor...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {pendingFiles.length} Görseli Yükle
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
