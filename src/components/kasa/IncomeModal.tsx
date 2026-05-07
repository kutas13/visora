"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { CashAccount, ParaBirimi } from "@/lib/supabase/types";
import { CURRENCY_SYMBOL, fmtCurrency, parseTrNumber } from "@/lib/kasa/helpers";

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: CashAccount[];
  balances: Map<string, number>;
  initialCurrency?: ParaBirimi;
}

const CURRENCIES: ParaBirimi[] = ["TL", "EUR", "USD"];

export default function IncomeModal({ isOpen, onClose, onSuccess, accounts, balances, initialCurrency }: IncomeModalProps) {
  const [currency, setCurrency] = useState<ParaBirimi>(initialCurrency || "TL");
  const [accountId, setAccountId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrency(initialCurrency || "TL");
    setDescription("");
    setAmount("");
    setError(null);
    setAccountId("");
  }, [isOpen, initialCurrency]);

  const filteredAccounts = accounts.filter((a) => a.is_active && a.currency === currency);

  useEffect(() => {
    // Para birimi degisince ilk uygun kasayi sec (nakit oncelik)
    if (filteredAccounts.length === 0) {
      setAccountId("");
      return;
    }
    const cash = filteredAccounts.find((a) => a.kind === "cash");
    setAccountId((cash || filteredAccounts[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, accounts.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const a = parseTrNumber(amount);
    if (!description.trim()) { setError("Açıklama zorunludur"); return; }
    if (!a || a <= 0) { setError("Geçerli bir tutar girin"); return; }
    if (!accountId) { setError("Bir kasa seçin"); return; }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) { setError("Oturum bulunamadı"); setSubmitting(false); return; }

      // organization_id'yi kasadan al
      const acc = accounts.find((x) => x.id === accountId);
      if (!acc) { setError("Kasa bulunamadı"); setSubmitting(false); return; }

      const { error: insertErr } = await supabase.from("cash_transactions").insert({
        organization_id: acc.organization_id,
        account_id: accountId,
        direction: "in",
        source: "manual",
        amount: a,
        currency,
        description: description.trim(),
        created_by: uid,
      });

      if (insertErr) { setError(insertErr.message); setSubmitting(false); return; }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gelir Ekle" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Currency */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Para Birimi
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`relative py-2.5 rounded-xl text-sm font-extrabold transition-all ${
                  currency === c
                    ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c} {CURRENCY_SYMBOL[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Account selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Kasa
          </label>
          {filteredAccounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-sm">
              Bu para biriminde aktif bir kasa yok.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filteredAccounts.map((a) => {
                const bal = balances.get(a.id) || 0;
                const isActive = accountId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccountId(a.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl ring-1 transition-all ${
                      isActive
                        ? "bg-emerald-50 ring-emerald-300 shadow-sm"
                        : "bg-white ring-slate-200 hover:ring-emerald-200 hover:bg-emerald-50/30"
                    }`}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${
                      a.kind === "cash" ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-violet-500 to-fuchsia-600"
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {a.kind === "cash" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16M4 6l8-3 8 3M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" />
                        )}
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-900 truncate">{a.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {a.kind === "cash" ? "Nakit Kasası" : "Banka Hesabı"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Bakiye</p>
                      <p className={`text-[12px] font-extrabold tabular-nums ${bal >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                        {fmtCurrency(bal, a.currency)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Açıklama <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Örn: Diğer hizmet bedeli, ek tahsilat..."
            rows={2}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-400 resize-none"
          />
        </div>

        {/* Tutar */}
        <Input
          label="Tutar"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
          placeholder="0,00"
          required
        />

        {/* Özet */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 ring-2 ring-emerald-300 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kasaya Eklenecek</p>
          <p className="mt-1 text-2xl font-black text-emerald-700 tabular-nums">
            + {parseTrNumber(amount).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) || "0"} {CURRENCY_SYMBOL[currency]}
          </p>
        </div>

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
            className="flex-1 !bg-gradient-to-r !from-emerald-600 !to-green-600 hover:!from-emerald-700 hover:!to-green-700"
            disabled={submitting || !accountId}
          >
            {submitting ? "Kaydediliyor..." : "Geliri Kaydet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
