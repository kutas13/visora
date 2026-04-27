"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Badge, Modal, Select, CustomerAvatar, resolveAvatarStatus } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyFileTransferred } from "@/lib/notifications";
import FileDetailModal from "@/components/files/FileDetailModal";
import FileActions from "@/components/files/FileActions";
import type { VisaFile, Profile } from "@/lib/supabase/types";

const VisaFileForm = dynamic(() => import("@/components/files/VisaFileForm"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  ),
});

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

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

function sym(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-";
}

function StaffPill({ name }: { name: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 ring-1 ring-slate-200">
      <span className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-[10px] font-extrabold text-white">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="text-[11.5px] font-semibold text-slate-700">{name}</span>
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [fileToEdit, setFileToEdit] = useState<VisaFileWithProfile | null>(null);

  const loadData = async (mode: ViewMode = viewMode) => {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    let orgId: string | null = null;
    if (user) {
      const { data: me } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle<{ organization_id: string | null }>();
      orgId = me?.organization_id ?? null;
    }

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

    let profilesQuery = supabase
      .from("profiles")
      .select("*")
      .eq("role", "staff");
    if (orgId) {
      profilesQuery = profilesQuery.eq("organization_id", orgId);
    }

    const [filesRes, profilesRes, islemdenCiktiCountRes] = await Promise.all([
      filesQuery,
      profilesQuery,
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
    if (newAssignee === selectedFile.assigned_user_id) {
      alert("Dosya zaten bu personele atanmış.");
      return;
    }
    setTransferring(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle<{ name: string }>();
      const adminName = adminProfile?.name || "Yönetici";

      const oldAssigneeId = selectedFile.assigned_user_id;
      const newProfile = profiles.find((p) => p.id === newAssignee);
      const newOwnerName = newProfile?.name || "Personel";

      const { data: updatedRows, error: updateError } = await supabase
        .from("visa_files")
        .update({ assigned_user_id: newAssignee })
        .eq("id", selectedFile.id)
        .select("id, assigned_user_id");

      if (updateError) throw new Error(updateError.message || "Atama veritabanına yazılamadı.");
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Atama yetkiniz bulunmuyor olabilir (RLS). Yöneticiyle iletişime geçin.");
      }

      const { error: logError } = await supabase.from("activity_logs").insert({
        type: "transfer",
        message: `${selectedFile.musteri_ad} dosyasını ${newOwnerName} personeline atadı`,
        file_id: selectedFile.id,
        actor_id: user.id,
      });
      if (logError) console.warn("activity_logs insert error:", logError.message);

      try {
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
      } catch (notifErr) {
        console.warn("notifyFileTransferred failed:", notifErr);
      }

      setShowTransferModal(false);
      setSelectedFile(null);
      setNewAssignee("");
      await loadData(viewMode);
    } catch (err) {
      console.error("Transfer error:", err);
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      alert(`Atama yapılamadı: ${msg}`);
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
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Dosya silinemedi.");
      }
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

  const totalActive = files.filter(f => !f.sonuc && !f.islemden_cikti).length;

  return (
    <div className="space-y-5">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Operasyon</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
              Vize Dosyaları
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {viewMode === "islemden_cikti"
                ? "İşlemden çıkmış arşiv dosyaları"
                : "Tüm personelin aktif dosyaları · ata, düzenle, ilerlet"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/admin/files/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Dosya
          </a>
        </div>
      </div>

      {/* TOOLBAR — Filter + Search */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode("active")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "active"
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Aktif
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${viewMode === "active" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"}`}>
              {totalActive}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("islemden_cikti")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "islemden_cikti"
                ? "bg-white text-fuchsia-700 shadow-sm ring-1 ring-fuchsia-100"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            İşlemden Çıkan
            {islemdenCiktiCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${viewMode === "islemden_cikti" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-200 text-slate-600"}`}>
                {islemdenCiktiCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Müşteri, pasaport, ülke veya personel ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/60 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all"
          />
        </div>

        <span className="hidden md:inline-flex items-center text-[11px] font-bold text-slate-500 bg-slate-50 ring-1 ring-slate-200 px-2.5 py-1 rounded-full">
          {filteredFiles.length} kayıt
        </span>
      </div>

      {/* TABLE / CARD */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {search ? "Sonuç bulunamadı" : viewMode === "islemden_cikti" ? "İşlemden çıkmış dosya yok" : "Henüz dosya yok"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? "Farklı bir arama deneyin" : "İlk dosyayı oluşturmak için yukarıdaki butonu kullanın"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-50/0">
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Müşteri</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Ülke</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Ücret · Ödeme</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">{viewMode === "islemden_cikti" ? "Çıkış" : "Randevu"}</th>
                  <th className="text-center py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Durum</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Personel</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="group hover:bg-indigo-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={file.musteri_ad} size="sm" status={resolveAvatarStatus(file)} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{file.musteri_ad}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{file.pasaport_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-sm text-slate-700 font-medium">{file.hedef_ulke}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-extrabold text-slate-900 leading-tight">
                        {((file.ucret || 0) + (file.davetiye_ucreti || 0)).toLocaleString("tr-TR")} <span className="text-slate-500 font-bold">{sym(file.ucret_currency)}</span>
                      </p>
                      {(file.davetiye_ucreti || 0) > 0 && (
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {file.ucret?.toLocaleString("tr-TR")} + {file.davetiye_ucreti?.toLocaleString("tr-TR")} dav.
                        </p>
                      )}
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
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
                    <td className="py-3.5 px-4">
                      <span className="text-[12px] text-slate-700 font-semibold">
                        {viewMode === "islemden_cikti"
                          ? fmtDate(file.islemden_cikti_at || file.sonuc_tarihi)
                          : fmtDate(file.randevu_tarihi)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">{getStatusBadge(file)}</td>
                    <td className="py-3.5 px-4">
                      <StaffPill name={file.profiles?.name || "?"} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1 justify-end items-center flex-wrap">
                        <div className="mr-1 min-w-[140px]">
                          <FileActions file={file} onUpdate={() => loadData(viewMode)} isAdmin />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setDetailFileId(file.id); setShowDetailModal(true); }}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700 transition-all"
                        >
                          Görüntüle
                        </button>
                        <button
                          onClick={() => { setFileToEdit(file); setShowEditModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => { setSelectedFile(file); setNewAssignee(file.assigned_user_id); setShowTransferModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Ata"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                        <button
                          onClick={() => { setFileToDelete(file); setShowDeleteModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 p-3.5">
              <p className="font-bold text-slate-900 text-sm">{selectedFile.musteri_ad}</p>
              <p className="text-[11.5px] text-slate-500 mt-0.5">{selectedFile.hedef_ulke} · {selectedFile.pasaport_no}</p>
              <p className="text-[11.5px] text-slate-500 mt-1.5">Mevcut: <strong className="text-slate-700">{selectedFile.profiles?.name || "-"}</strong></p>
            </div>
            <Select label="Personel Seçin" options={staffOptions} value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200 transition-colors">İptal</button>
              <button onClick={handleTransfer} disabled={transferring || !newAssignee || newAssignee === selectedFile.assigned_user_id} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/25">
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

      {/* Düzenleme Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setFileToEdit(null); }}
        title="Dosyayı Düzenle"
        size="xl"
      >
        {fileToEdit && (
          <VisaFileForm
            file={fileToEdit}
            onSuccess={() => {
              setShowEditModal(false);
              setFileToEdit(null);
              loadData(viewMode);
            }}
            onCancel={() => { setShowEditModal(false); setFileToEdit(null); }}
          />
        )}
      </Modal>

      {/* Silme Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setFileToDelete(null); }} title="Dosyayı Sil" size="sm">
        {fileToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4 text-center">
              <p className="text-sm text-rose-800"><strong>{fileToDelete.musteri_ad}</strong> dosyası ve ilgili tüm veriler kalıcı olarak silinecek.</p>
              <p className="text-[11px] text-rose-600 mt-1.5">Bu işlem geri alınamaz.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setFileToDelete(null); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200 transition-colors">İptal</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 disabled:opacity-50 transition-colors shadow-lg shadow-rose-500/25">
                {deleting ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
