"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type ExpenseType =
  | "konsolosluk"
  | "araci_kurum"
  | "saglik_sigortasi"
  | "araci_kurum_vip"
  | "randevu_vip";

export type ExpenseCurrency = "TL" | "USD" | "EUR";

export interface ExpenseDraft {
  id?: string;
  expense_type: ExpenseType;
  amount: string;
  currency: ExpenseCurrency;
  note?: string;
}

interface ExpenseTypeMeta {
  key: ExpenseType;
  label: string;
  short: string;
  icon: string;
  accent: string; // gradient
  ring: string;
  text: string;
}

const EXPENSE_TYPES: ExpenseTypeMeta[] = [
  {
    key: "konsolosluk",
    label: "Konsolosluk Ödemesi",
    short: "Konsolosluk",
    icon: "M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2M12 3l9 6-9 6-9-6 9-6z",
    accent: "from-indigo-500 to-blue-600",
    ring: "ring-indigo-200",
    text: "text-indigo-700",
  },
  {
    key: "araci_kurum",
    label: "Aracı Kurum Ödemesi",
    short: "Aracı Kurum",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5",
    accent: "from-violet-500 to-fuchsia-600",
    ring: "ring-violet-200",
    text: "text-violet-700",
  },
  {
    key: "saglik_sigortasi",
    label: "Sağlık Sigortası",
    short: "Sigorta",
    icon: "M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z",
    accent: "from-rose-500 to-pink-600",
    ring: "ring-rose-200",
    text: "text-rose-700",
  },
  {
    key: "araci_kurum_vip",
    label: "Aracı Kurum VIP Hizmeti",
    short: "Aracı VIP",
    icon: "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z",
    accent: "from-amber-500 to-orange-600",
    ring: "ring-amber-200",
    text: "text-amber-700",
  },
  {
    key: "randevu_vip",
    label: "Randevu VIP (Bot)",
    short: "Randevu VIP",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    accent: "from-emerald-500 to-teal-600",
    ring: "ring-emerald-200",
    text: "text-emerald-700",
  },
];

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = EXPENSE_TYPES.reduce(
  (acc, m) => ({ ...acc, [m.key]: m.label }),
  {} as Record<ExpenseType, string>
);

interface ExpensesPanelProps {
  fileId?: string | null;
  drafts: ExpenseDraft[];
  onChange: (next: ExpenseDraft[]) => void;
}

export default function ExpensesPanel({ fileId, drafts, onChange }: ExpensesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!fileId || loaded) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("visa_file_expenses")
          .select("id, expense_type, amount, currency, note")
          .eq("file_id", fileId)
          .order("created_at", { ascending: true });
        if (!cancelled) {
          if (!error && data) {
            onChange(
              data.map((r) => ({
                id: r.id as string,
                expense_type: r.expense_type as ExpenseType,
                amount: String(r.amount ?? ""),
                currency: (r.currency as ExpenseCurrency) || "TL",
                note: (r.note as string | null) || "",
              }))
            );
          }
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  const addExpense = (type: ExpenseType) => {
    onChange([
      ...drafts,
      { expense_type: type, amount: "", currency: "TL", note: "" },
    ]);
  };

  const updateAt = (idx: number, patch: Partial<ExpenseDraft>) => {
    const next = [...drafts];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeAt = (idx: number) => {
    onChange(drafts.filter((_, i) => i !== idx));
  };

  // Toplamlar
  const totals: Record<ExpenseCurrency, number> = { TL: 0, USD: 0, EUR: 0 };
  drafts.forEach((d) => {
    const n = parseFloat(d.amount || "0");
    if (!Number.isNaN(n) && n > 0) {
      totals[d.currency] += n;
    }
  });

  const SYM: Record<ExpenseCurrency, string> = { TL: "₺", USD: "$", EUR: "€" };
  const hasAnyTotal = totals.TL > 0 || totals.USD > 0 || totals.EUR > 0;

  return (
    <fieldset className="space-y-4 p-4 sm:p-5 border-2 border-rose-100 rounded-2xl bg-gradient-to-br from-rose-50/30 via-white to-amber-50/30">
      <legend className="px-3 py-1 mx-2 text-sm font-bold bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-full shadow">
        Giderler (opsiyonel)
      </legend>

      <p className="text-[12.5px] text-slate-600 leading-relaxed">
        Bu dosyaya ait <strong>maliyet kalemlerini</strong> aşağıdan ekleyebilirsin. Eklenen tutarlar Kasa &gt; Giderler
        sayfasında raporlanır. Ücret ile karıştırma — bunlar dosyaya yapılan harcamalardır.
      </p>

      {/* 5 buton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {EXPENSE_TYPES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => addExpense(m.key)}
            className={`group relative overflow-hidden rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-transparent ${m.ring} hover:ring-2`}
          >
            <div className={`absolute -top-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br ${m.accent} opacity-10 group-hover:opacity-20 transition-opacity`} />
            <div className="relative flex items-center gap-2">
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${m.accent} flex items-center justify-center shadow-sm`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={m.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[11.5px] font-bold ${m.text} leading-tight truncate`}>{m.short}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">+ ekle</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Yüklenirken */}
      {loading && (
        <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Mevcut giderler yükleniyor...
        </div>
      )}

      {/* Kalemler */}
      {drafts.length > 0 && (
        <div className="space-y-2.5">
          {drafts.map((d, idx) => {
            const meta = EXPENSE_TYPES.find((m) => m.key === d.expense_type) || EXPENSE_TYPES[0];
            return (
              <div
                key={idx}
                className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.accent} flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={meta.icon} />
                    </svg>
                  </div>
                  <p className={`text-[12.5px] font-bold ${meta.text} flex-1`}>{meta.label}</p>
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Sil"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={d.amount}
                    onChange={(e) => updateAt(idx, { amount: e.target.value })}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                  <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                    {(["TL", "USD", "EUR"] as ExpenseCurrency[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateAt(idx, { currency: c })}
                        className={`px-3 py-2 text-xs font-bold transition-all ${
                          d.currency === c
                            ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {SYM[c]} {c}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Açıklama (opsiyonel)"
                  value={d.note || ""}
                  onChange={(e) => updateAt(idx, { note: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Toplam */}
      {hasAnyTotal && (
        <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-3 text-white shadow-md">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">Toplam Gider</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(["TL", "USD", "EUR"] as ExpenseCurrency[]).map((c) =>
              totals[c] > 0 ? (
                <span key={c} className="text-sm font-black tabular-nums">
                  {totals[c].toLocaleString("tr-TR")} <span className="text-slate-400 font-bold">{SYM[c]} {c}</span>
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}
