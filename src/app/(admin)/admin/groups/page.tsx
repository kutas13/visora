"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "@/components/ui";
import VisaFileForm from "@/components/files/VisaFileForm";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Group, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

interface GroupMemberWithFile {
  group_id: string;
  visa_files: VisaFileWithProfile | null;
}

interface GroupWithStats extends Group {
  fileCount: number;
  unpaidCount: number;
  nearestAppointment: string | null;
  files: VisaFileWithProfile[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(amount: number, currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return `${amount.toLocaleString("tr-TR")} ${symbols[currency] || currency}`;
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

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [allFiles, setAllFiles] = useState<VisaFileWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showEditFileModal, setShowEditFileModal] = useState(false);

  // Form states
  const [grupAdi, setGrupAdi] = useState("");
  const [grupNot, setGrupNot] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<GroupWithStats | null>(null);
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    // Tüm dosyaları al
    const { data: files } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("arsiv_mi", false)
      .order("musteri_ad");

    setAllFiles(files || []);

    // Tüm grupları al
    const { data: groupsData } = await (supabase as any).from("visa_groups").select("*").order("created_at", { ascending: false }) as { data: Group[] | null };

    // Grup üyelerini al
    const { data: members } = await (supabase as any).from("visa_group_members").select("*, visa_files(*, profiles:assigned_user_id(name))") as { data: GroupMemberWithFile[] | null };

    const groupsWithStats: GroupWithStats[] = [];

    for (const group of groupsData || []) {
      const groupFiles = (members || [])
        .filter((m: GroupMemberWithFile) => m.group_id === group.id && m.visa_files)
        .map((m: GroupMemberWithFile) => m.visa_files as VisaFileWithProfile);

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
      await (supabase as any).from("visa_groups").insert({
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
      await (supabase as any).from("visa_group_members").insert({
        group_id: selectedGroup.id,
        visa_file_id: fileId,
      });
      loadData();
      setShowAddFileModal(false);
      setSearchTerm("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!selectedGroup) return;
    try {
      const supabase = createClient();
      await (supabase as any).from("visa_group_members")
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
      await (supabase as any).from("visa_groups").delete().eq("id", selectedGroup.id);
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

  // Gruba eklenebilecek dosyalar
  const availableFiles = selectedGroup
    ? allFiles.filter(f => 
        !selectedGroup.files.some(sf => sf.id === f.id) &&
        (searchTerm === "" || f.musteri_ad.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Tüm Gruplar</h2>
          <p className="text-navy-500">{groups.length} grup</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ Yeni Grup</Button>
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">👨‍👩‍👧‍👦</span>
          </div>
          <h3 className="text-lg font-semibold text-navy-900">Henüz Grup Yok</h3>
          <p className="text-navy-500 mt-1 mb-4">Aile veya grup dosyalarını bir arada yönetmek için grup oluşturun.</p>
          <Button onClick={() => setShowCreateModal(true)}>İlk Grubu Oluştur</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <Card key={group.id} className="p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openDetail(group)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👨‍👩‍👧‍👦</span>
                </div>
                <Badge variant="default">{group.fileCount} dosya</Badge>
              </div>
              <h3 className="font-semibold text-navy-900 text-lg">{group.grup_adi}</h3>
              {group.aciklama && <p className="text-sm text-navy-500 mt-1 line-clamp-2">{group.aciklama}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {group.nearestAppointment && (
                  <Badge variant="info" size="sm">
                    Randevu: {getDaysUntil(group.nearestAppointment)} gün
                  </Badge>
                )}
                {group.unpaidCount > 0 && (
                  <Badge variant="error" size="sm">
                    {group.unpaidCount} ödenmemiş
                  </Badge>
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
            <label className="block text-sm font-medium text-navy-700 mb-1">Not</label>
            <textarea
              placeholder="Grup hakkında not..."
              value={grupNot}
              onChange={(e) => setGrupNot(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-navy-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
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
              <div className="bg-navy-50 rounded-xl p-4">
                <p className="text-sm text-navy-600">{selectedGroup.aciklama}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-navy-900">Dosyalar ({selectedGroup.files.length})</h4>
              <Button size="sm" onClick={() => setShowAddFileModal(true)}>+ Dosya Ekle</Button>
            </div>

            {selectedGroup.files.length === 0 ? (
              <div className="text-center py-8 text-navy-500">
                <p>Bu grupta henüz dosya yok</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectedGroup.files.map(file => (
                  <div key={file.id} className="flex items-center gap-4 p-4 bg-navy-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                      <p className="text-sm text-navy-500">{file.hedef_ulke} • {formatCurrency(file.ucret, file.ucret_currency)}</p>
                      {file.randevu_tarihi && (
                        <p className="text-sm text-navy-500">Randevu: {formatDate(file.randevu_tarihi)}</p>
                      )}
                      <Badge variant="purple" size="sm">{file.profiles?.name}</Badge>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(file)}
                      <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm">
                        {file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingFile(file); setShowEditFileModal(true); }}>Düzenle</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveFile(file.id)}>Çıkar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-navy-200">
              <Button variant="ghost" onClick={handleDeleteGroup} className="text-red-600 hover:bg-red-50">Grubu Sil</Button>
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>Kapat</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dosya Ekle Modal */}
      <Modal isOpen={showAddFileModal} onClose={() => { setShowAddFileModal(false); setSearchTerm(""); }} title="Gruba Dosya Ekle" size="md">
        <div className="space-y-4">
          <Input placeholder="Müşteri ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {availableFiles.length === 0 ? (
            <div className="text-center py-8 text-navy-500">
              <p>Eklenebilecek dosya bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableFiles.slice(0, 20).map(file => (
                <button
                  key={file.id}
                  onClick={() => handleAddFile(file.id)}
                  className="w-full flex items-center gap-4 p-4 bg-navy-50 hover:bg-navy-100 rounded-xl transition-colors text-left"
                >
                  <div className="flex-1">
                    <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                    <p className="text-sm text-navy-500">{file.hedef_ulke} • {file.pasaport_no}</p>
                    <Badge variant="purple" size="sm">{file.profiles?.name}</Badge>
                  </div>
                  <Badge variant="info">Ekle</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Dosya Düzenle Modal */}
      <Modal isOpen={showEditFileModal} onClose={() => { setShowEditFileModal(false); setEditingFile(null); }} title="Dosyayı Düzenle" size="xl">
        <VisaFileForm file={editingFile} onSuccess={() => { setShowEditFileModal(false); setEditingFile(null); loadData(); }} onCancel={() => { setShowEditFileModal(false); setEditingFile(null); }} />
      </Modal>
    </div>
  );
}
