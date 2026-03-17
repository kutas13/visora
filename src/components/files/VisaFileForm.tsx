"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button, Input, Select, Modal } from "@/components/ui";
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
  const [randevuTarihi, setRandevuTarihi] = useState(() => {
    if (!file?.randevu_tarihi) return "";
    const d = new Date(file.randevu_tarihi);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
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
  const [faturaTipi, setFaturaTipi] = useState<FaturaTipi>(file?.fatura_tipi || "isimli");
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  
  const [dekontFile, setDekontFile] = useState<File | null>(null);
  const [dekontPreview, setDekontPreview] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 0, EUR: 0, TL: 1 });
  const [pesinEntries, setPesinEntries] = useState<{ amount: string; currency: string }[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [pastFiles, setPastFiles] = useState<VisaFile[]>([]);

  const countryOptions = TARGET_COUNTRIES.filter(c => c.value !== "all");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryOptions;
    const q = countrySearch.toLowerCase();
    return countryOptions.filter(c => c.label.toLowerCase().includes(q));
  }, [countrySearch, countryOptions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    const loadUserName = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        const name = profile?.name || "Kullanıcı";
        setUserName(name);
        if (!file) setCariSahibi(name);
      }
    };
    loadUserName();
    fetch("/api/exchange-rates").then(r => r.json()).then(d => { if (d.rates) setExchangeRates(d.rates); }).catch(() => {});
  }, []);

  // Edit modunda cariSahibi'yi dosyadan yükle
  useEffect(() => {
    if (file && odemePlani === "cari" && file.cari_tipi === "kullanici_cari") {
      setCariSahibi(file.cari_sahibi || userName);
    }
  }, [file?.id, file?.cari_sahibi, file?.cari_tipi, odemePlani, userName]);

  // Firma listesi yükle + edit modunda mevcut firmayı seç
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await fetch("/api/companies");
        if (res.ok) {
          const data = await res.json();
          const companyList = data.data || [];
          setCompanies(companyList);

          if (file?.company_id && !selectedCompany) {
            const existing = companyList.find((c: Company) => c.id === file.company_id);
            if (existing) {
              setSelectedCompany(existing);
              setCompanySearch(existing.firma_adi);
            }
          }
        }
      } catch (err) {
        console.error("Firma listesi alınamadı:", err);
      }
    };
    loadCompanies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pasaport numarası ile geçmiş başvuru kontrolü
  useEffect(() => {
    const checkPastFiles = async () => {
      const trimmed = pasaportNo.trim();
      if (trimmed.length < 3) { setPastFiles([]); return; }
      const supabase = createClient();
      const { data } = await supabase
        .from("visa_files")
        .select("*")
        .ilike("pasaport_no", trimmed)
        .order("created_at", { ascending: false })
        .limit(10);
      const results = (data || []).filter((f: VisaFile) => !isEdit || f.id !== file?.id);
      setPastFiles(results);
    };
    const timer = setTimeout(checkPastFiles, 500);
    return () => clearTimeout(timer);
  }, [pasaportNo, isEdit, file?.id]);

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
    if (odemePlani === "pesin" && hesapSahibi !== null && !hesapSahibi) { setError("Hesap sahibi seçimi zorunludur"); return; }
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
        randevu_tarihi: islemTipi === "randevulu" && randevuTarihi ? new Date(randevuTarihi).toISOString() : null,
        evrak_durumu: evrakDurumu,
        evrak_eksik_mi: evrakDurumu === "geldi" ? evrakEksikMi : null,
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
        cari_sahibi: (odemePlani === "cari" && cariSahibi) ? cariSahibi : null,
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

        const prevCariTipi = file.cari_tipi;
        const newCariTipi = fileData.cari_tipi;
        const changedToFirmaCari = prevCariTipi !== "firma_cari" && newCariTipi === "firma_cari";
        const changedToPesin = file.odeme_plani !== "pesin" && fileData.odeme_plani === "pesin";

        if (changedToFirmaCari && selectedCompany) {
          try {
            await fetch("/api/send-tahsilat-email", {
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
          } catch (emailErr) {
            console.error("Firma cari güncelleme email hatası:", emailErr);
          }
        }

        if (changedToPesin) {
          try {
            await supabase.from("payments").insert({
              file_id: file.id,
              tutar: ucretNum,
              yontem: hesapSahibi ? "hesaba" : "nakit",
              durum: "odendi",
              currency: ucretCurrency,
              payment_type: "pesin_satis",
              created_by: user.id,
            });
            await fetch("/api/send-tahsilat-email", {
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
                emailType: "pesin_satis",
              }),
            });
          } catch (emailErr) {
            console.error("Peşin güncelleme email hatası:", emailErr);
          }
        }

        await supabase.from("activity_logs").insert({
          type: "file_updated",
          message: `${musteriAd} dosyasını güncelledi${changedToFirmaCari ? " (firma cariye geçirildi)" : ""}`,
          file_id: file.id,
          actor_id: user.id,
        });

        await notifyFileUpdated(file.id, musteriAd.trim(), user.id, userName, `${musteriAd} dosyası güncellendi${changedToFirmaCari ? " - firma cariye geçirildi" : ""}`);
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
              yontem: hesapSahibi ? "hesaba" : "nakit",
              durum: "odendi",
              currency: ucretCurrency,
              payment_type: "pesin_satis",
              created_by: user.id,
            });

            const validPesinEntries = pesinEntries.filter(e => e.amount && parseFloat(e.amount) > 0);
            const breakdownText = validPesinEntries.length > 0
              ? validPesinEntries.map(e => `${parseFloat(e.amount).toLocaleString("tr-TR")} ${e.currency}`).join(" + ")
              : `${ucretNum} ${ucretCurrency}`;

            await supabase.from("activity_logs").insert({
              type: "payment_added",
              message: `Peşin satış: ${breakdownText}`,
              file_id: newFile.id,
              actor_id: user.id,
            });

            // Peşin satış otomatik email (Muhasebe'ye)
            try {
              let dekontBase64: string | null = null;
              let dekontName: string | null = null;
              if (dekontFile && hesapSahibi) {
                dekontBase64 = await fileToBase64(dekontFile);
                dekontName = dekontFile.name;
              }
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
                  dekontBase64,
                  dekontName,
                  dosyaCurrency: ucretCurrency,
                  dosyaTutar: ucretNum,
                  tlKarsiligi: validPesinEntries.length === 1 && validPesinEntries[0].currency === "TL" && ucretCurrency !== "TL" ? validPesinEntries[0].amount : null,
                  paymentBreakdown: validPesinEntries.length > 1 ? validPesinEntries.map(e => ({ tutar: parseFloat(e.amount), currency: e.currency })) : null,
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
    <>
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {/* Müşteri Bilgileri */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-navy-400 uppercase tracking-widest">Müşteri Bilgileri</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Ad Soyad" value={musteriAd} onChange={(e) => setMusteriAd(e.target.value)} placeholder="Ahmet Yılmaz" required />
          <Input label="Pasaport No" value={pasaportNo} onChange={(e) => setPasaportNo(e.target.value)} placeholder="U12345678" required />
        </div>
      </fieldset>

      {/* Geçmiş Başvuru Uyarısı */}
      {pastFiles.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm font-semibold text-amber-800">Bu pasaport ile {pastFiles.length} eski başvuru bulundu</p>
          </div>
          <div className="space-y-1.5 ml-6">
            {pastFiles.map((pf) => (
              <div key={pf.id} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/60 px-2.5 py-1.5 rounded-md">
                <span className="font-semibold">{pf.musteri_ad}</span>
                <span className="text-amber-500">·</span>
                <span>{pf.hedef_ulke}</span>
                <span className="text-amber-500">·</span>
                <span>{new Date(pf.created_at).toLocaleDateString("tr-TR")}</span>
                <span className="text-amber-500">·</span>
                <span className={`font-bold ${pf.sonuc === "vize_onay" ? "text-green-700" : pf.sonuc === "red" ? "text-red-600" : "text-amber-700"}`}>
                  {pf.sonuc === "vize_onay" ? "Onay" : pf.sonuc === "red" ? "Red" : pf.arsiv_mi ? "Arşiv" : "Devam Ediyor"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hedef Ülke */}
      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-semibold text-navy-400 uppercase tracking-widest">Hedef Ülke</legend>
          <button type="button" onClick={() => setUlkeManuelMi(!ulkeManuelMi)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            {ulkeManuelMi ? "Listeden seç" : "Manuel giriş"}
          </button>
        </div>
        {ulkeManuelMi ? (
          <Input placeholder="Ülke adı girin..." value={manuelUlke} onChange={(e) => setManuelUlke(e.target.value)} required />
        ) : (
          <div ref={countryRef} className="relative">
            <button
              type="button"
              onClick={() => { setCountryDropdownOpen(!countryDropdownOpen); setCountrySearch(""); }}
              className="w-full px-3 py-2.5 border border-navy-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-left flex items-center justify-between"
            >
              <span>{hedefUlke}</span>
              <svg className={`w-4 h-4 text-navy-400 transition-transform ${countryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {countryDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-navy-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                <div className="p-2 border-b border-navy-100">
                  <input
                    type="text"
                    placeholder="Ülke ara..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-48">
                  {filteredCountries.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-navy-400">Sonuç bulunamadı</p>
                  ) : (
                    filteredCountries.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setHedefUlke(opt.value); setCountryDropdownOpen(false); setCountrySearch(""); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors ${hedefUlke === opt.value ? "bg-primary-50 text-primary-700 font-medium" : "text-navy-700"}`}
                      >
                        {opt.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </fieldset>

      {/* Ücret ve Ödeme */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold text-navy-400 uppercase tracking-widest">Ücret ve Ödeme</legend>
        
        <div className="grid grid-cols-3 gap-3">
          <label className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${odemePlani === "pesin" ? "border-green-500 bg-green-50 text-green-700 font-semibold ring-1 ring-green-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
            <input type="radio" name="odemePlani" value="pesin" checked={odemePlani === "pesin"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
            Peşin
          </label>
          <label className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${odemePlani === "cari" ? "border-amber-500 bg-amber-50 text-amber-700 font-semibold ring-1 ring-amber-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
            <input type="radio" name="odemePlani" value="cari" checked={odemePlani === "cari"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
            Cari
          </label>
          <label className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${odemePlani === "firma_cari" ? "border-purple-500 bg-purple-50 text-purple-700 font-semibold ring-1 ring-purple-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
            <input type="radio" name="odemePlani" value="firma_cari" checked={odemePlani === "firma_cari"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
            Firma Cari
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input label="Ücret" type="number" placeholder="0" value={ucret} onChange={(e) => setUcret(e.target.value)} required />
          </div>
          <Select label="Birim" options={PARA_BIRIMLERI} value={ucretCurrency} onChange={(e) => setUcretCurrency(e.target.value as ParaBirimi)} />
        </div>

        {/* Peşin ödeme detayları */}
        {odemePlani === "pesin" && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Ödeme Yöntemi</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${!hesapSahibi ? "border-green-500 bg-white text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" checked={!hesapSahibi} onChange={() => setHesapSahibi(null)} className="sr-only" />
                Nakit
              </label>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${hesapSahibi ? "border-green-500 bg-white text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" checked={!!hesapSahibi} onChange={() => setHesapSahibi("DAVUT_TURGUT")} className="sr-only" />
                Hesaba
              </label>
            </div>
            {ucretCurrency !== "TL" && ucret && parseFloat(ucret) > 0 && exchangeRates[ucretCurrency] > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Ödeme Kalemleri</p>
                  <button type="button" onClick={() => setPesinEntries(prev => [...prev, { amount: "", currency: "TL" }])} className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Kalem Ekle
                  </button>
                </div>

                {pesinEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input label={idx === 0 ? "Tutar" : undefined} type="number" placeholder="0" value={entry.amount} onChange={(e) => {
                        const next = [...pesinEntries]; next[idx] = { ...next[idx], amount: e.target.value }; setPesinEntries(next);
                      }} />
                    </div>
                    <div className="w-24">
                      <select value={entry.currency} onChange={(e) => { const next = [...pesinEntries]; next[idx] = { ...next[idx], currency: e.target.value }; setPesinEntries(next); }} className="w-full px-2 py-2.5 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="TL">TL ₺</option>
                        <option value="EUR">EUR €</option>
                        <option value="USD">USD $</option>
                      </select>
                    </div>
                    {pesinEntries.length > 1 && (
                      <button type="button" onClick={() => setPesinEntries(prev => prev.filter((_, i) => i !== idx))} className="p-2.5 text-red-400 hover:text-red-600 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}

                {pesinEntries.length > 0 && pesinEntries.some(e => e.amount && parseFloat(e.amount) > 0) && (
                  <div className="bg-green-100 border border-green-200 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-green-700">
                      Toplam: {pesinEntries.filter(e => e.amount && parseFloat(e.amount) > 0).map(e => `${parseFloat(e.amount).toLocaleString("tr-TR")} ${({TL:"₺",EUR:"€",USD:"$"} as any)[e.currency] || e.currency}`).join(" + ")}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => {
                    const tl = Math.round(parseFloat(ucret) * exchangeRates[ucretCurrency]);
                    setPesinEntries([{ amount: String(tl), currency: "TL" }]);
                  }} className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-2.5 text-left transition-all hover:border-emerald-400 hover:shadow-md active:scale-[0.98]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500 text-white text-xs font-bold">₺</span>
                      <span className="text-xs font-bold text-emerald-800">TL Aldım</span>
                    </div>
                    <p className="text-sm font-black text-emerald-700 ml-8">{Math.round(parseFloat(ucret) * exchangeRates[ucretCurrency]).toLocaleString("tr-TR")} ₺</p>
                  </button>

                  <button type="button" onClick={() => {
                    setPesinEntries([{ amount: ucret, currency: ucretCurrency }]);
                  }} className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2.5 text-left transition-all hover:border-blue-400 hover:shadow-md active:scale-[0.98]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500 text-white text-xs font-bold">{({TL:"₺",EUR:"€",USD:"$"} as any)[ucretCurrency]}</span>
                      <span className="text-xs font-bold text-blue-800">{ucretCurrency} Aldım</span>
                    </div>
                    <p className="text-sm font-black text-blue-700 ml-8">{parseFloat(ucret).toLocaleString("tr-TR")} {({TL:"₺",EUR:"€",USD:"$"} as any)[ucretCurrency]}</p>
                  </button>

                  {ucretCurrency === "USD" && exchangeRates.EUR > 0 && (
                    <button type="button" onClick={() => {
                      const eur = Math.round(parseFloat(ucret) * exchangeRates.USD / exchangeRates.EUR);
                      setPesinEntries([{ amount: String(eur), currency: "EUR" }]);
                    }} className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100 p-2.5 text-left transition-all hover:border-violet-400 hover:shadow-md active:scale-[0.98]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-violet-500 text-white text-xs font-bold">€</span>
                        <span className="text-xs font-bold text-violet-800">EUR Aldım</span>
                      </div>
                      <p className="text-sm font-black text-violet-700 ml-8">{Math.round(parseFloat(ucret) * exchangeRates.USD / exchangeRates.EUR).toLocaleString("tr-TR")} €</p>
                    </button>
                  )}

                  {ucretCurrency === "EUR" && exchangeRates.USD > 0 && (
                    <button type="button" onClick={() => {
                      const usd = Math.round(parseFloat(ucret) * exchangeRates.EUR / exchangeRates.USD);
                      setPesinEntries([{ amount: String(usd), currency: "USD" }]);
                    }} className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-2.5 text-left transition-all hover:border-amber-400 hover:shadow-md active:scale-[0.98]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500 text-white text-xs font-bold">$</span>
                        <span className="text-xs font-bold text-amber-800">USD Aldım</span>
                      </div>
                      <p className="text-sm font-black text-amber-700 ml-8">{Math.round(parseFloat(ucret) * exchangeRates.EUR / exchangeRates.USD).toLocaleString("tr-TR")} $</p>
                    </button>
                  )}
                </div>
              </div>
            )}

            {hesapSahibi && (
              <>
                <Select label="Hesap Sahibi" options={HESAP_SAHIPLERI} value={hesapSahibi || ""} onChange={(e) => setHesapSahibi(e.target.value as HesapSahibi)} />
                <div>
                  <label className="block text-xs font-medium text-green-700 mb-1">Dekont Yükle (PDF veya Görsel)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setDekontFile(f);
                      if (f && f.type.startsWith("image/")) {
                        setDekontPreview(URL.createObjectURL(f));
                      } else {
                        setDekontPreview(null);
                      }
                    }}
                    className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-green-100 file:text-green-700 hover:file:bg-green-200 text-navy-600"
                  />
                  {dekontPreview && (
                    <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-green-200">
                      <img src={dekontPreview} alt="Dekont" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setDekontFile(null); setDekontPreview(null); }} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                    </div>
                  )}
                  {dekontFile && !dekontPreview && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-100 px-2.5 py-1.5 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      {dekontFile.name}
                      <button type="button" onClick={() => { setDekontFile(null); setDekontPreview(null); }} className="ml-auto text-red-600 font-bold">×</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Cari ödeme detayları */}
        {(odemePlani === "cari" && String(islemTipi) !== "firma_cari") && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Cari Detayları</p>
            
            <div className="grid grid-cols-2 gap-2">
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${cariSahibi === userName ? "border-amber-500 bg-white text-amber-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" checked={cariSahibi === userName} onChange={() => setCariSahibi(userName)} className="sr-only" />
                {userName} Cari
              </label>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${cariSahibi === "DAVUT" ? "border-amber-500 bg-white text-amber-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" checked={cariSahibi === "DAVUT"} onChange={() => setCariSahibi("DAVUT")} className="sr-only" />
                Davut Cari
              </label>
            </div>

            <label className="flex items-center gap-2 mt-3">
              <input type="checkbox" checked={onOdemeVar} onChange={(e) => setOnOdemeVar(e.target.checked)} className="w-4 h-4 text-amber-600 bg-white border-gray-300 rounded focus:ring-amber-500" />
              <span className="text-sm text-navy-700">Ön ödeme aldım</span>
            </label>

            {onOdemeVar && (
              <div className="space-y-3 mt-3 bg-white rounded-lg p-3 border border-amber-200">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Input label="Toplam Ücret" type="number" value={ucret} disabled /></div>
                  <Select label="Birim" options={PARA_BIRIMLERI} value={ucretCurrency} disabled />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Input label="Ön Ödeme" type="number" value={onOdemeTutar} onChange={(e) => setOnOdemeTutar(e.target.value)} required /></div>
                  <Select label="Birim" options={PARA_BIRIMLERI} value={onOdemeCurrency} onChange={(e) => setOnOdemeCurrency(e.target.value as ParaBirimi)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Input label="Kalan" type="number" value={onOdemeTutar && ucret ? (parseFloat(ucret) - parseFloat(onOdemeTutar)).toString() : ""} disabled /></div>
                  <Select label="Birim" options={PARA_BIRIMLERI} value={ucretCurrency} disabled />
                </div>
              </div>
            )}
          </div>
        )}
      </fieldset>

      {/* İşlem Tipi */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-navy-400 uppercase tracking-widest">İşlem Tipi</legend>
        <div className="grid grid-cols-2 gap-2">
          {ISLEM_TIPLERI.map((tip) => (
            <label key={tip.value} className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${islemTipi === tip.value ? "border-primary-500 bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
              <input type="radio" name="islemTipi" value={tip.value} checked={islemTipi === tip.value} onChange={(e) => setIslemTipi(e.target.value as IslemTipi)} className="sr-only" />
              {tip.label}
            </label>
          ))}
        </div>

        {/* Firma Cari Arama */}
        {odemePlani === "firma_cari" && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Firma Seçimi</p>
            
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input 
                  label="Firma Adı Ara" 
                  placeholder="Firma adı yazın..." 
                  value={companySearch} 
                  onChange={(e) => setCompanySearch(e.target.value)} 
                  className="flex-1"
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setNewCompanyName(companySearch.trim());
                      setShowCreateCompany(true);
                    }}
                    variant="outline"
                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    disabled={!companySearch.trim()}
                  >
                    + Firma Oluştur
                  </Button>
                </div>
              </div>
              
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

            <div className="mt-3 grid grid-cols-2 gap-2">
              {FATURA_TIPLERI.map((tip) => (
                <label key={tip.value} className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${faturaTipi === tip.value ? "border-purple-500 bg-white text-purple-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                  <input type="radio" checked={faturaTipi === tip.value} onChange={() => setFaturaTipi(tip.value)} className="sr-only" />
                  {tip.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {/* Randevu & Evrak */}
      {islemTipi === "randevulu" && (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-navy-400 uppercase tracking-widest">Randevu ve Evrak</legend>
          <Input label="Randevu Tarihi ve Saati" type="datetime-local" value={randevuTarihi} onChange={(e) => setRandevuTarihi(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            {EVRAK_DURUMLARI.map((durum) => (
              <label key={durum.value} className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${evrakDurumu === durum.value ? "border-primary-500 bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
                <input type="radio" name="evrakDurumu" value={durum.value} checked={evrakDurumu === durum.value} onChange={(e) => { setEvrakDurumu(e.target.value as EvrakDurumu); if (e.target.value === "gelmedi") setEvrakEksikMi(null); }} className="sr-only" />
                Evrak {durum.label}
              </label>
            ))}
          </div>
          {evrakDurumu === "geldi" && (
            <div className="grid grid-cols-2 gap-2">
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${evrakEksikMi === false ? "border-green-500 bg-green-50 text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="evrakEksik" checked={evrakEksikMi === false} onChange={() => setEvrakEksikMi(false)} className="sr-only" />
                Tam
              </label>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${evrakEksikMi === true ? "border-orange-500 bg-orange-50 text-orange-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="evrakEksik" checked={evrakEksikMi === true} onChange={() => setEvrakEksikMi(true)} className="sr-only" />
                Eksik Var
              </label>
            </div>
          )}
        </fieldset>
      )}

      {islemTipi === "randevusuz" && (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-navy-400 uppercase tracking-widest">Evrak Durumu</legend>
          <div className="grid grid-cols-2 gap-2">
            {EVRAK_DURUMLARI.map((durum) => (
              <label key={durum.value} className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${evrakDurumu === durum.value ? "border-primary-500 bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
                <input type="radio" name="evrakDurumuRandevusuz" value={durum.value} checked={evrakDurumu === durum.value} onChange={(e) => { setEvrakDurumu(e.target.value as EvrakDurumu); if (e.target.value === "gelmedi") setEvrakEksikMi(null); }} className="sr-only" />
                Evrak {durum.label}
              </label>
            ))}
          </div>
          {evrakDurumu === "geldi" && (
            <div className="grid grid-cols-2 gap-2">
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${evrakEksikMi === false ? "border-green-500 bg-green-50 text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="evrakEksikRandevusuz" checked={evrakEksikMi === false} onChange={() => setEvrakEksikMi(false)} className="sr-only" />
                Tam
              </label>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${evrakEksikMi === true ? "border-orange-500 bg-orange-50 text-orange-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="evrakEksikRandevusuz" checked={evrakEksikMi === true} onChange={() => setEvrakEksikMi(true)} className="sr-only" />
                Eksik Var
              </label>
            </div>
          )}
        </fieldset>
      )}

      {evrakEksikMi === true && (
        <div>
          <label className="block text-xs font-semibold text-navy-400 uppercase tracking-widest mb-1">Eksik Evrak Notu</label>
          <textarea value={evrakNot} onChange={(e) => setEvrakNot(e.target.value)} placeholder="Eksik evrakları yazın..." rows={2} className="w-full px-3 py-2.5 border border-navy-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-navy-100">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-navy-300 rounded-lg text-sm font-medium text-navy-600 hover:bg-navy-50 transition-colors">
          İptal
        </button>
        <button type="submit" disabled={isLoading} className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
          {isLoading ? "Kaydediliyor..." : (isEdit ? "Güncelle" : "Dosya Oluştur")}
        </button>
      </div>
    </form>

    {/* Firma Oluştur Modal */}
    <Modal isOpen={showCreateCompany} onClose={() => { setShowCreateCompany(false); setNewCompanyName(""); }} title="Yeni Firma Oluştur" size="sm">
      <div className="space-y-4">
        <Input
          label="Firma Adı"
          placeholder="Firma adını girin..."
          value={newCompanyName}
          onChange={(e) => setNewCompanyName(e.target.value)}
        />
        
        <div className="flex gap-3">
          <Button 
            type="button"
            variant="outline" 
            onClick={() => {
              setShowCreateCompany(false);
              setNewCompanyName("");
            }}
            className="flex-1"
          >
            İptal
          </Button>
          <Button 
            type="button"
            onClick={async () => {
              if (!newCompanyName.trim()) return;
              
              try {
                const res = await fetch("/api/companies", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ firma_adi: newCompanyName.trim() }),
                });

                if (res.ok) {
                  const data = await res.json();
                  setShowCreateCompany(false);
                  // Yeni firmayı seç ve listeye ekle
                  const newCompany = data.data;
                  setCompanies(prev => [...prev, newCompany]);
                  setSelectedCompany(newCompany);
                  setCompanySearch(newCompany.firma_adi);
                  setNewCompanyName("");
                  alert(`✅ ${newCompany.firma_adi} firması oluşturuldu ve seçildi!`);
                } else {
                  const errData = await res.json().catch(() => ({}));
                  alert(`Hata: ${errData.error || "Firma oluşturulamadı"}`);
                }
              } catch (err) {
                alert("Bağlantı hatası");
              }
            }}
            disabled={!newCompanyName.trim()}
            className="flex-1"
          >
            Oluştur ve Seç
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}
