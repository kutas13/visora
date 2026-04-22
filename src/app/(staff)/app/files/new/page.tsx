"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VisaFileForm from "@/components/files/VisaFileForm";

export default function NewVisaFilePage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Sol kenar dikey doluluk çizgisi */}
      <LeftProgressRail progress={progress} />

      {/* Dekoratif arka plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary-300/40 via-primary-200/30 to-transparent blur-3xl" />
        <div className="absolute top-40 -left-28 h-96 w-96 rounded-full bg-gradient-to-tr from-navy-200/50 via-blue-100/40 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-gradient-to-tl from-amber-100/50 to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        {/* Üst navigasyon */}
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
            <span className="hover:text-navy-700 cursor-pointer" onClick={() => router.push("/app/files")}>Dosyalar</span>
            <svg className="w-3 h-3 text-navy-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-navy-800 font-semibold">Yeni Dosya</span>
          </nav>
        </div>

        {/* Hero başlık */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-6 sm:p-8 mb-6 shadow-xl shadow-navy-900/20">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-primary-500 blur-3xl" />
            <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-primary-400 blur-3xl" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.15),transparent_50%)]" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl blur-lg opacity-60" />
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center shadow-lg ring-1 ring-white/20">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500/20 border border-primary-400/30 text-primary-200 text-[11px] font-semibold uppercase tracking-wider mb-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-400" />
                </span>
                Yeni Kayıt
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Vize Dosyası Oluştur
              </h1>
              <p className="text-sm sm:text-base text-navy-200 mt-1.5 max-w-xl">
                Müşteri bilgilerini, hedef ülkeyi ve ödeme planını doldurarak yeni dosyayı birkaç saniyede hazırlayın.
              </p>
            </div>
          </div>
        </div>

        {/* İçerik grid - form + yan panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form kartı */}
          <div className="lg:col-span-2">
            <div className="relative rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl shadow-navy-900/5 overflow-hidden">
              {/* Dekoratif üst çizgi */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-amber-400" />
              <div className="p-6 sm:p-8">
                <VisaFileForm
                  file={null}
                  onSuccess={() => router.push("/app/files")}
                  onCancel={() => router.back()}
                  onProgress={setProgress}
                />
              </div>
            </div>
          </div>

          {/* Yan bilgi paneli */}
          <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-amber-50 border border-primary-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-bold text-navy-900 text-sm">Hızlı İpuçları</h3>
              </div>
              <ul className="space-y-2.5 text-xs text-navy-700">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Pasaport numarası girildiğinde geçmiş başvurular otomatik gösterilir.</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Hedef ülkeye göre ücret para birimi otomatik seçilir.</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Peşin seçince ödeme yöntemine göre muhasebeye otomatik mail gider.</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Firma cari seçildiğinde firmayı aradıktan sonra hızlıca ekleyebilirsiniz.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white border border-navy-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-navy-900 text-sm">Zorunlu Alanlar</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-navy-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Müşteri ad soyad</span>
                </div>
                <div className="flex items-center gap-2 text-navy-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Pasaport numarası</span>
                </div>
                <div className="flex items-center gap-2 text-navy-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Hedef ülke</span>
                </div>
                <div className="flex items-center gap-2 text-navy-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Ücret ve ödeme planı</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 p-5 shadow-lg text-white">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="font-bold text-sm">Güvenli Kayıt</h3>
              </div>
              <p className="text-xs text-navy-200 leading-relaxed">
                Tüm veriler şifrelenmiş olarak saklanır ve sadece yetkili kullanıcılar tarafından görüntülenebilir.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sol Kenar Dikey Doluluk Çizgisi
// Ekranın sol kenarında, boydan boya (fixed), alttan üste dolar
// ============================================
function LeftProgressRail({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, progress));

  const color =
    pct >= 100
      ? "from-emerald-500 via-green-500 to-emerald-400"
      : pct >= 75
      ? "from-green-500 via-emerald-500 to-lime-400"
      : pct >= 50
      ? "from-amber-500 via-orange-500 to-amber-400"
      : pct >= 25
      ? "from-orange-500 via-primary-500 to-orange-400"
      : "from-rose-500 via-red-500 to-rose-400";

  const badgeColor =
    pct >= 75
      ? "bg-emerald-500 text-white shadow-emerald-500/40"
      : pct >= 50
      ? "bg-amber-500 text-white shadow-amber-500/40"
      : pct >= 25
      ? "bg-primary-500 text-white shadow-primary-500/40"
      : "bg-rose-500 text-white shadow-rose-500/40";

  return (
    <div className="pointer-events-none fixed left-0 top-16 bottom-0 z-40 flex items-stretch">
      {/* Zemin rayı */}
      <div className="relative w-1.5 sm:w-2 h-full bg-gradient-to-b from-navy-100/80 via-navy-100/60 to-navy-100/80 backdrop-blur-sm shadow-[1px_0_0_0_rgba(255,255,255,0.6)_inset]">
        {/* Dolu kısım (alttan yukarıya doğru dolar) */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${color} transition-all duration-700 ease-out shadow-lg`}
          style={{ height: `${pct}%` }}
        >
          {/* Üst parıltı */}
          <div className="absolute -top-px left-0 right-0 h-1 bg-white/70 blur-[1px]" />
        </div>

        {/* Ölçek çentikleri */}
        {[25, 50, 75].map((n) => (
          <div
            key={n}
            className="absolute left-0 right-0 h-px bg-navy-300/60"
            style={{ bottom: `${n}%` }}
          />
        ))}

        {/* Yüzde rozeti (doluluk seviyesine göre hareket eder) */}
        <div
          className="absolute left-full ml-2 transition-all duration-700 ease-out pointer-events-auto"
          style={{ bottom: `calc(${pct}% - 14px)` }}
        >
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums shadow-md ${badgeColor}`}>
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 01.894.553l2.11 4.22 4.66.677a1 1 0 01.554 1.706l-3.372 3.286.796 4.641a1 1 0 01-1.451 1.054L10 16.95l-4.191 2.187a1 1 0 01-1.451-1.054l.796-4.641L1.782 10.156a1 1 0 01.554-1.706l4.66-.677 2.11-4.22A1 1 0 0110 3z" />
            </svg>
            {Math.round(pct)}%
          </div>
        </div>
      </div>
    </div>
  );
}
