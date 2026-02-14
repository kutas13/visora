"use client";

import { useState, useEffect, useMemo } from "react";
import { Button, Input, Select, Card } from "@/components/ui";
import { TARGET_COUNTRIES, ISLEM_TIPLERI, EVRAK_DURUMLARI, PARA_BIRIMLERI, ODEME_PLANLARI_EXTENDED, HESAP_SAHIPLERI, FATURA_TIPLERI, ALL_USERS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { notifyFileCreated, notifyFileUpdated } from "@/lib/notifications";
import type { VisaFile, IslemTipi, EvrakDurumu, ParaBirimi, OdemePlani, HesapSahibi, FaturaTipi, Company } from "@/lib/supabase/types";

type UIPaymentPlan = "pesin" | "cari" | "firma_cari";

interface VisaFileFormProps {
  file?: VisaFile | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VisaFileForm({ file, onSuccess, onCancel }: VisaFileFormProps) {
  const isEdit = !!file;
  
  const [musteriAd, setMusteriAd] = useState(file?.musteri_ad || "");
  const [pasaportNo, setPasaportNo] = useState(file?.pasaport_no || "");
  const [hedefUlke, setHedefUlke] = useState(file?.hedef_ulke || "Almanya");
  const [ulkeManuelMi, setUlkeManuelMi] = useState(file?.ulke_manuel_mi || false);
  const [manuelUlke, setManuelUlke] = useState(file?.ulke_manuel_mi ? file.hedef_ulke : "");
  const [islemTipi, setIslemTipi] = useState<IslemTipi>(file?.islem_tipi || "randevulu");
  const [randevuTarihi, setRandevuTarihi] = useState(
    file?.randevu_tarihi ? new Date(file.randevu_tarihi).toISOString().slice(0, 16) : ""
  );
  const [evrakDurumu, setEvrakDurumu] = useState<EvrakDurumu>(file?.evrak_durumu || "gelmedi");
  const [evrakEksikMi, setEvrakEksikMi] = useState<boolean | null>(file?.evrak_eksik_mi ?? null);
  const [evrakNot, setEvrakNot] = useState(file?.evrak_not || "");
  
  // Ödeme bilgileri
  const [ucret, setUcret] = useState(file?.ucret?.toString() || "");
  const [ucretCurrency, setUcretCurrency] = useState<ParaBirimi>(file?.ucret_currency || "TL");
  const [odemePlani, setOdemePlani] = useState<UIPaymentPlan>(
    file?.cari_tipi === "firma_cari" ? "firma_cari" : (file?.odeme_plani || "cari")
  );
  
  // Yeni ödeme detayları
  const [hesapSahibi, setHesapSahibi] = useState<HesapSahibi | null>(file?.hesap_sahibi || null);
  const [onOdemeVar, setOnOdemeVar] = useState(!!file?.on_odeme_tutar);
  const [onOdemeTutar, setOnOdemeTutar] = useState(file?.on_odeme_tutar?.toString() || "");
  const [onOdemeCurrency, setOnOdemeCurrency] = useState<ParaBirimi>(file?.on_odeme_currency || "TL");
  const [cariSahibi, setCariSahibi] = useState<string>(""); // Hangi kullanıcının carisi
  
  // Firma cari
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [faturaTipi, setFaturaTipi] = useState<FaturaTipi>("isimli");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  const countryOptions = TARGET_COUNTRIES.filter(c => c.value !== "all");

  // Kullanıcı adını yükle
  useEffect(() => {
    const loadUserName = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        const name = profile?.name || "Kullanıcı";
        setUserName(name);
        setCariSahibi(name); // Cari sahibini otomatik ayarla
      }
    };
    loadUserName();
  }, []);

  // Firma listesi yükle
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await fetch("/api/companies");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.data || []);
        }
      } catch (err) {
        console.error("Firma listesi alınamadı:", err);
      }
    };
    loadCompanies();
  }, []);

  // Firma arama filtreleme
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    return companies.filter(c => 
      c.firma_adi.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [companies, companySearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!musteriAd.trim()) { setError("Müşteri adı zorunludur"); return; }
    if (!pasaportNo.trim()) { setError("Pasaport numarası zorunludur"); return; }
    if (ulkeManuelMi && !manuelUlke.trim()) { setError("Hedef ülke zorunludur"); return; }
    if (islemTipi === "randevulu" && !randevuTarihi) { setError("Randevulu işlem için randevu tarihi zorunludur"); return; }
    if (odemePlani === "firma_cari" && !selectedCompany) { setError("Firma seçimi zorunludur"); return; }
    if (!ucret || parseFloat(ucret) <= 0) { setError("Ücret zorunludur"); return; }
    if (odemePlani === "pesin" && hesapSahibi === null) { setError("Hesap sahibi seçimi zorunludur"); return; }
    if (onOdemeVar && (!onOdemeTutar || parseFloat(onOdemeTutar) <= 0)) { setError("Ön ödeme tutarı zorunludur"); return; }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const userName = userProfile?.name || "Kullanıcı";
      const finalUlke = ulkeManuelMi ? manuelUlke : hedefUlke;
      const ucretNum = parseFloat(ucret);
      const onOdemeNum = onOdemeVar ? parseFloat(onOdemeTutar) : null;
      const kalanTutar = onOdemeVar && onOdemeNum ? ucretNum - onOdemeNum : null;

      let eksikKayitTarihi = file?.eksik_kayit_tarihi || null;
      if (evrakEksikMi === true && !eksikKayitTarihi) {
        eksikKayitTarihi = new Date().toISOString();
      } else if (evrakEksikMi === false) {
        eksikKayitTarihi = null;
      }

      const fileData = {
        musteri_ad: musteriAd.trim(),
        pasaport_no: pasaportNo.trim(),
        hedef_ulke: finalUlke,
        ulke_manuel_mi: ulkeManuelMi,
        islem_tipi: islemTipi,
        randevu_tarihi: islemTipi === "randevulu" ? randevuTarihi : null,
        evrak_durumu: islemTipi === "randevulu" ? evrakDurumu : "gelmedi",
        evrak_eksik_mi: islemTipi === "randevusuz" ? evrakEksikMi : (evrakDurumu === "geldi" ? evrakEksikMi : null),
        evrak_not: evrakNot || null,
        eksik_kayit_tarihi: eksikKayitTarihi,
        assigned_user_id: file?.assigned_user_id || user.id,
        ucret: ucretNum,
        ucret_currency: ucretCurrency,
        odeme_plani: odemePlani === "firma_cari" ? "cari" as OdemePlani : odemePlani as OdemePlani,
        odeme_durumu: (odemePlani === "pesin" ? "odendi" : "odenmedi") as "odendi" | "odenmedi",
        // Yeni ödeme detayları
        hesap_sahibi: (odemePlani === "pesin" && hesapSahibi) ? hesapSahibi : null,
        cari_tipi: odemePlani === "firma_cari" ? "firma_cari" : (odemePlani === "cari" ? "kullanici_cari" : null),
        company_id: (odemePlani === "firma_cari" && selectedCompany) ? selectedCompany.id : null,
        fatura_tipi: odemePlani === "firma_cari" ? faturaTipi : null,
        on_odeme_tutar: onOdemeVar ? onOdemeNum : null,
        on_odeme_currency: onOdemeVar ? onOdemeCurrency : null,
        kalan_tutar: kalanTutar,
      };

      if (isEdit && file) {
        const { error: updateError } = await supabase
          .from("visa_files")
          .update(fileData)
          .eq("id", file.id);

        if (updateError) throw new Error(updateError.message);

        await supabase.from("activity_logs").insert({
          type: "file_updated",
          message: `${musteriAd} dosyasını güncelledi`,
          file_id: file.id,
          actor_id: user.id,
        });

        await notifyFileUpdated(file.id, musteriAd.trim(), user.id, userName, `${musteriAd} dosyası güncellendi`);
      } else {
        const { data: newFile, error: insertError } = await supabase
          .from("visa_files")
          .insert(fileData)
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);

        if (newFile) {
          // Activity log
          await supabase.from("activity_logs").insert({
            type: "file_created",
            message: `${musteriAd} için ${odemePlani === "pesin" ? "peşin" : "cari"} dosya oluşturdu (${ucretNum} ${ucretCurrency})`,
            file_id: newFile.id,
            actor_id: user.id,
          });

          // Peşin satışta otomatik ödeme kaydı oluştur
          if (odemePlani === "pesin") {
            await supabase.from("payments").insert({
              file_id: newFile.id,
              tutar: ucretNum,
              yontem: "nakit",
              durum: "odendi",
              currency: ucretCurrency,
              payment_type: "pesin_satis",
              created_by: user.id,
            });

            await supabase.from("activity_logs").insert({
              type: "payment_added",
              message: `Peşin satış: ${ucretNum} ${ucretCurrency}`,
              file_id: newFile.id,
              actor_id: user.id,
            });

            // Peşin satış otomatik email (Muhasebe'ye)
            try {
              const emailRes = await fetch("/api/send-tahsilat-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  senderEmail: user.email,
                  senderName: userName,
                  musteriAd: musteriAd.trim(),
                  hedefUlke: finalUlke,
                  tutar: ucretNum,
                  currency: ucretCurrency,
                  yontem: hesapSahibi ? "hesaba" : "nakit",
                  hesapSahibi: hesapSahibi,
                  companyInfo: selectedCompany,
                  faturaTipi: String(odemePlani) === "firma_cari" ? faturaTipi : null,
                  emailType: "pesin_satis",
                }),
              });
              if (!emailRes.ok) {
                const errData = await emailRes.json().catch(() => ({}));
                console.error("Pesin satis email hatasi:", errData);
              }
            } catch (emailErr) {
              console.error("Pesin satis email gonderilemedi:", emailErr);
            }
          }

          // Ön ödeme email gönderimi (cari seçilmiş ve ön ödeme alınmışsa)
          if (odemePlani === "cari" && onOdemeVar && onOdemeNum) {
            try {
              const emailRes = await fetch("/api/send-tahsilat-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  senderEmail: user.email,
                  senderName: userName,
                  musteriAd: musteriAd.trim(),
                  hedefUlke: finalUlke,
                  tutar: onOdemeNum,
                  currency: onOdemeCurrency,
                  yontem: "nakit", // Ön ödeme genellikle nakit
                  companyInfo: selectedCompany,
                  faturaTipi: String(odemePlani) === "firma_cari" ? faturaTipi : null,
                  emailType: "on_odeme",
                }),
              });
              if (!emailRes.ok) {
                const errData = await emailRes.json().catch(() => ({}));
                console.error("Ön ödeme email hatası:", errData);
              }
            } catch (emailErr) {
              console.error("Ön ödeme email gönderilemedi:", emailErr);
            }
          }

          // Firma Cari email gönderimi 
          if (odemePlani === "firma_cari" && selectedCompany) {
            try {
              const emailRes = await fetch("/api/send-tahsilat-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  senderEmail: user.email,
                  senderName: userName,
                  musteriAd: musteriAd.trim(),
                  hedefUlke: finalUlke,
                  tutar: ucretNum,
                  currency: ucretCurrency,
                  yontem: "cari",
                  companyInfo: selectedCompany,
                  faturaTipi: faturaTipi,
                  emailType: "firma_cari",
                }),
              });
              if (!emailRes.ok) {
                const errData = await emailRes.json().catch(() => ({}));
                console.error("Firma cari email hatası:", errData);
              }
            } catch (emailErr) {
              console.error("Firma cari email gönderilemedi:", emailErr);
            }
          }

          await notifyFileCreated(newFile.id, musteriAd.trim(), finalUlke, user.id, userName);
        }
      }

      onSuccess();
    } catch (err) {
      console.error("Form error:", err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <strong>Hata:</strong> {error}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wide">Müşteri Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Müşteri Adı Soyadı" value={musteriAd} onChange={(e) => setMusteriAd(e.target.value)} placeholder="Örn: Ahmet Yılmaz" required />
          <Input label="Pasaport Numarası" value={pasaportNo} onChange={(e) => setPasaportNo(e.target.value)} placeholder="Örn: U12345678" required />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wide">Hedef Ülke</h3>
          <button type="button" onClick={() => setUlkeManuelMi(!ulkeManuelMi)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            {ulkeManuelMi ? "Listeden seç" : "Manuel giriş"}
          </button>
        </div>
        {ulkeManuelMi ? (
          <Input placeholder="Ülke adı girin..." value={manuelUlke} onChange={(e) => setManuelUlke(e.target.value)} required />
        ) : (
          <Select options={countryOptions} value={hedefUlke} onChange={(e) => setHedefUlke(e.target.value)} />
        )}
      </div>

      {/* Ücret ve Ödeme Planı */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wide">Ücret Bilgileri</h3>
        
        {/* Ödeme Planı */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-navy-600">Ödeme Planı</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${odemePlani === "pesin" ? "border-green-500 bg-green-50" : "border-navy-200 hover:border-navy-300"}`}>
              <input type="radio" name="odemePlani" value="pesin" checked={odemePlani === "pesin"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
              <span className={`font-medium ${odemePlani === "pesin" ? "text-green-700" : "text-navy-700"}`}>
                💰 Peşin
              </span>
              <p className="text-xs mt-1 text-navy-500">Ödeme alındı</p>
            </label>
            <label className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${odemePlani === "cari" ? "border-amber-500 bg-amber-50" : "border-navy-200 hover:border-navy-300"}`}>
              <input type="radio" name="odemePlani" value="cari" checked={odemePlani === "cari"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
              <span className={`font-medium ${odemePlani === "cari" ? "text-amber-700" : "text-navy-700"}`}>
                📋 Cari
              </span>
              <p className="text-xs mt-1 text-navy-500">Sonra tahsil</p>
            </label>
            <label className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${odemePlani === "firma_cari" ? "border-purple-500 bg-purple-50" : "border-navy-200 hover:border-navy-300"}`}>
              <input type="radio" name="odemePlani" value="firma_cari" checked={odemePlani === "firma_cari"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
              <span className={`font-medium ${odemePlani === "firma_cari" ? "text-purple-700" : "text-navy-700"}`}>
                🏢 Firma Cari
              </span>
              <p className="text-xs mt-1 text-navy-500">Şirket carisi</p>
            </label>
          </div>
        </div>

        {/* Ücret ve Para Birimi */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input label="Ücret" type="number" placeholder="0" value={ucret} onChange={(e) => setUcret(e.target.value)} required />
          </div>
          <Select label="Para Birimi" options={PARA_BIRIMLERI} value={ucretCurrency} onChange={(e) => setUcretCurrency(e.target.value as ParaBirimi)} />
        </div>

        {/* Peşin ödeme detayları */}
        {odemePlani === "pesin" && (
          <Card className="p-4 bg-green-50 border border-green-200">
            <h4 className="text-sm font-medium text-green-700 mb-3">Peşin Ödeme Detayları</h4>
            
            {/* Ödeme Yöntemi */}
            <div className="space-y-3 mb-4">
              <label className="text-sm font-medium text-navy-600">Ödeme Yöntemi</label>
              <div className="flex gap-3">
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${!hesapSahibi ? "border-orange-500 bg-orange-50" : "border-navy-200"}`}>
                  <input type="radio" checked={!hesapSahibi} onChange={() => setHesapSahibi(null)} className="sr-only" />
                  <span className={!hesapSahibi ? "text-orange-700 font-medium" : "text-navy-600"}>💰 Nakit</span>
                </label>
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${hesapSahibi ? "border-blue-500 bg-blue-50" : "border-navy-200"}`}>
                  <input type="radio" checked={!!hesapSahibi} onChange={() => setHesapSahibi("DAVUT_TURGUT")} className="sr-only" />
                  <span className={hesapSahibi ? "text-blue-700 font-medium" : "text-navy-600"}>🏦 Hesaba</span>
                </label>
              </div>
            </div>

            {/* Hesap Sahibi Seçimi (Hesaba seçildiğinde) */}
            {hesapSahibi && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy-600">Hesap Sahibi</label>
                <Select 
                  options={HESAP_SAHIPLERI} 
                  value={hesapSahibi || ""} 
                  onChange={(e) => setHesapSahibi(e.target.value as HesapSahibi)} 
                />
              </div>
            )}
          </Card>
        )}

        {/* Cari ödeme detayları */}
        {(odemePlani === "cari" && String(islemTipi) !== "firma_cari") && (
          <Card className="p-4 bg-amber-50 border border-amber-200">
            <h4 className="text-sm font-medium text-amber-700 mb-3">Cari Ödeme Detayları</h4>
            
            {/* Cari Sahibi Seçimi */}
            <div className="space-y-3 mb-4">
              <label className="text-sm font-medium text-navy-600">Cari Sahibi</label>
              <div className="flex gap-3">
                {/* Kullanıcının kendisi */}
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${cariSahibi === userName ? "border-amber-500 bg-amber-100" : "border-navy-200"}`}>
                  <input type="radio" checked={cariSahibi === userName} onChange={() => setCariSahibi(userName)} className="sr-only" />
                  <span className={`font-medium ${cariSahibi === userName ? "text-amber-700" : "text-navy-600"}`}>
                    {userName} CARİ
                  </span>
                </label>
                {/* Davut Bey carisi (herkese açık) */}
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${cariSahibi === "DAVUT" ? "border-amber-500 bg-amber-100" : "border-navy-200"}`}>
                  <input type="radio" checked={cariSahibi === "DAVUT"} onChange={() => setCariSahibi("DAVUT")} className="sr-only" />
                  <span className={`font-medium ${cariSahibi === "DAVUT" ? "text-amber-700" : "text-navy-600"}`}>
                    DAVUT CARİ
                  </span>
                </label>
              </div>
            </div>

            {/* Ön ödeme checkbox */}
            <label className="flex items-center gap-3 mb-4">
              <input 
                type="checkbox" 
                checked={onOdemeVar} 
                onChange={(e) => setOnOdemeVar(e.target.checked)} 
                className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-navy-700">Ön ödeme aldım</span>
            </label>

            {/* Ön ödeme detayları */}
            {onOdemeVar && (
              <div className="space-y-4 bg-white rounded-lg p-4 border border-amber-200">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input label="Toplam Vize Ücreti" type="number" value={ucret} onChange={(e) => setUcret(e.target.value)} required disabled />
                  </div>
                  <div>
                    <Select label="Para Birimi" options={PARA_BIRIMLERI} value={ucretCurrency} onChange={(e) => setUcretCurrency(e.target.value as ParaBirimi)} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input label="Alınan Ön Ödeme" type="number" value={onOdemeTutar} onChange={(e) => setOnOdemeTutar(e.target.value)} required />
                  </div>
                  <div>
                    <Select label="Para Birimi" options={PARA_BIRIMLERI} value={onOdemeCurrency} onChange={(e) => setOnOdemeCurrency(e.target.value as ParaBirimi)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input 
                      label="Kalan Tutar" 
                      type="number" 
                      value={onOdemeTutar && ucret ? (parseFloat(ucret) - parseFloat(onOdemeTutar)).toString() : ""} 
                      disabled 
                    />
                  </div>
                  <div>
                    <Select label="Para Birimi" options={PARA_BIRIMLERI} value={ucretCurrency} disabled />
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wide">İşlem Tipi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ISLEM_TIPLERI.map((tip) => (
            <label key={tip.value} className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${islemTipi === tip.value ? "border-primary-500 bg-primary-50" : "border-navy-200 hover:border-navy-300"}`}>
              <input type="radio" name="islemTipi" value={tip.value} checked={islemTipi === tip.value} onChange={(e) => setIslemTipi(e.target.value as IslemTipi)} className="sr-only" />
              <span className={`font-medium ${islemTipi === tip.value ? "text-primary-700" : "text-navy-700"}`}>{tip.label}</span>
            </label>
          ))}
        </div>

        {/* Firma Cari Arama */}
        {odemePlani === "firma_cari" && (
          <Card className="p-4 bg-purple-50 border border-purple-200">
            <h4 className="text-sm font-medium text-purple-700 mb-3">Firma Seçimi</h4>
            
            <div className="space-y-3">
              <Input 
                label="Firma Adı Ara" 
                placeholder="Firma adı yazın..." 
                value={companySearch} 
                onChange={(e) => setCompanySearch(e.target.value)} 
              />
              
              {companySearch.trim() && filteredCompanies.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-purple-200 rounded-lg bg-white">
                  {filteredCompanies.slice(0, 5).map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => {
                        setSelectedCompany(company);
                        setCompanySearch(company.firma_adi);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors border-b border-purple-100 last:border-0"
                    >
                      {company.firma_adi}
                    </button>
                  ))}
                </div>
              )}

              {selectedCompany && (
                <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                  <p className="text-sm font-medium text-purple-800">✓ Seçilen Firma: {selectedCompany.firma_adi}</p>
                </div>
              )}
            </div>

            {/* Fatura Tipi */}
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-navy-600">Fatura Tipi</label>
              <div className="flex gap-3">
                {FATURA_TIPLERI.map((tip) => (
                  <label key={tip.value} className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${faturaTipi === tip.value ? "border-purple-500 bg-purple-100" : "border-navy-200"}`}>
                    <input type="radio" checked={faturaTipi === tip.value} onChange={() => setFaturaTipi(tip.value)} className="sr-only" />
                    <span className={faturaTipi === tip.value ? "text-purple-700 font-medium" : "text-navy-600"}>{tip.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {islemTipi === "randevulu" && (
        <>
          <Input label="Randevu Tarihi ve Saati" type="datetime-local" value={randevuTarihi} onChange={(e) => setRandevuTarihi(e.target.value)} required />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wide">Evrak Durumu</h3>
            <div className="flex gap-4">
              {EVRAK_DURUMLARI.map((durum) => (
                <label key={durum.value} className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${evrakDurumu === durum.value ? "border-primary-500 bg-primary-50" : "border-navy-200 hover:border-navy-300"}`}>
                  <input type="radio" name="evrakDurumu" value={durum.value} checked={evrakDurumu === durum.value} onChange={(e) => { setEvrakDurumu(e.target.value as EvrakDurumu); if (e.target.value === "gelmedi") setEvrakEksikMi(null); }} className="sr-only" />
                  <span className={`font-medium ${evrakDurumu === durum.value ? "text-primary-700" : "text-navy-700"}`}>{durum.label}</span>
                </label>
              ))}
            </div>
          </div>
          {evrakDurumu === "geldi" && (
            <Card className="p-4 bg-navy-50 border border-navy-200">
              <h4 className="text-sm font-medium text-navy-700 mb-3">Eksiği var mı?</h4>
              <div className="flex gap-4">
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${evrakEksikMi === false ? "border-green-500 bg-green-50" : "border-navy-200"}`}>
                  <input type="radio" name="evrakEksik" checked={evrakEksikMi === false} onChange={() => setEvrakEksikMi(false)} className="sr-only" />
                  <span className={evrakEksikMi === false ? "text-green-700 font-medium" : "text-navy-600"}>Yok (Tam)</span>
                </label>
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${evrakEksikMi === true ? "border-orange-500 bg-orange-50" : "border-navy-200"}`}>
                  <input type="radio" name="evrakEksik" checked={evrakEksikMi === true} onChange={() => setEvrakEksikMi(true)} className="sr-only" />
                  <span className={evrakEksikMi === true ? "text-orange-700 font-medium" : "text-navy-600"}>Var (Eksik)</span>
                </label>
              </div>
            </Card>
          )}
        </>
      )}

      {islemTipi === "randevusuz" && (
        <Card className="p-4 bg-navy-50 border border-navy-200">
          <h4 className="text-sm font-medium text-navy-700 mb-3">Eksik var mı?</h4>
          <div className="flex gap-4">
            <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${evrakEksikMi === false ? "border-green-500 bg-green-50" : "border-navy-200"}`}>
              <input type="radio" name="evrakEksik" checked={evrakEksikMi === false} onChange={() => setEvrakEksikMi(false)} className="sr-only" />
              <span className={evrakEksikMi === false ? "text-green-700 font-medium" : "text-navy-600"}>Yok (Tam)</span>
            </label>
            <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer text-center transition-all ${evrakEksikMi === true ? "border-orange-500 bg-orange-50" : "border-navy-200"}`}>
              <input type="radio" name="evrakEksik" checked={evrakEksikMi === true} onChange={() => setEvrakEksikMi(true)} className="sr-only" />
              <span className={evrakEksikMi === true ? "text-orange-700 font-medium" : "text-navy-600"}>Var (Eksik)</span>
            </label>
          </div>
        </Card>
      )}

      {evrakEksikMi === true && (
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Eksik Evrak Notu</label>
          <textarea value={evrakNot} onChange={(e) => setEvrakNot(e.target.value)} placeholder="Eksik evrakları yazın..." rows={3} className="w-full px-4 py-3 border border-navy-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t border-navy-200">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">İptal</Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Kaydediliyor..." : (isEdit ? "Güncelle" : "Oluştur")}
        </Button>
      </div>
    </form>
  );
}
