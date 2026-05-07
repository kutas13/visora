"use client";

import type { VisaFile } from "@/lib/supabase/types";

type FileLike = VisaFile & { profiles?: any };

interface Props {
  files: FileLike[];
}

export type PassportExpiryLevel = "ok" | "warn" | "critical" | "expired" | "none";

export function getPassportExpiryStatus(expiryDate?: string | null): {
  level: PassportExpiryLevel;
  daysLeft: number;
  label: string;
} {
  if (!expiryDate) return { level: "none", daysLeft: 0, label: "Tarih bilgisi yok" };
  const exp = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      level: "expired",
      daysLeft,
      label: `Süresi ${Math.abs(daysLeft)} gün önce DOLDU`,
    };
  }
  if (daysLeft <= 90) {
    return { level: "critical", daysLeft, label: `${daysLeft} gün sonra DOLUYOR` };
  }
  if (daysLeft <= 365) {
    return { level: "warn", daysLeft, label: `${daysLeft} gün kaldı (1 yıldan az)` };
  }
  const yearsLeft = Math.floor(daysLeft / 365);
  return { level: "ok", daysLeft, label: `${yearsLeft} yıldan fazla geçerli` };
}

export default function PassportInfoCard({ files }: Props) {
  const passportImageUrl = files.find((f) => (f as any).pasaport_image_url)?.pasaport_image_url as
    | string
    | undefined;
  const expiryDate = files.find((f) => (f as any).pasaport_son_kullanma)?.pasaport_son_kullanma as
    | string
    | undefined;

  if (!passportImageUrl && !expiryDate) return null;

  const expiry = getPassportExpiryStatus(expiryDate);
  const showExpiry = expiry.level !== "none";

  const handleDownload = async () => {
    if (!passportImageUrl) return;
    try {
      const res = await fetch(passportImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const customer = files[0];
      a.download = `pasaport-${(customer.musteri_ad || "")
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9\-]/g, "")}-${customer.pasaport_no || ""}.${
        blob.type.split("/")[1] || "jpg"
      }`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(passportImageUrl, "_blank");
    }
  };

  const cardBorder =
    expiry.level === "expired" || expiry.level === "critical"
      ? "border-rose-300"
      : expiry.level === "warn"
        ? "border-amber-300"
        : "border-navy-200";

  const banner =
    expiry.level === "expired"
      ? { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", title: "Pasaport süresi DOLMUŞ!" }
      : expiry.level === "critical"
        ? { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", title: "Pasaport süresi çok yakında doluyor!" }
        : expiry.level === "warn"
          ? { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", title: "Pasaport süresinin dolmasına 1 yıldan az kaldı" }
          : { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", title: "Pasaport geçerli" };

  return (
    <div className={`rounded-3xl border bg-white shadow-sm overflow-hidden ${cardBorder}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* Sol: görsel */}
        {passportImageUrl ? (
          <div className="md:col-span-1 relative bg-slate-100 flex items-center justify-center min-h-[220px]">
            <img
              src={passportImageUrl}
              alt="Pasaport"
              className="w-full h-full object-contain max-h-72"
            />
          </div>
        ) : (
          <div className="md:col-span-1 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-6 min-h-[220px]">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-xs font-medium">Pasaport görseli yok</p>
          </div>
        )}

        {/* Sağ: bilgi */}
        <div className="md:col-span-2 p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-navy-900">Pasaport Bilgileri</h3>
            </div>
            {passportImageUrl && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                İndir
              </button>
            )}
          </div>

          {expiryDate ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Son Kullanma Tarihi</span>
                <span className="text-sm font-bold text-navy-900">
                  {new Date(expiryDate).toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>

              {showExpiry && (
                <div className={`flex items-start gap-3 p-3.5 rounded-xl border-2 ${banner.bg} ${banner.border} ${banner.text}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {expiry.level === "ok" ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">{banner.title}</p>
                    <p className="text-xs mt-0.5 opacity-90">{expiry.label}</p>
                    {(expiry.level === "warn" ||
                      expiry.level === "critical" ||
                      expiry.level === "expired") && (
                      <p className="text-[11px] mt-1.5 font-medium">
                        Müşterinizi pasaport yenilemesi için bilgilendirin.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Pasaport son kullanma tarihi henüz girilmemiş. Yeni bir dosya açarken pasaport
              görseli yüklerseniz otomatik okunur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
