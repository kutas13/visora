import type { CashAccount, CashTransaction, ParaBirimi } from "@/lib/supabase/types";

export const CURRENCY_SYMBOL: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };

export function sym(c: string) {
  return CURRENCY_SYMBOL[c] || c;
}

export function fmtCurrency(n: number, c: string) {
  return `${Math.round(n).toLocaleString("tr-TR")} ${sym(c)}`;
}

export function fmtCurrencyDecimal(n: number, c: string) {
  const fixed = Math.round(n * 100) / 100;
  return `${fixed.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym(c)}`;
}

/**
 * Hesabin guncel bakiyesini hesaplar (in - out, transferler dahil).
 */
export function calcBalance(transactions: CashTransaction[], accountId: string): number {
  let bal = 0;
  for (const t of transactions) {
    if (t.account_id !== accountId) continue;
    const amt = Number(t.amount) || 0;
    bal += t.direction === "in" ? amt : -amt;
  }
  return bal;
}

/**
 * Tum kasalarin bakiyelerini bir mapde dondurur.
 */
export function calcAllBalances(
  accounts: CashAccount[],
  transactions: CashTransaction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of accounts) map.set(a.id, 0);
  for (const t of transactions) {
    const cur = map.get(t.account_id) || 0;
    const amt = Number(t.amount) || 0;
    map.set(t.account_id, cur + (t.direction === "in" ? amt : -amt));
  }
  return map;
}

export function accountIcon(kind: "cash" | "bank") {
  return kind === "cash"
    ? "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
    : "M4 10h16M4 6l8-3 8 3M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18";
}

/**
 * Kasa bakiyeleri icin renk seti (currency veya kind bazinda).
 */
export function accountColor(currency: ParaBirimi, kind: "cash" | "bank") {
  if (kind === "bank") {
    return {
      gradient: "from-violet-500 to-fuchsia-600",
      bg: "from-violet-50 via-fuchsia-50 to-white",
      ring: "ring-violet-200",
      text: "text-violet-700",
      iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
    };
  }
  if (currency === "TL") {
    return {
      gradient: "from-emerald-500 to-green-600",
      bg: "from-emerald-50 via-green-50 to-white",
      ring: "ring-emerald-200",
      text: "text-emerald-700",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    };
  }
  if (currency === "EUR") {
    return {
      gradient: "from-blue-500 to-indigo-600",
      bg: "from-blue-50 via-indigo-50 to-white",
      ring: "ring-blue-200",
      text: "text-blue-700",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    };
  }
  // USD
  return {
    gradient: "from-amber-500 to-orange-600",
    bg: "from-amber-50 via-orange-50 to-white",
    ring: "ring-amber-200",
    text: "text-amber-700",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
  };
}
