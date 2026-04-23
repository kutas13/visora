"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, Button, Badge, Modal } from "@/components/ui";
import VisaFileForm from "@/components/files/VisaFileForm";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isChinaCountry(ulke: string | null | undefined): boolean {
  if (!ulke) return false;
  const normalized = String(ulke)
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .trim();
  return normalized === "cin" || normalized === "china";
}

export default function VizeBitisiPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "30" | "60">("all");
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("sonuc", "vize_onay")
      .not("vize_bitis_tarihi", "is", null);

    const visible = (data || []).filter((f: VisaFile) => !(f as any).vize_bitisi_gizli && !isChinaCountry(f.hedef_ulke));
    setFiles(visible);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredFiles = useMemo(() => {
    let result = files.map(f => ({
      ...f,
      daysRemaining: getDaysUntil(f.vize_bitis_tarihi!),
    }));

    result.sort((a, b) => a.daysRemaining - b.daysRemaining);

    if (filter === "30") {
      result = result.filter(f => f.daysRemaining <= 30 && f.daysRemaining >= 0);
    } else if (filter === "60") {
      result = result.filter(f => f.daysRemaining <= 60 && f.daysRemaining >= 0);
    }

    return result;
  }, [files, filter]);

  const stats = useMemo(() => {
    const all = files.map(f => getDaysUntil(f.vize_bitis_tarihi!));
    return {
      critical: all.filter(d => d <= 30 && d >= 0).length,
      warning: all.filter(d => d > 30 && d <= 60).length,
      total: all.filter(d => d >= 0).length,
    };
  }, [files]);

  const handleEditFile = (file: VisaFile) => {
    setEditingFile(file);
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Vize Bitişi Takibi</h1>
          <p className="text-slate-500 text-sm">Onaylanmış vizelerin bitiş tarihlerini takip edin, süresi dolmak üzere olan dosyaları görün ve tekrar başvuru oluşturun</p>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">KRİTİK</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.critical}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">30 gün içinde biten</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">DİKKAT</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.warning}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">30-60 gün arası</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">AKTİF</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Toplam geçerli vize</p>
        </div>
      </div>

      {/* Filtre */}
      <div className="bg-slate-100 p-1 rounded-xl inline-flex gap-1">
        <button
          onClick={() => setFilter("all")}
          className={`px-6 py-3 font-medium rounded-lg transition-all ${
            filter === "all" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Tümü
        </button>
        <button
          onClick={() => setFilter("30")}
          className={`px-6 py-3 font-medium rounded-lg transition-all ${
            filter === "30" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          30 Günden Az
        </button>
        <button
          onClick={() => setFilter("60")}
          className={`px-6 py-3 font-medium rounded-lg transition-all ${
            filter === "60" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          60 Günden Az
        </button>
      </div>

      {/* Liste */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-slate-700 font-semibold flex items-center gap-2">
            Vize Listesi
            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-sm">{filteredFiles.length}</span>
          </h3>
        </div>
        <div className="p-6">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✓</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Harika!</h3>
              <p className="text-slate-500">Bu filtreye uyan vize bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file, index) => {
                const urgencyClass = file.daysRemaining <= 10 
                  ? "border-l-red-500 bg-red-50/50" 
                  : file.daysRemaining <= 30 
                    ? "border-l-amber-500 bg-amber-50/50" 
                    : "border-l-green-500 bg-green-50/50";
                const daysClass = file.daysRemaining <= 10 
                  ? "from-red-500 to-red-600" 
                  : file.daysRemaining <= 30 
                    ? "from-amber-500 to-orange-500" 
                    : "from-green-500 to-emerald-600";
                
                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-4 p-5 rounded-xl border-l-4 ${urgencyClass} shadow-md hover:shadow-lg transition-all duration-200 group`}
                  >
                    <div className={`w-16 h-16 bg-gradient-to-br ${daysClass} rounded-2xl flex flex-col items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform`}>
                      <span className="text-2xl font-bold">{file.daysRemaining}</span>
                      <span className="text-xs opacity-80">gün</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-800 text-lg">{file.musteri_ad}</p>
                        {file.daysRemaining <= 10 && (
                          <Badge variant="error" size="sm" className="animate-pulse">ACİL</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{file.hedef_ulke} • {file.pasaport_no}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-700">Bitiş: {formatDate(file.vize_bitis_tarihi!)}</p>
                      <Badge variant="success" size="sm" className="mt-1">Vize Onay</Badge>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (confirm(`${file.musteri_ad} kaydını bu listeden kaldırmak istediğinizden emin misiniz?\n\nDosya silinmez, sadece Vize Bitişi Takibi sayfasından gizlenir.`)) {
                              try {
                                const supabase = createClient();
                                const { error } = await supabase
                                  .from("visa_files")
                                  .update({ vize_bitisi_gizli: true })
                                  .eq("id", file.id);
                                if (error) throw error;
                                loadData();
                              } catch (err) {
                                console.error(err);
                                alert("Listeden kaldırma hatası");
                              }
                            }
                          }}
                          className="text-red-600 hover:bg-red-50 border-red-200"
                          title="Dosyayı silmeden bu listeden kaldır"
                        >
                          🗑️ Listeden Kaldır
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const supabase = createClient();
                              await supabase.from("visa_files").update({ arsiv_mi: true }).eq("id", file.id);
                              loadData();
                            } catch (err) {
                              alert("Bekletme hatası");
                            }
                          }}
                          className="text-amber-600 hover:bg-amber-50 border-amber-200"
                        >
                          ⏸️ Beklet
                        </Button>
                        <Button 
                          size="sm"
                          onClick={async () => {
                            try {
                              const supabase = createClient();
                              const newFile = {
                                musteri_ad: file.musteri_ad,
                                pasaport_no: file.pasaport_no.replace(/-R+$/, "") + "-R",
                                hedef_ulke: file.hedef_ulke,
                                ulke_manuel_mi: file.ulke_manuel_mi,
                                islem_tipi: file.islem_tipi,
                                assigned_user_id: file.assigned_user_id,
                                ucret: file.ucret,
                                ucret_currency: file.ucret_currency,
                                odeme_plani: "cari",
                                odeme_durumu: "odenmedi",
                              };
                              await supabase.from("visa_files").insert(newFile);
                              await supabase.from("visa_files").update({ arsiv_mi: true }).eq("id", file.id);
                              alert(`✅ ${file.musteri_ad} için yeni başvuru oluşturuldu`);
                              loadData();
                            } catch (err) {
                              alert("Tekrar başvuru hatası");
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          🔄 Tekrar Başvuru
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditFile(file)}
                        >
                          ✏️ Düzenle
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Dosyayı Düzenle" size="xl">
        <VisaFileForm file={editingFile} onSuccess={() => { setShowEditModal(false); setEditingFile(null); loadData(); }} onCancel={() => setShowEditModal(false)} />
      </Modal>
    </div>
  );
}
