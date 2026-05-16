"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Input, Select, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";
import type { BankAccount, CashAccount, CashTransaction, ParaBirimi } from "@/lib/supabase/types";
import { CURRENCY_SYMBOL, fmtCurrency } from "@/lib/kasa/helpers";

/**
 * Genel Mudur Banka Hesaplari sayfasi.
 *
 * - Bakiye `cash_accounts` + `cash_transactions` uzerinden hesaplanir
 *   (gelir tahsilat, manuel gider, dosya gideri, transferler).
 * - Her banka hesabi card'inda kendi para birimindeki net bakiye, toplam giris/cikis
 *   ve son hareketler listelenir.
 */

type Movement = {
  id: string;
  created_at: string;
  direction: "in" | "out";
  source: "manual" | "payment" | "file_expense" | "transfer";
  amount: number;
  currency: ParaBirimi;
  description: string | null;
};

type AccountWithStats = BankAccount & {
  /** O hesabin kendi para biriminde net bakiye */
  balance: number;
  totalIn: number;
  totalOut: number;
  count: number;
  last_at: string | null;
};

const SOURCE_LABEL: Record<Movement["source"], string> = {
  manual: "Manuel",
  payment: "Tahsilat",
  file_expense: "Dosya Gideri",
  transfer: "Transfer",
};

const SOURCE_BADGE: Record<Movement["source"], string> = {
  manual: "bg-slate-100 text-slate-700 border-slate-200",
  payment: "bg-emerald-50 text-emerald-700 border-emerald-200",
  file_expense: "bg-rose-50 text-rose-700 border-rose-200",
  transfer: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminBankAccountsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [currency, setCurrency] = useState<ParaBirimi>("TL");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, cashRes, txRes] = await Promise.all([
        fetch("/api/bank-accounts?active=false").then((r) => r.json()).catch(() => ({ data: [] })),
        supabase.from("cash_accounts").select("*").eq("kind", "bank"),
        supabase
          .from("cash_transactions")
          .select("id, account_id, created_at, direction, source, amount, currency, description")
          .order("created_at", { ascending: false }),
      ]);

      setAccounts((accRes.data || []) as BankAccount[]);
      setCashAccounts((cashRes.data as CashAccount[] | null) || []);
      setTransactions((txRes.data as CashTransaction[] | null) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // bank_account.id -> cash_account.id eslestir
  const cashAccByBankId = useMemo(() => {
    const m = new Map<string, CashAccount>();
    cashAccounts.forEach((ca) => {
      if (ca.bank_account_id) m.set(ca.bank_account_id, ca);
    });
    return m;
  }, [cashAccounts]);

  // bank_account.id -> Movement[]
  const movementsByAccount = useMemo(() => {
    const out: Record<string, Movement[]> = {};
    for (const acc of accounts) {
      const ca = cashAccByBankId.get(acc.id);
      if (!ca) { out[acc.id] = []; continue; }
      out[acc.id] = transactions
        .filter((t) => t.account_id === ca.id)
        .map((t) => ({
          id: t.id,
          created_at: t.created_at,
          direction: t.direction,
          source: t.source,
          amount: Number(t.amount) || 0,
          currency: t.currency as ParaBirimi,
          description: t.description,
        }));
    }
    return out;
  }, [accounts, transactions, cashAccByBankId]);

  const accountsWithStats: AccountWithStats[] = useMemo(() => {
    return accounts.map((a) => {
      const moves = movementsByAccount[a.id] || [];
      let totalIn = 0, totalOut = 0;
      for (const m of moves) {
        if (m.direction === "in") totalIn += m.amount;
        else totalOut += m.amount;
      }
      return {
        ...a,
        balance: totalIn - totalOut,
        totalIn,
        totalOut,
        count: moves.length,
        last_at: moves[0]?.created_at || null,
      };
    });
  }, [accounts, movementsByAccount]);

  const handleCreate = async () => {
    setMsg(null);
    if (!name.trim()) {
      setMsg({ type: "err", text: "Hesap sahibi adı zorunlu." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bank_name: bankName.trim() || null,
          iban: iban.trim() || null,
          currency,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Banka hesabı oluşturulamadı");
      setMsg({ type: "ok", text: "Hesap oluşturuldu." });
      setName(""); setBankName(""); setIban(""); setCurrency("TL"); setNotes("");
      setShowCreate(false);
      await loadAll();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Hata oluştu";
      setMsg({ type: "err", text });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (acc: BankAccount) => {
    const next = !acc.is_active;
    const verb = next ? "aktif edilsin mi" : "pasif edilsin mi";
    if (!confirm(`'${acc.name}' hesabı ${verb}? (Geçmiş hareketler korunur.)`)) return;
    try {
      const res = await fetch(`/api/bank-accounts/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Hesap güncellenemedi");
      }
      await loadAll();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Hata");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Banka Hesapları</h1>
          <p className="text-sm text-navy-500 mt-1">
            Tahsilat ve dosya formunda görünecek banka hesaplarınız. Bakiyeler kasa hareketleri (tahsilat,
            gider, transfer) ile gerçek zamanlı eşleşir.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary">
          + Yeni Banka Hesabı
        </Button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-navy-500">Yükleniyor…</Card>
      ) : accountsWithStats.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
          </div>
          <p className="font-semibold text-navy-800">Henüz banka hesabınız yok.</p>
          <p className="text-sm text-navy-500 mt-1">İlk hesabı oluşturun, dosya formlarında görünmeye başlasın.</p>
          <div className="mt-4">
            <Button onClick={() => setShowCreate(true)}>Banka Hesabı Oluştur</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accountsWithStats.map((acc) => {
            const isOpen = openAccountId === acc.id;
            const moves = movementsByAccount[acc.id] || [];
            const sym = CURRENCY_SYMBOL[acc.currency] || acc.currency;
            return (
              <Card
                key={acc.id}
                className={`p-5 transition-all ${acc.is_active ? "" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-navy-900 truncate">
                        {acc.name}
                        <span className="ml-1.5 text-base font-extrabold text-indigo-600">({acc.currency} {sym})</span>
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${acc.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                        {acc.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-navy-500 space-y-0.5">
                      {acc.bank_name && <p>{acc.bank_name}</p>}
                      {acc.iban && <p className="font-mono text-[11px] break-all">{acc.iban}</p>}
                      {acc.notes && <p className="italic">{acc.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(acc)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${acc.is_active ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                    >
                      {acc.is_active ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                  </div>
                </div>

                {/* BAKIYE OZETI */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="px-3 py-2.5 rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white text-center">
                    <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Net Bakiye</p>
                    <p className={`text-base font-black mt-0.5 tabular-nums ${acc.balance >= 0 ? "text-white" : "text-rose-300"}`}>
                      {fmtCurrency(acc.balance, acc.currency)}
                    </p>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Giriş</p>
                    <p className="text-sm font-extrabold text-emerald-700 mt-0.5 tabular-nums">+ {fmtCurrency(acc.totalIn, acc.currency)}</p>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-rose-600 font-bold">Çıkış</p>
                    <p className="text-sm font-extrabold text-rose-700 mt-0.5 tabular-nums">− {fmtCurrency(acc.totalOut, acc.currency)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-navy-100">
                  <div className="text-[11px] text-navy-500">
                    <span className="font-semibold">{acc.count}</span> hareket
                    {acc.last_at && <> · son: {fmtDate(acc.last_at)}</>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenAccountId(isOpen ? null : acc.id)}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    {isOpen ? "Hesap geçmişini kapat" : "Hesap geçmişini aç →"}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-navy-100 bg-white">
                    {moves.length === 0 ? (
                      <div className="p-4 text-xs text-navy-400 text-center">Bu hesaba ait hareket yok.</div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {moves.map((m) => {
                          const isIn = m.direction === "in";
                          return (
                            <li key={m.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-slate-50/60">
                              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${isIn ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-rose-500 to-red-600"}`}>
                                {isIn ? "+" : "−"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`inline-block px-1.5 py-0.5 text-[9.5px] font-bold rounded-full border ${SOURCE_BADGE[m.source]}`}>
                                    {SOURCE_LABEL[m.source]}
                                  </span>
                                  <span className="text-[10.5px] text-slate-400 font-semibold tabular-nums">{fmtDate(m.created_at)}</span>
                                </div>
                                <p className="mt-0.5 text-[12px] font-semibold text-slate-800 truncate" title={m.description ?? undefined}>
                                  {m.description || "—"}
                                </p>
                              </div>
                              <span className={`text-[13px] font-extrabold tabular-nums shrink-0 ${isIn ? "text-emerald-700" : "text-rose-700"}`}>
                                {isIn ? "+" : "−"} {fmtCurrency(m.amount, m.currency)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Yeni Hesap Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setMsg(null); }}
        title="Yeni Banka Hesabı"
        size="md"
      >
        <div className="space-y-3">
          <Input
            label="Hesap Sahibi (zorunlu)"
            placeholder="Örn: Ahmet Yılmaz veya Genel Ofis Hesabı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Banka (opsiyonel)"
            placeholder="Örn: Garanti, İş Bankası…"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <Input
            label="IBAN (opsiyonel)"
            placeholder="TR.."
            value={iban}
            onChange={(e) => setIban(e.target.value)}
          />
          <Select
            label="Para Birimi"
            options={PARA_BIRIMLERI}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as ParaBirimi)}
          />
          <div>
            <label className="text-xs font-medium text-navy-600">Not (opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Hesap için kısa açıklama"
            />
          </div>

          {msg && msg.type === "err" && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              {msg.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1" disabled={submitting}>
              İptal
            </Button>
            <Button onClick={handleCreate} className="flex-1" disabled={submitting}>
              {submitting ? "Kaydediliyor…" : "Hesabı Oluştur"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
