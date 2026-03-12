"use client";

import { useState } from "react";
import { Button, Modal, Input, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyFileStatusChanged } from "@/lib/notifications";
import { STAFF_USERS, ADMIN_USER } from "@/lib/constants";
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
  const [musteriTelefon, setMusteriTelefon] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [sonucError, setSonucError] = useState<string | null>(null);

  // Dosya tamamlandı mı kontrolü
  const isCompleted = file.sonuc !== null;
  const isArchived = file.arsiv_mi;
  const isReadOnly = isCompleted && !isAdmin;

  const isChina = file.hedef_ulke === "Çin";

  // Adım durumları
  const step1Done = file.dosya_hazir;
  const step2Done = file.basvuru_yapildi;
  const step3Done = file.islemden_cikti;

  const step1Label = isChina ? "Onay Geldi" : "Dosya Hazır";
  const step3Label = isChina ? "Çıktı" : "İşlemden Çıktı";

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
          updateData = { dosya_hazir: true, dosya_hazir_at: timestamp, evrak_eksik_mi: false, evrak_durumu: "geldi" as any };
          logMessage = isChina
            ? `${file.musteri_ad} dosyası için onay geldi`
            : `${file.musteri_ad} dosyasını hazır olarak işaretledi`;
          notifTitle = isChina ? "Onay Geldi" : "Dosya Hazır";
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
        musteri_telefon: musteriTelefon.trim() || null,
        arsiv_mi: true,
      };

      const { error } = await supabase.from("visa_files").update(updateData).eq("id", file.id);
      if (error) throw error;

      const sonucText = sonuc === "vize_onay" ? "Vize Onaylandı" : "Reddedildi";
      const logMessage = `${file.musteri_ad} dosyası işlemden çıktı: ${sonucText}`;

      await supabase.from("activity_logs").insert([
        {
          type: "islemden_cikti",
          message: logMessage,
          file_id: file.id,
          actor_id: user.id,
        },
        {
          type: "arsivle",
          message: `${file.musteri_ad} dosyası otomatik arşivlendi (${sonucText})`,
          file_id: file.id,
          actor_id: user.id,
        },
      ]);

      await notifyFileStatusChanged(file.id, file.musteri_ad, `İşlemden Çıktı - ${sonucText}`, logMessage, user.id, userName);

      const cleanPhone = musteriTelefon ? musteriTelefon.replace(/\D/g, "") : "";
      if (cleanPhone.length >= 10 && sonuc === "vize_onay") {
        try {
          const staffInfo = [...STAFF_USERS, ADMIN_USER].find(
            s => s.name.toUpperCase() === userName.toUpperCase()
          );
          const staffPhone = staffInfo?.phone || "";
          const staffHitap = staffInfo?.hitap || userName;
          const bitisTarihStr = vizeBitisTarihi
            ? new Date(vizeBitisTarihi).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
            : "";

          const message = [
            `Sayın ${file.musteri_ad},`,
            ``,
            `${file.hedef_ulke} vize başvurunuzla ilgili sevindirici haberimiz var! 🎉`,
            ``,
            `Vize başvurunuz *onaylanmıştır*. ✅`,
            ``,
            `📅 Vize Geçerlilik: ${bitisTarihStr} tarihine kadar`,
            `🛂 Hedef Ülke: ${file.hedef_ulke}`,
            ``,
            `Pasaportunuzu en kısa sürede ofisimizden teslim alabilirsiniz.`,
            ``,
            `⏰ Çalışma Saatlerimiz:`,
            `Hafta içi 09:00 - 18:00`,
            ``,
            `📌 Önemli Hatırlatma: Vize bitiş tarihiniz yaklaştığında tarafınıza tekrar bilgilendirme yapılacaktır. Yeniden başvuru için bizimle iletişime geçebilirsiniz.`,
            ``,
            `Bizi tercih ettiğiniz için teşekkür eder, iyi yolculuklar dileriz! 🙏✈️`,
            ``,
            `*Fox Turizm*`,
            `${staffHitap}`,
            staffPhone ? `📞 ${staffPhone}` : ``,
          ].filter(Boolean).join("\n");

          let phone = cleanPhone;
          if (phone.startsWith("0")) phone = "90" + phone.slice(1);
          if (!phone.startsWith("90")) phone = "90" + phone;

          console.log("WhatsApp müşteri mesajı gönderiliyor:", { phone, musteriAd: file.musteri_ad });

          const wpRes = await fetch("/api/whatsapp/send-direct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, message }),
          });

          const wpData = await wpRes.json().catch(() => ({}));
          console.log("WhatsApp müşteri sonuç:", wpRes.status, wpData);

          if (wpRes.ok) {
            setToast({ message: `${file.musteri_ad} müşterinize WhatsApp bilgilendirme mesajı gönderildi ✅`, type: "success" });
            setTimeout(() => setToast(null), 4000);
          } else {
            console.error("WhatsApp müşteri hata:", wpData);
            setToast({ message: "WhatsApp mesajı gönderilemedi", type: "error" });
            setTimeout(() => setToast(null), 4000);
          }
        } catch (wpErr) {
          console.error("Müşteri WhatsApp gönderilemedi:", wpErr);
          setToast({ message: "WhatsApp mesajı gönderilemedi", type: "error" });
          setTimeout(() => setToast(null), 4000);
        }
      }

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
        return isChina
          ? `"${file.musteri_ad}" dosyasını ONAY GELDİ olarak işaretlemek istediğinize emin misiniz? Bu işlem geri alınamaz.`
          : `"${file.musteri_ad}" dosyasını HAZIR olarak işaretlemek istediğinize emin misiniz? Bu işlem geri alınamaz.`;
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
      {/* Adım 1: Dosya Hazır / Onay Geldi (Çin) */}
      <Button
        size="sm"
        variant={canStep1 ? "primary" : "ghost"}
        onClick={() => canStep1 && openConfirmModal("dosya_hazir")}
        disabled={!canStep1 || isLoading || actionInProgress !== null}
        title={!canStep1 ? (step1Done ? `✓ ${step1Label}` : "") : `${step1Label} olarak işaretle`}
        className={canStep1 ? "" : "opacity-50 cursor-not-allowed"}
      >
        {step1Done ? `✓ ${step1Label}` : `1. ${step1Label}`}
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

      {/* Adım 3: İşlemden Çıktı / Çıktı (Çin) */}
      {step2Done && (
        <Button
          size="sm"
          variant={canStep3 ? "primary" : "ghost"}
          onClick={() => canStep3 && handleIslemdenCikti()}
          disabled={!canStep3 || isLoading || actionInProgress !== null}
          title={!canStep3 ? (step3Done ? `✓ ${step3Label}` : "") : "Sonucu gir ve işlemi tamamla"}
          className={canStep3 ? "" : "opacity-50 cursor-not-allowed"}
        >
          {step3Done ? `✓ ${step3Label}` : `3. ${step3Label}`}
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

          {/* İletişim Bilgisi */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy-700">Müşteri Telefon Numarası</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-navy-600 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg">
                  +90
                </span>
                <input
                  type="text"
                  placeholder="5058937071"
                  value={musteriTelefon.replace(/^90/, "")} // 90 prefix'i gösterme
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setMusteriTelefon("90" + digits); // Otomatik 90 ekle
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  maxLength={10}
                />
              </div>
              <p className="text-xs text-navy-500">
                Sadece numarayı girin, +90 otomatik eklenir
              </p>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              💡 Vize bitiş hatırlatması için kayıt edilir (WhatsApp sayfasından mesaj gönderilebilir)
            </p>
          </div>

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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-sm ${
            toast.type === "success"
              ? "bg-emerald-50/95 border-emerald-200 text-emerald-800"
              : "bg-red-50/95 border-red-200 text-red-800"
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
              toast.type === "success" ? "bg-emerald-500" : "bg-red-500"
            }`}>
              <span className="text-white text-sm">{toast.type === "success" ? "✓" : "✕"}</span>
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
