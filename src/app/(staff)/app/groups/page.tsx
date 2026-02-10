"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input } from "@/components/ui";
import VisaFileForm from "@/components/files/VisaFileForm";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Group } from "@/lib/supabase/types";

interface GroupWithStats extends Group {
  fileCount: number;
  unpaidCount: number;
  nearestAppointment: string | null;
  files: VisaFile[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(amount: number, currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return `${amount?.toLocaleString("tr-TR")} ${symbols[currency] || currency}`;
}

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusBadge(file: VisaFile) {
  if (file.sonuc === "vize_onay") return <Badge variant="success">Vize Onay</Badge>;
  if (file.sonuc === "red") return <Badge variant="error">Reddedildi</Badge>;
  if (file.islemden_cikti) return <Badge variant="purple">İşlemden Çıktı</Badge>;
  if (file.basvuru_yapildi) return <Badge variant="info">İşlemde</Badge>;
  if (file.dosya_hazir) return <Badge variant="info">Dosya Hazır</Badge>;
  return <Badge variant="default">Yeni</Badge>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [myFiles, setMyFiles] = useState<VisaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showEditFileModal, setShowEditFileModal] = useState(false);

  const [grupAdi, setGrupAdi] = useState("");
  const [grupNot, setGrupNot] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<GroupWithStats | null>(null);
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data: files } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("arsiv_mi", false)
      .order("musteri_ad");

    setMyFiles(files || []);

    const { data: groupsData } = await supabase.from("visa_groups").select("*").order("created_at", { ascending: false });
    const { data: members } = await supabase.from("visa_group_members").select("*, visa_files(*)");

    const userFileIds = new Set((files || []).map(f => f.id));

    const groupsWithStats: GroupWithStats[] = [];

    for (const group of groupsData || []) {
      const groupFiles = (members || [])
        .filter(m => m.group_id === group.id && m.visa_files)
        .map(m => m.visa_files as VisaFile);

      const hasMyFile = groupFiles.some(f => userFileIds.has(f.id));
      if (!hasMyFile && groupFiles.length > 0) continue;

      const unpaidCount = groupFiles.filter(f => f.odeme_plani === "cari" && f.odeme_durumu === "odenmedi").length;
      const appointmentFiles = groupFiles
        .filter(f => f.islem_tipi === "randevulu" && f.randevu_tarihi && !f.sonuc)
        .sort((a, b) => new Date(a.randevu_tarihi!).getTime() - new Date(b.randevu_tarihi!).getTime());

      groupsWithStats.push({
        ...group,
        fileCount: groupFiles.length,
        unpaidCount,
        nearestAppointment: appointmentFiles[0]?.randevu_tarihi || null,
        files: groupFiles,
      });
    }

    setGroups(groupsWithStats);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupAdi.trim()) return;
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      await supabase.from("visa_groups").insert({
        grup_adi: grupAdi.trim(),
        aciklama: grupNot || null,
        created_by: currentUserId,
      });

      setShowCreateModal(false);
      setGrupAdi("");
      setGrupNot("");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFile = async (fileId: string) => {
    if (!selectedGroup) return;
    try {
      const supabase = createClient();
      await supabase.from("visa_group_members").insert({
        group_id: selectedGroup.id,
        visa_file_id: fileId,
      });
      loadData();
      setShowAddFileModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!selectedGroup) return;
    try {
      const supabase = createClient();
      await supabase.from("visa_group_members")
        .delete()
        .eq("group_id", selectedGroup.id)
        .eq("visa_file_id", fileId);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !confirm("Bu grubu silmek istediğinize emin misiniz?")) return;
    try {
      const supabase = createClient();
      await supabase.from("visa_groups").delete().eq("id", selectedGroup.id);
      setShowDetailModal(false);
      setSelectedGroup(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const openDetail = (group: GroupWithStats) => {
    setSelectedGroup(group);
    setShowDetailModal(true);
  };

  const availableFiles = selectedGroup
    ? myFiles.filter(f => !selectedGroup.files.some(sf => sf.id === f.id))
    : [];

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
            Gruplar
          </h1>
          <p className="text-navy-500 mt-1">Aile ve grup dosyalarını bir arada yönetin</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="shadow-lg hover:shadow-xl transition-shadow">
          <span className="mr-2">+</span> Yeni Grup
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center shadow-lg">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">👨‍👩‍👧‍👦</span>
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Henüz Grup Yok</h3>
          <p className="text-navy-500 mb-6 max-w-md mx-auto">Aile veya grup halinde başvuru yapan müşterilerinizi bir arada yönetmek için grup oluşturun.</p>
          <Button onClick={() => setShowCreateModal(true)} size="lg">
            <span className="mr-2">+</span> İlk Grubu Oluştur
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <Card 
              key={group.id} 
              className="p-6 hover:shadow-xl transition-all duration-300 cursor-pointer group border-0 shadow-lg hover:-translate-y-1" 
              onClick={() => openDetail(group)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <span className="text-2xl">👨‍👩‍👧‍👦</span>
                </div>
                <div className="bg-navy-100 px-3 py-1 rounded-full">
                  <span className="text-sm font-semibold text-navy-700">{group.fileCount} dosya</span>
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">{group.grup_adi}</h3>
              {group.aciklama && <p className="text-sm text-navy-500 line-clamp-2">{group.aciklama}</p>}
              <div className="mt-4 pt-4 border-t border-navy-100 flex flex-wrap gap-2">
                {group.nearestAppointment && (
                  <Badge variant="info" size="sm" className="flex items-center gap-1">
                    <span>📅</span>
                    {getDaysUntil(group.nearestAppointment)} gün
                  </Badge>
                )}
                {group.unpaidCount > 0 && (
                  <Badge variant="error" size="sm" className="flex items-center gap-1">
                    <span>💰</span>
                    {group.unpaidCount} ödenmemiş
                  </Badge>
                )}
                {group.unpaidCount === 0 && (
                  <Badge variant="success" size="sm">✓ Ödemeler tamam</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Grup Oluştur Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Yeni Grup Oluştur" size="sm">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input label="Grup Adı *" placeholder="Örn: Yılmaz Ailesi" value={grupAdi} onChange={(e) => setGrupAdi(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Not (Opsiyonel)</label>
            <textarea
              placeholder="Grup hakkında not..."
              value={grupNot}
              onChange={(e) => setGrupNot(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-navy-100">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">İptal</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Oluşturuluyor..." : "Oluştur"}</Button>
          </div>
        </form>
      </Modal>

      {/* Grup Detay Modal */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedGroup(null); }} title={selectedGroup?.grup_adi || "Grup Detayı"} size="lg">
        {selectedGroup && (
          <div className="space-y-6">
            {selectedGroup.aciklama && (
              <div className="bg-gradient-to-r from-navy-50 to-white rounded-xl p-4 border border-navy-100">
                <p className="text-navy-600">{selectedGroup.aciklama}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h4 className="font-bold text-navy-900 flex items-center gap-2">
                📋 Dosyalar
                <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-sm">{selectedGroup.files.length}</span>
              </h4>
              <Button size="sm" onClick={() => setShowAddFileModal(true)}>+ Dosya Ekle</Button>
            </div>

            {selectedGroup.files.length === 0 ? (
              <div className="text-center py-12 bg-navy-50 rounded-xl">
                <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">📂</span>
                </div>
                <p className="text-navy-500">Bu grupta henüz dosya yok</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowAddFileModal(true)}>Dosya Ekle</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedGroup.files.map(file => (
                  <div key={file.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-navy-50 to-white rounded-xl border border-navy-100 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
                      <span className="font-bold text-primary-600">{file.musteri_ad.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900">{file.musteri_ad}</p>
                      <p className="text-sm text-navy-500">{file.hedef_ulke} • {formatCurrency(file.ucret, file.ucret_currency)}</p>
                      {file.randevu_tarihi && (
                        <p className="text-sm text-primary-600 font-medium">📅 {formatDate(file.randevu_tarihi)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(file)}
                      <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm">
                        {file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingFile(file); setShowEditFileModal(true); }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleRemoveFile(file.id)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-navy-200">
              <Button variant="ghost" onClick={handleDeleteGroup} className="text-red-600 hover:bg-red-50">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Grubu Sil
              </Button>
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>Kapat</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dosya Ekle Modal */}
      <Modal isOpen={showAddFileModal} onClose={() => setShowAddFileModal(false)} title="Gruba Dosya Ekle" size="md">
        {availableFiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-navy-500">Eklenebilecek dosya bulunmuyor</p>
            <p className="text-sm text-navy-400 mt-1">Tüm dosyalarınız zaten bu grupta</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {availableFiles.map(file => (
              <button
                key={file.id}
                onClick={() => handleAddFile(file.id)}
                className="w-full flex items-center gap-4 p-4 bg-navy-50 hover:bg-primary-50 rounded-xl transition-all text-left group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="font-bold text-primary-600">{file.musteri_ad.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                  <p className="text-sm text-navy-500">{file.hedef_ulke} • {file.pasaport_no}</p>
                </div>
                <Badge variant="info" className="group-hover:bg-primary-500 group-hover:text-white transition-colors">+ Ekle</Badge>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Dosya Düzenle Modal */}
      <Modal isOpen={showEditFileModal} onClose={() => { setShowEditFileModal(false); setEditingFile(null); }} title="Dosyayı Düzenle" size="lg">
        <VisaFileForm file={editingFile} onSuccess={() => { setShowEditFileModal(false); setEditingFile(null); loadData(); }} onCancel={() => { setShowEditFileModal(false); setEditingFile(null); }} />
      </Modal>
    </div>
  );
}
