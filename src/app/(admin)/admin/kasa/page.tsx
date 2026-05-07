"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashAccount, CashTransaction } from "@/lib/supabase/types";
import { CURRENCY_SYMBOL, fmtCurrency, calcAllBalances } from "@/lib/kasa/helpers";
import IncomeModal from "@/components/kasa/IncomeModal";
import ExpenseModal from "@/components/kasa/ExpenseModal";
import TransferModal from "@/components/kasa/TransferModal";
import WalletHistoryModal from "@/components/kasa/WalletHistoryModal";

export default function KasaPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 0, EUR: 0, TL: 1 });

  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<CashAccount | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [accRes, txRes, ratesRes] = await Promise.all([
      supabase.from("cash_accounts").select("*").eq("is_active", true).order("kind").order("currency"),
      supabase.from("cash_transactions").select("*").order("created_at", { ascending: false }),
      fetch("/api/exchange-rates").then((r) => r.json()).catch(() => ({ rates: null })),
    ]);
    setAccounts((accRes.data as CashAccount[]) || []);
    setTransactions((txRes.data as CashTransaction[]) || []);
    if (ratesRes && ratesRes.rates) {
      setExchangeRates({ USD: 0, EUR: 0, TL: 1, ...(ratesRes.rates as Record<string, number>) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const balances = useMemo(() => calcAllBalances(accounts, transactions), [accounts, transactions]);

  // Kasalari nakit + banka olarak ayir
  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.kind === "cash").sort((a, b) => {
      const order: Record<string, number> = { TL: 0, EUR: 1, USD: 2 };
      return (order[a.currency] || 99) - (order[b.currency] || 99);
    }),
    [accounts]
  );
  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.kind === "bank").sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [accounts]
  );

  // Tum kasalarin TL toplam degeri (gunluk kur ile)
  const grandTotalTl = useMemo(() => {
    let sum = 0;
    for (const a of accounts) {
      const bal = balances.get(a.id) || 0;
      const rate = a.currency === "TL" ? 1 : Number(exchangeRates[a.currency]) || 0;
      sum += bal * rate;
    }
    return sum;
  }, [accounts, balances, exchangeRates]);

  // Para birimi bazinda toplam (sadece o currency'deki kasalar)
  const totalsByCurrency = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of accounts) {
      const bal = balances.get(a.id) || 0;
      m[a.currency] = (m[a.currency] || 0) + bal;
    }
    return m;
  }, [accounts, balances]);

  const renderCard = (a: CashAccount) => {
    const bal = balances.get(a.id) || 0;
    const lastTx = transactions.find((t) => t.account_id === a.id);
    const txCount = transactions.filter((t) => t.account_id === a.id).length;

    const colorMap = {
      TL: { gradient: "from-emerald-500 to-green-600", bg: "from-emerald-50 to-green-50", text: "text-emerald-700", ring: "ring-emerald-200" },
      EUR: { gradient: "from-blue-500 to-indigo-600", bg: "from-blue-50 to-indigo-50", text: "text-blue-700", ring: "ring-blue-200" },
      USD: { gradient: "from-amber-500 to-orange-600", bg: "from-amber-50 to-orange-50", text: "text-amber-700", ring: "ring-amber-200" },
    } as const;

    const cBank = { gradient: "from-violet-500 to-fuchsia-600", bg: "from-violet-50 to-fuchsia-50", text: "text-violet-700", ring: "ring-violet-200" };

    const c = a.kind === "bank" ? cBank : (colorMap[a.currency as keyof typeof colorMap] || colorMap.TL);

    return (
      <button
        key={a.id}
        type="button"
        onClick={() => setHistoryAccount(a)}
        className={`group relative overflow-hidden text-left rounded-2xl bg-white ring-1 ${c.ring} hover:shadow-xl hover:shadow-slate-300/40 hover:-translate-y-0.5 transition-all duration-200`}
      >
        {/* dekoratif blob */}
        <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full bg-gradient-to-br ${c.gradient} opacity-15`} />
        <div className={`absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-gradient-to-br ${c.gradient} opacity-10`} />

        <div className="relative p-5">
          {/* Üst satır: ikon + tip badge */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {a.kind === "cash" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16M4 6l8-3 8 3M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" />
                )}
              </svg>
            </span>
            <span className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-br ${c.bg} ${c.text} ring-1 ${c.ring}`}>
              {a.kind === "cash" ? "Nakit" : "Banka"}
            </span>
          </div>

          {/* Kasa adı */}
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{a.currency} {CURRENCY_SYMBOL[a.currency]}</p>
          <p className="mt-0.5 text-[14.5px] font-extrabold text-slate-900 leading-tight truncate" title={a.name}>
            {a.name}
          </p>

          {/* Bakiye */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bakiye</p>
            <p className={`mt-0.5 text-2xl font-black tabular-nums ${bal > 0 ? "text-slate-900" : bal < 0 ? "text-rose-600" : "text-slate-500"}`}>
              {fmtCurrency(bal, a.currency)}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>{txCount} işlem</span>
              {lastTx && <span>Son: {new Date(lastTx.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</span>}
            </div>
          </div>

          {/* Hover hint */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity from-indigo-500 via-violet-500 to-fuchsia-500" />
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-emerald-500 via-violet-500 to-rose-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Finans</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Kasa</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Tüm nakit ve banka kasalarınız. Kasalar arası transfer, gelir/gider ekleme.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIncome(true)}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:brightness-110 shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            Gelir
          </button>
          <button
            type="button"
            onClick={() => setShowExpense(true)}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:brightness-110 shadow-lg shadow-rose-500/30 transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            Gider
          </button>
          <button
            type="button"
            onClick={() => setShowTransfer(true)}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:brightness-110 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Transfer
          </button>
        </div>
      </div>

      {/* TOPLAM BANNER */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900" />
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-emerald-500 blur-3xl animate-blob" />
          <div className="absolute -bottom-16 -right-10 w-72 h-72 rounded-full bg-violet-500 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        </div>
        <div className="relative p-6 sm:p-7 grid md:grid-cols-[1fr_auto] items-end gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Toplam Net Varlık
            </div>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black text-white tracking-tight tabular-nums">
              ≈ {Math.round(grandTotalTl).toLocaleString("tr-TR")} ₺
            </h2>
            <p className="mt-1.5 text-white/60 text-sm">Tüm kasaların güncel TCMB kuruyla TL karşılığı</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5 md:flex md:flex-row md:items-end md:gap-3">
            {(["TL", "EUR", "USD"] as const).map((c) => (
              <div key={c} className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-3 py-2.5 text-right md:min-w-[140px]">
                <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{c}</p>
                <p className={`mt-0.5 text-lg sm:text-xl font-black tabular-nums ${(totalsByCurrency[c] || 0) >= 0 ? "text-white" : "text-rose-300"}`}>
                  {fmtCurrency(totalsByCurrency[c] || 0, c)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NAKIT KASALAR */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-green-600" />
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Nakit Kasalar</h2>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{cashAccounts.length}</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-44" />
            ))}
          </div>
        ) : cashAccounts.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Henüz nakit kasası yok</p>
            <p className="text-xs text-slate-400 mt-1">Sayfa yenilendiğinde otomatik oluşturulacaktır</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cashAccounts.map(renderCard)}
          </div>
        )}
      </div>

      {/* BANKA KASALAR */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1 h-6 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-600" />
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Banka Hesapları</h2>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{bankAccounts.length}</span>
          </div>
          <a
            href="/admin/banka-hesaplari"
            className="text-[11.5px] font-bold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1"
          >
            Banka hesaplarını yönet
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-44" />
            ))}
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="rounded-2xl bg-violet-50/40 ring-1 ring-violet-200 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 mx-auto mb-3 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16M4 6l8-3 8 3M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-800">Henüz banka hesabı yok</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Banka Hesapları sayfasından yeni hesap ekleyebilirsiniz; otomatik olarak burada görünecektir.
            </p>
            <a
              href="/admin/banka-hesaplari"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Banka Hesabı Ekle
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bankAccounts.map(renderCard)}
          </div>
        )}
      </div>

      {/* MODALS */}
      <IncomeModal
        isOpen={showIncome}
        onClose={() => setShowIncome(false)}
        onSuccess={loadAll}
        accounts={accounts}
        balances={balances}
      />
      <ExpenseModal
        isOpen={showExpense}
        onClose={() => setShowExpense(false)}
        onSuccess={loadAll}
        accounts={accounts}
        balances={balances}
      />
      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSuccess={loadAll}
        accounts={accounts}
        balances={balances}
      />
      <WalletHistoryModal
        isOpen={Boolean(historyAccount)}
        onClose={() => setHistoryAccount(null)}
        account={historyAccount}
        transactions={transactions}
        balances={balances}
        onChanged={loadAll}
      />
    </div>
  );
}
