"use client";

import { useState, useRef, useCallback } from "react";

interface ProcessedResult {
  original: string;
  processed: string;
}

const MAX_SIZE = 1024;

export default function BackgroundRemover() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setError(null);
    setResult(null);

    if (!file.type.startsWith("image/")) {
      setError("Lütfen JPG veya PNG dosyası seçin.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Dosya boyutu 10MB'dan küçük olmalıdır.");
      return;
    }

    setIsProcessing(true);
    setProgress("Model yükleniyor...");

    try {
      const { removeBackground } = await import("@imgly/background-removal");

      // Orijinal resmi al
      const originalUrl = URL.createObjectURL(file);

      setProgress("Arka plan kaldırılıyor...");

      const blob = await removeBackground(file, {
        progress: (key: string, current: number, total: number) => {
          if (key === "compute:inference") {
            const pct = Math.round((current / total) * 100);
            setProgress(`İşleniyor... %${pct}`);
          }
        },
      });

      // Beyaz arka plan uygula
      const img = new Image();
      const processedUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (Math.max(w, h) > MAX_SIZE) {
            const scale = MAX_SIZE / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          setResult({
            original: originalUrl,
            processed: canvas.toDataURL("image/png"),
          });
          URL.revokeObjectURL(processedUrl);
          resolve();
        };
        img.onerror = reject;
        img.src = processedUrl;
      });
    } catch (err) {
      console.error("Arka plan kaldırma hatası:", err);
      setError("İşlem sırasında hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  }, []);

  const download = useCallback(
    (format: "jpg" | "png") => {
      if (!result) return;
      const link = document.createElement("a");
      link.download = `vesikalik-${Date.now()}.${format}`;

      if (format === "jpg") {
        const c = document.createElement("canvas");
        const img = new Image();
        img.onload = () => {
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          link.href = c.toDataURL("image/jpeg", 0.95);
          link.click();
        };
        img.src = result.processed;
      } else {
        link.href = result.processed;
        link.click();
      }
    },
    [result]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 underline mt-1"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {!result && !isProcessing && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging ? "border-primary-500 bg-primary-50" : "border-navy-300 hover:border-primary-400 hover:bg-navy-50"
          }`}
        >
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])} />
          <div className="w-12 h-12 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-navy-700">{isDragging ? "Bırakın!" : "Fotoğraf Yükle"}</p>
          <p className="text-xs text-navy-400 mt-1">Sürükle-bırak veya tıkla</p>
          <p className="text-[10px] text-navy-300 mt-2">JPG, PNG &bull; Max 10 MB</p>
        </div>
      )}

      {isProcessing && (
        <div className="text-center py-10">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-navy-600">{progress || "İşleniyor..."}</p>
          <p className="text-[11px] text-navy-400 mt-1">İlk kullanımda model indirme biraz sürebilir</p>
        </div>
      )}

      {result && !isProcessing && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-navy-500 mb-1 text-center font-medium">Önce</p>
              <div className="bg-navy-100 rounded-lg overflow-hidden aspect-[3/4] flex items-center justify-center">
                <img src={result.original} alt="Orijinal" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-navy-500 mb-1 text-center font-medium">Sonra</p>
              <div className="rounded-lg overflow-hidden aspect-[3/4] flex items-center justify-center"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='8' height='8' fill='%23e5e7eb'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23e5e7eb'/%3E%3C/svg%3E\")" }}>
                <img src={result.processed} alt="İşlenmiş" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => download("jpg")}
              className="py-2.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-colors">
              JPG İndir
            </button>
            <button onClick={() => download("png")}
              className="py-2.5 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg transition-colors">
              PNG İndir
            </button>
          </div>
          <button onClick={reset}
            className="w-full py-2 text-xs font-medium text-navy-600 bg-navy-100 hover:bg-navy-200 rounded-lg transition-colors">
            Yeni Fotoğraf
          </button>
        </div>
      )}

      <div className="text-center">
        <p className="text-[10px] text-navy-300">
          Dosyalarınız sunucuya yüklenmez &bull; Tüm işlemler tarayıcınızda yapılır
        </p>
      </div>
    </div>
  );
}
