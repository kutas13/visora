"use client";

import { useState, useEffect } from "react";
import { Badge, Modal, Select, CustomerAvatar, resolveAvatarStatus } from "@/components/ui";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { notifyFileTransferred } from "@/lib/notifications";
import FileDetailModal from "@/components/files/FileDetailModal";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ZAFER: "/zafer-avatar.png",
  ERCAN: "/ercan-avatar.png",
  BAHAR: "/bahar-avatar.jpg",
};

function getStatusBadge(file: VisaFile) {
  const isChina = file.hedef_ulke === "Çin";
  if (file.sonuc === "vize_onay") return <Badge variant="success">Onay</Badge>;
  if (file.sonuc === "red") return <Badge variant="error">Red</Badge>;
  if (file.islemden_cikti) return <Badge variant="purple">Çıktı</Badge>;
  if (file.basvuru_yapildi) return <Badge variant="info">İşlemde</Badge>;
  if (file.dosya_hazir) return <Badge variant="info">{isChina ? "Onay Geldi" : "Hazır"}</Badge>;
  if (file.evrak_eksik_mi) return <Badge variant="warning">Eksik</Badge>;
  return <Badge variant="default">Yeni</Badge>;
}

function sym(c: string) { return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-"; }

function StaffAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const src = USER_AVATARS[name.toUpperCase()];
  if (src) {
    return (
      <div className="rounded-full overflow-hidden ring-1 ring-slate-200" style={{ width: size, height: size }}>
        <Image src={src} alt={name} width={size} height={size} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="rounded-full bg-primary-100 flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="text-primary-600 font-bold" style={{ fontSize: size * 0.4 }}>{name.charAt(0)}</span>
    </div>
  );
}

type ViewMode = "active" | "islemden_cikti";

export default function AdminFilesPage() {
  const [files, setFiles] = useState<VisaFileWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VisaFileWithProfile | null>(null);
  const [newAssignee, setNewAssignee] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<VisaFileWithProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [islemdenCiktiCount, setIslemdenCiktiCount] = useState<number>(0);

  const loadData = async (mode: ViewMode = viewMode) => {
    setLoading(true);
    const supabase = createClient();

    const filesQuery =
      mode === "islemden_cikti"
        ? supabase
            .from("visa_files")
            .select("*, profiles:assigned_user_id(name)")
            .eq("islemden_cikti", true)
            .order("islemden_cikti_at", { ascending: false })
        : supabase
            .from("visa_files")
            .select("*, profiles:assigned_user_id(name)")
            .is("sonuc", null)
            .order("created_at", { ascending: false });

    const [filesRes, profilesRes, islemdenCiktiCountRes] = await Promise.all([
      filesQuery,
      supabase.from("profiles").select("*").eq("role", "staff"),
      supabase
        .from("visa_files")
        .select("id", { count: "exact", head: true })
        .eq("islemden_cikti", true),
    ]);
    setFiles(filesRes.data || []);
    setProfiles(profilesRes.data || []);
    setIslemdenCiktiCount(islemdenCiktiCountRes.count || 0);
    setLoading(false);
  };

  useEffect(() => { loadData(viewMode); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [viewMode]);

  const handleTransfer = async () => {
    if (!selectedFile || !newAssignee) return;
    setTransferring(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");
      const { data: adminProfile } = await supabase.from("profiles").select("name").eq("id", user.id).single<{ name: string }>();
      const adminName = adminProfile?.name || "Admin";
      const oldAssigneeId = selectedFile.assigned_user_id;
      const newProfile = profiles.find(p => p.id === newAssignee);
      const newOwnerName = newProfile?.name || "Personel";

      await (supabase as any).from("visa_files").update({ assigned_user_id: newAssignee }).eq("id", selectedFile.id);
      await (supabase as any).from("activity_logs").insert({ type: "transfer", message: `${selectedFile.musteri_ad} dosyasını ${newOwnerName} personeline atadı`, file_id: selectedFile.id, actor_id: user.id });
      await notifyFileTransferred(selectedFile.id, selectedFile.musteri_ad, selectedFile.hedef_ulke, oldAssigneeId, newAssignee, newOwnerName, user.id, adminName);

      setShowTransferModal(false);
      setSelectedFile(null);
      setNewAssignee("");
      loadData(viewMode);
    } catch (err) {
      console.error(err);
      alert("Transfer sırasında hata oluştu");
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-visa-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: fileToDelete.id }),
      });
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error || "Dosya silinemedi."); }
      setShowDeleteModal(false);
      setFileToDelete(null);
      loadData(viewMode);
    } catch (err) {
      console.error("Silme hatası:", err);
      alert("Dosya silinirken hata oluştu");
    } finally {
      setDeleting(false);
    }
  };

  const filteredFiles = (
    search.trim()
      ? files.filter(f =>
          f.musteri_ad.toLowerCase().includes(search.toLowerCase()) ||
          f.pasaport_no.toLowerCase().includes(search.toLowerCase()) ||
          f.hedef_ulke.toLowerCase().includes(search.toLowerCase()) ||
          (f.profiles?.name || "").toLowerCase().includes(search.toLowerCase())
        )
      : files
  ).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const staffOptions = profiles.map(p => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Vize Dosyaları</h1>
            <p className="text-slate-500 text-sm">
              {viewMode === "islemden_cikti"
                ? "İşlemden çıkmış dosyalar"
                : "Tüm personellerin dosyalarını görüntüleyin, filtreleyin, düzenleyin ve işlem yapın"}
              &nbsp;&middot;&nbsp;{files.length} dosya
            </p>
          </div>
        </div>
        <input
          type="text"
          placeholder="Müşteri, pasaport, ülke veya personel ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-80 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Görünüm filtresi */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode("active")}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            viewMode === "active"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Aktif Dosyalar
        </button>
        <button
          type="button"
          onClick={() => setViewMode("islemden_cikti")}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            viewMode === "islemden_cikti"
              ? "bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/20"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          İşlemden Çıkan Dosyalar
          {islemdenCiktiCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              viewMode === "islemden_cikti" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
            }`}>
              {islemdenCiktiCount}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">
              {search
                ? "Sonuç bulunamadı"
                : viewMode === "islemden_cikti"
                  ? "İşlemden çıkmış dosya yok"
                  : "Henüz dosya yok"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ülke</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ücret</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Randevu</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Personel</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar name={file.musteri_ad} size="sm" status={resolveAvatarStatus(file)} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{file.musteri_ad}</p>
                          <p className="text-xs text-slate-400">{file.pasaport_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{file.hedef_ulke}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{((file.ucret || 0) + (file.davetiye_ucreti || 0)).toLocaleString("tr-TR")} {sym(file.ucret_currency)}</p>
                      {(file.davetiye_ucreti || 0) > 0 && (
                        <p className="text-xs text-slate-400">{file.ucret?.toLocaleString("tr-TR")} + {file.davetiye_ucreti?.toLocaleString("tr-TR")} dav.</p>
                      )}
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant={file.cari_tipi === "firma_cari" ? "purple" : file.odeme_plani === "pesin" ? "success" : "warning"} size="sm">
                          {file.cari_tipi === "firma_cari" ? "Firma Cari" : file.odeme_plani === "pesin" ? "Peşin" : "Cari"}
                        </Badge>
                        {file.cari_tipi !== "firma_cari" && (
                          <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm">
                            {file.odeme_durumu === "odendi" ? "Ödendi" : "Bekliyor"}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {viewMode === "islemden_cikti" ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400">Çıkış</span>
                          <span className="text-slate-700 font-medium">{fmtDate(file.islemden_cikti_at || file.sonuc_tarihi)}</span>
                        </div>
                      ) : (
                        fmtDate(file.randevu_tarihi)
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(file)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <StaffAvatar name={file.profiles?.name || "?"} size={28} />
                        <span className="text-sm text-slate-700">{file.profiles?.name || "-"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 justify-end items-center flex-wrap">
                        <button
                          type="button"
                          onClick={() => { setDetailFileId(file.id); setShowDetailModal(true); }}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-primary-50 hover:border-primary-300 transition-colors"
                        >
                          Görüntüle
                        </button>
                        <button
                          onClick={() => { setSelectedFile(file); setNewAssignee(file.assigned_user_id); setShowTransferModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ata"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                        <button
                          onClick={() => { setFileToDelete(file); setShowDeleteModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      <Modal isOpen={showTransferModal} onClose={() => { setShowTransferModal(false); setSelectedFile(null); }} title="Dosya Atama" size="sm">
        {selectedFile && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="font-medium text-slate-800 text-sm">{selectedFile.musteri_ad}</p>
              <p className="text-xs text-slate-500">{selectedFile.hedef_ulke} · {selectedFile.pasaport_no}</p>
              <p className="text-xs text-slate-500 mt-1">Mevcut: <strong>{selectedFile.profiles?.name || "-"}</strong></p>
            </div>
            <Select label="Personel Seçin" options={staffOptions} value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
              <button onClick={handleTransfer} disabled={transferring || !newAssignee || newAssignee === selectedFile.assigned_user_id} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
                {transferring ? "Atanıyor..." : "Ata"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <FileDetailModal
        fileId={detailFileId}
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setDetailFileId(null); }}
        scrollToHistoryOnOpen
        title="Dosya ve işlem geçmişi"
      />

      {/* Silme Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setFileToDelete(null); }} title="Dosyayı Sil" size="sm">
        {fileToDelete && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-sm text-red-700"><strong>{fileToDelete.musteri_ad}</strong> dosyası ve ilgili tüm veriler kalıcı olarak silinecek.</p>
              <p className="text-xs text-red-500 mt-2">Bu işlem geri alınamaz.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
                {deleting ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
