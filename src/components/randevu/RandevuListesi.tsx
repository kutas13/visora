"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, Button, Badge } from "@/components/ui";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { STAFF_USERS, ADMIN_USER, MUHASEBE_USER } from "@/lib/constants";
import { uploadMultipleToStorage } from "@/lib/supabase/storage";
import type { RandevuTalebi, HesapBilgileri } from "@/lib/supabase/types";

const SCHENGEN_ULKELERI = [
  "Fransa", "Hollanda", "Bulgaristan", "İtalya",
  "Almanya", "İspanya", "Avusturya", "Belçika", "Portekiz",
  "Yunanistan", "İsviçre", "Polonya", "Çekya", "Macaristan",
  "Danimarka", "İsveç", "Norveç", "Finlandiya", "Estonya",
  "Letonya", "Litvanya", "Slovenya", "Slovakya", "Hırvatistan",
  "Malta", "Lüksemburg", "İzlanda", "Liechtenstein",
];

const VIZE_TIPLERI = [
  { value: "turistik", label: "Turistik" },
  { value: "ticari", label: "Ticari" },
  { value: "ogrenci", label: "Öğrenci" },
  { value: "konferans", label: "Konferans" },
  { value: "aile", label: "Aile" },
  { value: "arkadas", label: "Arkadaş" },
];

const ALT_KATEGORILER = [
  { value: "ilk_vize", label: "İlk Vize" },
  { value: "multi_vize", label: "Son 2 Yıl İçinde Geçerli Olan Vize (Multi)" },
];

const ULKE_RENKLERI: Record<string, { bg: string; text: string }> = {
  "Fransa": { bg: "linear-gradient(135deg, #002395 0%, #002395 33%, #FFFFFF 33%, #FFFFFF 66%, #ED2939 66%, #ED2939 100%)", text: "text-white" },
  "Hollanda": { bg: "linear-gradient(180deg, #AE1C28 0%, #AE1C28 33%, #FFFFFF 33%, #FFFFFF 66%, #21468B 66%, #21468B 100%)", text: "text-white" },
  "Bulgaristan": { bg: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 33%, #00966E 33%, #00966E 66%, #D62612 66%, #D62612 100%)", text: "text-gray-800" },
  "İtalya": { bg: "linear-gradient(135deg, #009246 0%, #009246 33%, #FFFFFF 33%, #FFFFFF 66%, #CE2B37 66%, #CE2B37 100%)", text: "text-white" },
  "Almanya": { bg: "linear-gradient(180deg, #000000 0%, #000000 33%, #DD0000 33%, #DD0000 66%, #FFCE00 66%, #FFCE00 100%)", text: "text-white" },
  "İspanya": { bg: "linear-gradient(180deg, #AA151B 0%, #AA151B 25%, #F1BF00 25%, #F1BF00 75%, #AA151B 75%, #AA151B 100%)", text: "text-white" },
  "Avusturya": { bg: "linear-gradient(180deg, #ED2939 0%, #ED2939 33%, #FFFFFF 33%, #FFFFFF 66%, #ED2939 66%, #ED2939 100%)", text: "text-white" },
  "Belçika": { bg: "linear-gradient(135deg, #000000 0%, #000000 33%, #FAE042 33%, #FAE042 66%, #ED2939 66%, #ED2939 100%)", text: "text-yellow-300" },
  "Portekiz": { bg: "linear-gradient(135deg, #006600 0%, #006600 40%, #FF0000 40%, #FF0000 100%)", text: "text-white" },
  "Yunanistan": { bg: "linear-gradient(180deg, #0D5EAF 0%, #0D5EAF 50%, #FFFFFF 50%, #FFFFFF 100%)", text: "text-white" },
  "İsviçre": { bg: "linear-gradient(135deg, #FF0000 0%, #FF0000 100%)", text: "text-white" },
  "Polonya": { bg: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 50%, #DC143C 50%, #DC143C 100%)", text: "text-red-700" },
  "Çekya": { bg: "linear-gradient(135deg, #11457E 0%, #11457E 50%, #D7141A 50%, #D7141A 100%)", text: "text-white" },
  "Macaristan": { bg: "linear-gradient(180deg, #CE2939 0%, #CE2939 33%, #FFFFFF 33%, #FFFFFF 66%, #477050 66%, #477050 100%)", text: "text-white" },
  "Danimarka": { bg: "linear-gradient(135deg, #C8102E 0%, #C8102E 100%)", text: "text-white" },
  "İsveç": { bg: "linear-gradient(135deg, #006AA7 0%, #006AA7 100%)", text: "text-yellow-300" },
  "Norveç": { bg: "linear-gradient(135deg, #BA0C2F 0%, #BA0C2F 40%, #00205B 40%, #00205B 100%)", text: "text-white" },
  "Finlandiya": { bg: "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, #003580 50%, #003580 100%)", text: "text-blue-800" },
  "Hırvatistan": { bg: "linear-gradient(180deg, #FF0000 0%, #FF0000 33%, #FFFFFF 33%, #FFFFFF 66%, #171796 66%, #171796 100%)", text: "text-white" },
  "Malta": { bg: "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, #CF142B 50%, #CF142B 100%)", text: "text-red-700" },
  "Slovenya": { bg: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 33%, #003DA5 33%, #003DA5 66%, #ED1C24 66%, #ED1C24 100%)", text: "text-white" },
  "Slovakya": { bg: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 33%, #0B4EA2 33%, #0B4EA2 66%, #EE1C25 66%, #EE1C25 100%)", text: "text-white" },
  "Lüksemburg": { bg: "linear-gradient(180deg, #ED2939 0%, #ED2939 33%, #FFFFFF 33%, #FFFFFF 66%, #00A1DE 66%, #00A1DE 100%)", text: "text-white" },
  "İzlanda": { bg: "linear-gradient(135deg, #003897 0%, #003897 50%, #D72828 50%, #D72828 100%)", text: "text-white" },
  "Estonya": { bg: "linear-gradient(180deg, #0072CE 0%, #0072CE 33%, #000000 33%, #000000 66%, #FFFFFF 66%, #FFFFFF 100%)", text: "text-white" },
  "Letonya": { bg: "linear-gradient(180deg, #9E3039 0%, #9E3039 40%, #FFFFFF 40%, #FFFFFF 60%, #9E3039 60%, #9E3039 100%)", text: "text-white" },
  "Litvanya": { bg: "linear-gradient(180deg, #FDB913 0%, #FDB913 33%, #006A44 33%, #006A44 66%, #C1272D 66%, #C1272D 100%)", text: "text-white" },
  "Liechtenstein": { bg: "linear-gradient(180deg, #002B7F 0%, #002B7F 50%, #CE1126 50%, #CE1126 100%)", text: "text-white" },
};

const AVATAR_MAP: Record<string, string> = {
  DAVUT: "/davut-avatar.png",
  BAHAR: "/bahar-avatar.jpg",
  ERCAN: "/ercan-avatar.png",
  YUSUF: "/yusuf-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ZAFER: "/zafer-avatar.png",
};

const WP_NUMARALARI = [
  { name: "DAVUT", phone: "905435680874" },
  { name: "BAHAR", phone: "905055623279" },
  { name: "ERCAN", phone: "905055623301" },
  { name: "YUSUF", phone: "905058937071" },
  { name: "SIRRI", phone: "905078015033" },
  { name: "ZAFER", phone: "905363434444" },
];

interface RandevuRow extends RandevuTalebi {
  profiles: { name: string } | null;
  randevu_alan: { name: string } | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function normalizePhone(raw: string) {
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "90" + phone.slice(1);
  if (!phone.startsWith("90")) phone = "90" + phone;
  return "+" + phone;
}

// ─── Fullscreen Image Viewer ────────────────────────────────────────────
function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `gorsel-${Date.now()}.png`;
    a.click();
  };

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", keyHandler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keyHandler); document.body.style.overflow = "unset"; };
  }, [onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7, 10];
    setZoom(prev => {
      const curIdx = steps.reduce((best, s, i) => Math.abs(s - prev) < Math.abs(steps[best] - prev) ? i : best, 0);
      const nextIdx = e.deltaY < 0 ? Math.min(curIdx + 1, steps.length - 1) : Math.max(curIdx - 1, 0);
      const next = steps[nextIdx];
      if (next <= 1) setPos({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return;
    e.stopPropagation();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  const resetZoom = useCallback(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => { if (zoom <= 1) onClose(); }}>
      {/* Download */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
        className="absolute top-4 left-4 z-10 w-11 h-11 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white transition-colors"
        title="İndir"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
      {/* Zoom info + reset */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
          {Math.round(zoom * 100)}%
        </span>
        {zoom !== 1 && (
          <button onClick={(e) => { e.stopPropagation(); resetZoom(); }}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm transition-colors">
            Sıfırla
          </button>
        )}
      </div>
      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 w-11 h-11 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white transition-colors"
        title="Kapat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Image */}
      <img
        src={src}
        alt="Görsel"
        className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl select-none"
        style={{ transform: `scale(${zoom}) translate(${pos.x / zoom}px, ${pos.y / zoom}px)`, cursor: zoom > 1 ? "grab" : "zoom-in", transition: dragging.current ? "none" : "transform 0.15s ease-out" }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); zoom === 1 ? setZoom(2.5) : resetZoom(); }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        draggable={false}
      />
    </div>
  );
}

// ─── Country Selector with Search ───────────────────────────────────────
function CountrySelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? SCHENGEN_ULKELERI.filter(u => u.toLowerCase().includes(search.toLowerCase()))
    : SCHENGEN_ULKELERI;

  return (
    <div>
      <label className="block text-sm font-bold text-navy-700 mb-2">Ülkeler *</label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Ülke ara..."
        className="w-full px-4 py-2 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all mb-2 text-sm"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-3 bg-navy-50 rounded-xl border border-navy-200">
        {filtered.map((ulke) => (
          <label key={ulke} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${selected.includes(ulke) ? "bg-primary-100 text-primary-700 font-medium" : "hover:bg-navy-100 text-navy-600"}`}>
            <input
              type="checkbox"
              checked={selected.includes(ulke)}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, ulke]);
                else onChange(selected.filter(u => u !== ulke));
              }}
              className="rounded border-navy-300 text-primary-500 focus:ring-primary-500"
            />
            {ulke}
          </label>
        ))}
        {filtered.length === 0 && <p className="text-sm text-navy-400 col-span-4 text-center py-2">Sonuç bulunamadı</p>}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map(u => (
            <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              {u}
              <button onClick={() => onChange(selected.filter(x => x !== u))} className="hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Account Fields for Spain/Italy ─────────────────────────────────────
function HesapAlanlari({
  ulke,
  hesapBilgileri,
  onChange,
  gorseller,
}: {
  ulke: "İspanya" | "İtalya";
  hesapBilgileri: HesapBilgileri | undefined;
  onChange: (val: HesapBilgileri) => void;
  gorseller?: string[];
}) {
  const info = hesapBilgileri || { hesap_var: false };
  const isItalya = ulke === "İtalya";

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{isItalya ? "🇮🇹" : "🇪🇸"}</span>
        <p className="font-bold text-navy-800 text-sm">{ulke} Hesap Bilgileri</p>
      </div>

      <div>
        <p className="text-sm font-medium text-navy-700 mb-2">Hesap açtınız mı?</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange({ ...info, hesap_var: true })}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${info.hesap_var ? "bg-green-600 text-white shadow-lg" : "bg-white text-navy-600 border border-navy-200 hover:bg-navy-50"}`}>
            Evet
          </button>
          <button type="button" onClick={() => onChange({ hesap_var: false })}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!info.hesap_var ? "bg-red-500 text-white shadow-lg" : "bg-white text-navy-600 border border-navy-200 hover:bg-navy-50"}`}>
            Hayır
          </button>
        </div>
      </div>

      {!info.hesap_var && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-xl p-3 flex items-start gap-2">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="font-bold text-yellow-800 text-sm">{ulke} hesabı henüz açılmamış!</p>
            <p className="text-yellow-700 text-xs mt-0.5">Kayıt sonrası oluşturan kişiye 3 günde bir hatırlatma gönderilecektir.</p>
          </div>
        </div>
      )}

      {info.hesap_var && gorseller && gorseller.length > 0 && (
        <div className="space-y-3">
          {gorseller.map((g, i) => {
            const gorselBilgi = info.gorsel_bilgileri?.[i] || {};
            const updateGorselBilgi = (field: string, val: string) => {
              const newBilgiler = [...(info.gorsel_bilgileri || [])];
              while (newBilgiler.length <= i) newBilgiler.push({});
              newBilgiler[i] = { ...newBilgiler[i], [field]: val };
              onChange({ ...info, gorsel_bilgileri: newBilgiler });
            };
            return (
              <div key={i} className="bg-white/80 rounded-lg p-3 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <img src={g} alt={`Pasaport ${i + 1}`} className="w-10 h-10 rounded object-cover border" />
                  <p className="text-xs font-bold text-navy-700">Pasaport {i + 1} - {ulke} Hesap Bilgileri</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-navy-500 mb-0.5">Hesap Maili</label>
                    <input type="email" value={gorselBilgi.email || ""} onChange={(e) => updateGorselBilgi("email", e.target.value)}
                      placeholder="E-posta" className="w-full px-2 py-1.5 rounded-lg border border-navy-200 text-xs focus:border-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-navy-500 mb-0.5">Şifre</label>
                    <input type="text" value={gorselBilgi.sifre || ""} onChange={(e) => updateGorselBilgi("sifre", e.target.value)}
                      placeholder="Şifre" className="w-full px-2 py-1.5 rounded-lg border border-navy-200 text-xs focus:border-primary-500 outline-none" />
                  </div>
                  {isItalya && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-navy-500 mb-0.5">IT Numarası</label>
                        <input type="text" value={gorselBilgi.it_numarasi || ""} onChange={(e) => updateGorselBilgi("it_numarasi", e.target.value)}
                          placeholder="IT numarası" className="w-full px-2 py-1.5 rounded-lg border border-navy-200 text-xs focus:border-primary-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-navy-500 mb-0.5">Telefon</label>
                        <input type="text" value={gorselBilgi.telefon || ""} onChange={(e) => updateGorselBilgi("telefon", e.target.value)}
                          placeholder="Hesap telefonu" className="w-full px-2 py-1.5 rounded-lg border border-navy-200 text-xs focus:border-primary-500 outline-none" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {info.hesap_var && (!gorseller || gorseller.length === 0) && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
          Görsel yükledikten sonra her görsel için hesap bilgilerini girebilirsiniz.
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function RandevuListesi() {
  const [talepler, setTalepler] = useState<RandevuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRandevuAlModal, setShowRandevuAlModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTalep, setSelectedTalep] = useState<RandevuRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [isSirri, setIsSirri] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUlke, setFilterUlke] = useState("");
  const [detailGorseller, setDetailGorseller] = useState<string[]>([]);
  const [detailDosyalar, setDetailDosyalar] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form
  const [formUlkeler, setFormUlkeler] = useState<string[]>([]);
  const [formVizeTipi, setFormVizeTipi] = useState("");
  const [formAltKategori, setFormAltKategori] = useState("");
  const [formDosyaAdi, setFormDosyaAdi] = useState("");
  const [formIletisim, setFormIletisim] = useState("");
  const [formGorseller, setFormGorseller] = useState<string[]>([]);
  const [formNot, setFormNot] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Spain/Italy account fields
  const [formHesapBilgileri, setFormHesapBilgileri] = useState<Record<string, HesapBilgileri>>({});
  const [editHesapBilgileri, setEditHesapBilgileri] = useState<Record<string, HesapBilgileri>>({});

  // Randevu al
  const [randevuTarihi, setRandevuTarihi] = useState("");
  const [randevuDosyalari, setRandevuDosyalari] = useState<string[]>([]);
  const [randevuUlke, setRandevuUlke] = useState("");
  const [randevuSaving, setRandevuSaving] = useState(false);

  // Edit form
  const [editUlkeler, setEditUlkeler] = useState<string[]>([]);
  const [editVizeTipi, setEditVizeTipi] = useState("");
  const [editAltKategori, setEditAltKategori] = useState("");
  const [editDosyaAdi, setEditDosyaAdi] = useState("");
  const [editIletisim, setEditIletisim] = useState("");
  const [editNot, setEditNot] = useState("");
  const [editGorseller, setEditGorseller] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const showAltKategori = (ulkeler: string[], vizeTipi: string) =>
    ulkeler.includes("Fransa") && vizeTipi === "turistik";

  const needsHesap = (ulkeler: string[]) => ({
    ispanya: ulkeler.includes("İspanya"),
    italya: ulkeler.includes("İtalya"),
  });

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", user.id)
      .single();

    if (profile) {
      setCurrentUser({ id: profile.id, name: profile.name });
      setIsSirri(profile.name === "SIRRI");
    }

    const { data, error } = await supabase
      .from("randevu_talepleri")
      .select("id, ulkeler, vize_tipi, alt_kategori, dosya_adi, iletisim, randevu_tarihi, randevu_alan_id, hesap_bilgileri, notlar, arsivlendi, created_by, created_at, updated_at, profiles:created_by(name), randevu_alan:randevu_alan_id(name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTalepler(data as unknown as RandevuRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadTalepDetail = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("randevu_talepleri")
      .select("gorseller, randevu_dosyalari")
      .eq("id", id)
      .single();
    return data as { gorseller: string[] | null; randevu_dosyalari: string[] | null } | null;
  }, []);

  const resetCreateForm = () => {
    setFormUlkeler([]); setFormVizeTipi(""); setFormAltKategori("");
    setFormDosyaAdi(""); setFormIletisim(""); setFormGorseller([]);
    setFormNot(""); setFormHesapBilgileri({});
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string[] | ((prev: string[]) => string[])) => void
  ) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) setter((prev: string[]) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleCreate = async () => {
    if (!formDosyaAdi || !formIletisim || formUlkeler.length === 0 || !formVizeTipi) return;
    setFormSaving(true);
    try {
      const gorselUrls = formGorseller.length > 0
        ? await uploadMultipleToStorage(formGorseller, "randevu-pasaport")
        : [];

      const hesapData = Object.keys(formHesapBilgileri).length > 0 ? formHesapBilgileri : null;

      const supabase = createClient();
      const { error } = await supabase.from("randevu_talepleri").insert({
        ulkeler: formUlkeler,
        vize_tipi: formVizeTipi,
        alt_kategori: showAltKategori(formUlkeler, formVizeTipi) ? (formAltKategori || null) : null,
        dosya_adi: formDosyaAdi,
        iletisim: formIletisim,
        gorseller: gorselUrls,
        hesap_bilgileri: hesapData,
        notlar: formNot.trim() || null,
        created_by: currentUser?.id || null,
      });
      if (!error) {
        const vizeTipiLabel = VIZE_TIPLERI.find(v => v.value === formVizeTipi)?.label || formVizeTipi;
        const ulkelerStr = formUlkeler.join(", ");
        const wpMsg =
          `📋 *Yeni Randevu Talebi*\n\n` +
          `👤 Dosya: *${formDosyaAdi}*\n` +
          `🌍 Ülke: *${ulkelerStr}*\n` +
          `📋 Vize Tipi: *${vizeTipiLabel}*\n` +
          (formNot.trim() ? `📝 Not: ${formNot.trim()}\n` : ``) +
          `👤 Oluşturan: *${currentUser?.name || "-"}*\n\n` +
          `_Fox Turizm Randevu Takip Sistemi_`;

        const davutPhone = "+905435680874";
        const zaferPhone = "+905363434444";
        sendWpMsg(davutPhone, wpMsg).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
        sendWpMsg(zaferPhone, wpMsg).catch(() => {});

        // Oluşturana da mesaj gönder
        if (currentUser?.name) {
          const olusturanWp = WP_NUMARALARI.find(w => w.name === currentUser.name);
          if (olusturanWp && olusturanWp.phone !== "905435680874" && olusturanWp.phone !== "905363434444") {
            await new Promise(r => setTimeout(r, 1000));
            sendWpMsg("+" + olusturanWp.phone, wpMsg).catch(() => {});
          }
        }

        setShowCreateModal(false);
        resetCreateForm();
        loadData();
      }
    } finally {
      setFormSaving(false);
    }
  };

  const sendWpMsg = async (phone: string, message: string) => {
    try {
      await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });
    } catch { /* sessiz */ }
  };

  const sendWpImage = async (phone: string, image: string, caption?: string) => {
    try {
      await fetch("/api/whatsapp/send-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, image, caption: caption || "" }),
      });
    } catch { /* sessiz */ }
  };

  const handleRandevuAl = async () => {
    if (!selectedTalep || !randevuTarihi || !currentUser) return;
    setRandevuSaving(true);
    try {
      const dosyaUrls = randevuDosyalari.length > 0
        ? await uploadMultipleToStorage(randevuDosyalari, "randevu-mektubu")
        : [];

      const supabase = createClient();
      const { error } = await supabase
        .from("randevu_talepleri")
        .update({
          randevu_tarihi: randevuTarihi,
          randevu_alan_id: currentUser.id,
          randevu_dosyalari: dosyaUrls,
          arsivlendi: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTalep.id);

      if (!error) {
        const allStaff = [...STAFF_USERS, ADMIN_USER, MUHASEBE_USER];
        const staffInfo = allStaff.find(s => s.name.toUpperCase() === currentUser.name.toUpperCase());
        const staffHitap = staffInfo?.hitap || currentUser.name;
        const staffPhone = staffInfo?.phone || "";
        const ulkelerStr = randevuUlke || selectedTalep.ulkeler.join(", ");
        const vizeTipiLabel = VIZE_TIPLERI.find(v => v.value === selectedTalep.vize_tipi)?.label || selectedTalep.vize_tipi;
        const randevuStr = new Date(randevuTarihi).toLocaleDateString("tr-TR", {
          day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
        });

        // Email
        try {
          await fetch("/api/randevu-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dosyaAdi: selectedTalep.dosya_adi,
              ulkeler: selectedTalep.ulkeler,
              vizeTipi: vizeTipiLabel,
              randevuTarihi,
              alanKisi: currentUser.name,
            }),
          });
        } catch { /* sessiz */ }

        // Hedef kişileri belirle: müşteri + davut + zafer + oluşturan + alan
        const musteriPhone = normalizePhone(selectedTalep.iletisim);
        const davutPhone = "+905435680874";
        const zaferPhone = "+905363434444";
        const olusturanName = selectedTalep.profiles?.name || "";
        const alanName = currentUser.name;
        const ekipPhones = new Set<string>();
        ekipPhones.add(davutPhone);
        ekipPhones.add(zaferPhone);
        for (const wp of WP_NUMARALARI) {
          if (wp.name === olusturanName || wp.name === alanName) {
            ekipPhones.add("+" + wp.phone);
          }
        }

        // 1) Pasaport görselleri müşteriye gönder - lazy load
        const detail = await loadTalepDetail(selectedTalep.id);
        const pasaportlar = detail?.gorseller || [];
        for (const gorsel of pasaportlar) {
          await sendWpImage(musteriPhone, gorsel);
          await new Promise(r => setTimeout(r, 1500));
        }

        // 2) "Üsteki pasaportlara randevu alınmıştır" mesajı
        if (pasaportlar.length > 0) {
          await sendWpMsg(musteriPhone, `Üsteki pasaportlara randevu alınmıştır. ✅`);
          await new Promise(r => setTimeout(r, 1000));
        }

        // 3) Randevu mektubu görselleri müşteriye gönder
        for (const dosya of dosyaUrls) {
          await sendWpImage(musteriPhone, dosya, "Randevu Mektubunuz");
          await new Promise(r => setTimeout(r, 1500));
        }

        // 4) Müşteriye güzel mesaj
        const musteriMsg = [
          `Sayın Müşterimiz,`,
          ``,
          `${ulkelerStr} vize randevunuzla ilgili güzel haberimiz var! 🎉`,
          ``,
          `Randevunuz *başarıyla alınmıştır*. ✅`,
          ``,
          `📅 Randevu Tarihi: *${randevuStr}*`,
          `🌍 Ülke: *${ulkelerStr}*`,
          `📋 Vize Tipi: *${vizeTipiLabel}*`,
          ``,
          `Randevu gününde gerekli evraklarınızla birlikte hazır olmanızı rica ederiz.`,
          ``,
          `📌 Önemli: Randevu tarihinden önce herhangi bir değişiklik olursa tarafınıza bilgi verilecektir.`,
          ``,
          `Bizi tercih ettiğiniz için teşekkür ederiz! 🙏`,
          ``,
          `*Fox Turizm*`,
          `${staffHitap}`,
          staffPhone ? `📞 ${staffPhone}` : ``,
        ].filter(Boolean).join("\n");

        await sendWpMsg(musteriPhone, musteriMsg);

        // 5) Ekip mesajı (Davut + oluşturan + alan)
        const ekipMsg =
          `📋 *RANDEVU ALINDI*\n\n` +
          `👤 Müşteri: *${selectedTalep.dosya_adi}*\n` +
          `🌍 Ülke: *${ulkelerStr}*\n` +
          `📋 Vize Tipi: *${vizeTipiLabel}*\n` +
          `📅 Randevu: *${randevuStr}*\n` +
          `👤 Alan: *${currentUser.name}*\n\n` +
          `_Fox Turizm_`;

        const ekipPhoneList = Array.from(ekipPhones);
        for (const phone of ekipPhoneList) {
          for (const dosya of dosyaUrls) {
            await sendWpImage(phone, dosya, `Randevu Mektubu - ${selectedTalep.dosya_adi}`);
            await new Promise(r => setTimeout(r, 1500));
          }
          await sendWpMsg(phone, ekipMsg);
          await new Promise(r => setTimeout(r, 1000));
        }

        // 6) Randevu tarihi 20 gün içindeyse hemen evrak hatırlatma gönder
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const rTarih = new Date(randevuTarihi);
        rTarih.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((rTarih.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 20 && diffDays >= 0 && musteriPhone) {
          try {
            const evrakBaslangic = new Date(rTarih);
            evrakBaslangic.setDate(evrakBaslangic.getDate() - 15);
            const teslimTarih = new Date(rTarih);
            teslimTarih.setDate(teslimTarih.getDate() - 3);
            const fmtTr = (d: Date) => d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

            const evrakMsg =
              `Sayın Müşterimiz,\n\n` +
              `*${fmtTr(rTarih)}* tarihinde randevunuz bulunmaktadır.\n\n` +
              `Evraklarınızı *${fmtTr(evrakBaslangic)}* tarihinden itibaren hazırlamaya başlamanız gerekmektedir.\n\n` +
              `Evraklarınızın en geç *${fmtTr(teslimTarih)}* tarihine kadar ofisimizde olması gerekmektedir.\n\n` +
              `Gerekli evrak listesi aşağıda gönderilecektir.\n\n` +
              `Fox Turizm Randevu Takip Sistemi`;
            await new Promise(r => setTimeout(r, 2000));
            await sendWpMsg(musteriPhone, evrakMsg);
            await new Promise(r => setTimeout(r, 2000));

            const ULKE_PDF: Record<string, string> = {
              "Fransa": "fransa.pdf", "Hollanda": "hollanda.pdf", "Bulgaristan": "bulgaristan.pdf",
              "İtalya": "italya.pdf", "Almanya": "almanya.pdf", "İspanya": "ispanya.pdf",
              "Avusturya": "avusturya.pdf", "Belçika": "belcika.pdf", "Portekiz": "portekiz.pdf",
              "Yunanistan": "yunanistan.pdf", "İsviçre": "isvicre.pdf", "Polonya": "polonya.pdf",
              "Çekya": "cekya.pdf", "Macaristan": "macaristan.pdf", "Danimarka": "danimarka.pdf",
              "İsveç": "isvec.pdf", "Norveç": "norvec.pdf", "Finlandiya": "finlandiya.pdf",
              "Slovakya": "slovakya.pdf", "Hırvatistan": "hirvatistan.pdf", "Malta": "malta.pdf",
            };
            const evrakUlkeler = randevuUlke ? [randevuUlke] : selectedTalep.ulkeler;
            const siteOrigin = window.location.origin;
            for (const u of evrakUlkeler) {
              const pdfName = ULKE_PDF[u];
              if (!pdfName) continue;
              await sendWpImage(musteriPhone, `${siteOrigin}/evrak-pdfs/${pdfName}`, `${u} - Gerekli Evrak Listesi`);
              await new Promise(r => setTimeout(r, 2000));
            }

            await sendWpImage(musteriPhone, `${siteOrigin}/fox-adres.png`, "Adresimiz");
            await new Promise(r => setTimeout(r, 2000));

            await sendWpMsg(musteriPhone,
              `*İletişim Bilgilerimiz:*\n\n` +
              `Ercan Bey: 0505 562 33 01\n` +
              `Bahar Hanım: 0505 562 32 79\n\n` +
              `Herhangi bir sorunuz olursa yukarıdaki numaralardan bize ulaşabilirsiniz.\n\n` +
              `Fox Turizm`
            );

            await supabase.from("randevu_talepleri").update({ evrak_hatirlatma_gonderildi: true }).eq("id", selectedTalep.id);
          } catch { /* evrak hatırlatma gönderilemedi - cron halledecek */ }
        }

        setShowRandevuAlModal(false);
        setRandevuTarihi("");
        setRandevuDosyalari([]);
        setRandevuUlke("");
        setSelectedTalep(null);
        loadData();
      }
    } finally {
      setRandevuSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTalep) return;
    const supabase = createClient();
    await supabase.from("randevu_talepleri").delete().eq("id", selectedTalep.id);
    setShowDeleteConfirm(false);
    setSelectedTalep(null);
    loadData();
  };

  const openEdit = async (talep: RandevuRow) => {
    setSelectedTalep(talep);
    setEditUlkeler(talep.ulkeler);
    setEditVizeTipi(talep.vize_tipi);
    setEditAltKategori(talep.alt_kategori || "");
    setEditDosyaAdi(talep.dosya_adi);
    setEditIletisim(talep.iletisim);
    setEditNot(talep.notlar || "");
    setEditGorseller([]);
    setEditHesapBilgileri((talep.hesap_bilgileri as Record<string, HesapBilgileri>) || {});
    setShowEditModal(true);
    const detail = await loadTalepDetail(talep.id);
    if (detail) setEditGorseller(detail.gorseller || []);
  };

  const handleEdit = async () => {
    if (!selectedTalep || !editDosyaAdi || !editIletisim || editUlkeler.length === 0 || !editVizeTipi) return;
    setEditSaving(true);
    try {
      const newGorseller = editGorseller.filter(g => g.startsWith("data:"));
      const existingUrls = editGorseller.filter(g => !g.startsWith("data:"));
      const uploadedUrls = newGorseller.length > 0
        ? await uploadMultipleToStorage(newGorseller, "randevu-pasaport")
        : [];
      const allGorseller = [...existingUrls, ...uploadedUrls];

      const hesapData = Object.keys(editHesapBilgileri).length > 0 ? editHesapBilgileri : null;
      const supabase = createClient();
      const { error } = await supabase
        .from("randevu_talepleri")
        .update({
          ulkeler: editUlkeler,
          vize_tipi: editVizeTipi,
          alt_kategori: showAltKategori(editUlkeler, editVizeTipi) ? (editAltKategori || null) : null,
          dosya_adi: editDosyaAdi,
          iletisim: editIletisim,
          notlar: editNot.trim() || null,
          gorseller: allGorseller,
          hesap_bilgileri: hesapData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTalep.id);
      if (!error) {
        setShowEditModal(false);
        setSelectedTalep(null);
        loadData();
      }
    } finally {
      setEditSaving(false);
    }
  };

  const allUlkeler = Array.from(new Set(talepler.flatMap(t => t.ulkeler))).sort();

  const filteredTalepler = talepler.filter(t => {
    if (showArchived ? !t.arsivlendi : t.arsivlendi) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.dosya_adi.toLowerCase().includes(q) && !t.iletisim.toLowerCase().includes(q)) return false;
    }
    if (filterUlke && !t.ulkeler.includes(filterUlke)) return false;
    return true;
  });

  if (isSirri) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="p-12 text-center shadow-lg max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Erişim Kısıtlı</h3>
          <p className="text-navy-500">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fullscreen Image Viewer */}
      {viewerImage && <ImageViewer src={viewerImage} onClose={() => setViewerImage(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">📋</span>
            Randevu Alınacak
          </h1>
          <p className="text-navy-500 mt-1">
            {filteredTalepler.length} {showArchived ? "arşivlenmiş" : "aktif"} randevu talebi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showArchived ? "primary" : "outline"}
            onClick={() => setShowArchived(!showArchived)}
            className="shadow-md"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {showArchived ? "Aktif Talepleri Göster" : "Arşivi Göster"}
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="shadow-lg">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Randevu Talebi Oluştur
          </Button>
        </div>
      </div>

      {/* Arama & Filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İsim veya iletişim ile ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-navy-200 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <select
          value={filterUlke}
          onChange={(e) => setFilterUlke(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-navy-200 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm shadow-sm min-w-[180px]"
        >
          <option value="">Tüm Ülkeler</option>
          {allUlkeler.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filteredTalepler.length === 0 ? (
        <Card className="p-12 text-center shadow-lg">
          <div className="w-24 h-24 bg-gradient-to-br from-navy-100 to-navy-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">📋</span>
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">
            {showArchived ? "Arşivde Kayıt Yok" : "Henüz Randevu Talebi Yok"}
          </h3>
          <p className="text-navy-500">
            {showArchived ? "Arşivlenmiş randevu talebi bulunmuyor." : "Yeni bir randevu talebi oluşturun."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTalepler.map((talep) => (
            <Card key={talep.id} className={`p-5 shadow-lg hover:shadow-xl transition-all duration-200 ${talep.arsivlendi ? "opacity-75 border-l-4 border-l-green-500" : "border-l-4 border-l-primary-500"}`}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-bold text-navy-900 text-lg">{talep.dosya_adi}</h3>
                    {talep.arsivlendi && <Badge variant="success" size="sm">Randevu Alındı</Badge>}
                    {!talep.arsivlendi && talep.hesap_bilgileri && Object.entries(talep.hesap_bilgileri as Record<string, HesapBilgileri>).some(([, v]) => !v.hesap_var) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300">
                        ⚠️ Hesap Açılmamış
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {talep.ulkeler.map((ulke) => (
                      <span key={ulke} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">🌍 {ulke}</span>
                    ))}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {VIZE_TIPLERI.find(v => v.value === talep.vize_tipi)?.label || talep.vize_tipi}
                    </span>
                    {talep.alt_kategori && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {ALT_KATEGORILER.find(a => a.value === talep.alt_kategori)?.label || talep.alt_kategori}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-navy-500">
                    <span className="flex items-center gap-1">📞 {talep.iletisim}</span>
                    <span className="flex items-center gap-1">📅 {formatDate(talep.created_at)}</span>
                    {talep.profiles && (
                      <span className="flex items-center gap-1">
                        {AVATAR_MAP[talep.profiles.name] && (
                          <img src={AVATAR_MAP[talep.profiles.name]} alt="" className="w-5 h-5 rounded-full object-cover" />
                        )}
                        <span className="text-[10px] text-navy-400">Oluşturan:</span> {talep.profiles.name}
                      </span>
                    )}
                    {talep.randevu_tarihi && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">✅ Randevu: {formatDateTime(talep.randevu_tarihi)}</span>
                    )}
                    {talep.randevu_alan && (
                      <span className="flex items-center gap-1 text-green-600">
                        {AVATAR_MAP[talep.randevu_alan.name] && (
                          <img src={AVATAR_MAP[talep.randevu_alan.name]} alt="" className="w-5 h-5 rounded-full object-cover" />
                        )}
                        <span className="text-[10px] text-navy-400">Alan:</span> {talep.randevu_alan.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={async () => {
                    setSelectedTalep(talep);
                    setDetailGorseller([]);
                    setDetailDosyalar([]);
                    setShowDetailModal(true);
                    setDetailLoading(true);
                    const detail = await loadTalepDetail(talep.id);
                    if (detail) {
                      setDetailGorseller(detail.gorseller || []);
                      setDetailDosyalar(detail.randevu_dosyalari || []);
                    }
                    setDetailLoading(false);
                  }}>Detay</Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(talep)}>Düzenle</Button>
                  {!talep.arsivlendi && (
                    <Button size="sm" variant="primary" onClick={() => { setSelectedTalep(talep); setRandevuUlke(talep.ulkeler.length === 1 ? talep.ulkeler[0] : ""); setShowRandevuAlModal(true); }} className="bg-green-600 hover:bg-green-700">
                      📅 Randevu Al
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setSelectedTalep(talep); setShowDeleteConfirm(true); }} className="text-red-500 border-red-200 hover:bg-red-50">
                    🗑️
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ===== CREATE MODAL ===== */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetCreateForm(); }} title="Randevu Talebi Oluştur" size="xl">
        <div className="space-y-5">
          <CountrySelector selected={formUlkeler} onChange={setFormUlkeler} />

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Vize Tipi *</label>
            <div className="grid grid-cols-3 gap-2">
              {VIZE_TIPLERI.map((tip) => (
                <button key={tip.value} type="button" onClick={() => setFormVizeTipi(tip.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${formVizeTipi === tip.value ? "bg-primary-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}>
                  {tip.label}
                </button>
              ))}
            </div>
          </div>

          {showAltKategori(formUlkeler, formVizeTipi) && (
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">Vize Kategorisi</label>
              <div className="grid grid-cols-2 gap-2">
                {ALT_KATEGORILER.map((kat) => (
                  <button key={kat.value} type="button" onClick={() => setFormAltKategori(kat.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${formAltKategori === kat.value ? "bg-amber-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}>
                    {kat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Dosya Adı *</label>
            <input type="text" value={formDosyaAdi} onChange={(e) => setFormDosyaAdi(e.target.value)} placeholder="Örn: Ahmet Yılmaz - Fransa Vize"
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all" />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">İletişim *</label>
            <input type="text" value={formIletisim} onChange={(e) => setFormIletisim(e.target.value)} placeholder="Telefon numarası (WhatsApp mesajı bu numaraya gidecek)"
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all" />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Görseller</label>
            <div className="border-2 border-dashed border-navy-200 rounded-xl p-4 text-center hover:border-primary-400 transition-colors">
              <input type="file" multiple accept="image/*" onChange={(e) => handleFileUpload(e, setFormGorseller)} className="hidden" id="gorsel-upload" />
              <label htmlFor="gorsel-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm text-navy-500">Tıklayın veya dosya sürükleyin (çoklu seçim)</p>
              </label>
            </div>
            {formGorseller.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {formGorseller.map((g, i) => (
                  <div key={i} className="relative group">
                    <img src={g} alt={`Görsel ${i + 1}`} className="w-full h-20 object-cover rounded-lg" />
                    <button onClick={() => setFormGorseller(formGorseller.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Not (Opsiyonel)</label>
            <textarea
              value={formNot}
              onChange={(e) => setFormNot(e.target.value)}
              placeholder="Varsa eklemek istediğiniz notları yazın..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-navy-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none resize-none"
            />
          </div>

          {needsHesap(formUlkeler).ispanya && (
            <HesapAlanlari
              ulke="İspanya"
              hesapBilgileri={formHesapBilgileri["İspanya"]}
              onChange={(val) => setFormHesapBilgileri(prev => ({ ...prev, "İspanya": val }))}
              gorseller={formGorseller}
            />
          )}

          {needsHesap(formUlkeler).italya && (
            <HesapAlanlari
              ulke="İtalya"
              hesapBilgileri={formHesapBilgileri["İtalya"]}
              onChange={(val) => setFormHesapBilgileri(prev => ({ ...prev, "İtalya": val }))}
              gorseller={formGorseller}
            />
          )}

          <Button onClick={handleCreate} disabled={formSaving || !formDosyaAdi || !formIletisim || formUlkeler.length === 0 || !formVizeTipi} className="w-full">
            {formSaving ? "Kaydediliyor..." : "Randevu Talebi Oluştur"}
          </Button>
        </div>
      </Modal>

      {/* ===== RANDEVU AL MODAL ===== */}
      <Modal isOpen={showRandevuAlModal} onClose={() => { setShowRandevuAlModal(false); setRandevuTarihi(""); setRandevuDosyalari([]); setRandevuUlke(""); setSelectedTalep(null); }} title="Randevu Al" size="md">
        <div className="space-y-4">
          {selectedTalep && (
            <div className="bg-navy-50 rounded-xl p-4">
              <p className="font-bold text-navy-900">{selectedTalep.dosya_adi}</p>
              <p className="text-sm text-navy-500">{selectedTalep.ulkeler.join(", ")}</p>
            </div>
          )}
          {selectedTalep && selectedTalep.ulkeler.length > 1 && (
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">Hangi ülkeye randevu aldınız? *</label>
              <div className="grid grid-cols-2 gap-2">
                {selectedTalep.ulkeler.map((ulke) => (
                  <button key={ulke} type="button" onClick={() => setRandevuUlke(ulke)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${randevuUlke === ulke ? "bg-green-600 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}>
                    🌍 {ulke}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Randevu Tarihi *</label>
            <input type="datetime-local" value={randevuTarihi} onChange={(e) => setRandevuTarihi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Randevu Mektubu / Dosya</label>
            <div className="border-2 border-dashed border-navy-200 rounded-xl p-3 text-center hover:border-green-400 transition-colors">
              <input type="file" multiple accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, setRandevuDosyalari)} className="hidden" id="randevu-dosya-upload" />
              <label htmlFor="randevu-dosya-upload" className="cursor-pointer">
                <div className="text-3xl mb-1">📎</div>
                <p className="text-xs text-navy-500">PDF veya görsel yükleyin (çoklu seçim)</p>
              </label>
            </div>
            {randevuDosyalari.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {randevuDosyalari.map((g, i) => (
                  <div key={i} className="relative group">
                    {g.startsWith("data:application/pdf") ? (
                      <div className="w-full h-16 bg-red-50 rounded-lg flex items-center justify-center text-red-500 text-xs font-medium">PDF {i + 1}</div>
                    ) : (
                      <img src={g} alt={`Dosya ${i + 1}`} className="w-full h-16 object-cover rounded-lg" />
                    )}
                    <button onClick={() => setRandevuDosyalari(randevuDosyalari.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-navy-400">
            Pasaport görselleri + randevu mektubu müşteriye WhatsApp ile gönderilecek.
            Davut, oluşturan ve alan kişiye bildirim gidecek.
          </p>
          <Button onClick={handleRandevuAl} disabled={randevuSaving || !randevuTarihi || (!!selectedTalep && selectedTalep.ulkeler.length > 1 && !randevuUlke)} className="w-full bg-green-600 hover:bg-green-700">
            {randevuSaving ? "Randevu alınıyor..." : "Randevuyu Onayla"}
          </Button>
        </div>
      </Modal>

      {/* ===== DELETE CONFIRM ===== */}
      <Modal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setSelectedTalep(null); }} title="Silme Onayı" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="font-bold text-red-700">Bu talebi silmek istediğinize emin misiniz?</p>
            <p className="text-sm text-red-500 mt-1">{selectedTalep?.dosya_adi}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setSelectedTalep(null); }} className="flex-1">İptal</Button>
            <Button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700">Evet, Sil</Button>
          </div>
        </div>
      </Modal>

      {/* ===== DETAIL MODAL ===== */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedTalep(null); }} title="Randevu Talebi Detayı" size="lg">
        {selectedTalep && (() => {
          const firstUlke = selectedTalep.ulkeler[0] || "";
          const flagStyle = ULKE_RENKLERI[firstUlke];
          const flagBg = flagStyle ? flagStyle.bg : "linear-gradient(135deg, #667eea, #764ba2)";
          return (
          <div className="relative -m-6 overflow-hidden">
            {/* Full flag background */}
            <div className="absolute inset-0" style={{ background: flagBg }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white/95" />
            <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 15%, rgba(255,255,255,0.3) 35%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,0.97) 75%, white 100%)" }} />

            <div className="relative z-10 p-6 space-y-5">
              {/* Header */}
              <div className="pt-2 pb-4">
                <h3 className="text-2xl font-extrabold text-white drop-shadow-lg mb-3">{selectedTalep.dosya_adi}</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTalep.ulkeler.map((ulke) => {
                    const ulkeFlag = ULKE_RENKLERI[ulke];
                    return (
                      <span key={ulke} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold bg-white/90 text-navy-800 shadow-md backdrop-blur-md border border-white/50">
                        {ulkeFlag && <span className="w-5 h-3.5 rounded-sm inline-block border border-gray-200 flex-shrink-0" style={{ background: ulkeFlag.bg }} />}
                        {ulke}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                  <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Vize Tipi</p>
                  <p className="font-semibold text-navy-900">{VIZE_TIPLERI.find(v => v.value === selectedTalep.vize_tipi)?.label}</p>
                </div>
                {selectedTalep.alt_kategori && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                    <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Kategori</p>
                    <p className="font-semibold text-navy-900">{ALT_KATEGORILER.find(a => a.value === selectedTalep.alt_kategori)?.label}</p>
                  </div>
                )}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                  <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">İletişim</p>
                  <p className="font-semibold text-navy-900">{selectedTalep.iletisim}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                  <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-2">Oluşturan</p>
                  <div className="flex items-center gap-2">
                    {selectedTalep.profiles?.name && AVATAR_MAP[selectedTalep.profiles.name] && (
                      <img src={AVATAR_MAP[selectedTalep.profiles.name]} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                    )}
                    <p className="font-semibold text-navy-900">{selectedTalep.profiles?.name || "-"}</p>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                  <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Oluşturma Tarihi</p>
                  <p className="font-semibold text-navy-900">{formatDateTime(selectedTalep.created_at)}</p>
                </div>
                {selectedTalep.randevu_tarihi && (
                  <div className="bg-green-50/90 backdrop-blur-sm rounded-xl p-4 border border-green-200/60 shadow-sm">
                    <p className="text-xs text-green-600 uppercase tracking-wide font-bold mb-1">Randevu Tarihi</p>
                    <p className="font-semibold text-green-700">{formatDateTime(selectedTalep.randevu_tarihi)}</p>
                  </div>
                )}
                {selectedTalep.randevu_alan && (
                  <div className="bg-green-50/90 backdrop-blur-sm rounded-xl p-4 border border-green-200/60 shadow-sm">
                    <p className="text-xs text-green-600 uppercase tracking-wide font-bold mb-2">Randevuyu Alan</p>
                    <div className="flex items-center gap-2">
                      {AVATAR_MAP[selectedTalep.randevu_alan.name] && (
                        <img src={AVATAR_MAP[selectedTalep.randevu_alan.name]} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-green-200 shadow-sm" />
                      )}
                      <p className="font-semibold text-green-700">{selectedTalep.randevu_alan.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Not */}
              {selectedTalep.notlar && (
                <div className="bg-amber-50/80 backdrop-blur-sm rounded-xl p-4 border border-amber-200/60 shadow-sm">
                  <p className="text-xs text-amber-600 uppercase tracking-wide font-bold mb-2">📝 Not</p>
                  <p className="text-sm text-navy-800 whitespace-pre-wrap">{selectedTalep.notlar}</p>
                </div>
              )}

              {/* Hesap Bilgileri */}
              {selectedTalep.hesap_bilgileri && Object.keys(selectedTalep.hesap_bilgileri).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(selectedTalep.hesap_bilgileri as Record<string, HesapBilgileri>).map(([ulke, info]) => (
                    <div key={ulke} className={`rounded-xl p-4 border shadow-sm ${info.hesap_var ? "bg-green-50/80 border-green-200/60" : "bg-yellow-50/80 border-yellow-200/60"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{ulke === "İtalya" ? "🇮🇹" : "🇪🇸"}</span>
                        <p className="text-sm font-bold text-navy-800">{ulke} Hesap Bilgileri</p>
                        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${info.hesap_var ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {info.hesap_var ? "✅ Hesap Açık" : "⚠️ Hesap Açılmamış"}
                        </span>
                      </div>
                      {info.hesap_var && info.gorsel_bilgileri && (
                        <div className="space-y-2 mt-2">
                          {info.gorsel_bilgileri.map((gb, i) => (
                            <div key={i} className="bg-white/60 rounded-lg p-2 border border-amber-100 text-xs">
                              <p className="font-bold text-navy-600 mb-1">Pasaport {i + 1}</p>
                              <div className="grid grid-cols-2 gap-1">
                                <span><span className="text-navy-400">E-posta:</span> {gb.email || "-"}</span>
                                <span><span className="text-navy-400">Şifre:</span> {gb.sifre || "-"}</span>
                                {ulke === "İtalya" && <span><span className="text-navy-400">IT No:</span> {gb.it_numarasi || "-"}</span>}
                                {ulke === "İtalya" && <span><span className="text-navy-400">Telefon:</span> {gb.telefon || "-"}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {detailLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-navy-600 font-medium">Görseller yükleniyor...</span>
                </div>
              )}

              {/* Randevu Dosyaları */}
              {!detailLoading && detailDosyalar.length > 0 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                  <p className="text-sm font-bold text-green-700 mb-3">📎 Randevu Mektubu ({detailDosyalar.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detailDosyalar.map((g, i) => (
                      <div key={i} className="relative cursor-pointer group" onClick={() => g.includes("application/pdf") ? window.open(g, "_blank") : setViewerImage(g)}>
                        {g.includes("application/pdf") || g.endsWith(".pdf") ? (
                          <div className="w-full h-32 bg-red-50 rounded-xl border border-red-200 flex flex-col items-center justify-center text-red-500">
                            <span className="text-3xl mb-1">📄</span>
                            <span className="text-xs font-medium">PDF {i + 1}</span>
                          </div>
                        ) : (
                          <img src={g} alt={`Randevu Dosya ${i + 1}`} className="w-full h-32 object-cover rounded-xl border border-green-200 group-hover:shadow-lg group-hover:scale-[1.02] transition-all" loading="lazy" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pasaport Görselleri */}
              {!detailLoading && detailGorseller.length > 0 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/60 shadow-sm">
                  <p className="text-sm font-bold text-navy-700 mb-3">Pasaport Görselleri ({detailGorseller.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detailGorseller.map((g, i) => (
                      <div key={i} className="relative cursor-pointer group" onClick={() => setViewerImage(g)}>
                        <img src={g} alt={`Görsel ${i + 1}`} className="w-full h-40 object-cover rounded-xl border border-navy-200 group-hover:shadow-lg group-hover:scale-[1.02] transition-all" loading="lazy" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
                          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                        <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md">Görsel {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* ===== EDIT MODAL ===== */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedTalep(null); }} title="Randevu Talebi Düzenle" size="xl">
        <div className="space-y-5">
          <CountrySelector selected={editUlkeler} onChange={setEditUlkeler} />

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Vize Tipi *</label>
            <div className="grid grid-cols-3 gap-2">
              {VIZE_TIPLERI.map((tip) => (
                <button key={tip.value} type="button" onClick={() => setEditVizeTipi(tip.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${editVizeTipi === tip.value ? "bg-primary-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}>
                  {tip.label}
                </button>
              ))}
            </div>
          </div>

          {showAltKategori(editUlkeler, editVizeTipi) && (
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">Vize Kategorisi</label>
              <div className="grid grid-cols-2 gap-2">
                {ALT_KATEGORILER.map((kat) => (
                  <button key={kat.value} type="button" onClick={() => setEditAltKategori(kat.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${editAltKategori === kat.value ? "bg-amber-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}>
                    {kat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Dosya Adı *</label>
            <input type="text" value={editDosyaAdi} onChange={(e) => setEditDosyaAdi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all" />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">İletişim *</label>
            <input type="text" value={editIletisim} onChange={(e) => setEditIletisim(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all" />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Not (Opsiyonel)</label>
            <textarea
              value={editNot}
              onChange={(e) => setEditNot(e.target.value)}
              placeholder="Varsa eklemek istediğiniz notları yazın..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-navy-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Görseller</label>
            <div className="border-2 border-dashed border-navy-200 rounded-xl p-4 text-center hover:border-primary-400 transition-colors">
              <input type="file" multiple accept="image/*" onChange={(e) => handleFileUpload(e, setEditGorseller)} className="hidden" id="edit-gorsel-upload" />
              <label htmlFor="edit-gorsel-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm text-navy-500">Yeni görsel eklemek için tıklayın</p>
              </label>
            </div>
            {editGorseller.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {editGorseller.map((g, i) => (
                  <div key={i} className="relative group">
                    <img src={g} alt={`Görsel ${i + 1}`} className="w-full h-20 object-cover rounded-lg" />
                    <button onClick={() => setEditGorseller(editGorseller.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {needsHesap(editUlkeler).ispanya && (
            <HesapAlanlari
              ulke="İspanya"
              hesapBilgileri={editHesapBilgileri["İspanya"]}
              onChange={(val) => setEditHesapBilgileri(prev => ({ ...prev, "İspanya": val }))}
              gorseller={editGorseller}
            />
          )}

          {needsHesap(editUlkeler).italya && (
            <HesapAlanlari
              ulke="İtalya"
              hesapBilgileri={editHesapBilgileri["İtalya"]}
              onChange={(val) => setEditHesapBilgileri(prev => ({ ...prev, "İtalya": val }))}
              gorseller={editGorseller}
            />
          )}

          <Button onClick={handleEdit} disabled={editSaving || !editDosyaAdi || !editIletisim || editUlkeler.length === 0 || !editVizeTipi} className="w-full">
            {editSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
