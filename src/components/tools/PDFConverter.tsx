"use client";

import { useState, useRef, useCallback } from "react";

interface ConvertedPage {
  pageNum: number;
  blob: Blob;
  previewUrl: string;
}

type Format = "jpg" | "png";
type Mode = "fast" | "quality";

let pdfjsInitialized = false;

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");

  if (!pdfjsInitialized) {
    // Worker dosyası public/ klasöründen yükleniyor (same-origin, güvenilir)
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    } catch {
      // Worker yüklenemezse fake worker kullan (ana thread'de çalışır)
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }
    pdfjsInitialized = true;
  }

  return pdfjsLib;
}

export default function PDFConverter() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pdfInfo, setPdfInfo] = useState<{ name: string; pages: number } | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  const [format, setFormat] = useState<Format>("jpg");
  const [mode, setMode] = useState<Mode>("quality");

  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [convertedPages, setConvertedPages] = useState<ConvertedPage[]>([]);

  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setPdfInfo(null);
    setPdfData(null);
    setConvertedPages([]);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Lütfen PDF dosyası seçin.");
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      setError("Dosya boyutu 150MB'dan küçük olmalıdır.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const pdfjsLib = await loadPdfJs();

      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      const pdf = "promise" in loadingTask
        ? await (loadingTask as any).promise
        : await loadingTask;

      setPdfInfo({ name: file.name, pages: pdf.numPages });
      setPdfData(uint8);
    } catch (err) {
      console.error("PDF yükleme hatası:", err);
      setError("PDF dosyası okunamadı. Dosyanın geçerli bir PDF olduğundan emin olun.");
    }
  }, []);

  const startConversion = useCallback(async () => {
    if (!pdfData) return;

    setIsProcessing(true);
    setConvertedPages([]);
    cancelRef.current = false;

    try {
      const pdfjsLib = await loadPdfJs();
      // pdfjs v5 ArrayBuffer'ı transfer edebilir, kopyasını gönder
      const dataCopy = new Uint8Array(pdfData);
      const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
      const pdf = "promise" in loadingTask
        ? await (loadingTask as any).promise
        : await loadingTask;

      const totalPages = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const pages: ConvertedPage[] = [];
      const scale = mode === "fast" ? 1.5 : 2;
      const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
      const quality = format === "jpg" ? 0.92 : undefined;

      for (let i = 1; i <= totalPages; i++) {
        if (cancelRef.current) break;

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        // Her sayfa için yeni canvas (pdfjs v5 uyumluluğu)
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;

        if (format === "jpg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // pdfjs v5: render parametreleri
        const renderParams: any = { canvasContext: ctx, viewport };
        try {
          // v5 canvas parametresi gerektirir
          renderParams.canvas = canvas;
        } catch { /* ignore */ }

        const renderTask = page.render(renderParams);
        // v4: renderTask.promise, v5: renderTask doğrudan awaitable
        try {
          if (renderTask && typeof renderTask === "object" && "promise" in renderTask) {
            await (renderTask as any).promise;
          } else {
            await renderTask;
          }
        } catch {
          // Fallback: canvas olmadan tekrar dene
          const canvas2 = document.createElement("canvas");
          canvas2.width = viewport.width;
          canvas2.height = viewport.height;
          const ctx2 = canvas2.getContext("2d")!;
          if (format === "jpg") { ctx2.fillStyle = "#FFFFFF"; ctx2.fillRect(0, 0, canvas2.width, canvas2.height); }
          const rt2 = page.render({ canvasContext: ctx2, viewport } as any);
          if (rt2 && typeof rt2 === "object" && "promise" in rt2) { await (rt2 as any).promise; } else { await rt2; }
          // Fallback canvas kullan
          const fallbackBlob = await new Promise<Blob>((resolve) => { canvas2.toBlob((b) => resolve(b!), mimeType, quality); });
          const previewUrl = URL.createObjectURL(fallbackBlob);
          pages.push({ pageNum: i, blob: fallbackBlob, previewUrl });
          setProgress({ current: i, total: totalPages });
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), mimeType, quality);
        });

        const previewUrl = URL.createObjectURL(blob);
        pages.push({ pageNum: i, blob, previewUrl });

        setProgress({ current: i, total: totalPages });
        await new Promise((r) => setTimeout(r, 10));
      }

      if (!cancelRef.current) {
        setConvertedPages(pages);
      } else {
        pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      }
    } catch (err: any) {
      console.error("PDF dönüştürme hatası:", err);
      const msg = err?.message || String(err);
      if (!cancelRef.current) setError(`Dönüştürme hatası: ${msg.slice(0, 120)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfData, format, mode]);

  const downloadAll = useCallback(async () => {
    if (convertedPages.length === 0) return;

    const ext = format;

    if (convertedPages.length === 1) {
      const link = document.createElement("a");
      link.download = `sayfa-1.${ext}`;
      link.href = URL.createObjectURL(convertedPages[0].blob);
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    convertedPages.forEach((p) => {
      zip.file(`sayfa-${p.pageNum}.${ext}`, p.blob);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.download = "pdf-images.zip";
    link.href = URL.createObjectURL(content);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [convertedPages, format]);

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
    convertedPages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setConvertedPages([]);
    setPdfInfo(null);
    setPdfData(null);
    setError(null);
    setIsProcessing(false);
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [convertedPages]);

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={reset} className="text-xs text-red-500 underline mt-1">Tekrar Dene</button>
        </div>
      )}

      {!pdfInfo && !isProcessing && convertedPages.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging ? "border-primary-500 bg-primary-50" : "border-navy-300 hover:border-primary-400 hover:bg-navy-50"
          }`}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-navy-700">{isDragging ? "Bırakın!" : "PDF Yükle"}</p>
          <p className="text-xs text-navy-400 mt-1">Sürükle-bırak veya tıkla</p>
          <p className="text-[10px] text-navy-300 mt-2">Sadece PDF &bull; Max 150 MB</p>
        </div>
      )}

      {pdfInfo && !isProcessing && convertedPages.length === 0 && (
        <div className="space-y-3">
          <div className="bg-navy-50 rounded-lg p-3 border border-navy-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-800 truncate">{pdfInfo.name}</p>
                <p className="text-[11px] text-navy-500">{pdfInfo.pages} sayfa</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-navy-600 mb-1.5">Format</p>
            <div className="grid grid-cols-2 gap-2">
              {(["jpg", "png"] as Format[]).map((f) => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`py-2 text-xs font-medium rounded-lg border-2 transition-colors ${
                    format === f ? "border-primary-500 bg-primary-50 text-primary-700" : "border-navy-200 text-navy-500 hover:border-navy-300"
                  }`}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-navy-600 mb-1.5">Kalite</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode("fast")}
                className={`py-2 text-xs font-medium rounded-lg border-2 transition-colors ${
                  mode === "fast" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-navy-200 text-navy-500 hover:border-navy-300"
                }`}>Hızlı</button>
              <button onClick={() => setMode("quality")}
                className={`py-2 text-xs font-medium rounded-lg border-2 transition-colors ${
                  mode === "quality" ? "border-green-400 bg-green-50 text-green-700" : "border-navy-200 text-navy-500 hover:border-navy-300"
                }`}>Kaliteli</button>
            </div>
          </div>
          <button onClick={startConversion}
            className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-lg transition-colors">
            Dönüştürmeyi Başlat
          </button>
          <button onClick={reset} className="w-full py-1.5 text-xs text-navy-500 hover:text-navy-700 transition-colors">
            Farklı PDF seç
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-navy-600 font-medium">Dönüştürülüyor...</p>
          <p className="text-lg font-bold text-navy-800 mt-1">{progress.current} / {progress.total}</p>
          <div className="w-full bg-navy-200 rounded-full h-2 mt-3 max-w-[200px] mx-auto">
            <div className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
          </div>
          <button onClick={() => { cancelRef.current = true; }}
            className="mt-3 text-xs text-red-500 hover:text-red-700 underline">İptal</button>
        </div>
      )}

      {convertedPages.length > 0 && !isProcessing && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-green-700">{convertedPages.length} sayfa dönüştürüldü</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
            {convertedPages.slice(0, 9).map((p) => (
              <div key={p.pageNum} className="relative bg-navy-100 rounded overflow-hidden aspect-[3/4]">
                <img src={p.previewUrl} alt={`Sayfa ${p.pageNum}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 bg-black/50 text-white text-[9px] px-1 rounded-tl">{p.pageNum}</span>
              </div>
            ))}
            {convertedPages.length > 9 && (
              <div className="bg-navy-100 rounded flex items-center justify-center aspect-[3/4]">
                <p className="text-xs text-navy-500">+{convertedPages.length - 9}</p>
              </div>
            )}
          </div>
          <button onClick={downloadAll}
            className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg transition-colors">
            {convertedPages.length > 1 ? "ZIP Olarak İndir" : `${format.toUpperCase()} İndir`}
          </button>
          <button onClick={reset} className="w-full py-2 text-xs font-medium text-navy-600 bg-navy-100 hover:bg-navy-200 rounded-lg transition-colors">
            Yeni PDF
          </button>
        </div>
      )}
    </div>
  );
}
