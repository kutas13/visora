"use client";

import { useState, useEffect } from "react";
import { Badge, Modal, Input } from "@/components/ui";
import Image from "next/image";
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

const USER_AVATARS: Record<string, string> = {};

function StaffAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const src = USER_AVATARS[name.toUpperCase()];
  if (src) return <div className="rounded-full overflow-hidden ring-1 ring-slate-200 flex-shrink-0" style={{ width: size, height: size }}><Image src={src} alt={name} width={size} height={size} className="w-full h-full object-cover" /></div>;
  return <div className="rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}><span className="text-primary-600 font-bold" style={{ fontSize: size * 0.4 }}>{name.charAt(0)}</span></div>;
}

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-"; }
function fmtCur(n: number, c: string) { const s: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" }; return `${n?.toLocaleString("tr-TR")} ${s[c] || c}`; }
function getDays(d: string) { const t = new Date(d); const n = new Date(); t.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil((t.getTime()-n.getTime())/(864e5)); }

function getStatusLabel(file: VisaFile) {
  if (file.sonuc === "vize_onay") return { text: "Onay", variant: "success" as const };
  if (file.sonuc === "red") return { text: "Red", variant: "error" as const };
  if (file.islemden_cikti) return { text: "Çıktı", variant: "purple" as const };
  if (file.basvuru_yapildi) return { text: "İşlemde", variant: "info" as const };
  if (file.dosya_hazir) return { text: "Hazır", variant: "info" as const };
  return { text: "Yeni", variant: "default" as const };
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [allFiles, setAllFiles] = useState<VisaFileWithProfile[]>([]);
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
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [filesRes, groupsRes, membersRes] = await Promise.all([
      supabase.from("visa_files").select("*, profiles:assigned_user_id(name)").order("musteri_ad"),
      (supabase as any).from("visa_groups").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("visa_group_members").select("*, visa_files(*, profiles:assigned_user_id(name))"),
    ]);

    setAllFiles(filesRes.data || []);

    const gws: GroupWithStats[] = [];
    for (const group of (groupsRes.data as Group[]) || []) {
      const groupFiles = ((membersRes.data as GroupMemberWithFile[]) || [])
        .filter(m => m.group_id === group.id && m.visa_files)
        .map(m => m.visa_files as VisaFileWithProfile);
      const unpaid = groupFiles.filter(f => f.odeme_plani === "cari" && f.odeme_durumu === "odenmedi").length;
      const apts = groupFiles.filter(f => f.islem_tipi === "randevulu" && f.randevu_tarihi && !f.sonuc).sort((a, b) => new Date(a.randevu_tarihi!).getTime() - new Date(b.randevu_tarihi!).getTime());
      gws.push({ ...group, fileCount: groupFiles.length, unpaidCount: unpaid, nearestAppointment: apts[0]?.randevu_tarihi || null, files: groupFiles });
    }
    setGroups(gws);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupAdi.trim()) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await (supabase as any).from("visa_groups").insert({ grup_adi: grupAdi.trim(), aciklama: grupNot || null, created_by: currentUserId });
      setShowCreateModal(false); setGrupAdi(""); setGrupNot(""); loadData();
    } catch { alert("Hata oluştu"); } finally { setIsSubmitting(false); }
  };

  const handleAddFile = async (fileId: string) => {
    if (!selectedGroup) return;
    try { const supabase = createClient(); await (supabase as any).from("visa_group_members").insert({ group_id: selectedGroup.id, visa_file_id: fileId }); loadData(); setShowAddFileModal(false); setSearchTerm(""); } catch (err) { console.error(err); }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!selectedGroup) return;
    try { const supabase = createClient(); await (supabase as any).from("visa_group_members").delete().eq("group_id", selectedGroup.id).eq("visa_file_id", fileId); loadData(); } catch (err) { console.error(err); }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !confirm("Bu grubu silmek istediğinize emin misiniz?")) return;
    try { const supabase = createClient(); await (supabase as any).from("visa_groups").delete().eq("id", selectedGroup.id); setShowDetailModal(false); setSelectedGroup(null); loadData(); } catch (err) { console.error(err); }
  };

  const availableFiles = selectedGroup
    ? allFiles.filter(f => !selectedGroup.files.some(sf => sf.id === f.id) && (searchTerm === "" || f.musteri_ad.toLowerCase().includes(searchTerm.toLowerCase())))
    : [];

  if (loading) return <div className="flex items-center justify-center h-[50vh]"><div className="w-7 h-7 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Gruplar</h1>
            <p className="text-slate-500 text-sm">Aile ve topluluk gruplarını oluşturun, dosyaları gruplayın ve toplu takip edin &middot; {groups.length} grup</p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
          + Yeni Grup
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <p className="text-slate-500 text-sm mb-4">Henüz grup oluşturulmamış</p>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg">Grup Oluştur</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <div key={group.id} onClick={() => { setSelectedGroup(group); setShowDetailModal(true); }} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">{group.grup_adi}</h3>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{group.fileCount} dosya</span>
              </div>
              {group.aciklama && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{group.aciklama}</p>}
              <div className="flex flex-wrap gap-1.5">
                {group.nearestAppointment && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                    Randevu: {getDays(group.nearestAppointment)} gün
                  </span>
                )}
                {group.unpaidCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">{group.unpaidCount} ödenmemiş</span>
                )}
                {group.unpaidCount === 0 && group.fileCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Ödemeler tamam</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Oluştur */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Yeni Grup" size="sm">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input label="Grup Adı" placeholder="Örn: Yılmaz Ailesi" value={grupAdi} onChange={(e) => setGrupAdi(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Not</label>
            <textarea placeholder="Açıklama..." value={grupNot} onChange={(e) => setGrupNot(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white">{isSubmitting ? "..." : "Oluştur"}</button>
          </div>
        </form>
      </Modal>

      {/* Detay */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedGroup(null); }} title={selectedGroup?.grup_adi || "Grup"} size="lg">
        {selectedGroup && (
          <div className="space-y-4">
            {selectedGroup.aciklama && <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{selectedGroup.aciklama}</div>}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Dosyalar ({selectedGroup.files.length})</p>
              <button onClick={() => setShowAddFileModal(true)} className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg font-medium">+ Ekle</button>
            </div>
            {selectedGroup.files.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Henüz dosya yok</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {selectedGroup.files.map(file => {
                  const st = getStatusLabel(file);
                  return (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800 text-sm">{file.musteri_ad}</p>
                          <Badge variant={st.variant} size="sm">{st.text}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{file.hedef_ulke}</span>
                          <span className="text-xs text-slate-400">{fmtCur(file.ucret, file.ucret_currency)}</span>
                          {file.randevu_tarihi && <span className="text-xs text-slate-400">{fmtDate(file.randevu_tarihi)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <StaffAvatar name={file.profiles?.name || "?"} size={18} />
                          <span className="text-[11px] text-slate-500">{file.profiles?.name}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingFile(file); setShowEditFileModal(true); }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleRemoveFile(file.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <button onClick={handleDeleteGroup} className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors">Grubu Sil</button>
              <button onClick={() => setShowDetailModal(false)} className="text-xs text-slate-600 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-colors">Kapat</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dosya Ekle */}
      <Modal isOpen={showAddFileModal} onClose={() => { setShowAddFileModal(false); setSearchTerm(""); }} title="Gruba Dosya Ekle" size="md">
        <div className="space-y-3">
          <Input placeholder="Müşteri ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {availableFiles.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">Eklenebilecek dosya yok</p>
          ) : (
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
              {availableFiles.slice(0, 20).map(file => (
                <button key={file.id} onClick={() => handleAddFile(file.id)} className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-primary-50 rounded-lg transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{file.musteri_ad}</p>
                    <p className="text-xs text-slate-500">{file.hedef_ulke} · {file.pasaport_no}</p>
                  </div>
                  <span className="text-xs text-primary-600 font-medium">+ Ekle</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Düzenle */}
      <Modal isOpen={showEditFileModal} onClose={() => { setShowEditFileModal(false); setEditingFile(null); }} title="Düzenle" size="xl">
        <VisaFileForm file={editingFile} onSuccess={() => { setShowEditFileModal(false); setEditingFile(null); loadData(); }} onCancel={() => { setShowEditFileModal(false); setEditingFile(null); }} />
      </Modal>
    </div>
  );
}
