"use client";

import { useMemo, useState, useEffect } from "react";
import { Modal, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { CashAccount, CashTransaction } from "@/lib/supabase/types";
import { CURRENCY_SYMBOL, fmtCurrency } from "@/lib/kasa/helpers";

interface WalletHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CashAccount | null;
  transactions: CashTransaction[];
  balances: Map<string, number>;
  onChanged: () => void;
  /** Modal acildiginda kullanilacak baslangic arama metni */
  initialSearch?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manuel",
  payment: "Tahsilat",
  file_expense: "Dosya Gideri",
  transfer: "Transfer",
};

const SOURCE_BADGE: Record<string, string> = {
  manual: "bg-slate-100 text-slate-700 ring-slate-200",
  payment: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  file_expense: "bg-rose-50 text-rose-700 ring-rose-200",
  transfer: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletHistoryModal({
  isOpen,
  onClose,
  account,
  transactions,
  balances,
  onChanged,
  initialSearch = "",
}: WalletHistoryModalProps) {
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");
  const [detailTx, setDetailTx] = useState<CashTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch(initialSearch);
      setFilter("all");
    } else {
      setSearch("");
      setFilter("all");
    }
  }, [isOpen, initialSearch]);

  const balance = account ? balances.get(account.id) || 0 : 0;

  const accountTransactions = useMemo(() => {
    if (!account) return [];
    const q = search.trim().toLocaleLowerCase("tr");
    return transactions
      .filter((t) => t.account_id === account.id)
      .filter((t) => filter === "all" || t.direction === filter)
      .filter((t) => {
        if (!q) return true;
        const desc = (t.description || "").toLocaleLowerCase("tr");
        const accName = (account.name || "").toLocaleLowerCase("tr");
        return desc.includes(q) || accName.includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [account, transactions, filter, search]);

  const totals = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    accountTransactions.forEach((t) => {
      if (t.direction === "in") totalIn += Number(t.amount) || 0;
      else totalOut += Number(t.amount) || 0;
    });
    return { totalIn, totalOut };
  }, [accountTransactions]);

  const handleDelete = async (tx: CashTransaction) => {
    const msg =
      "Bu kasa hareketini silmek istediğine emin misin?\n\n" +
      "• Sadece bu kasa kaydı silinecek\n" +
      "• İlgili vize dosyası VEYA ödeme/gider kaydı SİLİNMEZ\n" +
      "• Yalnızca bu kasa hareketinin etkisi (giriş/çıkış) kaldırılır\n\n" +
      "Bu işlem geri alınamaz.";
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      // Transferse, eslesi de sil
      if (tx.source === "transfer" && tx.transfer_pair_id) {
        const { error } = await supabase
          .from("cash_transactions")
          .delete()
          .in("id", [tx.id, tx.transfer_pair_id]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cash_transactions")
          .delete()
          .eq("id", tx.id);
        if (error) throw error;
      }
      setDetailTx(null);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Silme başarısız");
    } finally {
      setDeleting(false);
    }
  };

  if (!account) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`${account.name} — İşlem Geçmişi`} size="xl">
        <div className="space-y-4">
          {/* Bakiye + Toplamlar */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Mevcut Bakiye</p>
              <p className="mt-1 text-xl font-black tabular-nums">{fmtCurrency(balance, account.currency)}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Toplam Giriş</p>
              <p className="mt-1 text-xl font-black text-emerald-700 tabular-nums">+ {fmtCurrency(totals.totalIn, account.currency)}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 ring-1 ring-rose-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Toplam Çıkış</p>
              <p className="mt-1 text-xl font-black text-rose-700 tabular-nums">− {fmtCurrency(totals.totalOut, account.currency)}</p>
            </div>
          </div>

          {/* Arama */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya açıklama ile ara..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl ring-1 ring-slate-200 bg-white text-sm font-semibold placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center"
                aria-label="Aramayı temizle"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filtre */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(["all", "in", "out"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-extrabold transition-all ${
                  filter === f
                    ? f === "in" ? "bg-emerald-600 text-white" : f === "out" ? "bg-rose-600 text-white" : "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {f === "all" ? `Tümü (${accountTransactions.length})` : f === "in" ? "Girişler" : "Çıkışlar"}
              </button>
            ))}
          </div>

          {/* Liste */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/70">
            {accountTransactions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto mb-2 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {search.trim() ? `"${search}" için eşleşen kayıt bulunamadı` : "Bu kasada henüz işlem yok"}
                </p>
              </div>
            ) : (
              accountTransactions.map((t) => {
                const isIn = t.direction === "in";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDetailTx(t)}
                    className="w-full text-left flex items-start gap-2.5 px-4 py-3 hover:bg-slate-50/80 transition-colors group"
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
                      isIn ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-rose-500 to-red-600"
                    }`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isIn ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ring-1 ${SOURCE_BADGE[t.source] || SOURCE_BADGE.manual}`}>
                          {SOURCE_LABEL[t.source] || t.source}
                        </span>
                        <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums">{fmtDateTime(t.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-[13px] font-bold text-slate-800 truncate" title={t.description ?? undefined}>
                        {t.description || "—"}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className={`text-base font-black tabular-nums ${isIn ? "text-emerald-700" : "text-rose-700"}`}>
                          {isIn ? "+" : "−"} {Math.round(Number(t.amount) || 0).toLocaleString("tr-TR")} {CURRENCY_SYMBOL[t.currency]}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                          Detay
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Kapat</Button>
          </div>
        </div>
      </Modal>

      {/* DETAY MODALI */}
      <Modal isOpen={Boolean(detailTx)} onClose={() => setDetailTx(null)} title="İşlem Detayı" size="md">
        {detailTx && (
          <div className="space-y-4">
            <div className={`relative overflow-hidden rounded-2xl p-5 text-center ring-2 ${
              detailTx.direction === "in"
                ? "bg-gradient-to-br from-emerald-50 via-green-50 to-white ring-emerald-300"
                : "bg-gradient-to-br from-rose-50 via-red-50 to-white ring-rose-300"
            }`}>
              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider text-white ${
                detailTx.direction === "in" ? "bg-emerald-600" : "bg-rose-600"
              }`}>
                {detailTx.direction === "in" ? "GİRİŞ" : "ÇIKIŞ"} · {SOURCE_LABEL[detailTx.source] || detailTx.source}
              </span>
              <p className={`mt-2 text-3xl font-black tabular-nums ${detailTx.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                {detailTx.direction === "in" ? "+" : "−"} {Math.round(Number(detailTx.amount) || 0).toLocaleString("tr-TR")} {CURRENCY_SYMBOL[detailTx.currency]}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Açıklama</p>
              <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">{detailTx.description || "—"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kasa</p>
                <p className="mt-0.5 text-[12.5px] font-extrabold text-slate-900 truncate">{account.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Para Birimi</p>
                <p className="mt-0.5 text-[12.5px] font-extrabold text-slate-900">{detailTx.currency} ({CURRENCY_SYMBOL[detailTx.currency]})</p>
              </div>
              <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kaynak</p>
                <p className="mt-0.5 text-[12.5px] font-extrabold text-slate-900">{SOURCE_LABEL[detailTx.source] || detailTx.source}</p>
              </div>
              <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tarih</p>
                <p className="mt-0.5 text-[12px] font-bold text-slate-900">{fmtDateTime(detailTx.created_at)}</p>
              </div>
              {typeof detailTx.transfer_rate === "number" && detailTx.transfer_rate !== 1 && (
                <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200 col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kullanılan Kur</p>
                  <p className="mt-0.5 text-[12px] font-bold text-slate-900 tabular-nums">{Number(detailTx.transfer_rate).toFixed(4)}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDelete(detailTx)}
                disabled={deleting}
                title="Sadece bu kasa hareketini siler — dosya/ödeme kaydı korunur"
                className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50"
              >
                {deleting ? "Siliniyor..." : "🗑️ Bu Hareketi Sil"}
              </button>
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setDetailTx(null)}>Kapat</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
