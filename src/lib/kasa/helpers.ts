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
 * Turkce sayi formatindan parse eder. Once binlik ve ondalik ayraclari sezer.
 *  - "260.479,50"  -> 260479.50  (TR klasik: nokta=binlik, virgul=ondalik)
 *  - "1.234.567,89"-> 1234567.89
 *  - "260,479"     -> 260.479    (sadece virgul -> ondalik)
 *  - "260.479"     -> 260479     (tek nokta + sondaki grup 3 hane -> binlik)
 *  - "260.5"       -> 260.5      (tek nokta + sondaki grup 3 hane degil -> ondalik)
 *  - "1.234.567"   -> 1234567    (birden fazla nokta -> binlik)
 *  - "1234.56"     -> 1234.56    (sondaki grup 2 hane -> ondalik)
 */
export function parseTrNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  let s = String(input).trim().replace(/\s+/g, "").replace(/[^\d,.\-]/g, "");
  if (!s) return 0;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // Comma sondaysa ondalik, noktalar binlik
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Dot sondaysa ondalik, virguller binlik
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // Sadece virgul -> ondalik
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Birden fazla nokta -> hepsi binlik
      s = s.replace(/\./g, "");
    } else {
      // Tek nokta. Sagdaki grup 3 hane ve solda 1-3 hane varsa binlik kabul et.
      const parts = s.split(".");
      const right = parts[1] || "";
      if (right.length === 3) {
        s = s.replace(/\./g, "");
      }
      // Aksi halde ondalik olarak birak (ornegin "260.5", "1234.56")
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sayiyi input alani icin Turkce formatta yazar (binlik nokta, ondalik virgul).
 * Kullanim: setAmount(formatNumberForInput(123456.7)) -> "123.456,7"
 */
export function formatNumberForInput(n: number, maxDecimals = 2): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
    useGrouping: true,
  });
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
