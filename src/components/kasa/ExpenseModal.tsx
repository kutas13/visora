"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Input, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { CashAccount, ParaBirimi } from "@/lib/supabase/types";
import { CURRENCY_SYMBOL, fmtCurrency } from "@/lib/kasa/helpers";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: CashAccount[];
  balances: Map<string, number>;
  initialCurrency?: ParaBirimi;
  initialAccountId?: string;
}

const CURRENCIES: ParaBirimi[] = ["TL", "EUR", "USD"];

export default function ExpenseModal({ isOpen, onClose, onSuccess, accounts, balances, initialCurrency, initialAccountId }: ExpenseModalProps) {
  const [currency, setCurrency] = useState<ParaBirimi>(initialCurrency || "TL");
  const [accountKind, setAccountKind] = useState<"cash" | "bank">("cash");
  const [accountId, setAccountId] = useState<string>(initialAccountId || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const presetAcc = initialAccountId ? accounts.find((a) => a.id === initialAccountId) : null;
    setCurrency(presetAcc?.currency || initialCurrency || "TL");
    setAccountKind(presetAcc?.kind || "cash");
    setAccountId(initialAccountId || "");
    setDescription("");
    setAmount("");
    setError(null);
  }, [isOpen, initialCurrency, initialAccountId, accounts]);

  const filteredAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && a.currency === currency && a.kind === accountKind),
    [accounts, currency, accountKind]
  );

  useEffect(() => {
    if (initialAccountId) return;
    if (filteredAccounts.length === 0) { setAccountId(""); return; }
    setAccountId(filteredAccounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, accountKind, accounts.length]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const balance = selectedAccount ? balances.get(selectedAccount.id) || 0 : 0;
  const a = Number(amount) || 0;
  const remaining = balance - a;
  const insufficient = a > 0 && remaining < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) { setError("Açıklama zorunludur"); return; }
    if (!a || a <= 0) { setError("Geçerli bir tutar girin"); return; }
    if (!accountId || !selectedAccount) { setError("Bir kasa seçin"); return; }
    if (filteredAccounts.length === 0) {
      setError(
        accountKind === "bank"
          ? `${currency} para biriminde aktif bir banka hesabı bulunamadı. Önce Banka Hesapları sayfasından bir hesap ekleyin.`
          : `${currency} nakit kasası bulunamadı.`
      );
      return;
    }
    if (insufficient) { setError(`Bu kasada yeterli bakiye yok. Bakiye: ${fmtCurrency(balance, currency)}`); return; }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) { setError("Oturum bulunamadı"); setSubmitting(false); return; }

      const { error: insertErr } = await supabase.from("cash_transactions").insert({
        organization_id: selectedAccount.organization_id,
        account_id: accountId,
        direction: "out",
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
    <Modal isOpen={isOpen} onClose={onClose} title="Gider Ekle" size="md">
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
                    ? "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c} {CURRENCY_SYMBOL[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Kind toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Kasa Tipi
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccountKind("cash")}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                accountKind === "cash"
                  ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
              }`}
            >
              Nakit Kasa
            </button>
            <button
              type="button"
              onClick={() => setAccountKind("bank")}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                accountKind === "bank"
                  ? "bg-violet-600 text-white shadow-md ring-2 ring-violet-300"
                  : "bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
              }`}
            >
              Banka Hesabı
            </button>
          </div>
        </div>

        {/* Account selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Kasa Seçimi
          </label>
          {filteredAccounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-sm">
              {accountKind === "bank"
                ? <>Bu para biriminde aktif <strong>banka hesabı</strong> yok. <a className="underline font-bold" href="/admin/banka-hesaplari">Banka Hesapları</a> sayfasından ekleyin.</>
                : <>Bu para biriminde nakit kasası yok.</>}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {filteredAccounts.map((acc) => {
                const bal = balances.get(acc.id) || 0;
                const isActive = accountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccountId(acc.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl ring-1 transition-all ${
                      isActive
                        ? "bg-rose-50 ring-rose-300 shadow-sm"
                        : "bg-white ring-slate-200 hover:ring-rose-200 hover:bg-rose-50/30"
                    }`}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${
                      acc.kind === "cash" ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-violet-500 to-fuchsia-600"
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {acc.kind === "cash" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16M4 6l8-3 8 3M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" />
                        )}
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-900 truncate">{acc.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {acc.kind === "cash" ? "Nakit Kasası" : "Banka Hesabı"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Bakiye</p>
                      <p className={`text-[12px] font-extrabold tabular-nums ${bal > 0 ? "text-emerald-600" : bal < 0 ? "text-rose-600" : "text-slate-500"}`}>
                        {fmtCurrency(bal, acc.currency)}
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
            placeholder="Örn: Ofis kirası, internet faturası..."
            rows={2}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 transition-all focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 placeholder:text-slate-400 resize-none"
          />
        </div>

        {/* Tutar */}
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

        {/* Bakiye uyarisi */}
        {selectedAccount && a > 0 && (
          <div className={`p-3 rounded-xl ring-1 text-sm font-semibold ${
            insufficient ? "bg-rose-50 ring-rose-200 text-rose-700" : "bg-slate-50 ring-slate-200 text-slate-700"
          }`}>
            <div className="flex items-center justify-between">
              <span>Mevcut Bakiye:</span>
              <span className="tabular-nums font-extrabold">{fmtCurrency(balance, currency)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span>İşlem Sonrası:</span>
              <span className={`tabular-nums font-extrabold ${insufficient ? "text-rose-700" : "text-emerald-700"}`}>
                {fmtCurrency(remaining, currency)}
              </span>
            </div>
            {insufficient && (
              <p className="mt-2 text-[11.5px] font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Yetersiz bakiye! Bu işlem yapılamaz.
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
            className="flex-1 !bg-gradient-to-r !from-rose-600 !to-red-600 hover:!from-rose-700 hover:!to-red-700"
            disabled={submitting || !accountId || insufficient}
          >
            {submitting ? "Kaydediliyor..." : "Gideri Kaydet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
