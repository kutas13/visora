"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyPaymentReceived } from "@/lib/notifications";
import { ODEME_YONTEMLERI, PARA_BIRIMLERI, HESAP_SAHIPLERI } from "@/lib/constants";
import type { Payment, VisaFile, ParaBirimi, HesapSahibi } from "@/lib/supabase/types";

type PaymentWithFile = Payment & { visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke" | "ucret" | "ucret_currency"> | null };
type PaymentEntry = { amount: string; currency: ParaBirimi };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return symbols[currency] || currency;
}

function formatCurrency(amount: number, currency: string) {
  return `${amount?.toLocaleString("tr-TR")} ${getCurrencySymbol(currency)}`;
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<"odenmemis" | "tahsilatlar">("odenmemis");
  const [unpaidFiles, setUnpaidFiles] = useState<VisaFile[]>([]);
  const [payments, setPayments] = useState<PaymentWithFile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VisaFile | null>(null);
  const [yontem, setYontem] = useState("nakit");
  const [hesapSahibi, setHesapSahibi] = useState<HesapSahibi>("DAVUT_TURGUT");
  const [notlar, setNotlar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([{ amount: "", currency: "TL" }]);

  const [filterCurrency, setFilterCurrency] = useState("all");
  const [stats, setStats] = useState<Record<string, number>>({ TL: 0, EUR: 0, USD: 0 });
  const [dekontFile, setDekontFile] = useState<File | null>(null);
  const [dekontPreview, setDekontPreview] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 49.50, EUR: 53.00, TL: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: unpaid } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("arsiv_mi", false)
      .eq("odeme_plani", "cari")
      .eq("odeme_durumu", "odenmedi")
      .neq("cari_tipi", "firma_cari")
      .order("created_at", { ascending: false });

    setUnpaidFiles(unpaid || []);

    const { data: paymentData } = await supabase
      .from("payments")
      .select("*, visa_files(musteri_ad, hedef_ulke, ucret, ucret_currency)")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Firma cari dosyaları da tahsilat olarak ekle
    const { data: firmaCariFiles } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("cari_tipi", "firma_cari")
      .eq("arsiv_mi", false)
      .order("created_at", { ascending: false })
      .limit(25);

    // Firma cari dosyaları payment formatına dönüştür
    const firmaCariAsPayments = (firmaCariFiles || []).map(file => ({
      id: `firma_${file.id}`,
      file_id: file.id,
      tutar: file.ucret || 0,
      currency: file.ucret_currency || "TL",
      yontem: "firma_cari" as any,
      durum: "odendi" as any,
      payment_type: "firma_cari" as any,
      created_by: user.id,
      created_at: file.created_at,
      visa_files: {
        musteri_ad: file.musteri_ad,
        hedef_ulke: file.hedef_ulke,
        ucret: file.ucret,
        ucret_currency: file.ucret_currency
      }
    }));

    const allPayments = [...(paymentData || []), ...firmaCariAsPayments];
    setPayments(allPayments);

    if (allPayments) {
      const totals: Record<string, number> = { TL: 0, EUR: 0, USD: 0 };
      allPayments.forEach(p => {
        if (p.durum === "odendi") {
          const curr = p.currency || "TL";
          totals[curr] = (totals[curr] || 0) + Number(p.tutar);
        }
      });
      setStats(totals);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); loadExchangeRates(); }, []);

  const loadExchangeRates = async () => {
    setRatesLoading(true);
    try {
      const res = await fetch('/api/exchange-rates');
      const data = await res.json();
      if (data.rates) {
        setExchangeRates(data.rates);
      }
    } catch (err) {
      console.error('Exchange rates error:', err);
    } finally {
      setRatesLoading(false);
    }
  };

  const handleTahsilatYap = (file: VisaFile) => {
    setSelectedFile(file);
    const tahsilatTutari = file.kalan_tutar || file.ucret;
    setPaymentEntries([{ amount: tahsilatTutari?.toString() || "", currency: file.ucret_currency || "TL" }]);
    setYontem("nakit");
    setNotlar("");
    setDekontFile(null);
    setDekontPreview(null);
    setShowModal(true);
  };

  const addPaymentEntry = () => {
    setPaymentEntries(prev => [...prev, { amount: "", currency: "TL" }]);
  };

  const removePaymentEntry = (index: number) => {
    if (paymentEntries.length <= 1) return;
    setPaymentEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updatePaymentEntry = (index: number, field: "amount" | "currency", value: string) => {
    setPaymentEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const hasValidEntries = paymentEntries.some(e => e.amount && parseFloat(e.amount) > 0);

  const handleTahsilatOnay = () => {
    if (!selectedFile || !hasValidEntries) {
      alert("Lütfen en az bir geçerli tutar girin");
      return;
    }
    setShowModal(false);
    setShowConfirmModal(true);
  };

  const handleTahsilatKaydet = async () => {
    if (!selectedFile || !hasValidEntries || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      const userName = profile?.name || "Kullanıcı";
      
      const validEntries = paymentEntries.filter(e => e.amount && parseFloat(e.amount) > 0);
      const primaryEntry = validEntries[0];
      const primaryAmount = parseFloat(primaryEntry.amount);

      const { error: paymentError } = await supabase.from("payments").insert({
        file_id: selectedFile.id,
        tutar: primaryAmount,
        yontem: yontem as "nakit" | "hesaba",
        durum: "odendi",
        currency: primaryEntry.currency,
        payment_type: "tahsilat",
        created_by: user.id,
      });

      if (paymentError) throw paymentError;

      const { error: updateError } = await supabase.from("visa_files").update({ odeme_durumu: "odendi" }).eq("id", selectedFile.id);
      if (updateError) throw updateError;

      const breakdownText = validEntries.map(e => formatCurrency(parseFloat(e.amount), e.currency)).join(" + ");

      await supabase.from("activity_logs").insert({
        type: "payment_added",
        message: `${selectedFile.musteri_ad} için tahsilat aldı: ${breakdownText}`,
        file_id: selectedFile.id,
        actor_id: user.id,
      });

      await notifyPaymentReceived(selectedFile.id, selectedFile.musteri_ad, primaryAmount, yontem, user.id, userName);

      try {
        let dekontBase64: string | null = null;
        let dekontName: string | null = null;
        if (dekontFile && yontem === "hesaba") {
          dekontBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(dekontFile);
          });
          dekontName = dekontFile.name;
        }

        const paymentBreakdown = validEntries.length > 1 ? validEntries.map(e => ({
          tutar: parseFloat(e.amount),
          currency: e.currency,
        })) : null;

        // TL karşılığı hesapla (dosya farklı currency, tahsilat TL ise)
        const tlKarsiligi = selectedFile.ucret_currency !== "TL" && primaryEntry.currency === "TL" ? primaryAmount.toString() : null;

        const emailRes = await fetch("/api/send-tahsilat-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderEmail: user.email,
            senderName: userName,
            musteriAd: selectedFile.musteri_ad,
            hedefUlke: selectedFile.hedef_ulke,
            tutar: primaryAmount,
            currency: primaryEntry.currency,
            yontem: yontem,
            hesapSahibi: yontem === "hesaba" ? hesapSahibi : null,
            notlar: notlar.trim() || null,
            paymentBreakdown,
            dosyaCurrency: selectedFile.ucret_currency,
            dosyaTutar: selectedFile.kalan_tutar || selectedFile.ucret,
            tlKarsiligi,
            onOdemeGecmisi: selectedFile.on_odeme_tutar ? {
              tutar: selectedFile.on_odeme_tutar,
              currency: selectedFile.on_odeme_currency,
              tarih: selectedFile.created_at
            } : null,
            emailType: "tahsilat",
            dekontBase64,
            dekontName,
          }),
        });
        if (!emailRes.ok) {
          const errData = await emailRes.json().catch(() => ({}));
          console.error("Tahsilat email hatasi:", errData);
        }
      } catch (emailErr) {
        console.error("Tahsilat email gonderilemedi:", emailErr);
      }

      setShowConfirmModal(false);
      setSelectedFile(null);
      setPaymentEntries([{ amount: "", currency: "TL" }]);
      setDekontFile(null);
      setDekontPreview(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Tahsilat kaydedilirken hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPayments = filterCurrency === "all" 
    ? payments 
    : payments.filter(p => (p.currency || "TL") === filterCurrency);

  const currencyOptions = [{ value: "all", label: "Tümü" }, ...PARA_BIRIMLERI.map(p => ({ value: p.value, label: p.label }))];

  const validEntries = paymentEntries.filter(e => e.amount && parseFloat(e.amount) > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Ödemeler</h1>
        <p className="text-navy-500 text-sm">Tahsilatları yönetin ve takip edin</p>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(stats).map(([curr, total]) => (
          <div key={curr} className="bg-white rounded-xl border border-navy-200 p-4">
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wider">{curr}</p>
            <p className={`text-xl font-black mt-1 ${curr === "TL" ? "text-emerald-600" : curr === "EUR" ? "text-blue-600" : "text-amber-600"}`}>
              {total > 0 ? formatCurrency(total, curr) : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setActiveTab("odenmemis")} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "odenmemis" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"}`}>
          Ödenmemişler {unpaidFiles.length > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">{unpaidFiles.length}</span>}
        </button>
        <button onClick={() => setActiveTab("tahsilatlar")} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "tahsilatlar" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"}`}>
          Tahsilatlarım
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : activeTab === "odenmemis" ? (
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          {unpaidFiles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-navy-400">Tüm ödemeler tahsil edilmiş</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-100">
              {unpaidFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 hover:bg-navy-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-navy-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="font-semibold text-navy-600 text-sm">{file.musteri_ad.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900 text-sm truncate">{file.musteri_ad}</p>
                      <p className="text-xs text-navy-400">{file.hedef_ulke} · {file.pasaport_no}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-navy-900">{formatCurrency(file.kalan_tutar || file.ucret || 0, file.ucret_currency || "TL")}</p>
                      {file.on_odeme_tutar && (
                        <p className="text-[10px] text-blue-600">ön ödeme: {file.on_odeme_tutar} {file.on_odeme_currency}</p>
                      )}
                    </div>
                    <button onClick={() => handleTahsilatYap(file)} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors">
                      Tahsilat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-navy-100">
            <p className="text-sm font-medium text-navy-600">{filteredPayments.length} kayıt</p>
            <select value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} className="text-xs border border-navy-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500">
              {currencyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-navy-400">Tahsilat kaydı bulunamadı</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-50">
              {filteredPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 hover:bg-navy-50/30 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900 text-sm truncate">{p.visa_files?.musteri_ad || "-"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-navy-400">{p.visa_files?.hedef_ulke}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.payment_type === "pesin_satis" ? "bg-green-50 text-green-700" : p.payment_type === "firma_cari" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                        {p.payment_type === "pesin_satis" ? "Peşin" : p.payment_type === "firma_cari" ? "Firma Cari" : "Tahsilat"}
                      </span>
                      {p.payment_type !== "firma_cari" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.yontem === "nakit" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                          {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-navy-900 text-sm">{formatCurrency(Number(p.tutar), p.currency || "TL")}</p>
                    <p className="text-[10px] text-navy-400">{formatDate(p.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tahsilat Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Tahsilat Bilgileri" size="sm">
        {selectedFile && (
          <div className="space-y-4">
            <div className="bg-navy-50 rounded-xl p-4 border border-navy-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy-900">{selectedFile.musteri_ad}</p>
                  <p className="text-xs text-navy-500">{selectedFile.hedef_ulke}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-navy-400">Beklenen</p>
                  <p className="font-bold text-primary-600">{formatCurrency(selectedFile.kalan_tutar || selectedFile.ucret || 0, selectedFile.ucret_currency || "TL")}</p>
                </div>
              </div>
            </div>

            {/* Ödeme Kalemleri */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Ödeme Kalemleri</p>
                <button type="button" onClick={addPaymentEntry} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Kalem Ekle
                </button>
              </div>
              {paymentEntries.map((entry, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label={index === 0 ? "Tutar" : undefined}
                      type="number"
                      placeholder="0"
                      value={entry.amount}
                      onChange={(e) => updatePaymentEntry(index, "amount", e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <select
                      value={entry.currency}
                      onChange={(e) => updatePaymentEntry(index, "currency", e.target.value)}
                      className="w-full px-2 py-2.5 border border-navy-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="TL">TL ₺</option>
                      <option value="EUR">EUR €</option>
                      <option value="USD">USD $</option>
                    </select>
                  </div>
                  {paymentEntries.length > 1 && (
                    <button type="button" onClick={() => removePaymentEntry(index)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}

              {/* Özet */}
              {validEntries.length > 1 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mt-2">
                  <p className="text-xs font-semibold text-emerald-700">
                    Toplam: {validEntries.map(e => `${parseFloat(e.amount).toLocaleString("tr-TR")} ${getCurrencySymbol(e.currency)}`).join(" + ")}
                  </p>
                </div>
              )}

              {/* Hızlı Dönüşüm Butonları */}
              {selectedFile && selectedFile.ucret_currency !== "TL" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Hızlı Doldur</p>
                    <button type="button" onClick={loadExchangeRates} className="text-[10px] text-navy-400 hover:text-navy-600" disabled={ratesLoading}>
                      {ratesLoading ? "Güncelleniyor..." : "🔄 Kur Güncelle"}
                    </button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {/* TL Karşılığı Al */}
                    <button 
                      type="button"
                      onClick={() => {
                        const tlAmount = ((selectedFile.kalan_tutar || selectedFile.ucret || 0) * exchangeRates[selectedFile.ucret_currency]).toFixed(0);
                        setPaymentEntries([{ amount: tlAmount, currency: "TL" }]);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-colors"
                    >
                      TL Karşılığı Al ({((selectedFile.kalan_tutar || selectedFile.ucret || 0) * exchangeRates[selectedFile.ucret_currency]).toLocaleString("tr-TR", {maximumFractionDigits: 0})} ₺)
                    </button>

                    {/* Orijinal Currency */}
                    <button 
                      type="button"
                      onClick={() => {
                        setPaymentEntries([{ amount: (selectedFile.kalan_tutar || selectedFile.ucret || 0).toString(), currency: selectedFile.ucret_currency }]);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                    >
                      {selectedFile.ucret_currency} Al ({(selectedFile.kalan_tutar || selectedFile.ucret || 0).toLocaleString("tr-TR")} {selectedFile.ucret_currency})
                    </button>

                    {/* Diğer Currency (USD için EUR, EUR için USD) */}
                    {selectedFile.ucret_currency === "USD" && exchangeRates.EUR && (
                      <button 
                        type="button"
                        onClick={() => {
                          const eurAmount = ((selectedFile.kalan_tutar || selectedFile.ucret || 0) * exchangeRates.USD / exchangeRates.EUR).toFixed(0);
                          setPaymentEntries([{ amount: eurAmount, currency: "EUR" }]);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors"
                      >
                        EUR Al ({((selectedFile.kalan_tutar || selectedFile.ucret || 0) * exchangeRates.USD / exchangeRates.EUR).toLocaleString("tr-TR", {maximumFractionDigits: 0})} €)
                      </button>
                    )}

                    {selectedFile.ucret_currency === "EUR" && exchangeRates.USD && (
                      <button 
                        type="button"
                        onClick={() => {
                          const usdAmount = ((selectedFile.kalan_tutar || selectedFile.ucret || 0) * exchangeRates.EUR / exchangeRates.USD).toFixed(0);
                          setPaymentEntries([{ amount: usdAmount, currency: "USD" }]);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors"
                      >
                        USD Al ({((selectedFile.kalan_tutar || selectedFile.ucret || 0) * exchangeRates.EUR / exchangeRates.USD).toLocaleString("tr-TR", {maximumFractionDigits: 0})} $)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Farklı döviz bilgisi */}
              {validEntries.length === 1 && validEntries[0].currency !== (selectedFile.ucret_currency || "TL") && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  <p className="text-xs text-blue-700">
                    Dosya ücreti <strong>{selectedFile.ucret_currency}</strong> ama <strong>{validEntries[0].currency}</strong> olarak tahsil ediliyor. Bu bilgi muhasebeye iletilecek.
                  </p>
                </div>
              )}

              {/* TL karşılığı gösterimi */}
              {validEntries.length === 1 && validEntries[0].amount && validEntries[0].currency !== "TL" && exchangeRates[validEntries[0].currency] && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  <p className="text-xs text-emerald-600">
                    {parseFloat(validEntries[0].amount).toLocaleString("tr-TR")} {validEntries[0].currency} = <strong>{(parseFloat(validEntries[0].amount) * exchangeRates[validEntries[0].currency]).toLocaleString("tr-TR")} TL</strong>
                  </p>
                  <p className="text-[10px] text-emerald-500">Kur: 1 {validEntries[0].currency} = {exchangeRates[validEntries[0].currency]} TL</p>
                </div>
              )}
            </div>

            <Select label="Ödeme Yöntemi" options={ODEME_YONTEMLERI} value={yontem} onChange={(e) => setYontem(e.target.value)} />

            {yontem === "hesaba" && (
              <div className="space-y-3">
                <Select label="Hesap Sahibi" options={HESAP_SAHIPLERI} value={hesapSahibi} onChange={(e) => setHesapSahibi(e.target.value as HesapSahibi)} />
                <div>
                  <label className="block text-xs font-medium text-navy-600 mb-1">Dekont Yükle</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setDekontFile(f);
                      setDekontPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
                    }}
                    className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 text-navy-600"
                  />
                  {dekontPreview && (
                    <div className="mt-2 relative w-16 h-16 rounded-lg overflow-hidden border border-navy-200">
                      <img src={dekontPreview} alt="Dekont" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setDekontFile(null); setDekontPreview(null); }} className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">×</button>
                    </div>
                  )}
                  {dekontFile && !dekontPreview && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded-lg">
                      <span className="truncate">{dekontFile.name}</span>
                      <button type="button" onClick={() => { setDekontFile(null); setDekontPreview(null); }} className="text-red-600 font-bold flex-shrink-0">×</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedFile?.on_odeme_tutar && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">Ön Ödeme Geçmişi</p>
                <p className="text-xs text-blue-700">
                  {new Date(selectedFile.created_at).toLocaleDateString("tr-TR")} · {selectedFile.on_odeme_tutar} {selectedFile.on_odeme_currency} alınmıştır
                </p>
                <p className="text-[10px] text-blue-600 mt-1">Toplam: {selectedFile.ucret} {selectedFile.ucret_currency} · Kalan: {selectedFile.kalan_tutar} {selectedFile.ucret_currency}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-navy-500">Not <span className="text-navy-300">(isteğe bağlı)</span></label>
              <textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder="Ek bilgi..." className="w-full mt-1 px-3 py-2 border border-navy-200 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} />
            </div>

            <div className="flex gap-3 pt-3 border-t border-navy-100">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-navy-300 rounded-lg text-sm font-medium text-navy-600 hover:bg-navy-50 transition-colors">İptal</button>
              <button type="button" onClick={handleTahsilatOnay} disabled={!hasValidEntries} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">Devam</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Onay Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Tahsilatı Onayla" size="sm">
        {selectedFile && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <p className="text-sm text-navy-600 mb-1"><strong>{selectedFile.musteri_ad}</strong></p>
              <div className="space-y-1 mt-3">
                {validEntries.map((e, i) => (
                  <p key={i} className="text-2xl font-black text-emerald-700">{formatCurrency(parseFloat(e.amount), e.currency)}</p>
                ))}
              </div>
              {validEntries.length > 1 && (
                <p className="text-xs text-emerald-600 mt-2 bg-emerald-100 rounded-full px-3 py-1 inline-block">Karışık döviz ödemesi</p>
              )}
              <p className="text-xs text-navy-500 mt-2">
                {yontem === "nakit" ? "Nakit" : `Hesaba (${(HESAP_SAHIPLERI.find(h => h.value === hesapSahibi) || {label: ""}).label})`}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800 text-xs text-center">Bu işlem geri alınamaz. Emin misiniz?</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowConfirmModal(false); setShowModal(true); }} className="flex-1 py-2 border border-navy-300 rounded-lg text-sm font-medium text-navy-600 hover:bg-navy-50 transition-colors" disabled={isSubmitting}>Geri</button>
              <button type="button" onClick={handleTahsilatKaydet} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors" disabled={isSubmitting}>
                {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
