"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge } from "@/components/ui";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { RandevuTalebi, Profile } from "@/lib/supabase/types";

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

  // Create form state
  const [formUlkeler, setFormUlkeler] = useState<string[]>([]);
  const [formVizeTipi, setFormVizeTipi] = useState("");
  const [formAltKategori, setFormAltKategori] = useState("");
  const [formDosyaAdi, setFormDosyaAdi] = useState("");
  const [formIletisim, setFormIletisim] = useState("");
  const [formGorseller, setFormGorseller] = useState<string[]>([]);
  const [formSaving, setFormSaving] = useState(false);

  // Randevu al
  const [randevuTarihi, setRandevuTarihi] = useState("");
  const [randevuSaving, setRandevuSaving] = useState(false);

  // Edit form state
  const [editUlkeler, setEditUlkeler] = useState<string[]>([]);
  const [editVizeTipi, setEditVizeTipi] = useState("");
  const [editAltKategori, setEditAltKategori] = useState("");
  const [editDosyaAdi, setEditDosyaAdi] = useState("");
  const [editIletisim, setEditIletisim] = useState("");
  const [editGorseller, setEditGorseller] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const showAltKategori = (ulkeler: string[], vizeTipi: string) =>
    ulkeler.includes("Fransa") && vizeTipi === "turistik";

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
      .select("*, profiles:created_by(name), randevu_alan:randevu_alan_id(name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTalepler(data as unknown as RandevuRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetCreateForm = () => {
    setFormUlkeler([]);
    setFormVizeTipi("");
    setFormAltKategori("");
    setFormDosyaAdi("");
    setFormIletisim("");
    setFormGorseller([]);
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
        if (reader.result) {
          setter((prev: string[]) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleCreate = async () => {
    if (!formDosyaAdi || !formIletisim || formUlkeler.length === 0 || !formVizeTipi) return;
    setFormSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("randevu_talepleri").insert({
        ulkeler: formUlkeler,
        vize_tipi: formVizeTipi,
        alt_kategori: showAltKategori(formUlkeler, formVizeTipi) ? (formAltKategori || null) : null,
        dosya_adi: formDosyaAdi,
        iletisim: formIletisim,
        gorseller: formGorseller,
        created_by: currentUser?.id || null,
      });
      if (!error) {
        setShowCreateModal(false);
        resetCreateForm();
        loadData();
      }
    } finally {
      setFormSaving(false);
    }
  };

  const handleRandevuAl = async () => {
    if (!selectedTalep || !randevuTarihi || !currentUser) return;
    setRandevuSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("randevu_talepleri")
        .update({
          randevu_tarihi: randevuTarihi,
          randevu_alan_id: currentUser.id,
          arsivlendi: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTalep.id);

      if (!error) {
        // Email gönder
        try {
          await fetch("/api/randevu-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dosyaAdi: selectedTalep.dosya_adi,
              ulkeler: selectedTalep.ulkeler,
              vizeTipi: VIZE_TIPLERI.find(v => v.value === selectedTalep.vize_tipi)?.label || selectedTalep.vize_tipi,
              randevuTarihi,
              alanKisi: currentUser.name,
            }),
          });
        } catch { /* email hatası sessiz geçilir */ }

        // WhatsApp gönder
        try {
          await fetch("/api/whatsapp-send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: selectedTalep.iletisim.replace(/\D/g, ""),
              message: `Merhaba, ${currentUser.name} tarafından randevunuz alınmıştır.\n\n📁 Dosya: ${selectedTalep.dosya_adi}\n🌍 Ülke: ${selectedTalep.ulkeler.join(", ")}\n📅 Tarih: ${new Date(randevuTarihi).toLocaleDateString("tr-TR")}\n\nRandevu Alındı ✅\n\nFox Turizm`,
            }),
          });
        } catch { /* wp hatası sessiz geçilir */ }

        setShowRandevuAlModal(false);
        setRandevuTarihi("");
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

  const openEdit = (talep: RandevuRow) => {
    setSelectedTalep(talep);
    setEditUlkeler(talep.ulkeler);
    setEditVizeTipi(talep.vize_tipi);
    setEditAltKategori(talep.alt_kategori || "");
    setEditDosyaAdi(talep.dosya_adi);
    setEditIletisim(talep.iletisim);
    setEditGorseller(talep.gorseller || []);
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedTalep || !editDosyaAdi || !editIletisim || editUlkeler.length === 0 || !editVizeTipi) return;
    setEditSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("randevu_talepleri")
        .update({
          ulkeler: editUlkeler,
          vize_tipi: editVizeTipi,
          alt_kategori: showAltKategori(editUlkeler, editVizeTipi) ? (editAltKategori || null) : null,
          dosya_adi: editDosyaAdi,
          iletisim: editIletisim,
          gorseller: editGorseller,
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

  const filteredTalepler = talepler.filter(t => showArchived ? t.arsivlendi : !t.arsivlendi);

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">📋</span>
            Randevu Listesi
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
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-bold text-navy-900 text-lg">{talep.dosya_adi}</h3>
                    {talep.arsivlendi && (
                      <Badge variant="success" size="sm">Randevu Alındı</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {talep.ulkeler.map((ulke) => (
                      <span key={ulke} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        🌍 {ulke}
                      </span>
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
                  <div className="flex flex-wrap gap-4 text-sm text-navy-500">
                    <span className="flex items-center gap-1">📞 {talep.iletisim}</span>
                    <span className="flex items-center gap-1">📅 {formatDate(talep.created_at)}</span>
                    {talep.profiles && <span className="flex items-center gap-1">👤 {talep.profiles.name}</span>}
                    {talep.randevu_tarihi && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        ✅ Randevu: {formatDateTime(talep.randevu_tarihi)}
                      </span>
                    )}
                    {talep.randevu_alan && (
                      <span className="flex items-center gap-1 text-green-600">
                        🙋 {talep.randevu_alan.name}
                      </span>
                    )}
                    {talep.gorseller && talep.gorseller.length > 0 && (
                      <span className="flex items-center gap-1">🖼️ {talep.gorseller.length} görsel</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSelectedTalep(talep); setShowDetailModal(true); }}
                  >
                    Detay
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(talep)}
                  >
                    Düzenle
                  </Button>
                  {!talep.arsivlendi && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => { setSelectedTalep(talep); setShowRandevuAlModal(true); }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      📅 Randevu Al
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSelectedTalep(talep); setShowDeleteConfirm(true); }}
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
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
          {/* Ülke Seçimi */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Ülkeler *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-3 bg-navy-50 rounded-xl border border-navy-200">
              {SCHENGEN_ULKELERI.map((ulke) => (
                <label key={ulke} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${formUlkeler.includes(ulke) ? "bg-primary-100 text-primary-700 font-medium" : "hover:bg-navy-100 text-navy-600"}`}>
                  <input
                    type="checkbox"
                    checked={formUlkeler.includes(ulke)}
                    onChange={(e) => {
                      if (e.target.checked) setFormUlkeler([...formUlkeler, ulke]);
                      else setFormUlkeler(formUlkeler.filter(u => u !== ulke));
                    }}
                    className="rounded border-navy-300 text-primary-500 focus:ring-primary-500"
                  />
                  {ulke}
                </label>
              ))}
            </div>
            {formUlkeler.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formUlkeler.map(u => (
                  <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {u}
                    <button onClick={() => setFormUlkeler(formUlkeler.filter(x => x !== u))} className="hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Vize Tipi */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Vize Tipi *</label>
            <div className="grid grid-cols-3 gap-2">
              {VIZE_TIPLERI.map((tip) => (
                <button
                  key={tip.value}
                  type="button"
                  onClick={() => setFormVizeTipi(tip.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${formVizeTipi === tip.value ? "bg-primary-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}
                >
                  {tip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alt Kategori (Fransa + Turistik) */}
          {showAltKategori(formUlkeler, formVizeTipi) && (
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">Vize Kategorisi</label>
              <div className="grid grid-cols-2 gap-2">
                {ALT_KATEGORILER.map((kat) => (
                  <button
                    key={kat.value}
                    type="button"
                    onClick={() => setFormAltKategori(kat.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${formAltKategori === kat.value ? "bg-amber-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}
                  >
                    {kat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dosya Adı */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Dosya Adı *</label>
            <input
              type="text"
              value={formDosyaAdi}
              onChange={(e) => setFormDosyaAdi(e.target.value)}
              placeholder="Örn: Ahmet Yılmaz - Fransa Vize"
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>

          {/* İletişim */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">İletişim *</label>
            <input
              type="text"
              value={formIletisim}
              onChange={(e) => setFormIletisim(e.target.value)}
              placeholder="Telefon numarası (WhatsApp mesajı bu numaraya gidecek)"
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>

          {/* Görsel Yükleme */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Görseller</label>
            <div className="border-2 border-dashed border-navy-200 rounded-xl p-4 text-center hover:border-primary-400 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileUpload(e, setFormGorseller)}
                className="hidden"
                id="gorsel-upload"
              />
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
                    <button
                      onClick={() => setFormGorseller(formGorseller.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleCreate}
            disabled={formSaving || !formDosyaAdi || !formIletisim || formUlkeler.length === 0 || !formVizeTipi}
            className="w-full"
          >
            {formSaving ? "Kaydediliyor..." : "Randevu Talebi Oluştur"}
          </Button>
        </div>
      </Modal>

      {/* ===== RANDEVU AL MODAL ===== */}
      <Modal isOpen={showRandevuAlModal} onClose={() => { setShowRandevuAlModal(false); setRandevuTarihi(""); setSelectedTalep(null); }} title="Randevu Al" size="sm">
        <div className="space-y-4">
          {selectedTalep && (
            <div className="bg-navy-50 rounded-xl p-4">
              <p className="font-bold text-navy-900">{selectedTalep.dosya_adi}</p>
              <p className="text-sm text-navy-500">{selectedTalep.ulkeler.join(", ")}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Randevu Tarihi *</label>
            <input
              type="datetime-local"
              value={randevuTarihi}
              onChange={(e) => setRandevuTarihi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>
          <p className="text-xs text-navy-400">
            Randevu alındığında Ercan, Bahar, Davut, Yusuf ve Sırrı&apos;ya email gidecek.
            Müşteriye WhatsApp mesajı gönderilecek.
          </p>
          <Button
            onClick={handleRandevuAl}
            disabled={randevuSaving || !randevuTarihi}
            className="w-full bg-green-600 hover:bg-green-700"
          >
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
            <Button
              variant="outline"
              onClick={() => { setShowDeleteConfirm(false); setSelectedTalep(null); }}
              className="flex-1"
            >
              İptal
            </Button>
            <Button
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Evet, Sil
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===== DETAIL MODAL ===== */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedTalep(null); }} title="Randevu Talebi Detayı" size="lg">
        {selectedTalep && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-5">
              <h3 className="text-xl font-bold text-navy-900 mb-1">{selectedTalep.dosya_adi}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTalep.ulkeler.map((ulke) => (
                  <span key={ulke} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                    🌍 {ulke}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-50 rounded-xl p-4">
                <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Vize Tipi</p>
                <p className="font-medium text-navy-900">{VIZE_TIPLERI.find(v => v.value === selectedTalep.vize_tipi)?.label}</p>
              </div>
              {selectedTalep.alt_kategori && (
                <div className="bg-navy-50 rounded-xl p-4">
                  <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Kategori</p>
                  <p className="font-medium text-navy-900">{ALT_KATEGORILER.find(a => a.value === selectedTalep.alt_kategori)?.label}</p>
                </div>
              )}
              <div className="bg-navy-50 rounded-xl p-4">
                <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">İletişim</p>
                <p className="font-medium text-navy-900">{selectedTalep.iletisim}</p>
              </div>
              <div className="bg-navy-50 rounded-xl p-4">
                <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Oluşturan</p>
                <p className="font-medium text-navy-900">{selectedTalep.profiles?.name || "-"}</p>
              </div>
              <div className="bg-navy-50 rounded-xl p-4">
                <p className="text-xs text-navy-400 uppercase tracking-wide font-bold mb-1">Tarih</p>
                <p className="font-medium text-navy-900">{formatDateTime(selectedTalep.created_at)}</p>
              </div>
              {selectedTalep.randevu_tarihi && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-600 uppercase tracking-wide font-bold mb-1">Randevu Tarihi</p>
                  <p className="font-medium text-green-700">{formatDateTime(selectedTalep.randevu_tarihi)}</p>
                </div>
              )}
              {selectedTalep.randevu_alan && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-600 uppercase tracking-wide font-bold mb-1">Randevuyu Alan</p>
                  <p className="font-medium text-green-700">{selectedTalep.randevu_alan.name}</p>
                </div>
              )}
            </div>

            {/* Görseller */}
            {selectedTalep.gorseller && selectedTalep.gorseller.length > 0 && (
              <div>
                <p className="text-sm font-bold text-navy-700 mb-3">Görseller ({selectedTalep.gorseller.length})</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedTalep.gorseller.map((g, i) => (
                    <a key={i} href={g} target="_blank" rel="noopener noreferrer">
                      <img src={g} alt={`Görsel ${i + 1}`} className="w-full h-40 object-cover rounded-xl border border-navy-200 hover:shadow-lg transition-shadow cursor-pointer" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ===== EDIT MODAL ===== */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedTalep(null); }} title="Randevu Talebi Düzenle" size="xl">
        <div className="space-y-5">
          {/* Ülke Seçimi */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Ülkeler *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-3 bg-navy-50 rounded-xl border border-navy-200">
              {SCHENGEN_ULKELERI.map((ulke) => (
                <label key={ulke} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${editUlkeler.includes(ulke) ? "bg-primary-100 text-primary-700 font-medium" : "hover:bg-navy-100 text-navy-600"}`}>
                  <input
                    type="checkbox"
                    checked={editUlkeler.includes(ulke)}
                    onChange={(e) => {
                      if (e.target.checked) setEditUlkeler([...editUlkeler, ulke]);
                      else setEditUlkeler(editUlkeler.filter(u => u !== ulke));
                    }}
                    className="rounded border-navy-300 text-primary-500 focus:ring-primary-500"
                  />
                  {ulke}
                </label>
              ))}
            </div>
            {editUlkeler.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {editUlkeler.map(u => (
                  <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {u}
                    <button onClick={() => setEditUlkeler(editUlkeler.filter(x => x !== u))} className="hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Vize Tipi */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Vize Tipi *</label>
            <div className="grid grid-cols-3 gap-2">
              {VIZE_TIPLERI.map((tip) => (
                <button
                  key={tip.value}
                  type="button"
                  onClick={() => setEditVizeTipi(tip.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${editVizeTipi === tip.value ? "bg-primary-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}
                >
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
                  <button
                    key={kat.value}
                    type="button"
                    onClick={() => setEditAltKategori(kat.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${editAltKategori === kat.value ? "bg-amber-500 text-white shadow-lg" : "bg-navy-50 text-navy-600 hover:bg-navy-100 border border-navy-200"}`}
                  >
                    {kat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Dosya Adı *</label>
            <input
              type="text"
              value={editDosyaAdi}
              onChange={(e) => setEditDosyaAdi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">İletişim *</label>
            <input
              type="text"
              value={editIletisim}
              onChange={(e) => setEditIletisim(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-navy-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Görseller</label>
            <div className="border-2 border-dashed border-navy-200 rounded-xl p-4 text-center hover:border-primary-400 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileUpload(e, setEditGorseller)}
                className="hidden"
                id="edit-gorsel-upload"
              />
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
                    <button
                      onClick={() => setEditGorseller(editGorseller.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleEdit}
            disabled={editSaving || !editDosyaAdi || !editIletisim || editUlkeler.length === 0 || !editVizeTipi}
            className="w-full"
          >
            {editSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
