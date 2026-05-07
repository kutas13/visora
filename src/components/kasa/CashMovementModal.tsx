"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Input, Select, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";

type MovementType = "gelir" | "gider";

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SYM: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };

export default function CashMovementModal({ isOpen, onClose, onSuccess }: CashMovementModalProps) {
  const [type, setType] = useState<MovementType>("gelir");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("TL");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 0, EUR: 0, TL: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setType("gelir");
    setDescription("");
    setAmount("");
    setCurrency("TL");
    setError(null);
    setSubmitting(false);
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates) setExchangeRates({ USD: 0, EUR: 0, TL: 1, ...(d.rates as Record<string, number>) });
      })
      .catch(() => {});
  }, [isOpen]);

  const tlKarsilik = useMemo(() => {
    const a = Number(amount) || 0;
    if (a <= 0) return 0;
    if (currency === "TL") return a;
    const r = Number(exchangeRates[currency]) || 0;
    return r > 0 ? a * r : 0;
  }, [amount, currency, exchangeRates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const a = Number(amount);
    if (!description.trim()) { setError("Açıklama zorunludur"); return; }
    if (!a || a <= 0) { setError("Geçerli bir tutar girin"); return; }
    if (currency !== "TL" && tlKarsilik <= 0) {
      setError("Döviz kuru bilgisi alınamadı, lütfen TL ile girin");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        setError("Oturum bulunamadı");
        setSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase.from("cash_movements").insert({
        type,
        description: description.trim(),
        amount: a,
        currency,
        tl_karsilik: Math.round(tlKarsilik * 100) / 100,
        exchange_rate: currency === "TL" ? 1 : Number(exchangeRates[currency]) || null,
        created_by: uid,
      });

      if (insertErr) {
        setError(insertErr.message);
        setSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gelir / Gider Ekle" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            İşlem Türü
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("gelir")}
              className={`relative overflow-hidden flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-extrabold transition-all ${
                type === "gelir"
                  ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400 -translate-y-0.5"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Gelir
            </button>
            <button
              type="button"
              onClick={() => setType("gider")}
              className={`relative overflow-hidden flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-extrabold transition-all ${
                type === "gider"
                  ? "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400 -translate-y-0.5"
                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Gider
            </button>
          </div>
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Açıklama <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === "gelir" ? "Örn: Ek hizmet bedeli, ofis kirası tahsilatı..." : "Örn: Ofis kirası, internet faturası, market alışverişi..."}
            rows={3}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 transition-all focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 hover:border-slate-300 resize-none"
          />
        </div>

        {/* Tutar + Döviz */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Tutar"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              placeholder="0,00"
              required
            />
          </div>
          <div>
            <Select
              label="Döviz"
              options={PARA_BIRIMLERI.map((p) => ({ value: p.value, label: p.label }))}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
        </div>

        {/* TL karsiligi onizleme */}
        {currency !== "TL" && Number(amount) > 0 && (
          <div className={`p-3 rounded-xl ring-1 ${
            type === "gelir"
              ? "bg-emerald-50 ring-emerald-200 text-emerald-800"
              : "bg-rose-50 ring-rose-200 text-rose-800"
          }`}>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Anlık TL Karşılığı (TCMB)
            </div>
            <div className="mt-0.5 text-lg font-black">
              {tlKarsilik > 0
                ? `≈ ${Math.round(tlKarsilik).toLocaleString("tr-TR")} ₺`
                : "Kur bilgisi alınamadı"}
            </div>
            <div className="text-[10.5px] opacity-70 mt-0.5">
              Kur: 1 {SYM[currency]} = {(Number(exchangeRates[currency]) || 0).toFixed(2)} ₺
            </div>
          </div>
        )}

        {/* Ozet */}
        <div className={`p-3.5 rounded-xl text-center ring-2 ${
          type === "gelir"
            ? "bg-gradient-to-br from-emerald-50 to-green-50 ring-emerald-300"
            : "bg-gradient-to-br from-rose-50 to-red-50 ring-rose-300"
        }`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Kasaya {type === "gelir" ? "Eklenecek" : "Düşürülecek"} Tutar
          </p>
          <p className={`mt-1 text-2xl font-black ${type === "gelir" ? "text-emerald-700" : "text-rose-700"}`}>
            {type === "gelir" ? "+" : "−"} {Number(amount).toLocaleString("tr-TR") || "0"} {SYM[currency]}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={submitting}
          >
            İptal
          </Button>
          <Button
            type="submit"
            className={`flex-1 ${
              type === "gelir"
                ? "!bg-gradient-to-r !from-emerald-600 !to-green-600 hover:!from-emerald-700 hover:!to-green-700"
                : "!bg-gradient-to-r !from-rose-600 !to-red-600 hover:!from-rose-700 hover:!to-red-700"
            }`}
            disabled={submitting}
          >
            {submitting ? "Kaydediliyor..." : type === "gelir" ? "Geliri Kaydet" : "Gideri Kaydet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
