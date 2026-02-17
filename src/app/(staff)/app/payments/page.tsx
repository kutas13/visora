"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyPaymentReceived } from "@/lib/notifications";
import { ODEME_YONTEMLERI, PARA_BIRIMLERI, HESAP_SAHIPLERI } from "@/lib/constants";
import type { Payment, VisaFile, ParaBirimi, HesapSahibi } from "@/lib/supabase/types";

type PaymentWithFile = Payment & { visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke" | "ucret" | "ucret_currency"> | null };

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
  const [tutar, setTutar] = useState("");
  const [currency, setCurrency] = useState<ParaBirimi>("TL");
  const [yontem, setYontem] = useState("nakit");
  const [hesapSahibi, setHesapSahibi] = useState<HesapSahibi>("DAVUT_TURGUT");
  const [notlar, setNotlar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterCurrency, setFilterCurrency] = useState("all");
  const [stats, setStats] = useState<Record<string, number>>({ TL: 0, EUR: 0, USD: 0 });

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
      .neq("cari_tipi", "firma_cari") // Firma cari dosyaları hariç (muhasebe takibinde)
      .order("created_at", { ascending: false });

    setUnpaidFiles(unpaid || []);

    const { data: paymentData } = await supabase
      .from("payments")
      .select("*, visa_files(musteri_ad, hedef_ulke, ucret, ucret_currency)")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setPayments(paymentData || []);

    if (paymentData) {
      const totals: Record<string, number> = { TL: 0, EUR: 0, USD: 0 };
      paymentData.forEach(p => {
        if (p.durum === "odendi") {
          const curr = p.currency || "TL";
          totals[curr] = (totals[curr] || 0) + Number(p.tutar);
        }
      });
      setStats(totals);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleTahsilatYap = (file: VisaFile) => {
    setSelectedFile(file);
    // Ön ödeme varsa kalan tutarı, yoksa toplam tutarı göster
    const tahsilatTutari = file.kalan_tutar || file.ucret;
    setTutar(tahsilatTutari?.toString() || "");
    setCurrency(file.ucret_currency || "TL");
    setYontem("nakit");
    setNotlar("");
    setShowModal(true);
  };

  const handleTahsilatOnay = () => {
    if (!selectedFile || !tutar || parseFloat(tutar) <= 0) {
      alert("Lütfen geçerli bir tutar girin");
      return;
    }
    setShowModal(false);
    setShowConfirmModal(true);
  };

  const handleTahsilatKaydet = async () => {
    if (!selectedFile || !tutar || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      const userName = profile?.name || "Kullanıcı";
      const amount = parseFloat(tutar);

      const { error: paymentError } = await supabase.from("payments").insert({
        file_id: selectedFile.id,
        tutar: amount,
        yontem: yontem as "nakit" | "hesaba",
        durum: "odendi",
        currency: currency,
        payment_type: "tahsilat",
        created_by: user.id,
      });

      if (paymentError) throw paymentError;

      const { error: updateError } = await supabase.from("visa_files").update({ odeme_durumu: "odendi" }).eq("id", selectedFile.id);
      if (updateError) throw updateError;

      await supabase.from("activity_logs").insert({
        type: "payment_added",
        message: `${selectedFile.musteri_ad} için tahsilat aldı: ${formatCurrency(amount, currency)}`,
        file_id: selectedFile.id,
        actor_id: user.id,
      });

      await notifyPaymentReceived(selectedFile.id, selectedFile.musteri_ad, amount, yontem, user.id, userName);

      // Otomatik email gönder (Muhasebe'ye)
      try {
        const emailRes = await fetch("/api/send-tahsilat-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderEmail: user.email,
            senderName: userName,
            musteriAd: selectedFile.musteri_ad,
            hedefUlke: selectedFile.hedef_ulke,
            tutar: amount,
            currency: currency,
            yontem: yontem,
            hesapSahibi: yontem === "hesaba" ? hesapSahibi : null,
            notlar: notlar.trim() || null,
            onOdemeGecmisi: selectedFile.on_odeme_tutar ? {
              tutar: selectedFile.on_odeme_tutar,
              currency: selectedFile.on_odeme_currency,
              tarih: selectedFile.created_at
            } : null,
            emailType: "tahsilat",
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
      setTutar("");
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

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <span className="text-3xl">💰</span>
          Ödemeler
        </h1>
        <p className="text-navy-500 mt-1">Tahsilatları yönetin ve takip edin</p>
      </div>

      {/* Özet Kartlar - Profesyonel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats).map(([curr, total]) => {
          const borderColors: Record<string, string> = {
            TL: "border-l-emerald-500",
            EUR: "border-l-blue-500", 
            USD: "border-l-amber-500",
          };
          const textColors: Record<string, string> = {
            TL: "text-emerald-600",
            EUR: "text-blue-600",
            USD: "text-amber-600",
          };
          return (
            <Card key={curr} className={`bg-white p-6 shadow-md hover:shadow-lg transition-shadow border-l-4 ${borderColors[curr]}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-navy-500 text-sm font-medium">Toplam Tahsilat</p>
                  <p className={`text-2xl font-bold mt-2 ${textColors[curr]}`}>{formatCurrency(total, curr)}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${curr === "TL" ? "bg-emerald-50 text-emerald-600" : curr === "EUR" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                  {getCurrencySymbol(curr)}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tab Seçimi - Minimal */}
      <div className="inline-flex p-1 rounded-lg bg-gray-100 border">
        <button
          onClick={() => setActiveTab("odenmemis")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "odenmemis" 
              ? "bg-white text-navy-900 shadow-sm" 
              : "text-navy-600 hover:text-navy-900"
          }`}
        >
          Ödenmemişler
          {unpaidFiles.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">{unpaidFiles.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("tahsilatlar")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "tahsilatlar" 
              ? "bg-white text-navy-900 shadow-sm" 
              : "text-navy-600 hover:text-navy-900"
          }`}
        >
          Tahsilatlarım
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : activeTab === "odenmemis" ? (
        <Card className="overflow-hidden shadow-sm border">
          <div className="bg-navy-800 px-6 py-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span>⏳</span>
              Bekleyen Tahsilatlar
            </h3>
          </div>
          <div className="p-6 md:p-8">
            {unpaidFiles.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">✓</span>
                </div>
                <p className="text-xl font-bold text-navy-900 mb-2">Harika!</p>
                <p className="text-navy-500">Tüm ödemeler tahsil edilmiş.</p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Müşteri</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Ülke</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Ücret</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Durum</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidFiles.map((file, index) => (
                        <tr key={file.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="font-medium text-navy-600 text-sm">{file.musteri_ad.charAt(0)}</span>
                              </div>
                              <div>
                                <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                                <p className="text-xs text-navy-500">{file.pasaport_no}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-navy-700">{file.hedef_ulke}</span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-lg text-navy-900">{formatCurrency(file.ucret || 0, file.ucret_currency || "TL")}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-md">Cari</span>
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-md">Ödenmedi</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Button size="sm" onClick={() => handleTahsilatYap(file)}>
                              Tahsilat Yap
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-4">
                  {unpaidFiles.map((file) => {
                    const curr = file.ucret_currency || "TL";
                    const borderColors: Record<string, string> = { TL: "border-l-emerald-500", EUR: "border-l-blue-500", USD: "border-l-amber-500" };
                    return (
                      <Card key={file.id} className={`p-4 border-l-4 ${borderColors[curr] || borderColors.TL} shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="font-medium text-navy-600">{file.musteri_ad.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                              <p className="text-sm text-navy-500">{file.pasaport_no}</p>
                            </div>
                          </div>
                          <span className="text-sm text-navy-600">{file.hedef_ulke}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-navy-900">{formatCurrency(file.ucret || 0, file.ucret_currency || "TL")}</p>
                            <div className="flex gap-1.5 mt-2">
                              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-md">Cari</span>
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-md">Ödenmedi</span>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleTahsilatYap(file)}>
                            Tahsilat Yap
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm border">
          <div className="bg-navy-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <span>📋</span>
                Tahsilat Geçmişim
              </h3>
              <Select 
                options={currencyOptions} 
                value={filterCurrency} 
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="p-6 md:p-8">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📋</span>
                </div>
                <p className="text-navy-500">Tahsilat kaydı bulunamadı.</p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Müşteri</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Tutar</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Tip</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Yöntem</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-navy-700">Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((p, index) => (
                        <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="py-3 px-4">
                            <p className="font-medium text-navy-900">{p.visa_files?.musteri_ad || "-"}</p>
                            <p className="text-xs text-navy-500">{p.visa_files?.hedef_ulke}</p>
                          </td>
                          <td className="py-3 px-4 font-semibold text-lg text-navy-900">{formatCurrency(Number(p.tutar), p.currency || "TL")}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-md ${p.payment_type === "pesin_satis" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {p.payment_type === "pesin_satis" ? "Peşin Satış" : "Tahsilat"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-md ${p.yontem === "nakit" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {p.yontem === "nakit" ? "💵 Nakit" : "🏦 Hesaba"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-navy-500">{formatDate(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-4">
                  {filteredPayments.map((p) => {
                    const curr = p.currency || "TL";
                    const borderColors: Record<string, string> = { TL: "border-l-emerald-500", EUR: "border-l-blue-500", USD: "border-l-amber-500" };
                    return (
                      <Card key={p.id} className={`p-4 border-l-4 ${borderColors[curr] || borderColors.TL} shadow-sm`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-navy-900">{p.visa_files?.musteri_ad || "-"}</p>
                            <p className="text-xs text-navy-500">{p.visa_files?.hedef_ulke}</p>
                          </div>
                          <p className="font-semibold text-lg text-navy-900">{formatCurrency(Number(p.tutar), p.currency || "TL")}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5">
                            <span className={`px-2 py-1 text-xs font-medium rounded-md ${p.payment_type === "pesin_satis" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {p.payment_type === "pesin_satis" ? "Peşin" : "Tahsilat"}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-md ${p.yontem === "nakit" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {p.yontem === "nakit" ? "💵 Nakit" : "🏦 Hesaba"}
                            </span>
                          </div>
                          <p className="text-xs text-navy-500">{formatDate(p.created_at)}</p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Tahsilat Detay Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Tahsilat Bilgileri" size="sm">
        {selectedFile && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-navy-50 to-white rounded-xl p-4 border border-navy-200">
              <p className="text-sm text-navy-500 mb-1">Müşteri</p>
              <p className="font-bold text-navy-900 text-lg">{selectedFile.musteri_ad}</p>
              <p className="text-sm text-navy-600">{selectedFile.hedef_ulke}</p>
              <p className="text-xl font-bold text-primary-600 mt-3">
                Beklenen: {formatCurrency(selectedFile.ucret || 0, selectedFile.ucret_currency || "TL")}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input label="Tahsilat Tutarı *" type="number" placeholder="0" value={tutar} onChange={(e) => setTutar(e.target.value)} required />
              </div>
              <Select label="Para Birimi" options={PARA_BIRIMLERI} value={currency} onChange={(e) => setCurrency(e.target.value as ParaBirimi)} />
            </div>

            <Select label="Ödeme Yöntemi" options={ODEME_YONTEMLERI} value={yontem} onChange={(e) => setYontem(e.target.value)} />

            {yontem === "hesaba" && (
              <Select 
                label="Hesap Sahibi" 
                options={HESAP_SAHIPLERI} 
                value={hesapSahibi} 
                onChange={(e) => setHesapSahibi(e.target.value as HesapSahibi)} 
              />
            )}

            {/* Ön ödeme bilgisi */}
            {selectedFile?.on_odeme_tutar && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">💳 Ön Ödeme Geçmişi</h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">
                    {new Date(selectedFile.created_at).toLocaleDateString("tr-TR")} tarihinde
                  </span>
                  <span className="font-bold text-blue-800">
                    {selectedFile.on_odeme_tutar} {selectedFile.on_odeme_currency} alınmıştır
                  </span>
                </div>
                <div className="mt-2 text-xs text-blue-600 bg-blue-100 rounded-lg p-2">
                  <strong>Toplam:</strong> {selectedFile.ucret} {selectedFile.ucret_currency} • 
                  <strong> Kalan:</strong> {selectedFile.kalan_tutar} {selectedFile.ucret_currency}
                </div>
              </div>
            )}

            {/* Not Alanı */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy-600">
                Muhasebe Notunuz <span className="text-navy-400">(isteğe bağlı)</span>
              </label>
              <textarea
                value={notlar}
                onChange={(e) => setNotlar(e.target.value)}
                placeholder="Ek bilgi veya açıklama..."
                className="w-full px-4 py-3 border border-navy-300 rounded-xl resize-none text-sm"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-navy-200">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                İptal
              </Button>
              <Button type="button" onClick={handleTahsilatOnay} className="flex-1" disabled={!tutar || parseFloat(tutar) <= 0}>
                Devam →
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Onay Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Tahsilatı Onayla" size="sm">
        {selectedFile && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-4xl">💰</span>
                </div>
                <p className="text-navy-700 mb-2">
                  <strong>{selectedFile.musteri_ad}</strong> için
                </p>
                <p className="text-4xl font-bold text-green-700">
                  {formatCurrency(parseFloat(tutar), currency)}
                </p>
                <p className="text-sm text-navy-500 mt-2 bg-white/50 rounded-full px-4 py-1 inline-block">
                  {yontem === "nakit" ? "Nakit (Cariden Düşüş)" : `Hesaba (${(HESAP_SAHIPLERI.find(h => h.value === hesapSahibi) || {label: ""}).label})`}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 text-sm text-center flex items-center justify-center gap-2">
                <span>⚠️</span>
                Bu işlem geri alınamaz. Emin misiniz?
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => { setShowConfirmModal(false); setShowModal(true); }} className="flex-1" disabled={isSubmitting}>
                ← Geri
              </Button>
              <Button type="button" onClick={handleTahsilatKaydet} className="flex-1 bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                {isSubmitting ? "Kaydediliyor..." : "✓ Tahsilatı Kaydet"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
