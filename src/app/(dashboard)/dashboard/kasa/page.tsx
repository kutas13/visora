"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ────────────────────────── types ────────────────────────── */

type KasaCurrency = "TL" | "EUR" | "USD";

interface KasaTransaction {
  id: string;
  agency_id: string;
  kasa: KasaCurrency;
  type: "gelir" | "gider";
  amount: number;
  description: string;
  created_at: string;
}

interface BankCard {
  id: string;
  agency_id: string;
  bank_name: string;
  card_type: "banka";
  last_four: string;
  balance: number;
  created_at: string;
}

interface ExchangeRates {
  TRY: number;
  EUR: number;
  USD: number;
}

/* ────────────────────────── constants ────────────────────── */

const TURKISH_BANKS = [
  "Ziraat Bankası",
  "Halkbank",
  "Vakıfbank",
  "İş Bankası",
  "Garanti BBVA",
  "Yapı Kredi",
  "Akbank",
  "QNB Finansbank",
  "Denizbank",
  "TEB",
  "ING",
  "HSBC",
  "Şekerbank",
  "Odeabank",
];

const KASA_CONFIG: Record<KasaCurrency, { symbol: string; gradient: string; ring: string; text: string; bg: string; light: string }> = {
  TL:  { symbol: "₺", gradient: "from-emerald-500 to-green-600",  ring: "ring-green-500/20",  text: "text-green-700",  bg: "bg-green-100", light: "bg-green-50" },
  EUR: { symbol: "€", gradient: "from-blue-500 to-blue-600",      ring: "ring-blue-500/20",   text: "text-blue-700",   bg: "bg-blue-100",  light: "bg-blue-50" },
  USD: { symbol: "$", gradient: "from-amber-500 to-amber-600",    ring: "ring-amber-500/20",  text: "text-amber-700",  bg: "bg-amber-100", light: "bg-amber-50" },
};

/* ────────────────────────── helpers ──────────────────────── */

function sym(c: KasaCurrency) { return KASA_CONFIG[c].symbol; }
function fmtMoney(v: number, c: KasaCurrency) { return `${sym(c)}${Math.abs(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

/* ════════════════════════════════════════════════════════════
   KASA PAGE
   ════════════════════════════════════════════════════════════ */

export default function KasaPage() {
  const supabase = createClient();

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // kasa
  const [transactions, setTransactions] = useState<KasaTransaction[]>([]);
  const [balances, setBalances] = useState<Record<KasaCurrency, number>>({ TL: 0, EUR: 0, USD: 0 });

  // exchange
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  // converter
  const [convFrom, setConvFrom] = useState<KasaCurrency>("USD");
  const [convTo, setConvTo] = useState<KasaCurrency>("TL");
  const [convAmount, setConvAmount] = useState("");
  const [convResult, setConvResult] = useState("");
  const [convSaving, setConvSaving] = useState(false);

  // add transaction modal
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState({ description: "", amount: "", kasa: "TL" as KasaCurrency, type: "gelir" as "gelir" | "gider" });
  const [txSaving, setTxSaving] = useState(false);

  // bank cards
  const [cards, setCards] = useState<BankCard[]>([]);
  const [cardModal, setCardModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ amount: "", kasa: "TL" as KasaCurrency, cardId: "" });
  const [transferSaving, setTransferSaving] = useState(false);
  const [cardForm, setCardForm] = useState({
    bank_name: TURKISH_BANKS[0],
    last_four: "",
    balance: "",
  });
  const [cardSaving, setCardSaving] = useState(false);

  /* ──── init ──── */

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  /* ──── fetch rates ──── */

  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data = await res.json();
      setRates({ TRY: data.rates?.TRY ?? 38.5, EUR: data.rates?.EUR ?? 0.92, USD: 1 });
    } catch {
      setRates({ TRY: 38.5, EUR: 0.92, USD: 1 });
    }
    setRatesLoading(false);
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  /* ──── fetch kasa transactions ──── */

  const fetchTransactions = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kasa_transactions")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (error) { console.error("Kasa fetch error:", error.message); setLoading(false); return; }

      const txs = (data || []).map((t: any) => ({
        ...t,
        kasa: t.kasa || t.kasa_type || "TL",
        type: t.type || t.transaction_type || "gelir",
      })) as KasaTransaction[];
      setTransactions(txs);

      const bals: Record<KasaCurrency, number> = { TL: 0, EUR: 0, USD: 0 };
      txs.forEach((t) => {
        const k = (["TL","EUR","USD"].includes(t.kasa) ? t.kasa : "TL") as KasaCurrency;
        const sign = t.type === "gelir" ? 1 : -1;
        bals[k] += t.amount * sign;
      });
      setBalances(bals);
    } catch (e) { console.error("Kasa error:", e); }
    setLoading(false);
  }, [agencyId, supabase]);

  /* ──── fetch cards ──── */

  const fetchCards = useCallback(async () => {
    if (!agencyId) return;
    const { data } = await supabase
      .from("bank_cards")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("card_type", "banka")
      .order("created_at", { ascending: false });
    setCards((data || []) as BankCard[]);
  }, [agencyId, supabase]);

  useEffect(() => {
    if (agencyId) {
      fetchTransactions();
      fetchCards();
    }
  }, [agencyId, fetchTransactions, fetchCards]);

  /* ──── conversion helpers ──── */

  const convert = (amount: number, from: KasaCurrency, to: KasaCurrency): number => {
    if (!rates) return 0;
    const rateMap: Record<KasaCurrency, number> = { USD: 1, EUR: rates.EUR, TL: rates.TRY };
    const inUSD = amount / rateMap[from];
    return inUSD * rateMap[to];
  };

  useEffect(() => {
    if (!convAmount || !rates) { setConvResult(""); return; }
    const val = parseFloat(convAmount);
    if (isNaN(val)) { setConvResult(""); return; }
    setConvResult(convert(val, convFrom, convTo).toFixed(2));
  }, [convAmount, convFrom, convTo, rates]);

  /* ──── submit converter ──── */

  const submitConversion = async () => {
    if (!agencyId || !convAmount || !convResult) return;
    const fromAmt = parseFloat(convAmount);
    const toAmt = parseFloat(convResult);
    if (isNaN(fromAmt) || isNaN(toAmt) || fromAmt <= 0 || toAmt <= 0) return;

    setConvSaving(true);
    const now = new Date().toISOString();

    await supabase.from("kasa_transactions").insert([
      { agency_id: agencyId, kasa: convFrom, type: "gider", amount: fromAmt, description: `Kasa çevirme: ${sym(convFrom)}${fromAmt} → ${sym(convTo)}${toAmt}`, created_at: now },
      { agency_id: agencyId, kasa: convTo, type: "gelir", amount: toAmt, description: `Kasa çevirme: ${sym(convFrom)}${fromAmt} → ${sym(convTo)}${toAmt}`, created_at: now },
    ]);

    setConvAmount("");
    setConvResult("");
    setConvSaving(false);
    fetchTransactions();
  };

  /* ──── submit transaction ──── */

  const submitTransaction = async () => {
    if (!agencyId || !txForm.description || !txForm.amount) return;
    const amt = parseFloat(txForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    setTxSaving(true);
    await supabase.from("kasa_transactions").insert({
      agency_id: agencyId,
      kasa: txForm.kasa,
      type: txForm.type,
      amount: amt,
      description: txForm.description,
    });
    setTxSaving(false);
    setTxModal(false);
    setTxForm({ description: "", amount: "", kasa: "TL", type: "gelir" });
    fetchTransactions();
  };

  /* ──── submit card ──── */

  const submitCard = async () => {
    if (!agencyId || !cardForm.last_four || cardForm.last_four.length !== 4) return;
    setCardSaving(true);

    await supabase.from("bank_cards").insert({
      agency_id: agencyId,
      bank_name: cardForm.bank_name,
      card_type: "banka",
      last_four: cardForm.last_four,
      balance: parseFloat(cardForm.balance) || 0,
    });

    setCardSaving(false);
    setCardModal(false);
    setCardForm({ bank_name: TURKISH_BANKS[0], last_four: "", balance: "" });
    fetchCards();
  };

  /* ──── submit nakit → hesap transfer ──── */

  const submitTransfer = async () => {
    if (!agencyId || !transferForm.cardId || !transferForm.amount) return;
    setTransferSaving(true);
    const amt = parseFloat(transferForm.amount);
    const card = cards.find(c => c.id === transferForm.cardId);
    if (card) {
      await supabase.from("bank_cards").update({ balance: card.balance + amt }).eq("id", card.id);
    }
    await supabase.from("kasa_transactions").insert({ agency_id: agencyId, kasa: transferForm.kasa, type: "gider", amount: amt, description: `Hesaba aktarım - ${card?.bank_name || ""} *${card?.last_four || ""}` });
    setTransferSaving(false); setTransferModal(false);
    setTransferForm({ amount: "", kasa: "TL", cardId: "" });
    fetchTransactions(); fetchCards();
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-8">
      {/* ──── Header ──── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Kasa Yönetimi</h1>
            <p className="text-xs text-navy-400">Gelir, gider ve döviz işlemleri</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTransferModal(true)} className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600">
            💵→🏦 Hesaba Aktar
          </button>
          <button onClick={() => { setTxForm({ description: "", amount: "", kasa: "TL", type: "gelir" }); setTxModal(true); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-all hover:shadow-xl">
            + İşlem Ekle
          </button>
        </div>
      </div>

      {/* ──── Kasa Balances ──── */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["TL", "EUR", "USD"] as KasaCurrency[]).map((cur) => {
          const cfg = KASA_CONFIG[cur];
          const bal = balances[cur];
          return (
            <div key={cur} className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <div className={`bg-gradient-to-r ${cfg.gradient} px-5 py-3.5 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                    <span className="text-lg font-black text-white">{cfg.symbol}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{cur} Kasası</span>
                </div>
                <div className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {transactions.filter((t) => t.kasa === cur).length} işlem
                </div>
              </div>
              <div className="p-5">
                <div className="mb-3">
                  <span className="text-xs text-navy-400">Toplam Bakiye</span>
                  <div className={`text-2xl font-black ${bal >= 0 ? "text-navy-900" : "text-red-600"}`}>
                    {bal < 0 && "-"}{fmtMoney(bal, cur)}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-green-50 px-3 py-2">
                    <span className="text-[10px] font-medium text-green-600">Gelir</span>
                    <div className="text-sm font-bold text-green-700">
                      {fmtMoney(transactions.filter((t) => t.kasa === cur && t.type === "gelir").reduce((s, t) => s + t.amount, 0), cur)}
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl bg-red-50 px-3 py-2">
                    <span className="text-[10px] font-medium text-red-600">Gider</span>
                    <div className="text-sm font-bold text-red-700">
                      {fmtMoney(transactions.filter((t) => t.kasa === cur && t.type === "gider").reduce((s, t) => s + t.amount, 0), cur)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ──── Exchange Rates Bar ──── */}
      {rates && (
        <div className="flex items-center gap-4 rounded-2xl bg-navy-800 px-5 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-navy-400">Güncel Kur</span>
          <span className="text-sm font-bold text-green-400">$1 = ₺{rates.TRY.toFixed(2)}</span>
          <span className="text-sm font-bold text-blue-400">€1 = ₺{(rates.TRY / rates.EUR).toFixed(2)}</span>
          <span className="text-sm font-bold text-amber-400">$1 = €{rates.EUR.toFixed(4)}</span>
          <button onClick={fetchRates} disabled={ratesLoading} className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-navy-400 transition-colors hover:text-white">
            <svg className={`h-3.5 w-3.5 ${ratesLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {ratesLoading ? "Güncelleniyor..." : "Güncelle"}
          </button>
        </div>
      )}

      {/* ──── Currency Converter ──── */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="border-b border-navy-100 bg-navy-50/50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-800">
            <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Döviz Çevirici
          </h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-navy-500">Kaynak Kasa</label>
              <select value={convFrom} onChange={(e) => setConvFrom(e.target.value as KasaCurrency)} className="h-11 w-full rounded-xl border border-navy-200 bg-white px-4 text-sm font-medium text-navy-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                {(["TL", "EUR", "USD"] as KasaCurrency[]).map((c) => <option key={c} value={c}>{sym(c)} {c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-navy-500">Tutar</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400">{sym(convFrom)}</span>
                <input type="number" value={convAmount} onChange={(e) => setConvAmount(e.target.value)} placeholder="0.00" className="h-11 w-full rounded-xl border border-navy-200 pl-9 pr-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
            </div>

            <button onClick={() => { setConvFrom(convTo); setConvTo(convFrom); }} className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl border border-navy-200 bg-white text-navy-500 transition-all hover:bg-primary-50 hover:text-primary-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </button>

            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-navy-500">Hedef Kasa</label>
              <select value={convTo} onChange={(e) => setConvTo(e.target.value as KasaCurrency)} className="h-11 w-full rounded-xl border border-navy-200 bg-white px-4 text-sm font-medium text-navy-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                {(["TL", "EUR", "USD"] as KasaCurrency[]).map((c) => <option key={c} value={c}>{sym(c)} {c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-navy-500">Çevrilen Tutar</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400">{sym(convTo)}</span>
                <input type="number" value={convResult} onChange={(e) => setConvResult(e.target.value)} placeholder="0.00" className="h-11 w-full rounded-xl border border-navy-200 bg-amber-50/50 pl-9 pr-4 text-sm font-semibold focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
            </div>

            <button onClick={submitConversion} disabled={convSaving || !convAmount || !convResult || convFrom === convTo} className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-all hover:shadow-xl disabled:opacity-50 disabled:shadow-none">
              {convSaving ? "Çevriliyor..." : "Çevir"}
            </button>
          </div>
          {convFrom === convTo && <p className="mt-2 text-xs text-red-500">Kaynak ve hedef kasa aynı olamaz.</p>}
        </div>
      </div>

      {/* ──── Bank Cards Section ──── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900">
            <svg className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            Banka Kartlarım
          </h2>
          <button onClick={() => { setCardForm({ bank_name: TURKISH_BANKS[0], last_four: "", balance: "" }); setCardModal(true); }} className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Kart Ekle
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/30 py-12 text-center">
            <svg className="mx-auto h-10 w-10 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            <p className="mt-3 text-sm font-medium text-navy-400">Henüz kart eklenmemiş</p>
            <p className="text-xs text-navy-300">Banka kartı ekleyerek başlayın</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div key={card.id} className="overflow-hidden rounded-2xl border border-navy-200/60 bg-gradient-to-br from-navy-800 to-navy-900 shadow-sm transition-all hover:shadow-md">
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">Banka Hesabı</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white">{card.bank_name}</p>
                  <p className="mt-1 font-mono text-xs tracking-widest text-white/40">•••• •••• •••• {card.last_four}</p>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <span className="text-[10px] text-white/40">Bakiye</span>
                    <div className="text-xl font-black text-green-400">₺{card.balance.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──── Transaction History ──── */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="border-b border-navy-100 bg-navy-50/50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-800">
            <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            İşlem Geçmişi
            <span className="ml-2 rounded-full bg-navy-200/50 px-2 py-0.5 text-[10px] font-semibold text-navy-500">{transactions.length}</span>
          </h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-sm text-navy-400">Henüz işlem bulunmuyor.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/30">
                <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tarih</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Açıklama</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Kasa</th>
                <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {transactions.slice(0, 50).map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-primary-50/20">
                  <td className="whitespace-nowrap px-6 py-3.5 text-xs text-navy-500">{fmtDate(tx.created_at)}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-navy-800">{tx.description}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${KASA_CONFIG[tx.kasa].bg} ${KASA_CONFIG[tx.kasa].text}`}>
                      {sym(tx.kasa)} {tx.kasa}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-right">
                    <span className={`text-sm font-bold ${tx.type === "gelir" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "gelir" ? "+" : "-"}{fmtMoney(tx.amount, tx.kasa)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
         MODALS
         ════════════════════════════════════════════════════════ */}

      {/* ──── Add Transaction Modal ──── */}
      {txModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTxModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
              <h3 className="font-semibold text-white">İşlem Ekle</h3>
              <p className="text-xs text-white/70">Kasaya gelir veya gider kaydı ekleyin</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-500">İşlem Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setTxForm({ ...txForm, type: "gelir" })} className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${txForm.type === "gelir" ? "border-green-500 bg-green-50 text-green-700" : "border-navy-200 text-navy-500 hover:border-navy-300"}`}>
                    <span className="mr-1">↗</span> Gelir
                  </button>
                  <button type="button" onClick={() => setTxForm({ ...txForm, type: "gider" })} className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${txForm.type === "gider" ? "border-red-500 bg-red-50 text-red-700" : "border-navy-200 text-navy-500 hover:border-navy-300"}`}>
                    <span className="mr-1">↙</span> Gider
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-500">Açıklama</label>
                <input type="text" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="İşlem açıklaması..." className="h-11 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-navy-500">Tutar</label>
                  <input type="number" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} placeholder="0.00" className="h-11 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
                <div className="w-28">
                  <label className="mb-1.5 block text-xs font-medium text-navy-500">Kasa</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["TL", "EUR", "USD"] as KasaCurrency[]).map((c) => (
                      <button key={c} type="button" onClick={() => setTxForm({ ...txForm, kasa: c })} className={`h-11 rounded-xl border-2 text-xs font-bold transition-all ${txForm.kasa === c ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>
                        {sym(c)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
                <button onClick={() => setTxModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50">İptal</button>
                <button onClick={submitTransaction} disabled={txSaving || !txForm.description || !txForm.amount} className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:shadow-none ${txForm.type === "gelir" ? "bg-gradient-to-r from-green-500 to-green-600 shadow-green-500/20" : "bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/20"}`}>
                  {txSaving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Add Bank Card Modal ──── */}
      {cardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCardModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-navy-700 to-navy-800 px-6 py-4">
              <h3 className="font-semibold text-white">Banka Kartı Ekle</h3>
              <p className="text-xs text-white/70">Banka hesabı ekleyin</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-500">Banka</label>
                <select value={cardForm.bank_name} onChange={(e) => setCardForm({ ...cardForm, bank_name: e.target.value })} className="h-11 w-full rounded-xl border border-navy-200 bg-white px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                  {TURKISH_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-500">Son 4 Hane</label>
                <input type="text" maxLength={4} value={cardForm.last_four} onChange={(e) => setCardForm({ ...cardForm, last_four: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="1234" className="h-11 w-full rounded-xl border border-navy-200 px-4 font-mono text-sm tracking-widest focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-500">Bakiye (₺)</label>
                <input type="number" value={cardForm.balance} onChange={(e) => setCardForm({ ...cardForm, balance: e.target.value })} placeholder="0.00" className="h-11 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>

              <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
                <button onClick={() => setCardModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50">İptal</button>
                <button onClick={submitCard} disabled={cardSaving || cardForm.last_four.length !== 4} className="rounded-xl bg-gradient-to-r from-navy-700 to-navy-800 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-500/20 transition-all disabled:opacity-50 disabled:shadow-none">
                  {cardSaving ? "Kaydediliyor..." : "Kart Ekle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Transfer Modal (Nakit → Hesaba) ──── */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/40" onClick={() => setTransferModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-navy-700 to-navy-800 px-6 py-4">
              <h3 className="font-semibold text-white">💵 Nakit → 🏦 Hesaba Aktar</h3>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="text-sm font-medium text-navy-700">Tutar</label>
                <div className="mt-1 flex gap-2">
                  <input type="number" value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount:e.target.value})} placeholder="0" className="h-10 flex-1 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  <div className="grid grid-cols-3 gap-1">
                    {(["TL","EUR","USD"] as KasaCurrency[]).map(c => (
                      <button key={c} type="button" onClick={() => setTransferForm({...transferForm, kasa:c})} className={`rounded-lg border-2 px-2 py-1.5 text-xs font-bold ${transferForm.kasa === c ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>
                        {c === "TL" ? "₺" : c === "EUR" ? "€" : "$"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-navy-700">Hangi Hesaba?</label>
                {cards.length === 0 ? (
                  <p className="mt-2 text-xs text-navy-400">Banka hesabı ekleyin.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {cards.map(card => (
                      <button key={card.id} type="button" onClick={() => setTransferForm({...transferForm, cardId:card.id})}
                        className={`w-full flex items-center justify-between rounded-xl border-2 p-3 text-left transition-all ${transferForm.cardId === card.id ? "border-primary-500 bg-primary-50" : "border-navy-200 hover:border-navy-300"}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800 text-[10px] font-bold text-white">{card.bank_name.slice(0,2)}</div>
                          <div><p className="text-sm font-semibold text-navy-900">{card.bank_name}</p><p className="text-[11px] text-navy-400">**** {card.last_four}</p></div>
                        </div>
                        <span className="text-sm font-bold text-navy-700">₺{card.balance.toLocaleString("tr-TR")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
                <button onClick={() => setTransferModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium">İptal</button>
                <button onClick={submitTransfer} disabled={transferSaving || !transferForm.cardId} className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{transferSaving ? "Aktarılıyor..." : "Aktar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
