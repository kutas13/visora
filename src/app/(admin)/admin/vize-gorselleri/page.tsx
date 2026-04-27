"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

interface UploadedImage {
  id: string;
  user_id: string;
  gorsel_url: string;
  gorsel_adi: string;
  sira_no: number;
  created_at: string;
  profiles?: Pick<Profile, "name"> | null;
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type GalleryItem =
  | { kind: "visa"; file: VisaFileWithProfile }
  | { kind: "upload"; upload: UploadedImage };

export default function AdminVizeGorselleriPage() {
  const [files, setFiles] = useState<VisaFileWithProfile[]>([]);
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "visa" | "upload">("all");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("sonuc", "vize_onay")
      .not("vize_gorseli", "is", null)
      .order("sonuc_tarihi", { ascending: false });

    setFiles((data || []) as VisaFileWithProfile[]);
  }, []);

  const [systemError, setSystemError] = useState<string | null>(null);

  const loadUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/vize-gorselleri");
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.tableError) {
          setSystemError(`Tablo hatası (${json.tableCode}): ${json.tableError}. Supabase SQL Editor'den migration dosyasını çalıştırın.`);
        }
        setUploads(json.data || []);
      } catch {
        setSystemError("API yanıtı geçersiz: " + text.substring(0, 200));
      }
    } catch (e: any) {
      setSystemError("API bağlantı hatası: " + e.message);
    }
  }, []);

  useEffect(() => {
    fetch("/api/vize-gorselleri", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "health" }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.checks?.table && !j.checks.table.ok) {
          setSystemError(`Tablo mevcut değil (${j.checks.table.code}). Supabase SQL Editor'den migration SQL'ini çalıştırın.`);
        }
      })
      .catch(() => {});

    Promise.all([loadFiles(), loadUploads()]).finally(() => setLoading(false));
  }, [loadFiles, loadUploads]);

  const combined = useMemo<GalleryItem[]>(() => {
    const visaItems: GalleryItem[] = files.map(f => ({ kind: "visa", file: f }));
    const uploadItems: GalleryItem[] = uploads.map(u => ({ kind: "upload", upload: u }));
    const all = [...visaItems, ...uploadItems];
    all.sort((a, b) => {
      const aDate = a.kind === "visa"
        ? (a.file.sonuc_tarihi || a.file.created_at || "")
        : a.upload.created_at;
      const bDate = b.kind === "visa"
        ? (b.file.sonuc_tarihi || b.file.created_at || "")
        : b.upload.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
    return all;
  }, [files, uploads]);

  const filteredAll = useMemo<GalleryItem[]>(() => {
    let result = combined;

    if (filterKind === "visa") result = result.filter(i => i.kind === "visa");
    else if (filterKind === "upload") result = result.filter(i => i.kind === "upload");

    if (filterCountry !== "all") {
      result = result.filter(i => i.kind === "visa" && i.file.hedef_ulke === filterCountry);
    }

    if (filterStaff !== "all") {
      result = result.filter(i => {
        const name = i.kind === "visa" ? i.file.profiles?.name : i.upload.profiles?.name;
        return name === filterStaff;
      });
    }

    if (search.trim().length >= 2) {
      const term = norm(search.trim());
      result = result.filter(i => {
        if (i.kind === "visa") {
          return norm(i.file.musteri_ad).includes(term) || norm(i.file.pasaport_no).includes(term);
        }
        return norm(i.upload.gorsel_adi).includes(term);
      });
    }

    return result;
  }, [combined, filterKind, filterCountry, filterStaff, search]);

  const countries = useMemo(() => Array.from(new Set(files.map(f => f.hedef_ulke))).sort(), [files]);
  const staffNames = useMemo(() => {
    const fromFiles = files.map(f => f.profiles?.name).filter(Boolean);
    const fromUploads = uploads.map(u => u.profiles?.name).filter(Boolean);
    return Array.from(new Set([...fromFiles, ...fromUploads])).sort() as string[];
  }, [files, uploads]);

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

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");

  const compressImage = (file: File, maxW = 1600, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas desteklenmiyor")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel okunamadı")); };
      img.src = url;
    });
  };

  const safeFetch = async (url: string, opts: RequestInit): Promise<{ ok: boolean; status: number; json: any; rawText: string }> => {
    const res = await fetch(url, opts);
    const rawText = await res.text();
    let json: any = null;
    try { json = JSON.parse(rawText); } catch {}
    return { ok: res.ok, status: res.status, json, rawText };
  };

  const confirmUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      setUploadProgress("Hazırlanıyor...");

      const siraResult = await safeFetch("/api/vize-gorselleri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next_sira" }),
      });

      if (!siraResult.ok) {
        setUploadError(`Sıra alma hatası (${siraResult.status}): ${siraResult.json?.error || siraResult.rawText.substring(0, 200)}`);
        setUploading(false);
        setUploadProgress("");
        return;
      }

      const startNo = siraResult.json?.nextNo || 1;
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const siraNo = startNo + i;

        try {
          setUploadProgress(`${i + 1}/${pendingFiles.length} sıkıştırılıyor...`);
          const base64 = await compressImage(file);

          setUploadProgress(`${i + 1}/${pendingFiles.length} yükleniyor...`);
          const result = await safeFetch("/api/vize-gorselleri", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "upload_single", base64, contentType: "image/jpeg", siraNo }),
          });

          if (result.ok && result.json?.ok) {
            successCount++;
          } else {
            const msg = result.json?.error || `HTTP ${result.status}: ${result.rawText.substring(0, 100)}`;
            errors.push(`#${siraNo}: ${msg}`);
          }
        } catch (fileErr: any) {
          errors.push(`#${siraNo}: ${fileErr.message}`);
        }
      }

      if (successCount > 0) {
        pendingPreviews.forEach(u => URL.revokeObjectURL(u));
        setPendingFiles([]);
        setPendingPreviews([]);
        setShowUploadModal(false);
        await loadUploads();
      }

      if (errors.length > 0) {
        setUploadError(`${successCount}/${pendingFiles.length} başarılı. Hatalar: ${errors.join(" | ")}`);
      } else if (successCount === 0) {
        setUploadError("Hiçbir görsel yüklenemedi");
      }
    } catch (err: any) {
      setUploadError(`Bağlantı hatası: ${err?.message || String(err)}`);
    }

    setUploading(false);
    setUploadProgress("");
  };

  const handleRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/vize-gorselleri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", id, name: newName.trim() }),
      });
      if (res.ok) {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, gorsel_adi: newName.trim() } : u));
      }
    } catch {}
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu görseli silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch("/api/vize-gorselleri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
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
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 animate-pulse">Görseller yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {systemError && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-800">
          <strong>Sistem Hatası:</strong> {systemError}
        </div>
      )}
      {/* Başlık + Upload */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-pink-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">Galeri</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Vize Görselleri</h1>
            <p className="text-slate-500 text-sm mt-1">Tüm personelin vize görsel arşivini yönet</p>
          </div>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50"
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

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Müşteri adı, pasaport no veya görsel adı..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-9 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Tür filtresi */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setFilterKind("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterKind === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Tümü <span className="ml-1 text-[10px] text-slate-400">({files.length + uploads.length})</span>
          </button>
          <button
            onClick={() => setFilterKind("visa")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterKind === "visa" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Vize <span className="ml-1 text-[10px] text-slate-400">({files.length})</span>
          </button>
          <button
            onClick={() => setFilterKind("upload")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterKind === "upload" ? "bg-white text-orange-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Yüklenen <span className="ml-1 text-[10px] text-slate-400">({uploads.length})</span>
          </button>
        </div>

        {filterKind !== "upload" && countries.length > 0 && (
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-w-[140px]">
            <option value="all">Tüm Ülkeler</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-w-[140px]">
          <option value="all">Tüm Personel</option>
          {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="text-xs text-slate-400">
          {filteredAll.length} / {combined.length} görsel
        </div>
      </div>

      {/* Birleşik Grid */}
      {filteredAll.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-sm font-medium text-slate-600">Görsel bulunamadı</p>
          <p className="text-xs text-slate-400 mt-1">Onaylı vize dosyalarından veya yüklenen görsellerden hiçbiri eşleşmiyor</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAll.map(item => {
            if (item.kind === "visa") {
              const file = item.file;
              return (
                <div key={`v-${file.id}`} className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-200">
                  <div className="relative aspect-[3/4] bg-slate-50 cursor-pointer overflow-hidden" onClick={() => setLightbox({ kind: "visa", file })}>
                    <img src={file.vize_gorseli!} alt={`${file.musteri_ad} - ${file.hedef_ulke}`} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="px-1.5 py-0.5 bg-blue-500/90 backdrop-blur text-white text-[9px] font-bold rounded uppercase tracking-wider">Vize</span>
                      <span className="px-2 py-1 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-md">{file.hedef_ulke}</span>
                    </div>
                    {file.profiles?.name && (
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 bg-orange-500/80 backdrop-blur text-white text-[10px] font-medium rounded-md">{file.profiles.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800 truncate">{file.musteri_ad}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{file.pasaport_no}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[10px] text-slate-400">{file.sonuc_tarihi ? formatDate(file.sonuc_tarihi) : ""}</span>
                      <button onClick={() => handleDownload(file.vize_gorseli!, `${file.musteri_ad}_${file.hedef_ulke}_Vizesi`)} className="p-1.5 rounded-md text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-colors" title="İndir">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const u = item.upload;
            return (
              <div key={`u-${u.id}`} className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
                <div className="relative aspect-[3/4] bg-slate-50 cursor-pointer overflow-hidden" onClick={() => setLightbox({ kind: "upload", upload: u })}>
                  <img src={u.gorsel_url} alt={u.gorsel_adi} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-orange-500/90 backdrop-blur text-white text-[9px] font-bold rounded uppercase tracking-wider">Yüklenen</span>
                    <span className="px-2 py-1 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-md">#{u.sira_no}</span>
                  </div>
                  {u.profiles?.name && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 bg-slate-800/70 backdrop-blur text-white text-[10px] font-medium rounded-md">{u.profiles.name}</span>
                    </div>
                  )}
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
                        className="flex-1 px-2 py-1 text-sm border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500/30"
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
                      className="p-1.5 rounded-md text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
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
            );
          })}
        </div>
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
                    <p className="text-xs text-slate-400">{lightbox.file.hedef_ulke} &middot; {lightbox.file.pasaport_no} {lightbox.file.profiles?.name && <>&middot; <span className="text-orange-500">{lightbox.file.profiles.name}</span></>}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{lightbox.upload.gorsel_adi}</p>
                    <p className="text-xs text-slate-400">#{lightbox.upload.sira_no} &middot; {formatDate(lightbox.upload.created_at)} {lightbox.upload.profiles?.name && <>&middot; <span className="text-orange-500">{lightbox.upload.profiles.name}</span></>}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (lightbox.kind === "visa") handleDownload(lightbox.file.vize_gorseli!, `${lightbox.file.musteri_ad}_${lightbox.file.hedef_ulke}_Vizesi`);
                    else handleDownload(lightbox.upload.gorsel_url, lightbox.upload.gorsel_adi);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
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
                        <span className="px-2 py-1 bg-orange-500/90 text-white text-xs font-bold rounded-md">{idx + 1}</span>
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
            {uploadError && (
              <div className="mx-6 mb-0 mt-0 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {uploadError}
              </div>
            )}
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {uploadProgress || "Yükleniyor..."}
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
