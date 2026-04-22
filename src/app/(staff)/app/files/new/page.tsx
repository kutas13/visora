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
            {/* Yakıt Deposu / Doluluk Göstergesi */}
            <FuelGauge progress={progress} />

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
// Yakıt Deposu Göstergesi - Dikey Progress
// ============================================
function FuelGauge({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, progress));

  // Seviyeye göre renk & durum mesajı
  const level =
    pct >= 100
      ? { label: "FULL", color: "from-emerald-400 via-green-500 to-emerald-600", text: "text-emerald-600", ring: "ring-emerald-200", msg: "Dosya hazır!" }
      : pct >= 75
      ? { label: "YÜKSEK", color: "from-green-400 via-emerald-500 to-green-600", text: "text-emerald-600", ring: "ring-emerald-200", msg: "Neredeyse tamam" }
      : pct >= 50
      ? { label: "ORTA", color: "from-amber-400 via-orange-500 to-amber-600", text: "text-amber-600", ring: "ring-amber-200", msg: "Devam ediyor" }
      : pct >= 25
      ? { label: "DÜŞÜK", color: "from-orange-400 via-orange-500 to-red-500", text: "text-orange-600", ring: "ring-orange-200", msg: "Doldurmaya devam" }
      : { label: "BOŞ", color: "from-red-400 via-red-500 to-rose-600", text: "text-red-600", ring: "ring-red-200", msg: "Form boş" };

  return (
    <div className="relative rounded-2xl bg-white border border-navy-100 shadow-sm overflow-hidden">
      {/* Üst aksan */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${level.color}`} />

      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${level.color} flex items-center justify-center shadow-sm ring-2 ${level.ring}`}>
            {/* Yakıt pompası ikonu */}
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h8M4 4h8v16M12 8h3a2 2 0 012 2v6a2 2 0 002 2 2 2 0 002-2V9l-2-2M12 4v4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-navy-900 text-sm">Dosya Doluluğu</h3>
            <p className="text-[11px] text-navy-500 truncate">{level.msg}</p>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${level.text} bg-gradient-to-br ${level.color} text-white shadow-sm`}>
            {level.label}
          </div>
        </div>

        {/* Dikey yakıt deposu */}
        <div className="flex items-stretch gap-3">
          {/* Tank */}
          <div className="relative flex-shrink-0 w-16 h-56 sm:h-64 rounded-2xl bg-gradient-to-b from-navy-100 to-navy-50 border-2 border-navy-200 shadow-inner overflow-hidden">
            {/* Dolum animasyonlu */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${level.color} transition-all duration-700 ease-out`}
              style={{ height: `${pct}%` }}
            >
              {/* Yüzey parıltı */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/40" />
              {/* Kabarcık animasyonu */}
              {pct > 10 && (
                <>
                  <div className="absolute left-2 bottom-2 w-1.5 h-1.5 rounded-full bg-white/50 animate-ping" style={{ animationDelay: "0s" }} />
                  <div className="absolute right-3 bottom-6 w-1 h-1 rounded-full bg-white/40 animate-ping" style={{ animationDelay: "0.7s" }} />
                  <div className="absolute left-4 bottom-10 w-1 h-1 rounded-full bg-white/30 animate-ping" style={{ animationDelay: "1.3s" }} />
                </>
              )}
            </div>

            {/* Ölçek çizgileri */}
            <div className="absolute inset-y-0 right-0 flex flex-col justify-between py-2 pr-1 pointer-events-none">
              {[100, 75, 50, 25, 0].map((n) => (
                <div key={n} className="flex items-center gap-0.5">
                  <span className="text-[8px] font-bold text-navy-400 mix-blend-difference">{n}</span>
                  <div className="w-1.5 h-0.5 bg-navy-300/60" />
                </div>
              ))}
            </div>

            {/* Merkez yüzde göstergesi */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5 shadow-md border border-white ring-1 ring-navy-100">
                <span className={`text-[13px] font-black tabular-nums ${level.text}`}>
                  {Math.round(pct)}%
                </span>
              </div>
            </div>

            {/* Tank üst kapağı */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 rounded-t-lg bg-navy-300 border border-navy-400" />
          </div>

          {/* Adım listesi */}
          <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
            <Step done={pct >= 15} label="Müşteri" />
            <Step done={pct >= 30} label="Pasaport" />
            <Step done={pct >= 45} label="Ülke" />
            <Step done={pct >= 65} label="Ücret" />
            <Step done={pct >= 85} label="Ödeme" />
            <Step done={pct >= 100} label="Tamamlandı" highlight />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ done, label, highlight = false }: { done: boolean; label: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
          done
            ? highlight
              ? "bg-gradient-to-br from-emerald-400 to-green-600 shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-200"
              : "bg-gradient-to-br from-primary-400 to-primary-600 shadow-sm shadow-primary-500/30"
            : "bg-navy-100 border border-navy-200"
        }`}
      >
        {done ? (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-navy-300" />
        )}
      </div>
      <span
        className={`text-[11px] font-semibold truncate transition-colors ${
          done ? (highlight ? "text-emerald-700" : "text-navy-800") : "text-navy-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
