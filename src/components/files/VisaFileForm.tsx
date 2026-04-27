"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  onProgress?: (pct: number) => void;
}

const SCHENGEN_COUNTRIES = new Set([
  "ALMANYA", "FRANSA", "ITALYA", "ISPANYA", "HOLLANDA", "BELCIKA",
  "AVUSTURYA", "PORTEKIZ", "ISVICRE", "POLONYA", "CEKYA", "MACARISTAN",
  "DANIMARKA", "ISVEC", "NORVEC", "FINLANDIYA", "ESTONYA", "LETONYA",
  "LITVANYA", "SLOVENYA", "SLOVAKYA", "HIRVATISTAN", "MALTA", "LUKSEMBURG",
  "IZLANDA", "LIECHTENSTEIN", "YUNANISTAN", "ROMANYA", "BULGARISTAN",
]);

function normalizeCountryName(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function isUsdDefaultCountry(country: string) {
  const c = normalizeCountryName(country);
  return c === "CIN" || c === "ABD" || c === "INGILTERE";
}

function isSchengenCountry(country: string) {
  return SCHENGEN_COUNTRIES.has(normalizeCountryName(country));
}

export default function VisaFileForm({ file, onSuccess, onCancel, onProgress }: VisaFileFormProps) {
  const isEdit = !!file;
  
  const [musteriAd, setMusteriAd] = useState(file?.musteri_ad || "");
  const [pasaportNo, setPasaportNo] = useState(file?.pasaport_no || "");
  const [hedefUlke, setHedefUlke] = useState(file?.hedef_ulke || "");
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
  const [showDavetiyeUcreti, setShowDavetiyeUcreti] = useState((Number(file?.davetiye_ucreti) || 0) > 0);
  const [davetiyeUcreti, setDavetiyeUcreti] = useState(file?.davetiye_ucreti ? String(file.davetiye_ucreti) : "");
  const [davetiyeUcretiCurrency, setDavetiyeUcretiCurrency] = useState<ParaBirimi>(file?.davetiye_ucreti_currency || "USD");
  const [odemePlani, setOdemePlani] = useState<UIPaymentPlan>(
    file?.cari_tipi === "firma_cari" ? "firma_cari" : (file?.odeme_plani || "cari")
  );
  
  // Yeni ödeme detayları
  const [hesapSahibi, setHesapSahibi] = useState<HesapSahibi | null>(file?.hesap_sahibi || null);
  type PesinYontem = "nakit" | "hesaba" | "pos";
  const [pesinYontem, setPesinYontem] = useState<PesinYontem>(file?.hesap_sahibi ? "hesaba" : "nakit");
  const [pesinPosTl, setPesinPosTl] = useState("");
  const [pesinPosLoading, setPesinPosLoading] = useState(false);
  const [onOdemeVar, setOnOdemeVar] = useState(!!file?.on_odeme_tutar);
  const [onOdemeTutar, setOnOdemeTutar] = useState(file?.on_odeme_tutar?.toString() || "");
  const [onOdemeCurrency, setOnOdemeCurrency] = useState<ParaBirimi>(file?.on_odeme_currency || "TL");
  const [cariSahibi, setCariSahibi] = useState<string>(""); // Hangi kullanıcının carisi
  // Sirket Genel Muduru (admin) cari secimi icin gosterilecek isim.
  // null ise "Genel Mudur Cari" secenegi gizlenir.
  const [orgAdminName, setOrgAdminName] = useState<string | null>(null);
  // Mevcut kullanicinin rolu (cari secim ekraninda kullanilir)
  const [userRole, setUserRole] = useState<string>("");
  
  // Firma cari
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [faturaTipi, setFaturaTipi] = useState<FaturaTipi>(file?.fatura_tipi || "isimli");
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  
  // Vize tipleri
  const VIZE_TIPI_OPTIONS = ["3/1", "6/2", "MULTI", "S", "Z", "X", "TBD"] as const;
  const [vizeTipleri, setVizeTipleri] = useState<string[]>(file?.vize_tipleri || []);

  const toggleVizeTipi = (tip: string) => {
    setVizeTipleri((prev) => {
      if (prev.includes(tip)) return prev.filter((t) => t !== tip);
      if (tip === "TBD") return [...prev, tip];
      const withoutExclusive = prev.filter((t) => t === "TBD");
      return [...withoutExclusive, tip];
    });
  };

  const [eskiPasaport, setEskiPasaport] = useState(file?.eski_pasaport || false);

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

  const activeCountry = (ulkeManuelMi ? manuelUlke : hedefUlke).trim();
  const isChinaSelected = normalizeCountryName(activeCountry) === "CIN";

  useEffect(() => {
    if (!activeCountry) return;
    if (isUsdDefaultCountry(activeCountry)) {
      setUcretCurrency("USD");
    } else if (isSchengenCountry(activeCountry)) {
      setUcretCurrency("EUR");
    }
  }, [activeCountry]);

  useEffect(() => {
    if (!isChinaSelected) {
      setShowDavetiyeUcreti(false);
      setDavetiyeUcreti("");
      setDavetiyeUcretiCurrency("USD");
      setVizeTipleri([]);
      return;
    }
    setIslemTipi("randevusuz");
    if (!showDavetiyeUcreti && isEdit && (Number(file?.davetiye_ucreti) || 0) > 0) {
      setShowDavetiyeUcreti(true);
    }
    if (!davetiyeUcretiCurrency) {
      setDavetiyeUcretiCurrency("USD");
    }
  }, [isChinaSelected, isEdit, file?.davetiye_ucreti, showDavetiyeUcreti, davetiyeUcretiCurrency]);

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
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role, organization_id")
        .eq("id", user.id)
        .single();
      const name = profile?.name || "Kullanıcı";
      setUserName(name);
      setUserRole((profile?.role as string) || "");
      if (!file) setCariSahibi(name);

      // Ayni sirketin (organization) Genel Muduru'nu (admin) bul.
      // Personel ekraninda "Genel Mudur Cari" secenegini onun ismi
      // ile gosteririz; admin ekraninda ek secenege gerek yok.
      const orgId = profile?.organization_id as string | null;
      if (orgId && profile?.role !== "admin") {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("organization_id", orgId)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        if (adminProfile?.name) setOrgAdminName(adminProfile.name);
      }
    };
    loadUserName();
    fetch("/api/exchange-rates").then(r => r.json()).then(d => { if (d.rates) setExchangeRates(d.rates); }).catch(() => {});
  }, [file]);

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

  const fillPesinPosFields = useCallback(
    (rates: Record<string, number>) => {
      const uN = parseFloat(ucret) || 0;
      const dN = showDavetiyeUcreti ? parseFloat(davetiyeUcreti || "0") : 0;
      const getRate = (c: ParaBirimi) => (c === "TL" ? 1 : Number(rates[c]) || 0);
      const conv = (amt: number, fr: ParaBirimi, to: ParaBirimi) => {
        if (fr === to) return amt;
        const frR = getRate(fr);
        const toR = getRate(to);
        if (!frR || !toR) return amt;
        return (amt * frR) / toR;
      };
      const dMain = showDavetiyeUcreti ? conv(dN, davetiyeUcretiCurrency, ucretCurrency) : 0;
      const total = Math.round((uN + dMain) * 100) / 100;
      const tlRounded = ucretCurrency === "TL" ? total : Math.round(total * getRate(ucretCurrency));
      setPesinPosTl(String(tlRounded));
    },
    [ucret, davetiyeUcreti, showDavetiyeUcreti, davetiyeUcretiCurrency, ucretCurrency]
  );

  const handleSelectPesinPos = useCallback(async () => {
    setPesinYontem("pos");
    setHesapSahibi(null);
    setPesinPosLoading(true);
    try {
      const res = await fetch("/api/exchange-rates");
      const data = await res.json();
      const fresh = data.rates && typeof data.rates === "object" ? (data.rates as Record<string, number>) : null;
      const rates = fresh ?? exchangeRates;
      if (fresh) setExchangeRates(fresh);
      fillPesinPosFields(rates);
    } catch {
      fillPesinPosFields(exchangeRates);
    } finally {
      setPesinPosLoading(false);
    }
  }, [exchangeRates, fillPesinPosFields]);

  useEffect(() => {
    if (odemePlani !== "pesin" || pesinYontem !== "pos" || pesinPosLoading) return;
    fillPesinPosFields(exchangeRates);
  }, [odemePlani, pesinYontem, pesinPosLoading, exchangeRates, fillPesinPosFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!musteriAd.trim()) { setError("Müşteri adı zorunludur"); return; }
    if (!pasaportNo.trim()) { setError("Pasaport numarası zorunludur"); return; }
    if (ulkeManuelMi && !manuelUlke.trim()) { setError("Hedef ülke zorunludur"); return; }
    if (islemTipi === "randevulu" && !randevuTarihi) { setError("Randevulu işlem için randevu tarihi zorunludur"); return; }
    if (odemePlani === "firma_cari" && !selectedCompany) { setError("Firma seçimi zorunludur"); return; }
    if (!ucret || parseFloat(ucret) <= 0) { setError("Ücret zorunludur"); return; }
    if (showDavetiyeUcreti && (!davetiyeUcreti || parseFloat(davetiyeUcreti) <= 0)) { setError("Davetiye ücreti girin"); return; }
    if (odemePlani === "pesin" && pesinYontem === "hesaba" && !hesapSahibi) { setError("Hesap sahibi seçimi zorunludur"); return; }
    if (odemePlani === "pesin" && pesinYontem === "pos" && pesinPosLoading) { setError("Kur yükleniyor, lütfen bekleyin"); return; }
    if (odemePlani === "pesin" && pesinYontem === "pos" && (!pesinPosTl || parseFloat(pesinPosTl) <= 0)) { setError("POS için hesaba geçen TL tutarını girin"); return; }
    if (onOdemeVar && (!onOdemeTutar || parseFloat(onOdemeTutar) <= 0)) { setError("Ön ödeme tutarı zorunludur"); return; }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      }

      // Yeni dosya oluşturulurken aynı pasaport no ile aktif dosya var mı kontrol et
      if (!isEdit) {
        const { data: activeFiles } = await supabase
          .from("visa_files")
          .select("id, musteri_ad, hedef_ulke, assigned_user_id")
          .ilike("pasaport_no", pasaportNo.trim())
          .is("sonuc", null);

        if (activeFiles && activeFiles.length > 0) {
          const existing = activeFiles[0];
          setError(`Bu pasaport numarasıyla zaten aktif bir dosya var: ${existing.musteri_ad} (${existing.hedef_ulke}). Önce mevcut dosya sonuçlanmalı.`);
          setIsLoading(false);
          return;
        }
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const userName = userProfile?.name || "Kullanıcı";
      const finalUlke = ulkeManuelMi ? manuelUlke : hedefUlke;
      const ucretNum = parseFloat(ucret);
      const davetiyeNum = showDavetiyeUcreti ? parseFloat(davetiyeUcreti || "0") : 0;
      const onOdemeNum = onOdemeVar ? parseFloat(onOdemeTutar) : null;
      const getRate = (currency: ParaBirimi) => {
        if (currency === "TL") return 1;
        return Number(exchangeRates[currency]) || 0;
      };
      const convertAmount = (amount: number, from: ParaBirimi, to: ParaBirimi) => {
        if (from === to) return amount;
        const fromRate = getRate(from);
        const toRate = getRate(to);
        if (!fromRate || !toRate) return amount;
        const tlValue = amount * fromRate;
        return tlValue / toRate;
      };
      const davetiyeInMainCurrency = showDavetiyeUcreti
        ? convertAmount(davetiyeNum, davetiyeUcretiCurrency, ucretCurrency)
        : 0;
      const totalDosyaAmount = Math.round((ucretNum + davetiyeInMainCurrency) * 100) / 100;
      const onOdemeInMainCurrency = onOdemeVar && onOdemeNum
        ? convertAmount(onOdemeNum, onOdemeCurrency, ucretCurrency)
        : 0;
      const kalanTutar = onOdemeVar ? Math.round((totalDosyaAmount - onOdemeInMainCurrency) * 100) / 100 : null;

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
        davetiye_ucreti: showDavetiyeUcreti ? davetiyeNum : null,
        davetiye_ucreti_currency: showDavetiyeUcreti ? davetiyeUcretiCurrency : null,
        odeme_plani: odemePlani === "firma_cari" ? "cari" as OdemePlani : odemePlani as OdemePlani,
        odeme_durumu: (odemePlani === "pesin" ? "odendi" : "odenmedi") as "odendi" | "odenmedi",
        // Yeni ödeme detayları
        hesap_sahibi: (odemePlani === "pesin" && pesinYontem === "hesaba" && hesapSahibi) ? hesapSahibi : null,
        cari_tipi: odemePlani === "firma_cari" ? "firma_cari" : (odemePlani === "cari" ? "kullanici_cari" : null),
        cari_sahibi: (odemePlani === "cari" && cariSahibi) ? cariSahibi : null,
        company_id: (odemePlani === "firma_cari" && selectedCompany) ? selectedCompany.id : null,
        fatura_tipi: odemePlani === "firma_cari" ? faturaTipi : null,
        on_odeme_tutar: onOdemeVar ? onOdemeNum : null,
        on_odeme_currency: onOdemeVar ? onOdemeCurrency : null,
        kalan_tutar: kalanTutar,
        vize_tipleri: vizeTipleri,
        ...(eskiPasaport ? { eski_pasaport: true } : {}),
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
                tutar: totalDosyaAmount,
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
            const yDb = pesinYontem === "hesaba" ? "hesaba" : pesinYontem === "pos" ? "pos" : "nakit";
            const tKayit = pesinYontem === "pos" ? parseFloat(pesinPosTl) : totalDosyaAmount;
            const cKayit = pesinYontem === "pos" ? ("TL" as const) : ucretCurrency;
            const pdn =
              pesinYontem === "pos" && (ucretCurrency === "USD" || ucretCurrency === "EUR") ? totalDosyaAmount : null;
            const pdc = pdn ? ucretCurrency : null;
            await supabase.from("payments").insert({
              file_id: file.id,
              tutar: tKayit,
              yontem: yDb,
              durum: "odendi",
              currency: cKayit,
              payment_type: "pesin_satis",
              created_by: user.id,
              pos_doviz_tutar: pdn,
              pos_doviz_currency: pdc,
            });
            await fetch("/api/send-tahsilat-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                senderEmail: user.email,
                senderName: userName,
                musteriAd: musteriAd.trim(),
                hedefUlke: finalUlke,
                tutar: tKayit,
                currency: cKayit,
                yontem: yDb,
                hesapSahibi: pesinYontem === "hesaba" ? hesapSahibi : null,
                emailType: "pesin_satis",
                dosyaCurrency: ucretCurrency,
                dosyaTutar: totalDosyaAmount,
                ucretDetay: {
                  vizeTutar: ucretNum,
                  vizeCurrency: ucretCurrency,
                  davetiyeTutar: showDavetiyeUcreti ? davetiyeNum : null,
                  davetiyeCurrency: showDavetiyeUcreti ? davetiyeUcretiCurrency : null,
                },
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
            message: `${musteriAd} için ${odemePlani === "pesin" ? "peşin" : "cari"} dosya oluşturdu (${totalDosyaAmount} ${ucretCurrency})`,
            file_id: newFile.id,
            actor_id: user.id,
          });

          // Peşin satışta otomatik ödeme kaydı oluştur
          if (odemePlani === "pesin") {
            const yDb = pesinYontem === "hesaba" ? "hesaba" : pesinYontem === "pos" ? "pos" : "nakit";
            const tKayit = pesinYontem === "pos" ? parseFloat(pesinPosTl) : totalDosyaAmount;
            const cKayit = pesinYontem === "pos" ? ("TL" as const) : ucretCurrency;
            const pdn =
              pesinYontem === "pos" && (ucretCurrency === "USD" || ucretCurrency === "EUR") ? totalDosyaAmount : null;
            const pdc = pdn ? ucretCurrency : null;

            await supabase.from("payments").insert({
              file_id: newFile.id,
              tutar: tKayit,
              yontem: yDb,
              durum: "odendi",
              currency: cKayit,
              payment_type: "pesin_satis",
              created_by: user.id,
              pos_doviz_tutar: pdn,
              pos_doviz_currency: pdc,
            });

            const validPesinEntries = pesinEntries.filter(e => e.amount && parseFloat(e.amount) > 0);
            const breakdownText = pesinYontem === "pos"
              ? `${parseFloat(pesinPosTl).toLocaleString("tr-TR")} TL (POS)${pdn ? ` · dosya ${pdn} ${pdc}` : ""}`
              : validPesinEntries.length > 0
                ? validPesinEntries.map(e => `${parseFloat(e.amount).toLocaleString("tr-TR")} ${e.currency}`).join(" + ")
                : `${totalDosyaAmount} ${ucretCurrency}`;

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
              if (dekontFile && pesinYontem === "hesaba" && hesapSahibi) {
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
                  tutar: tKayit,
                  currency: cKayit,
                  yontem: yDb,
                  hesapSahibi: pesinYontem === "hesaba" ? hesapSahibi : null,
                  companyInfo: selectedCompany,
                  faturaTipi: String(odemePlani) === "firma_cari" ? faturaTipi : null,
                  emailType: "pesin_satis",
                  dekontBase64,
                  dekontName,
                  dosyaCurrency: ucretCurrency,
                  dosyaTutar: totalDosyaAmount,
                  tlKarsiligi: pesinYontem === "pos" ? null : validPesinEntries.length === 1 && validPesinEntries[0].currency === "TL" && ucretCurrency !== "TL" ? validPesinEntries[0].amount : null,
                  paymentBreakdown: pesinYontem === "pos" ? null : validPesinEntries.length > 1 ? validPesinEntries.map(e => ({ tutar: parseFloat(e.amount), currency: e.currency })) : null,
                  ucretDetay: {
                    vizeTutar: ucretNum,
                    vizeCurrency: ucretCurrency,
                    davetiyeTutar: showDavetiyeUcreti ? davetiyeNum : null,
                    davetiyeCurrency: showDavetiyeUcreti ? davetiyeUcretiCurrency : null,
                  },
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
                  tutar: totalDosyaAmount,
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

  // Form doluluk oranı (sol stepper için)
  // Her harf yazdıkça kademeli artar - 5 aşama x 20 puan = 100
  const formProgress = useMemo(() => {
    // Karakter başına 20 puana doğru kademeli: min(len/target, 1) * 20
    const partial = (len: number, target: number) => Math.min(len / target, 1) * 20;

    let score = 0;

    // 1) Müşteri adı (hedef: 10 karakter)
    score += partial(musteriAd.trim().length, 10);

    // 2) Pasaport numarası (hedef: 8 karakter)
    score += partial(pasaportNo.trim().length, 8);

    // 3) Hedef ülke (hedef: 4 karakter - dropdown seçiminde anında tamamlanır)
    score += partial(activeCountry.trim().length, 4);

    // 4) Ödeme: ücret (10 puan kademeli) + plan seçimi (10 puan)
    const ucretDigits = (ucret || "").replace(/\D/g, "").length;
    score += Math.min(ucretDigits / 3, 1) * 10;

    let planOk = false;
    if (odemePlani === "pesin") {
      planOk =
        pesinYontem === "nakit" ||
        (pesinYontem === "hesaba" && !!hesapSahibi) ||
        (pesinYontem === "pos" && Number(pesinPosTl) > 0);
    } else if (odemePlani === "cari") {
      planOk = !!cariSahibi;
    } else if (odemePlani === "firma_cari") {
      planOk = !!selectedCompany;
    }
    if (planOk) score += 10;

    // 5) İşlem tipi + randevu (randevusuz ise otomatik tamam)
    if (islemTipi === "randevusuz") {
      score += 20;
    } else if (randevuTarihi) {
      score += 20;
    }

    return Math.min(100, Math.round(score));
  }, [
    musteriAd,
    pasaportNo,
    activeCountry,
    ucret,
    odemePlani,
    pesinYontem,
    hesapSahibi,
    pesinPosTl,
    cariSahibi,
    selectedCompany,
    islemTipi,
    randevuTarihi,
  ]);

  useEffect(() => {
    onProgress?.(formProgress);
  }, [formProgress, onProgress]);

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
        <legend className="w-full">
          <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-navy-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/25">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-navy-800">Müşteri Bilgileri</h3>
              <p className="text-[11px] text-navy-500">Ad soyad ve pasaport numarası</p>
            </div>
          </div>
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Ad Soyad" value={musteriAd} onChange={(e) => setMusteriAd(e.target.value)} placeholder="Ahmet Yılmaz" required />
          <Input label="Pasaport No" value={pasaportNo} onChange={(e) => setPasaportNo(e.target.value)} placeholder="U12345678" required />
        </div>
        <label className="flex items-center gap-2 mt-2">
          <input type="checkbox" checked={eskiPasaport} onChange={(e) => setEskiPasaport(e.target.checked)} className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500" />
          <span className="text-sm text-navy-700">Eski pasaport var</span>
        </label>
      </fieldset>

      {/* Geçmiş Başvuru Uyarısı + Autofill */}
      {pastFiles.length > 0 && !isEdit && (
        <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-xl">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">Tekrar gelen müşteri · {pastFiles.length} eski dosya</p>
                <p className="text-[11px] text-amber-700">Bu pasaport daha önce sisteme girilmiş.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const latest = pastFiles[0];
                if (!latest) return;
                if (!musteriAd) setMusteriAd(latest.musteri_ad);
                const knownCountry = TARGET_COUNTRIES.find(c => c.value === latest.hedef_ulke);
                if (knownCountry && !hedefUlke) {
                  setHedefUlke(latest.hedef_ulke);
                  setUlkeManuelMi(false);
                } else if (!knownCountry && latest.hedef_ulke && !manuelUlke) {
                  setManuelUlke(latest.hedef_ulke);
                  setUlkeManuelMi(true);
                }
                if (latest.eski_pasaport !== undefined) setEskiPasaport(true);
              }}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm shadow-amber-500/30 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Otomatik Doldur
            </button>
          </div>
          <div className="space-y-1.5 pl-1">
            {pastFiles.map((pf) => (
              <div key={pf.id} className="flex items-center gap-2 text-xs text-amber-700 bg-white/70 px-2.5 py-1.5 rounded-md border border-amber-200/70">
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
      {pastFiles.length > 0 && isEdit && (
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
        <div className="flex items-center justify-between pb-2.5 mb-1 border-b border-navy-100">
          <legend className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/25">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-800">Hedef Ülke</h3>
              <p className="text-[11px] text-navy-500">Vize başvurulacak ülke</p>
            </div>
          </legend>
          <button type="button" onClick={() => setUlkeManuelMi(!ulkeManuelMi)} className="text-xs text-primary-600 hover:text-primary-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-primary-50 transition-colors">
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
              <span className={hedefUlke ? "text-navy-800" : "text-navy-400"}>{hedefUlke || "Seçiniz"}</span>
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

      {/* Vize Tipi Seçimi - Sadece Çin dosyalarında */}
      {normalizeCountryName(ulkeManuelMi ? manuelUlke : hedefUlke) === "CIN" && (
      <fieldset className="space-y-2">
        <legend className="w-full">
          <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-navy-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm shadow-rose-500/25">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-800">Vize Tipi</h3>
              <p className="text-[11px] text-navy-500">Çin vize başvurusu için tip seçimi</p>
            </div>
          </div>
        </legend>
        <div className="flex flex-wrap gap-2">
          {VIZE_TIPI_OPTIONS.map((tip) => {
            const isSelected = vizeTipleri.includes(tip);
            const isTBD = tip === "TBD";
            return (
              <label
                key={tip}
                className={`px-3.5 py-2 border rounded-lg cursor-pointer transition-all text-sm font-medium select-none ${
                  isSelected
                    ? isTBD
                      ? "border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500"
                      : "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500"
                    : "border-navy-200 text-navy-600 hover:border-navy-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleVizeTipi(tip)}
                  className="sr-only"
                />
                {tip}
              </label>
            );
          })}
        </div>
        {vizeTipleri.includes("TBD") && vizeTipleri.length > 1 && (
          <p className="text-xs text-orange-600">TBD + {vizeTipleri.filter(t => t !== "TBD").join(", ")}</p>
        )}
      </fieldset>
      )}

      {/* Ücret ve Ödeme */}
      <fieldset className="space-y-4">
        <legend className="w-full">
          <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-navy-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm shadow-primary-500/25">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-800">Ücret ve Ödeme</h3>
              <p className="text-[11px] text-navy-500">Ücret, para birimi ve ödeme planı</p>
            </div>
          </div>
        </legend>
        
        <div className="grid grid-cols-3 gap-3">
          <label className={`relative p-3 border-2 rounded-xl cursor-pointer transition-all text-center overflow-hidden group ${odemePlani === "pesin" ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm shadow-green-500/10" : "border-navy-200 bg-white hover:border-green-300 hover:bg-green-50/40"}`}>
            <input type="radio" name="odemePlani" value="pesin" checked={odemePlani === "pesin"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${odemePlani === "pesin" ? "bg-green-500 text-white shadow-md shadow-green-500/30" : "bg-navy-100 text-navy-500 group-hover:bg-green-100 group-hover:text-green-600"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <span className={`text-sm font-semibold ${odemePlani === "pesin" ? "text-green-700" : "text-navy-700"}`}>Peşin</span>
            </div>
          </label>
          <label className={`relative p-3 border-2 rounded-xl cursor-pointer transition-all text-center overflow-hidden group ${odemePlani === "cari" ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm shadow-amber-500/10" : "border-navy-200 bg-white hover:border-amber-300 hover:bg-amber-50/40"}`}>
            <input type="radio" name="odemePlani" value="cari" checked={odemePlani === "cari"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${odemePlani === "cari" ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" : "bg-navy-100 text-navy-500 group-hover:bg-amber-100 group-hover:text-amber-600"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className={`text-sm font-semibold ${odemePlani === "cari" ? "text-amber-700" : "text-navy-700"}`}>Cari</span>
            </div>
          </label>
          <label className={`relative p-3 border-2 rounded-xl cursor-pointer transition-all text-center overflow-hidden group ${odemePlani === "firma_cari" ? "border-purple-500 bg-gradient-to-br from-purple-50 to-fuchsia-50 shadow-sm shadow-purple-500/10" : "border-navy-200 bg-white hover:border-purple-300 hover:bg-purple-50/40"}`}>
            <input type="radio" name="odemePlani" value="firma_cari" checked={odemePlani === "firma_cari"} onChange={(e) => setOdemePlani(e.target.value as UIPaymentPlan)} className="sr-only" />
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${odemePlani === "firma_cari" ? "bg-purple-500 text-white shadow-md shadow-purple-500/30" : "bg-navy-100 text-navy-500 group-hover:bg-purple-100 group-hover:text-purple-600"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <span className={`text-sm font-semibold ${odemePlani === "firma_cari" ? "text-purple-700" : "text-navy-700"}`}>Firma Cari</span>
            </div>
          </label>
        </div>

        {/* TCMB Anlık Kur — bilgi banner */}
        {(exchangeRates.USD > 0 || exchangeRates.EUR > 0) && (
          <div className="rounded-lg bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 border border-indigo-100 px-3 py-2 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">TCMB</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-700 font-semibold">
              <span>1 EUR = <strong className="tabular-nums text-slate-900">₺{exchangeRates.EUR?.toFixed(2) || "—"}</strong></span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>1 USD = <strong className="tabular-nums text-slate-900">₺{exchangeRates.USD?.toFixed(2) || "—"}</strong></span>
            </div>
            <span className="ml-auto text-[10px] text-slate-500">Kur otomatik TCMB'den çekilir</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input label="Ücret" type="number" placeholder="0" value={ucret} onChange={(e) => setUcret(e.target.value)} required />
          </div>
          <Select label="Birim" options={PARA_BIRIMLERI} value={ucretCurrency} onChange={(e) => setUcretCurrency(e.target.value as ParaBirimi)} />
        </div>

        {isChinaSelected && (
          <div className="space-y-3">
            {!showDavetiyeUcreti ? (
              <button
                type="button"
                onClick={() => {
                  setShowDavetiyeUcreti(true);
                  if (!davetiyeUcretiCurrency) setDavetiyeUcretiCurrency("USD");
                }}
                className="px-3 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                + Davetiye Ücreti Ekle
              </button>
            ) : (
              <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Davetiye Ücreti</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDavetiyeUcreti(false);
                      setDavetiyeUcreti("");
                      setDavetiyeUcretiCurrency("USD");
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Kaldır
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={davetiyeUcreti}
                      onChange={(e) => setDavetiyeUcreti(e.target.value)}
                      required={showDavetiyeUcreti}
                    />
                  </div>
                  <Select
                    options={PARA_BIRIMLERI}
                    value={davetiyeUcretiCurrency}
                    onChange={(e) => setDavetiyeUcretiCurrency(e.target.value as ParaBirimi)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Peşin ödeme detayları */}
        {odemePlani === "pesin" && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Ödeme Yöntemi</p>
            <div className="grid grid-cols-3 gap-2">
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${pesinYontem === "nakit" ? "border-green-500 bg-white text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="pesinYontem" checked={pesinYontem === "nakit"} onChange={() => { setPesinYontem("nakit"); setHesapSahibi(null); }} className="sr-only" />
                Nakit
              </label>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${pesinYontem === "hesaba" ? "border-green-500 bg-white text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="pesinYontem" checked={pesinYontem === "hesaba"} onChange={() => { setPesinYontem("hesaba"); setHesapSahibi("DAVUT_TURGUT"); }} className="sr-only" />
                Hesaba
              </label>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${pesinYontem === "pos" ? "border-green-500 bg-white text-green-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" name="pesinYontem" checked={pesinYontem === "pos"} onChange={() => { void handleSelectPesinPos(); }} className="sr-only" />
                POS
              </label>
            </div>

            {pesinYontem === "pos" && (
              <div className="space-y-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                {pesinPosLoading && (
                  <p className="text-xs text-violet-600 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Anlık kur yükleniyor…
                  </p>
                )}
                {!pesinPosLoading && ucretCurrency !== "TL" && exchangeRates[ucretCurrency] && (
                  <p className="text-[11px] text-violet-900 leading-relaxed">
                    Ücret <strong>{ucretCurrency}</strong> olarak girildi; güncel kur{" "}
                    <strong>
                      1 {ucretCurrency} = {Number(exchangeRates[ucretCurrency]).toLocaleString("tr-TR", { maximumFractionDigits: 4 })} TL
                    </strong>
                    . Aşağıdaki TL tutarı vize + (varsa) davetiye toplamı bu kurla hesaplandı — <strong>düzenleyebilirsiniz</strong>.
                  </p>
                )}
                {!pesinPosLoading && ucretCurrency === "TL" && (
                  <p className="text-[11px] text-violet-900 leading-relaxed">
                    Ücret TL cinsinden. Tutar aşağıda otomatik yazıldı — <strong>düzenleyebilirsiniz</strong>.
                  </p>
                )}
                <p className="text-xs font-semibold text-violet-800">POS — hesaba geçen tutar (TL)</p>
                <Input type="number" placeholder="0" value={pesinPosTl} onChange={(e) => setPesinPosTl(e.target.value)} disabled={pesinPosLoading} />
              </div>
            )}

            {pesinYontem !== "pos" && ucretCurrency !== "TL" && ucret && parseFloat(ucret) > 0 && exchangeRates[ucretCurrency] > 0 && (
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

                {(() => {
                  const base = parseFloat(ucret) || 0;
                  const dav = showDavetiyeUcreti && davetiyeUcreti ? (parseFloat(davetiyeUcreti) || 0) : 0;
                  const rateOf = (c: string) => c === "TL" ? 1 : (Number(exchangeRates[c]) || 0);
                  const davInMain = dav > 0 && davetiyeUcretiCurrency !== ucretCurrency
                    ? (rateOf(davetiyeUcretiCurrency) && rateOf(ucretCurrency)
                      ? (dav * rateOf(davetiyeUcretiCurrency) / rateOf(ucretCurrency))
                      : dav)
                    : dav;
                  const total = Math.round((base + davInMain) * 100) / 100;
                  const sym = ({TL:"₺",EUR:"€",USD:"$"} as any);
                  return (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => {
                    const tl = Math.round(total * exchangeRates[ucretCurrency]);
                    setPesinEntries([{ amount: String(tl), currency: "TL" }]);
                  }} className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-2.5 text-left transition-all hover:border-emerald-400 hover:shadow-md active:scale-[0.98]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500 text-white text-xs font-bold">₺</span>
                      <span className="text-xs font-bold text-emerald-800">TL Aldım</span>
                    </div>
                    <p className="text-sm font-black text-emerald-700 ml-8">{Math.round(total * exchangeRates[ucretCurrency]).toLocaleString("tr-TR")} ₺</p>
                  </button>

                  <button type="button" onClick={() => {
                    setPesinEntries([{ amount: String(total), currency: ucretCurrency }]);
                  }} className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2.5 text-left transition-all hover:border-blue-400 hover:shadow-md active:scale-[0.98]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500 text-white text-xs font-bold">{sym[ucretCurrency]}</span>
                      <span className="text-xs font-bold text-blue-800">{ucretCurrency} Aldım</span>
                    </div>
                    <p className="text-sm font-black text-blue-700 ml-8">{total.toLocaleString("tr-TR")} {sym[ucretCurrency]}</p>
                  </button>

                  {ucretCurrency === "USD" && exchangeRates.EUR > 0 && (
                    <button type="button" onClick={() => {
                      const eur = Math.round(total * exchangeRates.USD / exchangeRates.EUR);
                      setPesinEntries([{ amount: String(eur), currency: "EUR" }]);
                    }} className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100 p-2.5 text-left transition-all hover:border-violet-400 hover:shadow-md active:scale-[0.98]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-violet-500 text-white text-xs font-bold">€</span>
                        <span className="text-xs font-bold text-violet-800">EUR Aldım</span>
                      </div>
                      <p className="text-sm font-black text-violet-700 ml-8">{Math.round(total * exchangeRates.USD / exchangeRates.EUR).toLocaleString("tr-TR")} €</p>
                    </button>
                  )}

                  {ucretCurrency === "EUR" && exchangeRates.USD > 0 && (
                    <button type="button" onClick={() => {
                      const usd = Math.round(total * exchangeRates.EUR / exchangeRates.USD);
                      setPesinEntries([{ amount: String(usd), currency: "USD" }]);
                    }} className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-2.5 text-left transition-all hover:border-amber-400 hover:shadow-md active:scale-[0.98]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500 text-white text-xs font-bold">$</span>
                        <span className="text-xs font-bold text-amber-800">USD Aldım</span>
                      </div>
                      <p className="text-sm font-black text-amber-700 ml-8">{Math.round(total * exchangeRates.EUR / exchangeRates.USD).toLocaleString("tr-TR")} $</p>
                    </button>
                  )}
                </div>
                  );
                })()}
              </div>
            )}

            {pesinYontem === "hesaba" && hesapSahibi && (
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
            
            <div className={`grid gap-2 ${orgAdminName && orgAdminName !== userName ? "grid-cols-2" : "grid-cols-1"}`}>
              <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${cariSahibi === userName ? "border-amber-500 bg-white text-amber-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                <input type="radio" checked={cariSahibi === userName} onChange={() => setCariSahibi(userName)} className="sr-only" />
                {userRole === "admin" ? "Genel Müdür Cari" : `${userName} Cari (Personel)`}
              </label>
              {orgAdminName && orgAdminName !== userName && (
                <label className={`p-2.5 border rounded-lg cursor-pointer text-center text-sm transition-all ${cariSahibi === orgAdminName ? "border-amber-500 bg-white text-amber-700 font-medium" : "border-navy-200 text-navy-600"}`}>
                  <input type="radio" checked={cariSahibi === orgAdminName} onChange={() => setCariSahibi(orgAdminName)} className="sr-only" />
                  Genel Müdür Cari
                </label>
              )}
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

      {/* İşlem Tipi - Çin hariç */}
      <fieldset className="space-y-3">
        {!isChinaSelected && (
        <>
        <legend className="w-full">
          <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-navy-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shadow-violet-500/25">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-800">İşlem Tipi</h3>
              <p className="text-[11px] text-navy-500">Randevulu veya randevusuz başvuru</p>
            </div>
          </div>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {ISLEM_TIPLERI.map((tip) => (
            <label key={tip.value} className={`p-3 border rounded-lg cursor-pointer transition-all text-center text-sm ${islemTipi === tip.value ? "border-primary-500 bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-500" : "border-navy-200 text-navy-600 hover:border-navy-300"}`}>
              <input type="radio" name="islemTipi" value={tip.value} checked={islemTipi === tip.value} onChange={(e) => setIslemTipi(e.target.value as IslemTipi)} className="sr-only" />
              {tip.label}
            </label>
          ))}
        </div>
        </>
        )}

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
          <legend className="w-full">
            <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-navy-100">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-sm shadow-sky-500/25">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-800">Randevu ve Evrak</h3>
                <p className="text-[11px] text-navy-500">Randevu zamanı ve evrak durumu</p>
              </div>
            </div>
          </legend>
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
          <legend className="w-full">
            <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-navy-100">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm shadow-teal-500/25">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-800">Evrak Durumu</h3>
                <p className="text-[11px] text-navy-500">Müşteri evraklarının durumu</p>
              </div>
            </div>
          </legend>
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

      <div className="flex flex-col sm:flex-row gap-3 pt-5 mt-2 border-t border-navy-100">
        <button
          type="button"
          onClick={onCancel}
          className="sm:flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 border border-navy-200 bg-white rounded-xl text-sm font-semibold text-navy-700 hover:bg-navy-50 hover:border-navy-300 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          İptal
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="sm:flex-[2] relative inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white transition-all overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-primary-500 via-primary-600 to-primary-600 hover:from-primary-600 hover:via-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 active:scale-[0.99]"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Kaydediliyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isEdit ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                )}
              </svg>
              {isEdit ? "Değişiklikleri Kaydet" : "Dosya Oluştur"}
            </>
          )}
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
