"use client";

import { useState, useEffect, useMemo } from "react";
import { Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";
import type { Payment, VisaFile, Profile, Company } from "@/lib/supabase/types";

type PaymentRow = Payment & {
  visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke" | "cari_tipi" | "company_id"> | null;
  profiles: Pick<Profile, "name"> | null;
};

type FirmaCariFile = VisaFile & {
  profiles: Pick<Profile, "name"> | null;
  company?: Pick<Company, "id" | "firma_adi"> | null;
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
  musteri_ad: string;
  hedef_ulke: string;
  tutar: number;
  currency: string;
  yontem: string;
  payment_type: string;
  personel: string;
  created_at: string;
  badge?: string;
}

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
    label: "Nakit",
    description: "Elden veya kasaya alınan nakit tahsilatlar",
    bg: "from-green-50 via-emerald-50 to-white",
    ring: "ring-green-200",
    iconBg: "bg-gradient-to-br from-green-500 to-emerald-600",
    iconText: "text-white",
    accent: "text-emerald-700",
    icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  },
  pesin: {
    label: "Peşin Satış",
    description: "Peşin satılan dosyaların toplam cirosu",
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
    description: "Banka hesabına EFT/Havale ile gelen tutarlar",
    bg: "from-amber-50 via-orange-50 to-white",
    ring: "ring-amber-200",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    iconText: "text-white",
    accent: "text-amber-700",
    icon: "M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
  },
};

export default function KasaPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [firmaCariFiles, setFirmaCariFiles] = useState<FirmaCariFile[]>([]);
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterRange, setFilterRange] = useState<"today" | "week" | "month" | "all">("all");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("nakit");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [paymentsRes, firmaRes] = await Promise.all([
        supabase
          .from("payments")
          .select(
            "*, visa_files(musteri_ad, hedef_ulke, cari_tipi, company_id), profiles:created_by(name)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("visa_files")
          .select("*, profiles:assigned_user_id(name)")
          .eq("cari_tipi", "firma_cari")
          .order("created_at", { ascending: false }),
      ]);
      setPayments((paymentsRes.data as PaymentRow[]) || []);
      setFirmaCariFiles((firmaRes.data as FirmaCariFile[]) || []);
      setLoading(false);
    }
    load();
  }, []);

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
      .forEach((p) => {
        const baseRow: DisplayRow = {
          id: p.id,
          musteri_ad: p.visa_files?.musteri_ad || "—",
          hedef_ulke: p.visa_files?.hedef_ulke || "—",
          tutar: Number(p.tutar) || 0,
          currency: p.currency || "TL",
          yontem: p.yontem,
          payment_type: p.payment_type,
          personel: p.profiles?.name || "—",
          created_at: p.created_at,
          badge: p.payment_type === "pesin_satis" ? "Peşin" : "Tahsilat",
        };

        // Yöntem bazında: nakit / hesaba_eft
        if (p.yontem === "nakit") addRow("nakit", baseRow);
        else if (p.yontem === "hesaba") addRow("hesaba_eft", baseRow);

        // Plan bazında: peşin satışlar
        if (p.payment_type === "pesin_satis") addRow("pesin", baseRow);
      });

    // Firma cari dosyaları (ayrı kayıt; payments tablosu yerine dosyanın kendisi)
    firmaCariFiles
      .filter((f) => dateFilterFn(f.created_at))
      .forEach((f) => {
        const row: DisplayRow = {
          id: `firma_${f.id}`,
          musteri_ad: f.musteri_ad,
          hedef_ulke: f.hedef_ulke,
          tutar: getFileTotal(f),
          currency: f.ucret_currency || "TL",
          yontem: "firma_cari",
          payment_type: "firma_cari",
          personel: f.profiles?.name || "—",
          created_at: f.created_at,
          badge: "Firma Cari",
        };
        addRow("firma_cari", row);
      });

    // Sıralama
    (Object.keys(data) as CategoryKey[]).forEach((k) => {
      data[k].rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return data;
  }, [payments, firmaCariFiles, dateFilterFn, filterCurrency]);

  // Toplam ciro (tüm kategoriler birleştirildiğinde para birimi başına; nakit + hesaba + firma_cari kullanıyoruz, peşin sadece görsel için)
  const grandTotals = useMemo(() => {
    const g: Totals = {};
    const add = (totals: Totals) => {
      Object.entries(totals).forEach(([c, v]) => {
        g[c] = (g[c] || 0) + v;
      });
    };
    add(categoryData.nakit.totals);
    add(categoryData.hesaba_eft.totals);
    add(categoryData.firma_cari.totals);
    return g;
  }, [categoryData]);

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
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Kasa</h1>
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
              Nakit + Hesaba + Cari Firma toplamı
            </h2>
            <p className="mt-1.5 text-white/60 text-sm">Seçili tarih aralığında biriken tüm kasa tutarı</p>
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
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
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
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Müşteri</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Ülke</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tutar</th>
                  <th className="text-center py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tip</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Personel</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {active.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{r.musteri_ad}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{r.hedef_ulke}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {fmtCur(r.tutar, r.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          r.payment_type === "pesin_satis"
                            ? "bg-sky-50 text-sky-700"
                            : r.payment_type === "firma_cari"
                            ? "bg-fuchsia-50 text-fuchsia-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {r.badge}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">{r.personel}</td>
                    <td className="py-3 px-4 text-right text-[11.5px] font-semibold text-slate-500">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
