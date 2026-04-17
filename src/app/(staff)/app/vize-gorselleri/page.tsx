"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";
import { TARGET_COUNTRIES } from "@/lib/constants";

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

export default function VizeGorselleriPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [lightbox, setLightbox] = useState<VisaFile | null>(null);

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
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const filtered = useMemo(() => {
    let result = files;
    if (filterCountry !== "all") {
      result = result.filter(f => f.hedef_ulke === filterCountry);
    }
    if (search.trim().length >= 2) {
      const term = norm(search.trim());
      result = result.filter(f =>
        norm(f.musteri_ad).includes(term) || norm(f.pasaport_no).includes(term)
      );
      result.sort((a, b) => {
        const aStart = norm(a.musteri_ad).startsWith(term) ? 0 : 1;
        const bStart = norm(b.musteri_ad).startsWith(term) ? 0 : 1;
        return aStart - bStart;
      });
    }
    return result;
  }, [files, search, filterCountry]);

  const countries = useMemo(() => {
    const set = new Set(files.map(f => f.hedef_ulke));
    return Array.from(set).sort();
  }, [files]);

  const handleDownload = (file: VisaFile) => {
    if (!file.vize_gorseli) return;
    const link = document.createElement("a");
    link.href = file.vize_gorseli;
    const safeName = file.musteri_ad.replace(/\s+/g, "_");
    const safeCountry = file.hedef_ulke.replace(/\s+/g, "_");
    const ext = file.vize_gorseli.match(/^data:image\/(\w+);/) ? file.vize_gorseli.match(/^data:image\/(\w+);/)![1] : "jpg";
    link.download = `${safeName}_${safeCountry}_Vizesi.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Vize Görselleri</h1>
          <p className="text-slate-500 text-sm">Onaylanan vizelerin görsellerini görüntüleyin ve indirin</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Müşteri adı veya pasaport no..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>
        <select
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-w-[160px]"
        >
          <option value="all">Tüm Ülkeler</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="text-xs text-slate-400">
          {filtered.length} / {files.length} görsel
        </div>
      </div>

      {/* Galeri */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-sm font-medium text-slate-600">Vize görseli bulunamadı</p>
          <p className="text-xs text-slate-400 mt-1">Onaylanan dosyalara eklenen görseller burada görünür</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(file => (
            <div
              key={file.id}
              className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
            >
              {/* Görsel */}
              <div
                className="relative aspect-[3/4] bg-slate-50 cursor-pointer overflow-hidden"
                onClick={() => setLightbox(file)}
              >
                <img
                  src={file.vize_gorseli!}
                  alt={`${file.musteri_ad} - ${file.hedef_ulke}`}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    </div>
                  </div>
                </div>
                {/* Ülke badge */}
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-1 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-md">
                    {file.hedef_ulke}
                  </span>
                </div>
              </div>

              {/* Bilgi */}
              <div className="p-3">
                <p className="text-sm font-semibold text-slate-800 truncate">{file.musteri_ad}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{file.pasaport_no}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[10px] text-slate-400">
                    {file.sonuc_tarihi ? formatDate(file.sonuc_tarihi) : ""}
                  </span>
                  <button
                    onClick={() => handleDownload(file)}
                    className="p-1.5 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="İndir"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Üst bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">{lightbox.musteri_ad}</p>
                <p className="text-xs text-slate-400">{lightbox.hedef_ulke} &middot; {lightbox.pasaport_no}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(lightbox)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  İndir
                </button>
                <button
                  onClick={() => setLightbox(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            {/* Görsel */}
            <div className="flex items-center justify-center bg-slate-50 p-4">
              <img
                src={lightbox.vize_gorseli!}
                alt={`${lightbox.musteri_ad} - ${lightbox.hedef_ulke}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            {/* Alt bilgi */}
            {lightbox.vize_bitis_tarihi && (
              <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-500">
                Vize Bitiş: <span className="font-medium text-slate-700">{formatDate(lightbox.vize_bitis_tarihi)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
