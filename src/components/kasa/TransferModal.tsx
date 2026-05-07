"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Input, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { CashAccount } from "@/lib/supabase/types";
import { CURRENCY_SYMBOL, fmtCurrency } from "@/lib/kasa/helpers";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: CashAccount[];
  balances: Map<string, number>;
}

export default function TransferModal({ isOpen, onClose, onSuccess, accounts, balances }: TransferModalProps) {
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 0, EUR: 0, TL: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFromId("");
    setToId("");
    setFromAmount("");
    setToAmount("");
    setDescription("");
    setError(null);
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates) setExchangeRates({ USD: 0, EUR: 0, TL: 1, ...(d.rates as Record<string, number>) });
      })
      .catch(() => {});
  }, [isOpen]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts]);
  const fromAccount = activeAccounts.find((a) => a.id === fromId);
  const toAccount = activeAccounts.find((a) => a.id === toId);

  const fromBalance = fromAccount ? balances.get(fromAccount.id) || 0 : 0;
  const fa = Number(fromAmount) || 0;
  const remaining = fromBalance - fa;
  const insufficient = fa > 0 && remaining < 0;

  const sameCurrency = fromAccount && toAccount && fromAccount.currency === toAccount.currency;
  const sameAccount = fromId && toId && fromId === toId;

  // Otomatik kur cevirisi (farkli para birimi ise)
  useEffect(() => {
    if (!fromAccount || !toAccount || sameCurrency || !fromAmount) return;
    // Kaynak'tan TL'ye, sonra TL'den hedefe
    const fromRate = fromAccount.currency === "TL" ? 1 : (exchangeRates[fromAccount.currency] || 0);
    const toRate = toAccount.currency === "TL" ? 1 : (exchangeRates[toAccount.currency] || 0);
    if (fromRate > 0 && toRate > 0) {
      const tlAmount = fa * fromRate;
      const converted = tlAmount / toRate;
      setToAmount((Math.round(converted * 100) / 100).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, fromId, toId]);

  // Ayni para birimi -> tek tutar
  useEffect(() => {
    if (sameCurrency) setToAmount(fromAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, sameCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromAccount || !toAccount) { setError("Hem kaynak hem hedef kasa seçilmeli"); return; }
    if (sameAccount) { setError("Aynı kasaya transfer yapılamaz"); return; }
    const ta = Number(toAmount) || 0;
    if (!fa || fa <= 0) { setError("Geçerli bir kaynak tutarı girin"); return; }
    if (!ta || ta <= 0) { setError("Geçerli bir hedef tutarı girin"); return; }
    if (insufficient) {
      setError(`Kaynak kasada yeterli bakiye yok. Bakiye: ${fmtCurrency(fromBalance, fromAccount.currency)}`);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) { setError("Oturum bulunamadı"); setSubmitting(false); return; }

      const desc = description.trim() ||
        `Transfer: ${fromAccount.name} → ${toAccount.name}`;

      const rate = sameCurrency ? 1 : (fa > 0 ? ta / fa : null);

      // 1) cikis kaydi
      const { data: outRow, error: outErr } = await supabase
        .from("cash_transactions")
        .insert({
          organization_id: fromAccount.organization_id,
          account_id: fromAccount.id,
          direction: "out",
          source: "transfer",
          amount: fa,
          currency: fromAccount.currency,
          description: desc,
          transfer_rate: rate,
          created_by: uid,
        })
        .select()
        .single();
      if (outErr) { setError(outErr.message); setSubmitting(false); return; }

      // 2) giris kaydi
      const { data: inRow, error: inErr } = await supabase
        .from("cash_transactions")
        .insert({
          organization_id: toAccount.organization_id,
          account_id: toAccount.id,
          direction: "in",
          source: "transfer",
          amount: ta,
          currency: toAccount.currency,
          description: desc,
          transfer_pair_id: outRow?.id ?? null,
          transfer_rate: rate,
          created_by: uid,
        })
        .select()
        .single();
      if (inErr) {
        // Cikis kaydini geri al
        if (outRow?.id) await supabase.from("cash_transactions").delete().eq("id", outRow.id);
        setError(inErr.message);
        setSubmitting(false);
        return;
      }

      // 3) cikis kaydina pair_id yaz
      if (outRow?.id && inRow?.id) {
        await supabase
          .from("cash_transactions")
          .update({ transfer_pair_id: inRow.id })
          .eq("id", outRow.id);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Kasalar Arası Transfer" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-200 text-[12.5px] text-indigo-800">
          <p className="font-bold mb-0.5">Nasıl Çalışır?</p>
          <p>Kaynak kasadan düşer, hedef kasaya eklenir. Farklı para birimi seçilirse anlık TCMB kuru otomatik uygulanır; istediğin tutarı düzenleyebilirsin.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          {/* Kaynak */}
          <div className="rounded-2xl ring-2 ring-rose-200 bg-rose-50/40 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              Kaynak Kasa
            </p>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            >
              <option value="">— Seçin —</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency}) · {Math.round(balances.get(a.id) || 0).toLocaleString("tr-TR")} {CURRENCY_SYMBOL[a.currency]}
                </option>
              ))}
            </select>
            {fromAccount && (
              <p className="mt-2 text-[11px] font-bold text-slate-600">
                Bakiye: <span className={`tabular-nums ${fromBalance >= 0 ? "text-slate-900" : "text-rose-600"}`}>{fmtCurrency(fromBalance, fromAccount.currency)}</span>
              </p>
            )}
            <div className="mt-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                placeholder={`Tutar ${fromAccount ? CURRENCY_SYMBOL[fromAccount.currency] : ""}`}
              />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center md:px-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>

          {/* Hedef */}
          <div className="rounded-2xl ring-2 ring-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              Hedef Kasa
            </p>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">— Seçin —</option>
              {activeAccounts
                .filter((a) => a.id !== fromId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency}) · {Math.round(balances.get(a.id) || 0).toLocaleString("tr-TR")} {CURRENCY_SYMBOL[a.currency]}
                  </option>
                ))}
            </select>
            {toAccount && (
              <p className="mt-2 text-[11px] font-bold text-slate-600">
                Bakiye: <span className="tabular-nums text-slate-900">{fmtCurrency(balances.get(toAccount.id) || 0, toAccount.currency)}</span>
              </p>
            )}
            <div className="mt-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                placeholder={`Tutar ${toAccount ? CURRENCY_SYMBOL[toAccount.currency] : ""}`}
                disabled={Boolean(sameCurrency)}
              />
              {!sameCurrency && fromAccount && toAccount && (
                <p className="mt-1 text-[10.5px] text-slate-500">
                  Otomatik kur uygulandı (TCMB). İstersen düzenle.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Açıklama (opsiyonel)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Örn: 50 EUR'yu TL hesabına çekildi"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
          />
        </div>

        {/* Bakiye uyarisi */}
        {fromAccount && fa > 0 && (
          <div className={`p-3 rounded-xl ring-1 text-sm font-semibold ${
            insufficient ? "bg-rose-50 ring-rose-200 text-rose-700" : "bg-slate-50 ring-slate-200 text-slate-700"
          }`}>
            <div className="flex items-center justify-between">
              <span>Kaynak Sonrası Bakiye:</span>
              <span className={`tabular-nums font-extrabold ${insufficient ? "text-rose-700" : "text-slate-900"}`}>
                {fmtCurrency(remaining, fromAccount.currency)}
              </span>
            </div>
            {insufficient && (
              <p className="mt-2 text-[11.5px] font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Yetersiz bakiye! Bu transfer yapılamaz.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
            İptal
          </Button>
          <Button
            type="submit"
            className="flex-1 !bg-gradient-to-r !from-indigo-600 !to-violet-600 hover:!from-indigo-700 hover:!to-violet-700"
            disabled={submitting || !fromAccount || !toAccount || sameAccount || insufficient}
          >
            {submitting ? "Aktarılıyor..." : "Transferi Yap"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
