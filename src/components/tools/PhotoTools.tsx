"use client";

import dynamic from "next/dynamic";

const BackgroundRemover = dynamic(() => import("./BackgroundRemover"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-navy-500">Yükleniyor...</p>
      </div>
    </div>
  ),
});

export default function PhotoTools() {
  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm leading-tight">Arka Plan Beyaz Yapma</h3>
            <p className="text-[10px] text-white/70">Vesikalık fotoğraf arka planı</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <BackgroundRemover />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-navy-50 border-t border-navy-200 shrink-0">
        <p className="text-[10px] text-navy-400 text-center">
          🔒 Dosyalarınız sunucuya yüklenmez &bull; Tüm işlemler tarayıcınızda yapılır
        </p>
      </div>
    </div>
  );
}
