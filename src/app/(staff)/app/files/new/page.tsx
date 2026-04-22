"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VisaFileForm from "@/components/files/VisaFileForm";

export default function NewVisaFilePage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Dekoratif arka plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary-300/40 via-primary-200/30 to-transparent blur-3xl" />
        <div className="absolute top-40 -left-28 h-96 w-96 rounded-full bg-gradient-to-tr from-navy-200/50 via-blue-100/40 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-gradient-to-tl from-amber-100/50 to-transparent blur-3xl" />
      </div>

      {/* Ana yerleşim: sol progress + içerik */}
      <div className="relative max-w-7xl mx-auto flex items-stretch gap-6 lg:gap-8">
        {/* Sol taraf: Dikey Stepper - boydan boya */}
        <aside className="hidden lg:flex w-48 shrink-0 self-stretch">
          <VerticalStepper progress={progress} />
        </aside>

        {/* Sağ taraf: Mevcut içerik */}
        <div className="flex-1 min-w-0 max-w-5xl mx-auto">
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
    </div>
  );
}

// ============================================
// Dikey Stepper - Boydan boya çizgi + aşama etiketleri
// En yukarıdan Dosya Oluştur butonu hizasına kadar uzar
// Form doldukça yukarıdan aşağıya doğru dolar
// ============================================
function VerticalStepper({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, progress));

  // Her biri 20 puan — threshold = pozisyon
  const steps: { label: string; position: number; threshold: number; desc: string }[] = [
    { label: "Müşteri",  position: 5,  threshold: 20,  desc: "Ad Soyad" },
    { label: "Pasaport", position: 25, threshold: 40,  desc: "Pasaport No" },
    { label: "Ülke",     position: 45, threshold: 60,  desc: "Hedef ülke" },
    { label: "Ödeme",    position: 70, threshold: 80,  desc: "Ücret + plan" },
    { label: "Bitti",    position: 95, threshold: 100, desc: "Tamamlandı" },
  ];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Başlık */}
      <div className="mb-4 px-1 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tabular-nums bg-gradient-to-br from-primary-500 to-amber-500 bg-clip-text text-transparent">
            {Math.round(pct)}
          </span>
          <span className="text-lg font-bold text-navy-400">%</span>
        </div>
        <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wider mt-0.5">
          Dosya doluluğu
        </p>
      </div>

      {/* Stepper gövde - Kalan tüm yüksekliği doldurur */}
      <div className="relative flex-1 min-h-[400px] pl-1">
        {/* Arka ray - boydan boya */}
        <div className="absolute left-[14px] top-0 bottom-0 w-1 rounded-full bg-navy-100" />

        {/* Dolan çizgi - yukarıdan aşağıya */}
        <div
          className="absolute left-[14px] top-0 w-1 rounded-full bg-gradient-to-b from-primary-500 via-primary-400 to-amber-400 shadow-[0_0_14px_rgba(249,115,22,0.5)] transition-all duration-700 ease-out"
          style={{ height: `${pct}%` }}
        />

        {/* Adımlar - pozisyonlarına göre absolute */}
        {steps.map((step, i) => {
          const done = pct >= step.threshold;
          const prev = i === 0 ? 0 : steps[i - 1].threshold;
          const active = !done && pct >= prev;
          const isLast = i === steps.length - 1;

          return (
            <div
              key={step.label}
              className="absolute left-0 right-0 flex items-center gap-3 -translate-y-1/2"
              style={{ top: `${step.position}%` }}
            >
              {/* Nokta */}
              <div className="relative z-10 shrink-0">
                {done ? (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md ring-4 ring-white transition-all ${
                    isLast
                      ? "bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/30"
                      : "bg-gradient-to-br from-primary-400 to-primary-600 shadow-primary-500/30"
                  }`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : active ? (
                  <div className="relative w-7 h-7">
                    <span className="absolute inset-0 rounded-full bg-primary-400/40 animate-ping" />
                    <div className="relative w-7 h-7 rounded-full bg-white border-2 border-primary-500 flex items-center justify-center shadow-md ring-4 ring-white">
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    </div>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white border-2 border-navy-200 flex items-center justify-center shadow-sm ring-4 ring-white">
                    <span className="text-[11px] font-bold text-navy-400">{i + 1}</span>
                  </div>
                )}
              </div>

              {/* Etiket */}
              <div className="min-w-0">
                <p className={`text-sm font-bold leading-tight transition-colors ${
                  done
                    ? isLast
                      ? "text-emerald-700"
                      : "text-navy-900"
                    : active
                    ? "text-primary-600"
                    : "text-navy-400"
                }`}>
                  {step.label}
                </p>
                <p className={`text-[11px] leading-tight mt-0.5 transition-colors ${
                  done ? "text-navy-500" : active ? "text-primary-500" : "text-navy-300"
                }`}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt durum rozeti */}
      <div className="mt-4 px-1 shrink-0">
        {pct >= 100 ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[11px] font-bold shadow-sm shadow-emerald-500/30">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Dosya hazır
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-[11px] font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-500" />
            </span>
            Devam ediyor
          </div>
        )}
      </div>
    </div>
  );
}
