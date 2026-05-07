"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

type RefLogo = {
  id: string;
  company_name: string;
  logo_url: string;
  sort_order: number;
  is_active: boolean;
  organization_id: string | null;
};

type Org = {
  id: string;
  name: string;
  status: string;
};

export default function ReferencesPage() {
  const [logos, setLogos] = useState<RefLogo[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [logosRes, orgsRes] = await Promise.all([
      supabase
        .from("reference_logos")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("organizations")
        .select("id, name, status")
        .eq("status", "active")
        .order("name"),
    ]);

    setLogos((logosRes.data as RefLogo[] | null) || []);
    setOrgs((orgsRes.data as Org[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdd = async () => {
    const companyName = selectedOrg
      ? orgs.find((o) => o.id === selectedOrg)?.name || customName
      : customName.trim();

    if (!companyName) {
      setError("Firma adı veya şirket seçimi gerekli.");
      return;
    }
    if (!logoFile && !preview) {
      setError("Logo dosyası seçiniz.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      let logoUrl = "";

      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const fileName = `ref-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("reference-logos")
          .upload(fileName, logoFile, {
            cacheControl: "31536000",
            upsert: false,
          });

        if (uploadErr) {
          if (uploadErr.message?.includes("Bucket not found")) {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(logoFile);
            });
            logoUrl = base64;
          } else {
            throw uploadErr;
          }
        } else {
          const { data: publicData } = supabase.storage
            .from("reference-logos")
            .getPublicUrl(fileName);
          logoUrl = publicData.publicUrl;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/visora/reference-logos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          action: "add",
          organization_id: selectedOrg || null,
          company_name: companyName,
          logo_url: logoUrl,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Hata oluştu");

      setSuccess(`${companyName} logosu eklendi!`);
      setSelectedOrg("");
      setCustomName("");
      setLogoFile(null);
      setPreview(null);
      await load();
    } catch (err: any) {
      setError(err?.message || "Logo eklenemedi.");
    } finally {
      setUploading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" logosunu silmek istediğinize emin misiniz?`)) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    await fetch("/api/visora/reference-logos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({ action: "delete", id }),
    });

    await load();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Ana Sayfa Yönetimi</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Referans Logoları</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ana sayfada "Bize güvenen firmalar" bölümünde gösterilecek logolar.
          </p>
        </div>
      </div>

      {/* Add New */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Yeni Logo Ekle</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Şirket Seç (opsiyonel)</label>
            <select
              value={selectedOrg}
              onChange={(e) => {
                setSelectedOrg(e.target.value);
                if (e.target.value) {
                  const org = orgs.find((o) => o.id === e.target.value);
                  if (org) setCustomName(org.name);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- Seçim yapmadan isim gir --</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Firma Adı</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Spyke Turizm"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Logo (PNG veya JPG)</label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors text-sm font-medium text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {logoFile ? logoFile.name : "Dosya seç..."}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
            </label>
            {preview && (
              <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                <img src={preview} alt="Önizleme" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={uploading}
          className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Yükleniyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Logo Ekle
            </>
          )}
        </button>
      </div>

      {/* Existing Logos */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Mevcut Logolar ({logos.length})
        </h2>

        {logos.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Henüz referans logosu eklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {logos.map((logo) => (
              <div key={logo.id} className="group relative rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-20 h-20 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={logo.logo_url}
                    alt={logo.company_name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <p className="text-sm font-semibold text-slate-700 text-center truncate w-full">
                  {logo.company_name}
                </p>
                <button
                  onClick={() => handleDelete(logo.id, logo.company_name)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
