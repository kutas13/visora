"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PassportOcrResult {
  ad: string | null;
  soyad: string | null;
  pasaport_no: string | null;
  dogum_tarihi: string | null;
  son_kullanma: string | null;
  uyruk: string | null;
  cinsiyet: string | null;
}

interface PassportOcrPanelProps {
  /**
   * Mevcut yüklü pasaport görseli URL'i (edit modunda doluyu gösterir).
   */
  initialImageUrl?: string | null;

  /**
   * OCR başarıyla tamamlandığında çağrılır. Form alanlarını doldurmak için.
   */
  onOcrResult?: (data: PassportOcrResult) => void;

  /**
   * Görsel storage'a yüklendiğinde URL'i parent'a iletir.
   * Parent bu URL'i form data'sının `pasaport_image_url` alanına yazmalı.
   */
  onImageUploaded?: (url: string | null) => void;
}

export default function PassportOcrPanel({
  initialImageUrl = null,
  onOcrResult,
  onImageUploaded,
}: PassportOcrPanelProps) {
  const supabaseRef = useRef(createClient());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);

    if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) {
      setError("Sadece PNG, JPG veya WEBP yükleyebilirsiniz.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Görsel 8MB'tan büyük olamaz.");
      return;
    }

    // Önce preview için base64'e çevir
    const base64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setPreviewBase64(base64);
    setUploading(true);

    try {
      const supabase = supabaseRef.current;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      // 1) Storage'a yükle
      const upRes = await fetch("/api/passport-image/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ base64 }),
      });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error || "Yükleme başarısız.");

      setImageUrl(upJson.url);
      onImageUploaded?.(upJson.url);
      setUploading(false);

      // 2) OCR çalıştır
      setScanning(true);
      const ocrRes = await fetch("/api/ocr/passport", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ base64 }),
      });
      const ocrJson = await ocrRes.json();
      if (!ocrRes.ok) {
        throw new Error(ocrJson.error || "OCR başarısız oldu.");
      }

      const data = ocrJson.data as PassportOcrResult;

      const filledFields: string[] = [];
      if (data.ad) filledFields.push("Ad");
      if (data.soyad) filledFields.push("Soyad");
      if (data.pasaport_no) filledFields.push("Pasaport No");
      if (data.son_kullanma) filledFields.push("Son Kullanma");
      if (data.dogum_tarihi) filledFields.push("Doğum Tarihi");

      onOcrResult?.(data);

      if (filledFields.length === 0) {
        setError(
          "Görselden bilgi okunamadı. Daha net bir foto deneyin (parlama, gölge, kesik kenar olmasın)."
        );
      } else {
        setSuccess(`Otomatik dolduruldu: ${filledFields.join(", ")}`);
      }
    } catch (err: any) {
      setError(err?.message || "Bir hata oluştu.");
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleRemove = () => {
    if (!confirm("Pasaport görselini bu dosyadan kaldırmak istiyor musunuz?")) return;
    setImageUrl(null);
    setPreviewBase64(null);
    setSuccess(null);
    setError(null);
    onImageUploaded?.(null);
  };

  const busy = uploading || scanning;
  const displaySrc = previewBase64 || imageUrl;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/30 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Pasaport Ön Yüzü</h3>
          <p className="text-[11px] text-slate-500 leading-tight">Yükleyin, AI bilgileri otomatik doldursun.</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          OCR
        </span>
      </div>

      {!displaySrc ? (
        <div
          onClick={() => !busy && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragOver
              ? "border-indigo-400 bg-indigo-50/60"
              : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="mx-auto w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm mb-3">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Pasaport Foto Yükle</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Tıklayın veya sürükleyip bırakın · PNG/JPG/WEBP · Max 8MB
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            En iyi sonuç için MRZ'li (alttaki iki çizgili) data sayfasını çekin.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={displaySrc}
              alt="Pasaport"
              className="w-full h-auto max-h-72 object-contain"
            />
            {busy && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mb-2" />
                <span className="text-xs font-semibold">
                  {uploading ? "Yükleniyor…" : "AI okuyor…"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => !busy && fileInputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Değiştir
            </button>

            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14M5 10v9a2 2 0 002 2h9" />
                </svg>
                Aç
              </a>
            )}

            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition disabled:opacity-50 ml-auto"
            >
              Kaldır
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onPick}
      />

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}
      {success && !error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
