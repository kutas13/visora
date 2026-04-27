"use client";

import { useEffect, useState } from "react";
import { Modal, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { notifyPaymentReceived } from "@/lib/notifications";
import { ODEME_YONTEMLERI, HESAP_SAHIPLERI } from "@/lib/constants";
import type { VisaFile, ParaBirimi, HesapSahibi } from "@/lib/supabase/types";

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
  const [hesapSahibi, setHesapSahibi] = useState<HesapSahibi>("DAVUT_TURGUT");
  const [notlar, setNotlar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([{ amount: "", currency: "TL" }]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 49.5, EUR: 53, TL: 1 });
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
    }
  }, [isOpen, file]);

  const loadExchangeRates = async () => {
    try {
      const res = await fetch("/api/exchange-rates");
      const data = await res.json();
      if (data.rates) setExchangeRates(data.rates);
    } catch {}
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

      const { error: payErr } = await supabase.from("payments").insert({
        file_id: file.id,
        tutar: primaryAmount,
        yontem: yontem as "nakit" | "hesaba" | "pos",
        durum: "odendi",
        currency: effectiveCurrency,
        payment_type: "tahsilat",
        created_by: user.id,
        pos_doviz_tutar: posDovizNum,
        pos_doviz_currency: posDovizCurr,
      });
      if (payErr) throw payErr;

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
      alert("Tahsilat kaydedilirken hata oluştu");
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

            {validEntries.length === 1 &&
              validEntries[0].amount &&
              validEntries[0].currency !== "TL" &&
              exchangeRates[validEntries[0].currency] && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  <p className="text-xs text-emerald-600">
                    {parseFloat(validEntries[0].amount).toLocaleString("tr-TR")} {validEntries[0].currency} ={" "}
                    <strong>
                      {(parseFloat(validEntries[0].amount) * exchangeRates[validEntries[0].currency]).toLocaleString(
                        "tr-TR"
                      )}{" "}
                      TL
                    </strong>
                  </p>
                </div>
              )}
          </div>

          <Select
            label="Ödeme Yöntemi"
            options={ODEME_YONTEMLERI}
            value={yontem}
            onChange={(e) => setYontem(e.target.value)}
          />

          {yontem === "hesaba" && (
            <div className="space-y-3">
              <Select
                label="Hesap Sahibi"
                options={HESAP_SAHIPLERI}
                value={hesapSahibi}
                onChange={(e) => setHesapSahibi(e.target.value as HesapSahibi)}
              />
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
                : `Hesaba (${(HESAP_SAHIPLERI.find((h) => h.value === hesapSahibi) || { label: "" }).label})`}
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
