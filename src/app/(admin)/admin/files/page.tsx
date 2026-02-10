"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyFileTransferred } from "@/lib/notifications";
import FileDetailModal from "@/components/files/FileDetailModal";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

function getStatusBadge(file: VisaFile) {
  if (file.sonuc === "vize_onay") return <Badge variant="success">Vize Onay</Badge>;
  if (file.sonuc === "red") return <Badge variant="error">Reddedildi</Badge>;
  if (file.islemden_cikti) return <Badge variant="purple">İşlemden Çıktı</Badge>;
  if (file.basvuru_yapildi) return <Badge variant="info">İşlemde</Badge>;
  if (file.dosya_hazir) return <Badge variant="info">Dosya Hazır</Badge>;
  if (file.evrak_eksik_mi) return <Badge variant="warning">Evrak Eksik</Badge>;
  return <Badge variant="default">Yeni</Badge>;
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return symbols[currency] || currency;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminFilesPage() {
  const [files, setFiles] = useState<VisaFileWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VisaFileWithProfile | null>(null);
  const [newAssignee, setNewAssignee] = useState("");
  const [transferring, setTransferring] = useState(false);
  
  // Detay modal
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Silme için
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<VisaFileWithProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    
    // Paralel sorgular (hız optimizasyonu)
    const [filesRes, profilesRes] = await Promise.all([
      supabase.from("visa_files").select("*, profiles:assigned_user_id(name)").eq("arsiv_mi", false).order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "staff"),
    ]);

    setFiles(filesRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransfer = async () => {
    if (!selectedFile || !newAssignee) return;
    
    setTransferring(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      // Admin profili
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single<{ name: string }>();
      const adminName = adminProfile?.name || "Admin";

      const oldAssigneeId = selectedFile.assigned_user_id;
      const newProfile = profiles.find(p => p.id === newAssignee);
      const newOwnerName = newProfile?.name || "Personel";

      // Dosyayı güncelle
      await (supabase as any)
        .from("visa_files")
        .update({ assigned_user_id: newAssignee })
        .eq("id", selectedFile.id);

      // Activity log
      await (supabase as any).from("activity_logs").insert({
        type: "transfer",
        message: `${selectedFile.musteri_ad} dosyasını ${newOwnerName} personeline atadı`,
        file_id: selectedFile.id,
        actor_id: user.id,
      });

      // Bildirimleri gönder
      await notifyFileTransferred(
        selectedFile.id,
        selectedFile.musteri_ad,
        selectedFile.hedef_ulke,
        oldAssigneeId,
        newAssignee,
        newOwnerName,
        user.id,
        adminName
      );

      setShowTransferModal(false);
      setSelectedFile(null);
      setNewAssignee("");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Transfer sırasında hata oluştu");
    } finally {
      setTransferring(false);
    }
  };

  const staffOptions = profiles.map(p => ({ value: p.id, label: p.name }));

  const handleDeleteClick = (file: VisaFileWithProfile) => { setFileToDelete(file); setShowDeleteModal(true); };
  
  const handleDelete = async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    
    try {
      const supabase = createClient();
      
      // Önce ilgili ödemeleri sil
      await supabase.from("payments").delete().eq("file_id", fileToDelete.id);
      
      // İlgili activity logları sil
      await supabase.from("activity_logs").delete().eq("file_id", fileToDelete.id);
      
      // İlgili bildirimleri sil
      await supabase.from("notifications").delete().eq("file_id", fileToDelete.id);
      
      // Grup üyeliklerini sil
      await supabase.from("visa_group_members").delete().eq("visa_file_id", fileToDelete.id);
      
      // Dosyayı sil
      const { error } = await supabase.from("visa_files").delete().eq("id", fileToDelete.id);
      
      if (error) throw error;
      
      setShowDeleteModal(false);
      setFileToDelete(null);
      loadData();
    } catch (err) {
      console.error("Silme hatası:", err);
      alert("Dosya silinirken hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">📁</span>
            Tüm Vize Dosyaları
          </h1>
          <p className="text-navy-500 mt-1">Dosyaları görüntüleyin ve personele atayın</p>
        </div>
        <div className="bg-navy-100 px-4 py-2 rounded-xl">
          <span className="font-bold text-navy-900">{files.length}</span>
          <span className="text-navy-500 ml-1">dosya</span>
        </div>
      </div>

      {/* Dosya Listesi */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            📋 Dosyalar
          </h3>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📂</span>
              </div>
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Dosya Bulunamadı</h3>
              <p className="text-navy-500">Henüz dosya oluşturulmamış.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-navy-200">
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">Müşteri</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">Ülke</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">Ücret</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">Randevu</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">Durum</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">Atanan</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-navy-700">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr key={file.id} className={`border-b border-navy-100 hover:bg-gradient-to-r hover:from-primary-50 hover:to-white transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-navy-50/50'}`}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center shadow-sm">
                            <span className="text-primary-600 font-bold">{file.musteri_ad.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-navy-900">{file.musteri_ad}</p>
                            <p className="text-xs text-navy-500">{file.pasaport_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="info">{file.hedef_ulke}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-navy-900">{file.ucret?.toLocaleString('tr-TR')} {getCurrencySymbol(file.ucret_currency)}</span>
                          <div className="flex gap-1">
                            <Badge variant={file.odeme_plani === "pesin" ? "success" : "warning"} size="sm">
                              {file.odeme_plani === "pesin" ? "Peşin" : "Cari"}
                            </Badge>
                            <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm">
                              {file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi"}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-navy-600">{formatDate(file.randevu_tarihi)}</td>
                      <td className="py-4 px-4">{getStatusBadge(file)}</td>
                      <td className="py-4 px-4">
                        <Badge variant="purple">{file.profiles?.name || "-"}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDetailFileId(file.id);
                              setShowDetailModal(true);
                            }}
                            className="hover:bg-primary-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedFile(file);
                              setNewAssignee(file.assigned_user_id);
                              setShowTransferModal(true);
                            }}
                            className="hover:bg-blue-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Ata
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClick(file)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Transfer Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => { setShowTransferModal(false); setSelectedFile(null); }}
        title="Dosya Atama"
        size="sm"
      >
        {selectedFile && (
          <div className="space-y-4">
            <div className="bg-navy-50 p-4 rounded-xl">
              <p className="font-medium text-navy-900">{selectedFile.musteri_ad}</p>
              <p className="text-sm text-navy-500">{selectedFile.hedef_ulke} • {selectedFile.pasaport_no}</p>
              <p className="text-sm text-navy-500 mt-1">
                Mevcut: <strong>{selectedFile.profiles?.name || "-"}</strong>
              </p>
            </div>

            <Select
              label="Personel Seçin"
              options={staffOptions}
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
            />

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowTransferModal(false)} className="flex-1">
                İptal
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={transferring || !newAssignee || newAssignee === selectedFile.assigned_user_id}
                className="flex-1"
              >
                {transferring ? "Atanıyor..." : "Ata"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detay Modal */}
      <FileDetailModal
        fileId={detailFileId}
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setDetailFileId(null); }}
      />
      
      {/* Silme Onay Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setFileToDelete(null); }} title="Dosyayı Sil" size="sm">
        {fileToDelete && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-red-900 text-lg mb-2">Emin misiniz?</h3>
              <p className="text-sm text-red-700">
                <strong>{fileToDelete.musteri_ad}</strong> dosyası ve ilgili tüm veriler (ödemeler, loglar, bildirimler) kalıcı olarak silinecek.
              </p>
              <p className="text-xs text-red-500 mt-3 bg-red-100 rounded-lg py-2">⚠️ Bu işlem geri alınamaz!</p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }} className="flex-1">İptal</Button>
              <Button variant="ghost" className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
