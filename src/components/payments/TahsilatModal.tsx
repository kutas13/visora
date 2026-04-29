"use client";

import { useEffect, useState } from "react";
import { Modal, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { uploadBase64ToStorage } from "@/lib/supabase/storage";
import { notifyPaymentReceived } from "@/lib/notifications";
import { ODEME_YONTEMLERI } from "@/lib/constants";
import type { VisaFile, ParaBirimi, HesapSahibi, BankAccount } from "@/lib/supabase/types";

type PaymentEntry = { amount: string; currency: ParaBirimi };

interface TahsilatModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: VisaFile | null;
  onSuccess: () => void;
}

function getCurrencySymbol(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}
function formatCurrency(n: number, c: string) {
  return `${n.toLocaleString("tr-TR")} ${getCurrencySymbol(c)}`;
}
function getTotalDosyaAmount(file: VisaFile) {
  if (typeof file.kalan_tutar === "number") return file.kalan_tutar;
  return (Number(file.ucret) || 0) + (Number(file.davetiye_ucreti) || 0);
}

export default function TahsilatModal({ isOpen, onClose, file, onSuccess }: TahsilatModalProps) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [yontem, setYontem] = useState("nakit");
  // Hesap sahibi listesi artik bank_accounts'tan dinamik geliyor;
  // ilk aktif hesabin adi default olur (ilk fetch'ten sonra atanir).
  const [hesapSahibi, setHesapSahibi] = useState<HesapSahibi>("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const hesapSahibiOptions = bankAccounts
    .filter((a) => a.is_active)
    .map((a) => ({ value: a.name, label: a.bank_name ? `${a.name} — ${a.bank_name}` : a.name }));
  const [notlar, setNotlar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([{ amount: "", currency: "TL" }]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 49.5, EUR: 53, TL: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [dekontFile, setDekontFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen && file) {
      setStep("form");
      const tot = getTotalDosyaAmount(file);
      setPaymentEntries([{ amount: tot ? String(tot) : "", currency: (file.ucret_currency || "TL") as ParaBirimi }]);
      setYontem("nakit");
      setNotlar("");
      setDekontFile(null);
      void loadExchangeRates();
      void loadBankAccounts();
    }
  }, [isOpen, file]);

  const loadBankAccounts = async () => {
    try {
      const res = await fetch("/api/bank-accounts");
      if (res.ok) {
        const json = await res.json();
        const accounts = (json.data || []) as BankAccount[];
        setBankAccounts(accounts);
        const firstActive = accounts.find((a) => a.is_active);
        if (firstActive) setHesapSahibi(firstActive.name);
        else setHesapSahibi("");
      }
    } catch (err) {
      console.error("Banka hesaplari alinamadi:", err);
    }
  };

  const loadExchangeRates = async () => {
    try {
      setRatesLoading(true);
      const res = await fetch("/api/exchange-rates");
      const data = await res.json();
      if (data.rates) setExchangeRates(data.rates);
      if (data.lastUpdate) setRatesUpdatedAt(data.lastUpdate as string);
    } catch {}
    finally {
      setRatesLoading(false);
    }
  };

  const validEntries = paymentEntries.filter((e) => e.amount && parseFloat(e.amount) > 0);
  const hasValidEntries = validEntries.length > 0;

  const updateEntry = (i: number, field: "amount" | "currency", v: string) => {
    if (yontem === "pos" && field === "currency") return;
    setPaymentEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)));
  };

  const addEntry = () => {
    if (yontem === "pos") return;
    setPaymentEntries((prev) => [...prev, { amount: "", currency: "TL" }]);
  };

  const removeEntry = (i: number) => {
    if (paymentEntries.length <= 1) return;
    setPaymentEntries((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onContinue = () => {
    if (!hasValidEntries) {
      alert("Lütfen geçerli bir tutar girin");
      return;
    }
    setStep("confirm");
  };

  const onSave = async () => {
    if (!file || isSubmitting || !hasValidEntries) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      const userName = profile?.name || "Kullanıcı";

      const primary = validEntries[0];
      const primaryAmount = parseFloat(primary.amount);
      const effectiveCurrency = (yontem === "pos" ? "TL" : primary.currency) as ParaBirimi;

      const fc = file.ucret_currency || "TL";
      const posDovizNum = yontem === "pos" && (fc === "USD" || fc === "EUR") ? getTotalDosyaAmount(file) : null;
      const posDovizCurr = posDovizNum ? (fc as "USD" | "EUR") : null;

      // Dekont (yalniz hesaba): Storage'a yukle, payments.dekont_url'e yaz.
      let dekontUrlForPayment: string | null = null;
      if (dekontFile && yontem === "hesaba" && hesapSahibi) {
        try {
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(dekontFile);
          });
          dekontUrlForPayment = await uploadBase64ToStorage(b64, `dekontlar/${file.id}`, `tahsilat-${Date.now()}`);
        } catch (e) {
          console.error("Dekont yuklenemedi:", e);
        }
      }

      const paymentPayload = {
        file_id: file.id,
        tutar: primaryAmount,
        yontem: yontem as "nakit" | "hesaba" | "pos",
        durum: "odendi",
        currency: effectiveCurrency,
        payment_type: "tahsilat",
        created_by: user.id,
        pos_doviz_tutar: posDovizNum,
        pos_doviz_currency: posDovizCurr,
      };

      const { error: payErr } = await supabase.from("payments").insert({
        ...paymentPayload,
        hesap_sahibi: yontem === "hesaba" ? hesapSahibi : null,
        dekont_url: dekontUrlForPayment,
      });
      // Migration 028 henuz calismadiysa kolonsuz fallback ile tahsilati yine kaydet.
      if (payErr && /hesap_sahibi|dekont_url/i.test(payErr.message || "")) {
        const { error: legacyErr } = await supabase.from("payments").insert(paymentPayload);
        if (legacyErr) throw new Error(legacyErr.message || "Tahsilat kaydı yapılamadı");
      } else if (payErr) {
        throw new Error(payErr.message || "Tahsilat kaydı yapılamadı");
      }

      const { error: upErr } = await supabase.from("visa_files").update({ odeme_durumu: "odendi" }).eq("id", file.id);
      if (upErr) throw upErr;

      const breakdownText = validEntries
        .map((e) => formatCurrency(parseFloat(e.amount), yontem === "pos" ? "TL" : e.currency))
        .join(" + ");

      await supabase.from("activity_logs").insert({
        type: "payment_added",
        message: `${file.musteri_ad} için tahsilat alındı: ${breakdownText}`,
        file_id: file.id,
        actor_id: user.id,
      });

      await notifyPaymentReceived(file.id, file.musteri_ad, primaryAmount, yontem, user.id, userName);

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
        await fetch("/api/send-tahsilat-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderEmail: user.email,
            senderName: userName,
            musteriAd: file.musteri_ad,
            hedefUlke: file.hedef_ulke,
            tutar: primaryAmount,
            currency: effectiveCurrency,
            yontem,
            hesapSahibi: yontem === "hesaba" ? hesapSahibi : null,
            notlar: notlar.trim() || null,
            dosyaCurrency: file.ucret_currency,
            dosyaTutar: getTotalDosyaAmount(file),
            emailType: "tahsilat",
            dekontBase64,
            dekontName,
          }),
        });
      } catch (mailErr) {
        console.error("Tahsilat email gönderilemedi:", mailErr);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      alert(`Tahsilat kaydedilirken hata oluştu: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!file) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={step === "form" ? "Tahsilat Bilgileri" : "Tahsilatı Onayla"}
      size="sm"
    >
      {step === "form" ? (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">{file.musteri_ad}</p>
                <p className="text-xs text-slate-500">{file.hedef_ulke}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Beklenen</p>
                <p className="font-bold text-primary-600">
                  {formatCurrency(getTotalDosyaAmount(file), file.ucret_currency || "TL")}
                </p>
              </div>
            </div>
          </div>

          {/* TCMB ANLIK KUR */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 border border-indigo-100 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  TCMB Anlık Kur
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadExchangeRates()}
                disabled={ratesLoading}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 inline-flex items-center gap-1"
                title="Kuru yenile"
              >
                <svg className={`w-3 h-3 ${ratesLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Yenile
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/70 ring-1 ring-indigo-100 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">EUR / TL</p>
                <p className="text-sm font-black text-slate-900 tabular-nums">
                  ₺{exchangeRates.EUR?.toFixed(2) ?? "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white/70 ring-1 ring-indigo-100 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">USD / TL</p>
                <p className="text-sm font-black text-slate-900 tabular-nums">
                  ₺{exchangeRates.USD?.toFixed(2) ?? "—"}
                </p>
              </div>
            </div>
            {ratesUpdatedAt && (
              <p className="mt-1.5 text-[10px] text-slate-500">
                Son güncelleme: {ratesUpdatedAt}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ödeme Kalemleri</p>
              {yontem !== "pos" && (
                <button
                  type="button"
                  onClick={addEntry}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Kalem Ekle
                </button>
              )}
            </div>
            {paymentEntries.map((entry, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={idx === 0 ? "Tutar" : undefined}
                    type="number"
                    placeholder="0"
                    value={entry.amount}
                    onChange={(e) => updateEntry(idx, "amount", e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <select
                    value={yontem === "pos" ? "TL" : entry.currency}
                    onChange={(e) => updateEntry(idx, "currency", e.target.value)}
                    disabled={yontem === "pos"}
                    className="w-full px-2 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                  >
                    <option value="TL">TL ₺</option>
                    {yontem !== "pos" && <option value="EUR">EUR €</option>}
                    {yontem !== "pos" && <option value="USD">USD $</option>}
                  </select>
                </div>
                {paymentEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(idx)}
                    className="p-2.5 text-red-400 hover:bg-red-50 rounded-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* Çoklu kalem TL toplam karşılığı */}
            {validEntries.length > 0 &&
              validEntries.some((e) => e.currency !== "TL") &&
              yontem !== "pos" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 space-y-1">
                  {validEntries.map((e, i) => {
                    if (e.currency === "TL") return null;
                    const rate = exchangeRates[e.currency] || 0;
                    const tl = parseFloat(e.amount) * rate;
                    return (
                      <p key={i} className="text-xs text-emerald-700">
                        {parseFloat(e.amount).toLocaleString("tr-TR")} {e.currency} ×{" "}
                        <span className="font-mono">{rate.toFixed(2)}</span> ={" "}
                        <strong className="tabular-nums">
                          {Math.round(tl).toLocaleString("tr-TR")} ₺
                        </strong>
                      </p>
                    );
                  })}
                  {validEntries.length > 1 && (
                    <p className="text-[11px] text-emerald-800 font-bold border-t border-emerald-200 pt-1 mt-1">
                      Toplam TL karşılığı:{" "}
                      <span className="tabular-nums">
                        {Math.round(
                          validEntries.reduce((sum, e) => {
                            const r = e.currency === "TL" ? 1 : exchangeRates[e.currency] || 0;
                            return sum + parseFloat(e.amount) * r;
                          }, 0)
                        ).toLocaleString("tr-TR")}{" "}
                        ₺
                      </span>
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* Hızlı Döviz Butonları */}
          {file.ucret_currency !== "TL" && yontem !== "pos" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hızlı Seçim</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const tlAmount = (getTotalDosyaAmount(file) * (exchangeRates[file.ucret_currency || "TL"] || 1)).toFixed(0);
                    setPaymentEntries([{ amount: tlAmount, currency: "TL" }]);
                  }}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  TL Al
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentEntries([{ amount: String(getTotalDosyaAmount(file)), currency: (file.ucret_currency || "TL") as ParaBirimi }])}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {file.ucret_currency || "TL"} Al
                </button>
                {file.ucret_currency === "USD" && exchangeRates.EUR && (
                  <button
                    type="button"
                    onClick={() => {
                      const eurAmount = (getTotalDosyaAmount(file) * (exchangeRates.USD || 1) / exchangeRates.EUR).toFixed(0);
                      setPaymentEntries([{ amount: eurAmount, currency: "EUR" }]);
                    }}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    EUR Al
                  </button>
                )}
                {file.ucret_currency === "EUR" && exchangeRates.USD && (
                  <button
                    type="button"
                    onClick={() => {
                      const usdAmount = (getTotalDosyaAmount(file) * (exchangeRates.EUR || 1) / exchangeRates.USD).toFixed(0);
                      setPaymentEntries([{ amount: usdAmount, currency: "USD" }]);
                    }}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    USD Al
                  </button>
                )}
              </div>
            </div>
          )}

          <Select
            label="Ödeme Yöntemi"
            options={ODEME_YONTEMLERI}
            value={yontem}
            onChange={(e) => setYontem(e.target.value)}
          />

          {yontem === "hesaba" && (
            <div className="space-y-3">
              {hesapSahibiOptions.length > 0 ? (
                <Select
                  label="Hesap Sahibi"
                  options={hesapSahibiOptions}
                  value={hesapSahibi}
                  onChange={(e) => setHesapSahibi(e.target.value as HesapSahibi)}
                />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Henüz tanımlı banka hesabı yok. Genel müdür <a href="/admin/banka-hesaplari" className="font-semibold underline">Banka Hesapları</a> sayfasından bir hesap eklemeli.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dekont (opsiyonel)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDekontFile(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500">Not (isteğe bağlı)</label>
            <textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!hasValidEntries}
              className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
            >
              Devam
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
            <p className="text-sm text-slate-600 mb-1">
              <strong>{file.musteri_ad}</strong>
            </p>
            <div className="space-y-1 mt-3">
              {validEntries.map((e, i) => (
                <p key={i} className="text-2xl font-black text-emerald-700">
                  {formatCurrency(parseFloat(e.amount), e.currency)}
                </p>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {yontem === "nakit"
                ? "Nakit"
                : yontem === "pos"
                ? "POS"
                : `Hesaba (${hesapSahibi || "-"})`}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-800 text-xs text-center">Bu işlem geri alınamaz. Emin misiniz?</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("form")}
              disabled={isSubmitting}
              className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Geri
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSubmitting}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
            >
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
