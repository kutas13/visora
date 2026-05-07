"use client";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";
import type { Payment, VisaFile, Profile, Company } from "@/lib/supabase/types";

type PaymentRow = Payment & {
  visa_files:
    | (Pick<VisaFile,
        "id" |
        "musteri_ad" |
        "hedef_ulke" |
        "cari_tipi" |
        "company_id" |
        "ucret" |
        "ucret_currency" |
        "davetiye_ucreti" |
        "davetiye_ucreti_currency"
      >)
    | null;
  profiles: Pick<Profile, "name"> | null;
};

type FirmaCariFile = VisaFile & {
  profiles: Pick<Profile, "name"> | null;
  company?: Pick<Company, "id" | "firma_adi"> | null;
};

type ExpenseRow = {
  id: string;
  file_id: string;
  expense_type: string;
  amount: number;
  currency: string;
  tl_karsilik: number | null;
  exchange_rate: number | null;
  note: string | null;
  created_at: string;
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  konsolosluk: "Konsolosluk Ödemesi",
  araci_kurum: "Aracı Kurum Ödemesi",
  saglik_sigortasi: "Sağlık Sigortası",
  araci_kurum_vip: "Aracı Kurum VIP Hizmeti",
  randevu_vip: "Randevu VIP (Bot)",
};

type CategoryKey = "nakit" | "pesin" | "firma_cari" | "hesaba_eft";

type Totals = Record<string, number>; // currency -> sum

interface CategoryData {
  totals: Totals;
  count: number;
  rows: DisplayRow[];
}

interface DisplayRow {
  id: string;
  file_id: string | null;
  musteri_ad: string;
  hedef_ulke: string;
  tutar: number;
  currency: string;
  yontem: string;
  payment_type: string;
  personel: string;
  created_at: string;
  badge?: string;
  /** TL karşılığı tahsil edildiyse, gerçekte alınan TL tutar (gösterim notu için) */
  tl_karsilik?: number | null;
  /** Dosyanin kendi vize ucreti (gosterim icin) */
  vize_ucreti?: number;
  vize_ucreti_currency?: string;
  davetiye_ucreti?: number | null;
  davetiye_ucreti_currency?: string | null;
  /** Firma cari satirlarinda dosya tahsil edildiyse hangi yontemle alindigi (gosterim notu) */
  firmaCariCollectedYontem?: string | null;
  /** Firma cari satirinda gercek tahsilat tutari (payment varsa) */
  firmaCariCollectedAmount?: number | null;
  firmaCariCollectedCurrency?: string | null;
}

const YONTEM_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  nakit: { label: "Nakit", bg: "bg-emerald-50", text: "text-emerald-700" },
  hesaba: { label: "Hesaba", bg: "bg-amber-50", text: "text-amber-700" },
  pos: { label: "POS", bg: "bg-violet-50", text: "text-violet-700" },
  firma_cari: { label: "Firma Cari", bg: "bg-fuchsia-50", text: "text-fuchsia-700" },
};

const SYM: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
function sym(c: string) { return SYM[c] || c; }
function fmtCur(n: number, c: string) { return `${Math.round(n).toLocaleString("tr-TR")} ${sym(c)}`; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function getFileTotal(file: VisaFile) {
  return (Number(file.ucret) || 0) + (Number(file.davetiye_ucreti) || 0);
}

const CATEGORY_META: Record<CategoryKey, { label: string; description: string; bg: string; ring: string; iconBg: string; iconText: string; accent: string; icon: string }> = {
  nakit: {
    label: "Nakit Tahsilat",
    description: "Cari kapanışlarında nakit ile alınan sonradan tahsilatlar",
    bg: "from-green-50 via-emerald-50 to-white",
    ring: "ring-green-200",
    iconBg: "bg-gradient-to-br from-green-500 to-emerald-600",
    iconText: "text-white",
    accent: "text-emerald-700",
    icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  },
  pesin: {
    label: "Peşin Satış",
    description: "Peşin satılan dosyalar (yöntem: nakit / hesaba / POS)",
    bg: "from-sky-50 via-blue-50 to-white",
    ring: "ring-sky-200",
    iconBg: "bg-gradient-to-br from-sky-500 to-blue-600",
    iconText: "text-white",
    accent: "text-sky-700",
    icon: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  firma_cari: {
    label: "Cari Firma",
    description: "Firma cariye yapılan satışlar (faturalı)",
    bg: "from-purple-50 via-fuchsia-50 to-white",
    ring: "ring-purple-200",
    iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    iconText: "text-white",
    accent: "text-purple-700",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  hesaba_eft: {
    label: "Hesaba / EFT",
    description: "Cari kapanışlarında EFT/Havale ile gelen sonradan tahsilatlar",
    bg: "from-amber-50 via-orange-50 to-white",
    ring: "ring-amber-200",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    iconText: "text-white",
    accent: "text-amber-700",
    icon: "M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
  },
};

export default function CiroIslemleriPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [firmaCariFiles, setFirmaCariFiles] = useState<FirmaCariFile[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 0, EUR: 0, TL: 1 });
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterRange, setFilterRange] = useState<"today" | "week" | "month" | "all">("all");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("pesin");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [paymentsRes, firmaRes, expensesRes, ratesRes] = await Promise.all([
      supabase
        .from("payments")
        .select(
          "*, visa_files(id, musteri_ad, hedef_ulke, cari_tipi, company_id, ucret, ucret_currency, davetiye_ucreti, davetiye_ucreti_currency), profiles:created_by(name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .eq("cari_tipi", "firma_cari")
        .order("created_at", { ascending: false }),
      supabase
        .from("visa_file_expenses")
        .select("id, file_id, expense_type, amount, currency, tl_karsilik, exchange_rate, note, created_at"),
      fetch("/api/exchange-rates").then((r) => r.json()).catch(() => ({ rates: null })),
    ]);
    setPayments((paymentsRes.data as PaymentRow[]) || []);
    setFirmaCariFiles((firmaRes.data as FirmaCariFile[]) || []);
    setExpenses((expensesRes.data as ExpenseRow[]) || []);
    if (ratesRes && ratesRes.rates) {
      setExchangeRates({ ...{ USD: 0, EUR: 0, TL: 1 }, ...(ratesRes.rates as Record<string, number>) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Dosya bazli toplam TL gider haritasi
  const expenseByFileTl = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      // Onceki kayitlarda tl_karsilik bos olabilir; o anki kurla geriye donuk hesapla
      let tl = 0;
      if (typeof e.tl_karsilik === "number" && e.tl_karsilik > 0) {
        tl = e.tl_karsilik;
      } else {
        const amt = Number(e.amount) || 0;
        if (e.currency === "TL") tl = amt;
        else {
          const r = Number(exchangeRates[e.currency]) || 0;
          tl = r > 0 ? amt * r : 0;
        }
      }
      const prev = map.get(e.file_id) || 0;
      map.set(e.file_id, prev + tl);
    });
    return map;
  }, [expenses, exchangeRates]);

  // Dosya bazli gider listesi
  const expensesByFile = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    expenses.forEach((e) => {
      const arr = map.get(e.file_id) || [];
      arr.push(e);
      map.set(e.file_id, arr);
    });
    return map;
  }, [expenses]);

  // Dosya gider toplamlari (currency basina) — detay panelinde gosterim icin
  const expenseTotalsByFile = useMemo(() => {
    const map = new Map<string, Totals>();
    expenses.forEach((e) => {
      const totals = map.get(e.file_id) || {};
      const amt = Number(e.amount) || 0;
      totals[e.currency] = (totals[e.currency] || 0) + amt;
      map.set(e.file_id, totals);
    });
    return map;
  }, [expenses]);

  // Bir tutari TL'ye cevir (display amaclı)
  const toTl = (amount: number, currency: string, fallbackTl?: number | null): number => {
    if (typeof fallbackTl === "number" && fallbackTl > 0) return fallbackTl;
    if (!amount || amount <= 0) return 0;
    if (currency === "TL") return amount;
    const r = Number(exchangeRates[currency]) || 0;
    return r > 0 ? amount * r : 0;
  };

  // Tarih aralığı filtresi
  const dateFilterFn = useMemo(() => {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
    return (dateStr: string) => {
      if (filterRange === "all") return true;
      const d = new Date(dateStr);
      if (filterRange === "today") {
        const dd = new Date(d); dd.setHours(0, 0, 0, 0);
        return dd.getTime() === today.getTime();
      }
      if (filterRange === "week") return d >= weekAgo;
      if (filterRange === "month") return d >= monthAgo;
      return true;
    };
  }, [filterRange]);

  // file_id -> en yeni odendi payment'i (firma cari satirinda gosterim icin)
  const latestPaymentByFileId = useMemo(() => {
    const map = new Map<string, PaymentRow>();
    payments
      .filter((p) => p.durum === "odendi")
      .forEach((p) => {
        const fid = p.visa_files?.id || p.file_id;
        if (!fid) return;
        const existing = map.get(fid);
        if (!existing || new Date(p.created_at).getTime() > new Date(existing.created_at).getTime()) {
          map.set(fid, p);
        }
      });
    return map;
  }, [payments]);

  // Kategori bazında gruplandırma
  const categoryData = useMemo(() => {
    const data: Record<CategoryKey, CategoryData> = {
      nakit: { totals: {}, count: 0, rows: [] },
      pesin: { totals: {}, count: 0, rows: [] },
      firma_cari: { totals: {}, count: 0, rows: [] },
      hesaba_eft: { totals: {}, count: 0, rows: [] },
    };

    const addRow = (key: CategoryKey, row: DisplayRow) => {
      if (filterCurrency !== "all" && row.currency !== filterCurrency) return;
      data[key].rows.push(row);
      data[key].count += 1;
      data[key].totals[row.currency] = (data[key].totals[row.currency] || 0) + row.tutar;
    };

    // Payments tablosu (peşin satış + tahsilatlar)
    payments
      .filter((p) => p.durum === "odendi" && dateFilterFn(p.created_at))
      // Firma cari dosyaların tahsilatları nakit/hesaba_eft kategorilerine
      // gitmesin — sadece "firma_cari" kategorisinde, ek tahsilat notuyla
      // gozuksun (duplicate engelleme).
      .filter((p) => p.visa_files?.cari_tipi !== "firma_cari")
      .forEach((p) => {
        const baseRow: DisplayRow = {
          id: p.id,
          file_id: p.visa_files?.id || p.file_id || null,
          musteri_ad: p.visa_files?.musteri_ad || "—",
          hedef_ulke: p.visa_files?.hedef_ulke || "—",
          tutar: Number(p.tutar) || 0,
          currency: p.currency || "TL",
          yontem: p.yontem,
          payment_type: p.payment_type,
          personel: p.profiles?.name || "—",
          created_at: p.created_at,
          badge: p.payment_type === "pesin_satis" ? "Peşin" : "Tahsilat",
          tl_karsilik: typeof p.tl_karsilik === "number" ? p.tl_karsilik : null,
          vize_ucreti: Number(p.visa_files?.ucret) || 0,
          vize_ucreti_currency: p.visa_files?.ucret_currency || "TL",
          davetiye_ucreti: typeof p.visa_files?.davetiye_ucreti === "number" ? p.visa_files?.davetiye_ucreti : null,
          davetiye_ucreti_currency: p.visa_files?.davetiye_ucreti_currency || null,
        };

        // ARTIK DUPLICATE YOK:
        //  - Pesin satis yalniz "pesin" kategorisinde gozukur (yontem badge ile)
        //  - Sonradan tahsilat ise yontem-bazinda (nakit / hesaba_eft) gozukur
        if (p.payment_type === "pesin_satis") {
          addRow("pesin", baseRow);
        } else {
          if (p.yontem === "nakit") addRow("nakit", baseRow);
          else if (p.yontem === "hesaba") addRow("hesaba_eft", baseRow);
          else if (p.yontem === "pos") addRow("nakit", baseRow); // POS sonradan tahsilat — nakit gibi davranir
        }
      });

    // Firma cari dosyaları (ayrı kayıt; payments tablosu yerine dosyanın kendisi)
    firmaCariFiles
      .filter((f) => dateFilterFn(f.created_at))
      .forEach((f) => {
        const collected = latestPaymentByFileId.get(f.id);
        const row: DisplayRow = {
          id: `firma_${f.id}`,
          file_id: f.id,
          musteri_ad: f.musteri_ad,
          hedef_ulke: f.hedef_ulke,
          tutar: getFileTotal(f),
          currency: f.ucret_currency || "TL",
          yontem: "firma_cari",
          payment_type: "firma_cari",
          personel: f.profiles?.name || "—",
          created_at: f.created_at,
          badge: collected ? "Tahsil Edildi" : "Fatura Kesildi",
          vize_ucreti: Number(f.ucret) || 0,
          vize_ucreti_currency: f.ucret_currency || "TL",
          davetiye_ucreti: typeof f.davetiye_ucreti === "number" ? f.davetiye_ucreti : null,
          davetiye_ucreti_currency: f.davetiye_ucreti_currency || null,
          firmaCariCollectedYontem: collected ? collected.yontem : null,
          firmaCariCollectedAmount: collected ? Number(collected.tutar) || 0 : null,
          firmaCariCollectedCurrency: collected ? collected.currency || "TL" : null,
          tl_karsilik: collected && typeof collected.tl_karsilik === "number" ? collected.tl_karsilik : null,
        };
        addRow("firma_cari", row);
      });

    // Sıralama
    (Object.keys(data) as CategoryKey[]).forEach((k) => {
      data[k].rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return data;
  }, [payments, firmaCariFiles, dateFilterFn, filterCurrency]);

  // Toplam ciro: tum kategoriler DISJOINT, hepsini topla
  const grandTotals = useMemo(() => {
    const g: Totals = {};
    const add = (totals: Totals) => {
      Object.entries(totals).forEach(([c, v]) => {
        g[c] = (g[c] || 0) + v;
      });
    };
    add(categoryData.pesin.totals);
    add(categoryData.nakit.totals);
    add(categoryData.hesaba_eft.totals);
    add(categoryData.firma_cari.totals);
    return g;
  }, [categoryData]);

  // Toplam gider (TL bazinda) — secili tarih araliginda
  const totalExpenseTl = useMemo(() => {
    const allRows = [
      ...categoryData.pesin.rows,
      ...categoryData.nakit.rows,
      ...categoryData.hesaba_eft.rows,
      ...categoryData.firma_cari.rows,
    ];
    const seenFiles = new Set<string>();
    let total = 0;
    allRows.forEach((r) => {
      if (!r.file_id || seenFiles.has(r.file_id)) return;
      seenFiles.add(r.file_id);
      total += expenseByFileTl.get(r.file_id) || 0;
    });
    return total;
  }, [categoryData, expenseByFileTl]);

  const currencyOptions = [{ value: "all", label: "Tüm Birimler" }, ...PARA_BIRIMLERI];
  const rangeOptions = [
    { value: "today", label: "Bugün" },
    { value: "week", label: "Son 7 Gün" },
    { value: "month", label: "Son 30 Gün" },
    { value: "all", label: "Tümü" },
  ];

  const active = categoryData[activeCategory];
  const meta = CATEGORY_META[activeCategory];

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-amber-500 via-orange-500 to-rose-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Finans</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Ciro İşlemleri</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Ödeme yöntemine göre ciro kırılımı: nakit, peşin satış, cari firma ve hesaba EFT.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <div className="w-full sm:w-40">
            <Select
              options={rangeOptions}
              value={filterRange}
              onChange={(e) => setFilterRange(e.target.value as typeof filterRange)}
            />
          </div>
          <div className="w-full sm:w-36">
            <Select
              options={currencyOptions}
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
            />
          </div>
          <a
            href="/admin/kasa"
            className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-emerald-500 via-violet-500 to-rose-500 hover:brightness-110 shadow-lg shadow-violet-500/30 transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-1M16 12h5M18 9l3 3-3 3" />
            </svg>
            Kasaya Git
          </a>
        </div>
      </div>

      {/* TOPLAM CİRO — Karanlık glass banner */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-amber-500 blur-3xl animate-blob" />
          <div className="absolute -bottom-16 -right-10 w-72 h-72 rounded-full bg-fuchsia-500 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        </div>
        <div className="relative p-6 sm:p-7 grid md:grid-cols-[1fr_auto] items-end gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Toplam Ciro
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight">
              Peşin + Tahsilat + Firma Cari toplamı
            </h2>
            <p className="mt-1.5 text-white/60 text-sm">Seçili tarih aralığında biriken tüm kasa tutarı (artık duplicate yok)</p>
            {totalExpenseTl > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30 text-rose-200 text-[11.5px] font-bold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                Dosya Giderleri (TL): {Math.round(totalExpenseTl).toLocaleString("tr-TR")} ₺
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2.5 md:flex md:flex-row md:items-end md:gap-3">
            {(["TL", "EUR", "USD"] as const).map((c) => (
              <div key={c} className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-3 py-2.5 text-right md:min-w-[140px]">
                <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{c}</p>
                <p className="mt-0.5 text-lg sm:text-xl font-black text-white">{fmtCur(grandTotals[c] || 0, c)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 KATEGORİ KARTI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(CATEGORY_META) as CategoryKey[]).map((key) => {
          const m = CATEGORY_META[key];
          const d = categoryData[key];
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`relative overflow-hidden text-left rounded-2xl bg-white p-4 transition-all ${
                isActive
                  ? "ring-2 ring-indigo-300 shadow-lg shadow-indigo-500/10 -translate-y-0.5"
                  : "ring-1 ring-slate-200/70 hover:ring-indigo-200 hover:-translate-y-0.5"
              }`}
            >
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${m.iconBg} opacity-10`} />
              <div className="relative flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${m.iconBg} flex items-center justify-center shadow-md`}>
                  <svg className={`w-5 h-5 ${m.iconText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
                  </svg>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {d.count} kayıt
                </span>
              </div>

              <p className="relative text-[13.5px] font-extrabold text-slate-900">{m.label}</p>
              <p className="relative text-[11px] text-slate-500 mb-3 leading-tight">{m.description}</p>

              <div className="relative space-y-0.5">
                {Object.keys(d.totals).length === 0 ? (
                  <p className="text-sm text-slate-400">—</p>
                ) : (
                  Object.entries(d.totals).map(([c, v]) => (
                    <p key={c} className="text-base font-extrabold text-slate-900">
                      {fmtCur(v, c)}
                    </p>
                  ))
                )}
              </div>

              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* DETAY TABLO */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden min-w-0">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-1 h-7 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
            <div>
              <p className="text-base font-extrabold text-slate-900 tracking-tight">{meta.label}</p>
              <p className="text-[11px] text-slate-500">{active.count} kayıt · {meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(active.totals).map(([c, v]) => (
              <span key={c} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11.5px] font-bold ring-1 ring-slate-200">
                {fmtCur(v, c)}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : active.rows.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-3 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Bu kategoride henüz kayıt yok</p>
            <p className="text-xs text-slate-400 mt-1">Tarih veya döviz filtresini değiştirerek tekrar deneyin</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-50/0">
                  <th className="w-8 py-3.5 px-2"></th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Müşteri / Yöntem</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Ülke</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Satış / Gider / Kâr</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Vize Ücreti</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Personel</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {active.rows.map((r) => {
                  const yontemBadge = YONTEM_BADGES[r.yontem] || { label: r.yontem, bg: "bg-slate-100", text: "text-slate-700" };
                  const satisTl = toTl(r.tutar, r.currency, r.tl_karsilik);
                  const giderTl = r.file_id ? expenseByFileTl.get(r.file_id) || 0 : 0;
                  const karTl = satisTl - giderTl;
                  const sym = SYM[r.vize_ucreti_currency || "TL"] || "₺";
                  const totalVize = (Number(r.vize_ucreti) || 0) + (Number(r.davetiye_ucreti) || 0);
                  const fileExpenses = r.file_id ? expensesByFile.get(r.file_id) || [] : [];
                  const fileExpenseTotals = r.file_id ? expenseTotalsByFile.get(r.file_id) || {} : {};
                  const hasExpenses = fileExpenses.length > 0;
                  const isExpanded = expandedRowId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={`transition-colors ${hasExpenses ? "cursor-pointer hover:bg-indigo-50/40" : "hover:bg-indigo-50/30"} ${isExpanded ? "bg-indigo-50/60" : ""}`}
                        onClick={() => {
                          if (!hasExpenses) return;
                          setExpandedRowId(isExpanded ? null : r.id);
                        }}
                      >
                        <td className="py-3 px-2 align-top">
                          {hasExpenses ? (
                            <button
                              type="button"
                              aria-label={isExpanded ? "Gider detayını kapat" : "Gider detayını aç"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId(isExpanded ? null : r.id);
                              }}
                              className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${
                                isExpanded
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-rose-50 text-rose-600 hover:bg-rose-100 ring-1 ring-rose-200"
                              }`}
                              title={`${fileExpenses.length} gider kalemi`}
                            >
                              <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="block w-6 h-6" />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.musteri_ad}</div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${yontemBadge.bg} ${yontemBadge.text}`}>
                              {yontemBadge.label}
                            </span>
                            {r.payment_type === "pesin_satis" && (
                              <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-sky-50 text-sky-700">
                                Peşin
                              </span>
                            )}
                            {r.payment_type === "firma_cari" && (
                              <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                r.firmaCariCollectedYontem
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              }`}>
                                {r.firmaCariCollectedYontem ? "Tahsil Edildi" : "Fatura Kesildi"}
                              </span>
                            )}
                            {r.payment_type !== "pesin_satis" && r.payment_type !== "firma_cari" && (
                              <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                                Tahsilat
                              </span>
                            )}
                            {hasExpenses && (
                              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                {fileExpenses.length} gider
                              </span>
                            )}
                          </div>
                          {/* Firma cari dosya icin tahsilat bilgisi */}
                          {r.payment_type === "firma_cari" && r.firmaCariCollectedYontem && (
                            <div className="mt-1.5 inline-flex flex-wrap items-center gap-1 text-[10.5px] text-slate-600">
                              <span className="font-bold text-emerald-700">
                                {r.firmaCariCollectedYontem === "nakit" ? "Nakit" :
                                 r.firmaCariCollectedYontem === "hesaba" ? "Hesaba" :
                                 r.firmaCariCollectedYontem === "pos" ? "POS" : r.firmaCariCollectedYontem}
                              </span>
                              <span>olarak</span>
                              <strong className="text-slate-800">
                                {fmtCur(r.firmaCariCollectedAmount || 0, r.firmaCariCollectedCurrency || "TL")}
                              </strong>
                              <span>alındı</span>
                              {typeof r.tl_karsilik === "number" && r.tl_karsilik > 0 && r.firmaCariCollectedCurrency !== "TL" && (
                                <span className="text-amber-600 font-semibold">
                                  · TL karşılığı {Math.round(r.tl_karsilik).toLocaleString("tr-TR")} ₺
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{r.hedef_ulke}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-extrabold text-slate-900">{fmtCur(r.tutar, r.currency)}</div>
                          {/* TL karsiligi alindiysa (gercek TL kasaya girdi) net olarak goster */}
                          {typeof r.tl_karsilik === "number" && r.tl_karsilik > 0 && r.currency !== "TL" && (
                            <div className="text-[10.5px] font-bold text-emerald-700 mt-0.5">
                              TL karşılığı {Math.round(r.tl_karsilik).toLocaleString("tr-TR")} ₺ alındı
                            </div>
                          )}
                          {/* TL karsiligi yoksa ama dosya farkli currency ise sadece anlik kur cevirisi */}
                          {(!r.tl_karsilik || r.tl_karsilik <= 0) && r.currency !== "TL" && satisTl > 0 && (
                            <div className="text-[10px] font-semibold text-amber-600 mt-0.5">
                              ≈ {Math.round(satisTl).toLocaleString("tr-TR")} ₺
                            </div>
                          )}
                          <div className="mt-1 inline-flex flex-col items-end gap-0.5 text-[10.5px] leading-tight">
                            <span className="text-slate-500">
                              Satış: <strong className="text-emerald-700">{Math.round(satisTl).toLocaleString("tr-TR")} ₺</strong>
                            </span>
                            <span className="text-slate-500">
                              Gider: <strong className="text-rose-600">{Math.round(giderTl).toLocaleString("tr-TR")} ₺</strong>
                            </span>
                            <span className={`font-bold ${karTl >= 0 ? "text-indigo-700" : "text-rose-700"}`}>
                              Kâr: {Math.round(karTl).toLocaleString("tr-TR")} ₺
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="text-[12px] font-bold text-slate-700">
                            {Math.round(Number(r.vize_ucreti) || 0).toLocaleString("tr-TR")} {sym}
                          </div>
                          {Number(r.davetiye_ucreti) > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              +Davet: {Math.round(Number(r.davetiye_ucreti) || 0).toLocaleString("tr-TR")} {SYM[r.davetiye_ucreti_currency || "USD"] || "$"}
                            </div>
                          )}
                          {Number(r.davetiye_ucreti) > 0 && (
                            <div className="text-[10px] font-semibold text-slate-600 mt-0.5">
                              Toplam: {Math.round(totalVize).toLocaleString("tr-TR")} {sym}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">{r.personel}</td>
                        <td className="py-3 px-4 text-right text-[11.5px] font-semibold text-slate-500">{fmtDate(r.created_at)}</td>
                      </tr>
                      {isExpanded && hasExpenses && (
                        <tr className="bg-gradient-to-b from-rose-50/50 via-rose-50/30 to-transparent">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="rounded-xl bg-white ring-1 ring-rose-200/70 overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-rose-100 bg-rose-50/60 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-1 h-5 rounded-full bg-gradient-to-b from-rose-500 to-pink-500" />
                                  <p className="text-[12px] font-extrabold text-rose-800 uppercase tracking-wider">
                                    {r.musteri_ad} — Giderler ({fileExpenses.length} kalem)
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {Object.entries(fileExpenseTotals).map(([c, v]) => (
                                    <span key={c} className="px-2 py-0.5 bg-white rounded-md text-[10.5px] font-bold ring-1 ring-rose-200 text-rose-700">
                                      {fmtCur(v, c)}
                                    </span>
                                  ))}
                                  <span className="px-2 py-0.5 bg-rose-600 text-white rounded-md text-[10.5px] font-bold">
                                    ≈ {Math.round(giderTl).toLocaleString("tr-TR")} ₺
                                  </span>
                                </div>
                              </div>
                              <table className="w-full text-[12.5px]">
                                <thead>
                                  <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kalem</th>
                                    <th className="text-right py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tutar</th>
                                    <th className="text-right py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">TL Karşılığı</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Not</th>
                                    <th className="text-right py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tarih</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {fileExpenses.map((exp) => {
                                    const tlKars = typeof exp.tl_karsilik === "number" && exp.tl_karsilik > 0
                                      ? exp.tl_karsilik
                                      : exp.currency === "TL"
                                        ? Number(exp.amount) || 0
                                        : (Number(exchangeRates[exp.currency]) || 0) * (Number(exp.amount) || 0);
                                    return (
                                      <tr key={exp.id} className="hover:bg-rose-50/40">
                                        <td className="py-2 px-3 font-semibold text-slate-800">
                                          {EXPENSE_TYPE_LABELS[exp.expense_type] || exp.expense_type}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                                          {fmtCur(Number(exp.amount) || 0, exp.currency)}
                                        </td>
                                        <td className="py-2 px-3 text-right text-amber-700 font-semibold tabular-nums">
                                          {exp.currency !== "TL" ? `≈ ${Math.round(tlKars).toLocaleString("tr-TR")} ₺` : "—"}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-[11.5px] max-w-[280px] truncate">
                                          {exp.note || "—"}
                                        </td>
                                        <td className="py-2 px-3 text-right text-slate-400 text-[10.5px] tabular-nums">
                                          {fmtDate(exp.created_at)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
