"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import VisaFileForm from "@/components/files/VisaFileForm";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";

export default function AdminEditVisaFilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [file, setFile] = useState<VisaFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: dbErr } = await supabase
          .from("visa_files")
          .select("*")
          .eq("id", id)
          .single();
        if (cancelled) return;
        if (dbErr || !data) {
          setError("Dosya bulunamadı veya erişim yetkiniz yok.");
          setFile(null);
        } else {
          setFile(data as VisaFile);
        }
      } catch {
        if (!cancelled) setError("Dosya yüklenemedi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-amber-300/30 via-orange-200/20 to-transparent blur-3xl" />
        <div className="absolute top-40 -left-28 h-96 w-96 rounded-full bg-gradient-to-tr from-violet-200/40 via-fuchsia-100/30 to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 backdrop-blur border border-white/80 text-navy-600 hover:text-navy-800 hover:bg-white transition-all shadow-sm hover:shadow"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Geri</span>
          </button>

          <nav className="hidden sm:flex items-center gap-2 text-xs text-navy-500">
            <span className="hover:text-navy-700 cursor-pointer" onClick={() => router.push("/admin/files")}>Vize Dosyaları</span>
            <svg className="w-3 h-3 text-navy-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-navy-800 font-semibold">Dosyayı Düzenle</span>
          </nav>
        </div>

        <section className="relative overflow-hidden rounded-3xl mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-amber-950 to-orange-950" />
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-amber-500 blur-3xl animate-blob" />
            <div className="absolute -bottom-16 -right-10 w-72 h-72 rounded-full bg-orange-500 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
          </div>
          <div className="relative p-6 sm:p-7 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Düzenleme · Admin
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200 bg-clip-text text-transparent">Vize Dosyası</span> Düzenle
            </h1>
            {file && (
              <p className="mt-1.5 text-white/70 text-sm max-w-xl">
                <strong className="text-white">{file.musteri_ad}</strong> · {file.hedef_ulke} · {file.pasaport_no}
              </p>
            )}
          </div>
        </section>

        <div className="relative rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl shadow-navy-900/5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400" />
          <div className="p-6 sm:p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg className="w-7 h-7 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <p className="text-sm text-slate-500">Dosya yükleniyor...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-5 text-center">
                <p className="text-sm text-rose-700 font-semibold">{error}</p>
                <button
                  onClick={() => router.push("/admin/files")}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700"
                >
                  Dosya listesine dön
                </button>
              </div>
            ) : file ? (
              <VisaFileForm
                file={file}
                onSuccess={() => router.push("/admin/files")}
                onCancel={() => router.back()}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
