"use client";

import { useState } from "react";
import { Button, Modal, Input, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyFileStatusChanged } from "@/lib/notifications";
import type { VisaFile, VizeSonucu } from "@/lib/supabase/types";

interface FileActionsProps {
  file: VisaFile;
  onUpdate: () => void;
  isAdmin?: boolean;
}

export default function FileActions({ file, onUpdate, isAdmin = false }: FileActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  
  // Confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"dosya_hazir" | "isleme_girdi" | "arsivle" | null>(null);
  
  // Sonuç modal
  const [showSonucModal, setShowSonucModal] = useState(false);
  const [sonuc, setSonuc] = useState<VizeSonucu | "">("");
  const [sonucTarihi, setSonucTarihi] = useState(new Date().toISOString().split("T")[0]);
  const [vizeBitisTarihi, setVizeBitisTarihi] = useState("");
  const [sonucError, setSonucError] = useState<string | null>(null);

  // Dosya tamamlandı mı kontrolü
  const isCompleted = file.sonuc !== null;
  const isArchived = file.arsiv_mi;
  const isReadOnly = isCompleted && !isAdmin;

  // Adım durumları
  const step1Done = file.dosya_hazir; // Dosya Hazır
  const step2Done = file.basvuru_yapildi; // İşleme Girdi
  const step3Done = file.islemden_cikti; // İşlemden Çıktı

  // Hangi buton aktif? (Sıralı kilit sistemi)
  const canStep1 = !step1Done && !isCompleted && !isArchived;
  const canStep2 = step1Done && !step2Done && !isCompleted && !isArchived;
  const canStep3 = step1Done && step2Done && !step3Done && !isCompleted && !isArchived;
  const canArchive = isCompleted && !isArchived;

  const openConfirmModal = (action: "dosya_hazir" | "isleme_girdi" | "arsivle") => {
    if (isLoading || actionInProgress) return;
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction || isLoading || actionInProgress) return;
    
    setShowConfirmModal(false);
    setIsLoading(true);
    setActionInProgress(confirmAction);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      const userName = profile?.name || "Kullanıcı";

      const timestamp = new Date().toISOString();
      let updateData: Partial<VisaFile> = {};
      let logMessage = "";
      let notifTitle = "";

      switch (confirmAction) {
        case "dosya_hazir":
          updateData = { dosya_hazir: true, dosya_hazir_at: timestamp };
          logMessage = `${file.musteri_ad} dosyasını hazır olarak işaretledi`;
          notifTitle = "Dosya Hazır";
          break;
        case "isleme_girdi":
          updateData = { basvuru_yapildi: true, basvuru_yapildi_at: timestamp };
          logMessage = `${file.musteri_ad} dosyası işleme girdi`;
          notifTitle = "İşleme Girdi";
          break;
        case "arsivle":
          updateData = { arsiv_mi: true };
          logMessage = `${file.musteri_ad} dosyasını arşivledi`;
          notifTitle = "Dosya Arşivlendi";
          break;
      }

      const { error } = await supabase.from("visa_files").update(updateData).eq("id", file.id);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        type: confirmAction,
        message: logMessage,
        file_id: file.id,
        actor_id: user.id,
      });

      await notifyFileStatusChanged(file.id, file.musteri_ad, notifTitle, logMessage, user.id, userName);

      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
      setConfirmAction(null);
    }
  };

  const handleIslemdenCikti = () => {
    if (isLoading || actionInProgress) return;
    setSonucError(null);
    setSonuc("");
    setSonucTarihi(new Date().toISOString().split("T")[0]);
    setVizeBitisTarihi("");
    setShowSonucModal(true);
  };

  const handleSonucKaydet = async () => {
    setSonucError(null);

    // Validasyonlar
    if (!sonuc) {
      setSonucError("Sonuç seçimi zorunludur");
      return;
    }
    if (!sonucTarihi) {
      setSonucError("Sonuç tarihi zorunludur");
      return;
    }
    if (sonuc === "vize_onay" && !vizeBitisTarihi) {
      setSonucError("Vize bitiş tarihi zorunludur");
      return;
    }

    if (isLoading || actionInProgress) return;
    setIsLoading(true);
    setActionInProgress("islemden_cikti");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      const userName = profile?.name || "Kullanıcı";

      const timestamp = new Date().toISOString();
      const updateData: Partial<VisaFile> = {
        islemden_cikti: true,
        islemden_cikti_at: timestamp,
        sonuc: sonuc as VizeSonucu,
        sonuc_tarihi: sonucTarihi,
        vize_bitis_tarihi: sonuc === "vize_onay" ? vizeBitisTarihi : null,
      };

      const { error } = await supabase.from("visa_files").update(updateData).eq("id", file.id);
      if (error) throw error;

      const sonucText = sonuc === "vize_onay" ? "Vize Onaylandı" : "Reddedildi";
      const logMessage = `${file.musteri_ad} dosyası işlemden çıktı: ${sonucText}`;

      await supabase.from("activity_logs").insert({
        type: "islemden_cikti",
        message: logMessage,
        file_id: file.id,
        actor_id: user.id,
      });

      await notifyFileStatusChanged(file.id, file.musteri_ad, `İşlemden Çıktı - ${sonucText}`, logMessage, user.id, userName);

      setShowSonucModal(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      setSonucError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
    }
  };

  const getConfirmMessage = () => {
    switch (confirmAction) {
      case "dosya_hazir":
        return `"${file.musteri_ad}" dosyasını HAZIR olarak işaretlemek istediğinize emin misiniz? Bu işlem geri alınamaz.`;
      case "isleme_girdi":
        return `"${file.musteri_ad}" dosyasını İŞLEME GİRDİ olarak işaretlemek istediğinize emin misiniz?`;
      case "arsivle":
        return `"${file.musteri_ad}" dosyasını arşivlemek istediğinize emin misiniz?`;
      default:
        return "";
    }
  };

  // Salt okunur mod (işlem tamamlanmış ve admin değil)
  if (isReadOnly) {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant={file.sonuc === "vize_onay" ? "success" : "error"}>
          {file.sonuc === "vize_onay" ? "Vize Onay" : "Reddedildi"}
        </Badge>
        <span className="text-xs text-navy-500">İşlem tamamlandı</span>
      </div>
    );
  }

  // Arşivlenmiş dosya
  if (isArchived) {
    return <Badge variant="default">Arşivde</Badge>;
  }

  // Tamamlanmış dosya (admin veya arşiv butonu)
  if (isCompleted) {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant={file.sonuc === "vize_onay" ? "success" : "error"}>
          {file.sonuc === "vize_onay" ? "Vize Onay" : "Reddedildi"}
        </Badge>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => openConfirmModal("arsivle")} 
          disabled={isLoading || actionInProgress !== null}
        >
          Arşivle
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Adım 1: Dosya Hazır */}
      <Button
        size="sm"
        variant={canStep1 ? "primary" : "ghost"}
        onClick={() => canStep1 && openConfirmModal("dosya_hazir")}
        disabled={!canStep1 || isLoading || actionInProgress !== null}
        title={!canStep1 ? (step1Done ? "✓ Dosya zaten hazır" : "") : "Dosyayı hazır olarak işaretle"}
        className={canStep1 ? "" : "opacity-50 cursor-not-allowed"}
      >
        {step1Done ? "✓ Dosya Hazır" : "1. Dosya Hazır"}
      </Button>

      {/* Adım 2: İşleme Girdi - Sadece step1 tamamlandıysa görünür */}
      {step1Done && (
        <Button
          size="sm"
          variant={canStep2 ? "primary" : "ghost"}
          onClick={() => canStep2 && openConfirmModal("isleme_girdi")}
          disabled={!canStep2 || isLoading || actionInProgress !== null}
          title={!canStep2 ? (step2Done ? "✓ Dosya zaten işlemde" : "") : "Dosyayı işleme al"}
          className={canStep2 ? "" : "opacity-50 cursor-not-allowed"}
        >
          {step2Done ? "✓ İşleme Girdi" : "2. İşleme Girdi"}
        </Button>
      )}

      {/* Adım 3: İşlemden Çıktı - Sadece step2 tamamlandıysa görünür */}
      {step2Done && (
        <Button
          size="sm"
          variant={canStep3 ? "primary" : "ghost"}
          onClick={() => canStep3 && handleIslemdenCikti()}
          disabled={!canStep3 || isLoading || actionInProgress !== null}
          title={!canStep3 ? (step3Done ? "✓ Dosya işlemden çıktı" : "") : "Sonucu gir ve işlemi tamamla"}
          className={canStep3 ? "" : "opacity-50 cursor-not-allowed"}
        >
          {step3Done ? "✓ İşlemden Çıktı" : "3. İşlemden Çıktı"}
        </Button>
      )}

      {/* Onay Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="İşlemi Onayla" size="sm">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-amber-800">{getConfirmMessage()}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} className="flex-1">
              İptal
            </Button>
            <Button onClick={handleConfirmedAction} disabled={isLoading} className="flex-1">
              {isLoading ? "İşleniyor..." : "Evet, Onayla"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sonuç Modal */}
      <Modal isOpen={showSonucModal} onClose={() => setShowSonucModal(false)} title="İşlem Sonucu" size="sm">
        <div className="space-y-4">
          {sonucError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {sonucError}
            </div>
          )}

          <div className="bg-navy-50 rounded-xl p-4 border border-navy-200">
            <p className="text-sm text-navy-500 mb-1">Dosya</p>
            <p className="font-semibold text-navy-900">{file.musteri_ad}</p>
            <p className="text-sm text-navy-600">{file.hedef_ulke}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-navy-700">Sonuç Nedir? *</label>
            <div className="flex gap-3">
              <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer text-center transition-all ${sonuc === "vize_onay" ? "border-green-500 bg-green-50" : "border-navy-200 hover:border-navy-300"}`}>
                <input type="radio" name="sonuc" value="vize_onay" checked={sonuc === "vize_onay"} onChange={() => setSonuc("vize_onay")} className="sr-only" />
                <span className="text-2xl mb-1 block">✅</span>
                <span className={`font-medium ${sonuc === "vize_onay" ? "text-green-700" : "text-navy-700"}`}>Vize Çıktı</span>
              </label>
              <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer text-center transition-all ${sonuc === "red" ? "border-red-500 bg-red-50" : "border-navy-200 hover:border-navy-300"}`}>
                <input type="radio" name="sonuc" value="red" checked={sonuc === "red"} onChange={() => setSonuc("red")} className="sr-only" />
                <span className="text-2xl mb-1 block">❌</span>
                <span className={`font-medium ${sonuc === "red" ? "text-red-700" : "text-navy-700"}`}>Red</span>
              </label>
            </div>
          </div>

          <Input
            label="Sonuç Tarihi *"
            type="date"
            value={sonucTarihi}
            onChange={(e) => setSonucTarihi(e.target.value)}
            required
          />

          {sonuc === "vize_onay" && (
            <Input
              label="Vize Bitiş Tarihi *"
              type="date"
              value={vizeBitisTarihi}
              onChange={(e) => setVizeBitisTarihi(e.target.value)}
              required
            />
          )}

          <div className="flex gap-3 pt-4 border-t border-navy-200">
            <Button type="button" variant="outline" onClick={() => setShowSonucModal(false)} className="flex-1" disabled={isLoading}>
              İptal
            </Button>
            <Button type="button" onClick={handleSonucKaydet} className="flex-1" disabled={isLoading || actionInProgress !== null}>
              {isLoading ? "Kaydediliyor..." : "Kaydet ve Tamamla"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
