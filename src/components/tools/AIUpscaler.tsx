"use client";

import { useState, useRef, useCallback } from "react";

interface ProcessedResult {
  original: string;
  processed: string;
  scale: number;
  originalSize: string;
  newSize: string;
}

/* ================================================
   IMAGE PROCESSING UTILITIES
   ================================================ */

function unsharpMask(canvas: HTMLCanvasElement, radius: number, amount: number): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const originalData = ctx.getImageData(0, 0, w, h);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w;
  blurCanvas.height = h;
  const blurCtx = blurCanvas.getContext("2d")!;
  blurCtx.filter = `blur(${radius}px)`;
  blurCtx.drawImage(canvas, 0, 0);
  blurCtx.filter = "none";
  const blurredData = blurCtx.getImageData(0, 0, w, h);

  const out = ctx.createImageData(w, h);
  const od = originalData.data;
  const bd = blurredData.data;
  const rd = out.data;

  for (let i = 0; i < od.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = od[i + c] - bd[i + c];
      rd[i + c] = Math.max(0, Math.min(255, Math.round(od[i + c] + diff * amount)));
    }
    rd[i + 3] = od[i + 3];
  }

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = w;
  resultCanvas.height = h;
  resultCanvas.getContext("2d")!.putImageData(out, 0, 0);
  return resultCanvas;
}

function autoLevels(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Build histograms
  const hists = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) hists[c][d[i + c]]++;
  }

  const totalPixels = w * h;
  const clipPercent = 0.005; // 0.5% each side
  const clipCount = Math.floor(totalPixels * clipPercent);

  const mins = [0, 0, 0];
  const maxs = [255, 255, 255];

  for (let c = 0; c < 3; c++) {
    let count = 0;
    for (let v = 0; v < 256; v++) {
      count += hists[c][v];
      if (count >= clipCount) {
        mins[c] = v;
        break;
      }
    }
    count = 0;
    for (let v = 255; v >= 0; v--) {
      count += hists[c][v];
      if (count >= clipCount) {
        maxs[c] = v;
        break;
      }
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const range = maxs[c] - mins[c];
      if (range < 20) continue;
      d[i + c] = Math.max(0, Math.min(255, Math.round(((d[i + c] - mins[c]) / range) * 255)));
    }
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.putImageData(imgData, 0, 0);
  return out;
}

function upscaleCanvas(
  source: HTMLCanvasElement,
  scale: number
): HTMLCanvasElement {
  const w = source.width * scale;
  const h = source.height * scale;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return c;
}

/* ================================================
   COMPONENT
   ================================================ */

export default function AIUpscaler() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    name: string;
  } | null>(null);

  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImage = useCallback((file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setUploadedFile(null);

      if (!file.type.startsWith("image/")) {
        setError("Lütfen JPG veya PNG dosyası seçin.");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError("Dosya boyutu 15MB'dan küçük olmalıdır.");
        return;
      }

      try {
        const img = await loadImage(file);
        setUploadedFile({
          dataUrl: img.src,
          width: img.width,
          height: img.height,
          name: file.name,
        });
      } catch {
        setError("Görsel yüklenemedi.");
      }
    },
    [loadImage]
  );

  const processUpscale = useCallback(
    async (scale: 2 | 4) => {
      if (!uploadedFile) return;

      setIsProcessing(true);
      setError(null);
      cancelRef.current = false;

      try {
        // Yield to UI
        await new Promise((r) => setTimeout(r, 50));

        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = uploadedFile.dataUrl;
        });

        if (cancelRef.current) return;

        // Limit input size for 4x
        let w = img.width;
        let h = img.height;
        const maxInput = scale === 4 ? 1024 : 2048;
        if (Math.max(w, h) > maxInput) {
          const s = maxInput / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }

        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = w;
        srcCanvas.height = h;
        srcCanvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

        if (cancelRef.current) return;

        // Step 1: Upscale
        let canvas = upscaleCanvas(srcCanvas, scale);

        if (cancelRef.current) return;
        await new Promise((r) => setTimeout(r, 10));

        // Step 2: Sharpen (multi-pass for quality)
        if (scale === 4) {
          canvas = unsharpMask(canvas, 2, 0.6);
          await new Promise((r) => setTimeout(r, 10));
          if (cancelRef.current) return;
          canvas = unsharpMask(canvas, 1, 0.3);
        } else {
          canvas = unsharpMask(canvas, 1.5, 0.5);
        }

        if (cancelRef.current) return;
        await new Promise((r) => setTimeout(r, 10));

        // Step 3: Auto levels
        canvas = autoLevels(canvas);

        if (cancelRef.current) return;

        const originalSize = `${w} x ${h}`;
        const newSize = `${canvas.width} x ${canvas.height}`;

        setResult({
          original: srcCanvas.toDataURL("image/jpeg", 0.9),
          processed: canvas.toDataURL("image/png"),
          scale,
          originalSize,
          newSize,
        });
      } catch {
        if (!cancelRef.current) setError("İşlem sırasında hata oluştu.");
      } finally {
        setIsProcessing(false);
      }
    },
    [uploadedFile]
  );

  const download = useCallback(
    (format: "jpg" | "png") => {
      if (!result) return;
      const link = document.createElement("a");
      link.download = `kalite-artir-${result.scale}x-${Date.now()}.${format}`;

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
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const reset = useCallback(() => {
    cancelRef.current = true;
    setResult(null);
    setUploadedFile(null);
    setError(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ===== RENDER ===== */
  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={reset} className="text-xs text-red-500 underline mt-1">
            Tekrar Dene
          </button>
        </div>
      )}

      {/* ---- Upload ---- */}
      {!uploadedFile && !result && !isProcessing && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-primary-500 bg-primary-50"
              : "border-navy-300 hover:border-primary-400 hover:bg-navy-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          <div className="w-12 h-12 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-navy-700">{isDragging ? "Bırakın!" : "Fotoğraf Yükle"}</p>
          <p className="text-xs text-navy-400 mt-1">Sürükle-bırak veya tıkla</p>
          <p className="text-[10px] text-navy-300 mt-2">JPG, PNG &bull; Max 15 MB</p>
        </div>
      )}

      {/* ---- Preview + Scale Buttons ---- */}
      {uploadedFile && !result && !isProcessing && (
        <div className="space-y-3">
          <div className="bg-navy-50 rounded-lg overflow-hidden">
            <img
              src={uploadedFile.dataUrl}
              alt="Yüklenen"
              className="w-full max-h-40 object-contain"
            />
          </div>
          <div className="text-center">
            <p className="text-xs text-navy-500 truncate">{uploadedFile.name}</p>
            <p className="text-[11px] text-navy-400">
              {uploadedFile.width} x {uploadedFile.height} piksel
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => processUpscale(2)}
              className="py-3 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 rounded-lg transition-colors"
            >
              2x Kalite Artır
            </button>
            <button
              onClick={() => processUpscale(4)}
              className="py-3 text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 hover:from-fuchsia-600 hover:to-fuchsia-700 rounded-lg transition-colors"
            >
              4x Kalite Artır
            </button>
          </div>
          <button
            onClick={reset}
            className="w-full py-1.5 text-xs text-navy-500 hover:text-navy-700 transition-colors"
          >
            Farklı fotoğraf seç
          </button>
        </div>
      )}

      {/* ---- Processing ---- */}
      {isProcessing && (
        <div className="text-center py-10">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-navy-600 font-medium">Kalite artırılıyor...</p>
          <p className="text-[11px] text-navy-400 mt-1">Bu işlem birkaç saniye sürebilir</p>
          <button
            onClick={() => {
              cancelRef.current = true;
              setIsProcessing(false);
            }}
            className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
          >
            İptal
          </button>
        </div>
      )}

      {/* ---- Result ---- */}
      {result && !isProcessing && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-navy-500 mb-1 text-center font-medium">Önce</p>
              <div className="bg-navy-100 rounded-lg overflow-hidden aspect-square flex items-center justify-center">
                <img src={result.original} alt="Orijinal" className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-[10px] text-navy-400 text-center mt-1">{result.originalSize}</p>
            </div>
            <div>
              <p className="text-[11px] text-navy-500 mb-1 text-center font-medium">
                Sonra ({result.scale}x)
              </p>
              <div className="bg-navy-100 rounded-lg overflow-hidden aspect-square flex items-center justify-center">
                <img src={result.processed} alt="İşlenmiş" className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-[10px] text-navy-400 text-center mt-1">{result.newSize}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => download("jpg")}
              className="py-2.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-colors"
            >
              JPG İndir
            </button>
            <button
              onClick={() => download("png")}
              className="py-2.5 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg transition-colors"
            >
              PNG İndir
            </button>
          </div>

          <button
            onClick={reset}
            className="w-full py-2 text-xs font-medium text-navy-600 bg-navy-100 hover:bg-navy-200 rounded-lg transition-colors"
          >
            Yeni Fotoğraf
          </button>
        </div>
      )}
    </div>
  );
}
