"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select, Modal } from "@/components/ui";
import type { VisaFile, Profile, CommissionRate } from "@/lib/supabase/types";

type StaffMini = Pick<Profile, "id" | "name">;

type FileWithProfile = VisaFile & { profiles: StaffMini | null };

// Sadece bu 3 kişi görebilir
const ALLOWED_NAMES = ["BAHAR", "ERCAN", "YUSUF"];

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatDateTR(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function monthKey(d: string) {
  // "YYYY-MM"
  return d.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const i = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[i] || m} ${y}`;
}

// Prim tarihi = prim_tarihi override varsa o, yoksa sonuc_tarihi
function getPrimDate(f: FileWithProfile): string | null {
  return (f.prim_tarihi as any) || f.sonuc_tarihi;
}

function formatMoney(n: number, currency: "EUR" | "USD" | "TL") {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "₺";
  return `${symbol}${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PrimTakibiPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [myName, setMyName] = useState<string>("");
  const [myId, setMyId] = useState<string>("");

  const [files, setFiles] = useState<FileWithProfile[]>([]);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [fx, setFx] = useState<{ USD: number; EUR: number; TL: number } | null>(null);
  const [fxUpdate, setFxUpdate] = useState<string>("");

  // Seçili ay (YYYY-MM, "all" da olabilir)
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Ülkeler modal
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [rateDraft, setRateDraft] = useState<{ country: string; amount: string; currency: "EUR" | "USD" | "TL" }>({
    country: "",
    amount: "",
    currency: "EUR",
  });

  // Prim tarihi düzenleme modal
  const [editingFile, setEditingFile] = useState<FileWithProfile | null>(null);
  const [editingDate, setEditingDate] = useState<string>("");

  // ───────────────────────────────────────────
  // Yetkilendirme
  // ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();

      if (!profile || !ALLOWED_NAMES.includes(profile.name)) {
        setAuthorized(false);
        return;
      }
      setMyName(profile.name);
      setMyId(profile.id);
      setAuthorized(true);
    })();
  }, [router]);

  // ───────────────────────────────────────────
  // Veri yükle
  // ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!authorized) return;
    const supabase = createClient();

    const [{ data: filesData }, { data: ratesData }] = await Promise.all([
      supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(id, name)")
        .eq("sonuc", "vize_onay")
        .not("sonuc_tarihi", "is", null),
      supabase
        .from("commission_rates")
        .select("*")
        .order("country", { ascending: true }),
    ]);

    setFiles((filesData || []) as FileWithProfile[]);
    setRates((ratesData || []) as CommissionRate[]);

    // FX
    try {
      const r = await fetch("/api/exchange-rates");
      const d = await r.json();
      if (d?.rates) setFx(d.rates);
      if (d?.lastUpdate) setFxUpdate(d.lastUpdate);
    } catch {
      // ignore
    }

    setLoading(false);
  }, [authorized]);

  useEffect(() => { loadData(); }, [loadData]);

  // ───────────────────────────────────────────
  // Lookups
  // ───────────────────────────────────────────
  const rateByCountry = useMemo(() => {
    const m = new Map<string, CommissionRate>();
    for (const r of rates) m.set(r.country, r);
    return m;
  }, [rates]);

  // Dosyaların içinde görünen ama henüz oranı tanımlı olmayan ülkeler
  const missingCountries = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      if (!f.hedef_ulke) continue;
      if (!rateByCountry.has(f.hedef_ulke)) set.add(f.hedef_ulke);
    }
    return Array.from(set).sort();
  }, [files, rateByCountry]);

  // ───────────────────────────────────────────
  // Ay seçenekleri
  // ───────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      const d = getPrimDate(f);
      if (d) set.add(monthKey(d));
    }
    set.add(currentMonthKey);
    const arr = Array.from(set).sort().reverse();
    return arr;
  }, [files, currentMonthKey]);

  // ───────────────────────────────────────────
  // Seçili ayın verisi
  // ───────────────────────────────────────────
  const monthFiles = useMemo(() => {
    if (selectedMonth === "all") return files;
    return files.filter(f => {
      const d = getPrimDate(f);
      return d ? monthKey(d) === selectedMonth : false;
    });
  }, [files, selectedMonth]);

  // Bu ayki prim kayıtları (sadece BAHAR/ERCAN/YUSUF — diğer personel ve admin hariç)
  const monthEntries = useMemo(() => {
    return monthFiles
      .filter(f => f.profiles && ALLOWED_NAMES.includes(f.profiles.name))
      .map(f => {
        const rate = rateByCountry.get(f.hedef_ulke);
        return {
          file: f,
          rate,
          staffName: f.profiles?.name || "?",
          country: f.hedef_ulke,
          primDate: getPrimDate(f)!,
          amount: rate ? Number(rate.amount) : 0,
          currency: (rate?.currency || "EUR") as "EUR" | "USD" | "TL",
          hasRate: !!rate,
        };
      })
      .sort((a, b) => (a.primDate > b.primDate ? -1 : 1));
  }, [monthFiles, rateByCountry]);

  // Personel kırılımı
  const staffSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; approved: number; eur: number; usd: number; tl: number }>();
    for (const name of ALLOWED_NAMES) {
      map.set(name, { name, count: 0, approved: 0, eur: 0, usd: 0, tl: 0 });
    }
    for (const e of monthEntries) {
      const s = map.get(e.staffName);
      if (!s) continue;
      s.count += 1;
      s.approved += 1;
      if (e.currency === "EUR") s.eur += e.amount;
      else if (e.currency === "USD") s.usd += e.amount;
      else s.tl += e.amount;
    }
    return Array.from(map.values());
  }, [monthEntries]);

  // Benim özetim
  const myRow = staffSummary.find(s => s.name === myName);

  // Toplamlar (seçili ay)
  const totals = useMemo(() => {
    let eur = 0, usd = 0, tl = 0;
    for (const e of monthEntries) {
      if (e.currency === "EUR") eur += e.amount;
      else if (e.currency === "USD") usd += e.amount;
      else tl += e.amount;
    }
    const eurTl = fx ? eur * fx.EUR : 0;
    const usdTl = fx ? usd * fx.USD : 0;
    return {
      eur,
      usd,
      tl,
      eurTl,
      usdTl,
      grandTl: eurTl + usdTl + tl,
    };
  }, [monthEntries, fx]);

  // Ayın personeli
  const topStaff = useMemo(() => {
    const withValues = staffSummary.map(s => ({
      ...s,
      totalTl: (fx ? s.eur * fx.EUR + s.usd * fx.USD : 0) + s.tl,
    }));
    withValues.sort((a, b) => b.totalTl - a.totalTl || b.count - a.count);
    if (withValues.length === 0 || (withValues[0].count === 0 && withValues[0].totalTl === 0)) return null;
    return withValues[0];
  }, [staffSummary, fx]);

  // ───────────────────────────────────────────
  // Actions: ülke oranı kaydet/sil
  // ───────────────────────────────────────────
  const saveRate = async () => {
    const country = rateDraft.country.trim();
    const amount = parseFloat(rateDraft.amount.replace(",", "."));
    if (!country || isNaN(amount) || amount < 0) {
      alert("Ülke ve geçerli bir tutar girin.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("commission_rates")
      .upsert(
        { country, amount, currency: rateDraft.currency, updated_by: myId, updated_at: new Date().toISOString() },
        { onConflict: "country" }
      );
    if (error) {
      alert("Kaydedilemedi: " + error.message);
      return;
    }
    setRateDraft({ country: "", amount: "", currency: "EUR" });
    await loadData();
  };

  const deleteRate = async (id: string) => {
    if (!confirm("Bu ülke oranı silinsin mi?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("commission_rates").delete().eq("id", id);
    if (error) {
      alert("Silinemedi: " + error.message);
      return;
    }
    await loadData();
  };

  // ───────────────────────────────────────────
  // Actions: prim tarihi düzenle
  // ───────────────────────────────────────────
  const openEditDate = (f: FileWithProfile) => {
    setEditingFile(f);
    const d = getPrimDate(f);
    setEditingDate(d ? d.slice(0, 10) : new Date().toISOString().slice(0, 10));
  };

  const saveEditDate = async () => {
    if (!editingFile) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("visa_files")
      .update({ prim_tarihi: editingDate || null } as any)
      .eq("id", editingFile.id);
    if (error) {
      alert("Kaydedilemedi: " + error.message);
      return;
    }
    setEditingFile(null);
    await loadData();
  };

  const resetPrimDate = async (f: FileWithProfile) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("visa_files")
      .update({ prim_tarihi: null } as any)
      .eq("id", f.id);
    if (error) {
      alert("Sıfırlanamadı: " + error.message);
      return;
    }
    await loadData();
  };

  // ───────────────────────────────────────────
  // Render guards
  // ───────────────────────────────────────────
  if (authorized === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 text-rose-600 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4.15a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" /></svg>
        </div>
        <h2 className="text-xl font-bold text-navy-900">Bu sayfaya erişim yetkiniz yok</h2>
        <p className="text-sm text-navy-500">Prim Takibi sayfası sadece yetkili personele açıktır.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Gradient arka plan */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0b1120] via-[#0f172a] to-[#1e1b4b]" />
      <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.25),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(251,146,60,0.25),transparent_55%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* HERO */}
        <div className="rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <div className="relative p-6 sm:p-8 bg-gradient-to-br from-indigo-600/20 via-fuchsia-600/10 to-amber-500/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 text-[11px] font-bold uppercase tracking-widest border border-amber-300/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                  Prim Takibi
                </div>
                <h1 className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Merhaba <span className="bg-gradient-to-r from-amber-300 to-fuchsia-300 bg-clip-text text-transparent">{myName}</span>
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Aylık performansın, prim tutarların ve takım karnesi.
                </p>
              </div>

              {/* Kurlar */}
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">USD</span>
                    <span className="text-sm font-black text-white tabular-nums">{fx ? `₺${fx.USD.toFixed(2)}` : "-"}</span>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">EUR</span>
                    <span className="text-sm font-black text-white tabular-nums">{fx ? `₺${fx.EUR.toFixed(2)}` : "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ay seçici + ülkeler butonu */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedMonth("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedMonth === "all"
                    ? "bg-white text-navy-900 shadow-lg"
                    : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
                }`}
              >
                Tümü
              </button>
              {monthOptions.map(k => (
                <button
                  key={k}
                  onClick={() => setSelectedMonth(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedMonth === k
                      ? "bg-gradient-to-r from-amber-400 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {monthLabel(k)}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={() => setShowRatesModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/15 backdrop-blur transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Ülke & Oran
                {missingCountries.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black text-white">
                    {missingCountries.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* KPI KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* EUR */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-blue-500/15 to-indigo-600/10 border border-blue-400/20 backdrop-blur-xl overflow-hidden group">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-blue-400/20 blur-2xl group-hover:bg-blue-400/30 transition-all" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Kazanç (EUR)</span>
                <div className="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center text-blue-200">€</div>
              </div>
              <p className="mt-3 text-3xl font-black text-white tabular-nums">
                €{totals.eur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-blue-200/80">
                ≈ ₺{totals.eurTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* USD */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-emerald-500/15 to-green-600/10 border border-emerald-400/20 backdrop-blur-xl overflow-hidden group">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-emerald-400/20 blur-2xl group-hover:bg-emerald-400/30 transition-all" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Kazanç (USD)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-400/20 flex items-center justify-center text-emerald-200">$</div>
              </div>
              <p className="mt-3 text-3xl font-black text-white tabular-nums">
                ${totals.usd.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-emerald-200/80">
                ≈ ₺{totals.usdTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* TL (direkt tl olarak girilen oranlar) */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-amber-500/15 to-orange-600/10 border border-amber-400/20 backdrop-blur-xl overflow-hidden group">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-amber-400/20 blur-2xl group-hover:bg-amber-400/30 transition-all" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Kazanç (TL Doğrudan)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center text-amber-200">₺</div>
              </div>
              <p className="mt-3 text-3xl font-black text-white tabular-nums">
                ₺{totals.tl.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-amber-200/80">Doğrudan TL olarak girilen</p>
            </div>
          </div>

          {/* TOPLAM TL */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-fuchsia-500/20 to-rose-600/15 border border-fuchsia-400/30 backdrop-blur-xl overflow-hidden group shadow-xl shadow-fuchsia-600/10">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-fuchsia-400/25 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-200">Toplam (TL)</span>
                <div className="w-8 h-8 rounded-lg bg-fuchsia-400/20 flex items-center justify-center text-fuchsia-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-black text-white tabular-nums">
                ₺{totals.grandTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-fuchsia-200/80">
                EUR+USD+TL toplamı • {fxUpdate ? `Kur: ${fxUpdate}` : "Kur güncel"}
              </p>
            </div>
          </div>
        </div>

        {/* BEN + TAKIM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Benim kartım */}
          <div className="lg:col-span-1 rounded-2xl p-5 bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bu ay — {myName}</span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-fuchsia-500 flex items-center justify-center text-white font-black text-sm shadow-lg">
                {myName.charAt(0)}
              </div>
            </div>
            <p className="mt-4 text-4xl font-black text-white tabular-nums">
              {myRow?.count || 0}
              <span className="ml-1 text-base font-bold text-slate-400">dosya</span>
            </p>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">EUR kazancım</span>
                <span className="font-bold text-white tabular-nums">€{(myRow?.eur || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">USD kazancım</span>
                <span className="font-bold text-white tabular-nums">${(myRow?.usd || 0).toFixed(2)}</span>
              </div>
              {myRow && myRow.tl > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">TL kazancım</span>
                  <span className="font-bold text-white tabular-nums">₺{myRow.tl.toFixed(0)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Toplam (₺)</span>
                <span className="font-black text-lg text-amber-300 tabular-nums">
                  ₺{(((myRow?.eur || 0) * (fx?.EUR || 0)) + ((myRow?.usd || 0) * (fx?.USD || 0)) + (myRow?.tl || 0)).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {/* Takım karnesi */}
          <div className="lg:col-span-2 rounded-2xl p-5 bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Takım karnesi</span>
              {topStaff && topStaff.totalTl > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/30">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  Ayın personeli: {topStaff.name}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {staffSummary.map((s) => {
                const totalTl = (s.eur * (fx?.EUR || 0)) + (s.usd * (fx?.USD || 0)) + s.tl;
                const maxTl = Math.max(...staffSummary.map(x => (x.eur * (fx?.EUR || 0)) + (x.usd * (fx?.USD || 0)) + x.tl), 1);
                const pct = (totalTl / maxTl) * 100;
                const isMe = s.name === myName;
                return (
                  <div key={s.name} className={`p-3 rounded-xl border transition-all ${isMe ? "bg-amber-400/10 border-amber-400/30" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shadow-md ${
                          isMe ? "bg-gradient-to-br from-amber-400 to-fuchsia-500" : "bg-gradient-to-br from-slate-500 to-slate-700"
                        }`}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{s.name}{isMe && <span className="ml-1 text-[10px] text-amber-300">(sen)</span>}</p>
                          <p className="text-[11px] text-slate-400">{s.count} dosya · €{s.eur.toFixed(0)} · ${s.usd.toFixed(0)}{s.tl>0 ? ` · ₺${s.tl.toFixed(0)}` : ""}</p>
                        </div>
                      </div>
                      <span className="font-black text-white tabular-nums text-sm shrink-0">
                        ₺{totalTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isMe ? "bg-gradient-to-r from-amber-400 to-fuchsia-500" : "bg-gradient-to-r from-slate-400 to-slate-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MISSING RATES UYARI */}
        {missingCountries.length > 0 && (
          <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-400/30 backdrop-blur flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4.15a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Bazı ülkeler için prim oranı tanımlı değil</p>
              <p className="text-xs text-rose-200/90 mt-0.5">Bu dosyalar için kazanç 0 gözükür. Ülke & Oran'dan ekleyebilirsin.</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {missingCountries.map(c => (
                  <button
                    key={c}
                    onClick={() => { setRateDraft({ country: c, amount: "", currency: "EUR" }); setShowRatesModal(true); }}
                    className="px-2 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-100 text-[11px] font-semibold hover:bg-rose-500/30 transition-colors"
                  >
                    + {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KAYITLAR TABLOSU */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Prim Kayıtları</h2>
              <p className="text-xs text-slate-400">{monthEntries.length} kayıt · {selectedMonth === "all" ? "Tüm aylar" : monthLabel(selectedMonth)}</p>
            </div>
          </div>

          {monthEntries.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-block w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-sm text-slate-400">Bu ayda prim kaydı yok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <th className="px-4 py-3">Personel</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Ülke</th>
                    <th className="px-4 py-3">Sonuç Tarihi</th>
                    <th className="px-4 py-3">Prim Tarihi</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                    <th className="px-4 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {monthEntries.map((e) => {
                    const isOverridden = !!e.file.prim_tarihi;
                    return (
                      <tr key={e.file.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-black text-[11px] shadow">
                              {e.staffName.charAt(0)}
                            </div>
                            <span className="text-white font-semibold text-xs">{e.staffName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{e.file.musteri_ad}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            e.hasRate ? "bg-indigo-500/20 text-indigo-200" : "bg-rose-500/20 text-rose-200"
                          }`}>
                            {e.country}
                            {!e.hasRate && " · oran yok"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{formatDateTR(e.file.sonuc_tarihi)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs tabular-nums ${isOverridden ? "text-amber-300 font-bold" : "text-slate-300"}`}>
                            {formatDateTR(e.primDate)}
                            {isOverridden && <span className="ml-1 text-[10px] text-amber-400">(taşındı)</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-white tabular-nums">
                          {e.hasRate ? formatMoney(e.amount, e.currency) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => openEditDate(e.file)}
                              className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold border border-white/10"
                              title="Prim tarihini değiştir"
                            >
                              Tarih
                            </button>
                            {isOverridden && (
                              <button
                                onClick={() => resetPrimDate(e.file)}
                                className="px-2 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-semibold border border-rose-400/20"
                                title="Override'ı sıfırla"
                              >
                                Sıfırla
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ÜLKE & ORAN MODAL */}
      <Modal isOpen={showRatesModal} onClose={() => setShowRatesModal(false)} title="Ülke & Prim Oranları">
        <div className="space-y-4">
          <div className="rounded-xl border border-navy-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-navy-500 mb-2">Yeni ülke ekle / güncelle</p>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-5">
                <Input
                  placeholder="Ülke adı (örn. İngiltere)"
                  value={rateDraft.country}
                  onChange={(e) => setRateDraft({ ...rateDraft, country: e.target.value })}
                />
              </div>
              <div className="col-span-7 sm:col-span-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Tutar"
                  value={rateDraft.amount}
                  onChange={(e) => setRateDraft({ ...rateDraft, amount: e.target.value })}
                />
              </div>
              <div className="col-span-5 sm:col-span-2">
                <Select
                  value={rateDraft.currency}
                  onChange={(e) => setRateDraft({ ...rateDraft, currency: e.target.value as any })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="TL">TL</option>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-2">
                <Button onClick={saveRate} className="w-full">Kaydet</Button>
              </div>
            </div>
            <p className="text-[11px] text-navy-400 mt-2">Bir ülke eklendiğinde/değiştirildiğinde <b>tüm personelde</b> aynı oran geçerli olur.</p>
          </div>

          <div className="rounded-xl border border-navy-200 bg-white max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-navy-50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-navy-500">
                  <th className="px-3 py-2">Ülke</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                  <th className="px-3 py-2">Birim</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-navy-400 text-xs">Henüz ülke oranı yok.</td></tr>
                )}
                {rates.map(r => (
                  <tr key={r.id} className="border-t border-navy-100 hover:bg-navy-50/50">
                    <td className="px-3 py-2 text-navy-900 font-semibold">{r.country}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy-900">{Number(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-navy-700">{r.currency}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setRateDraft({ country: r.country, amount: String(r.amount), currency: r.currency })}
                          className="px-2 py-1 text-[11px] font-semibold text-primary-600 hover:bg-primary-50 rounded"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => deleteRate(r.id)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* PRIM TARİHİ DÜZENLEME MODAL */}
      <Modal isOpen={!!editingFile} onClose={() => setEditingFile(null)} title="Prim Tarihini Değiştir">
        {editingFile && (
          <div className="space-y-4">
            <div className="rounded-lg bg-navy-50 p-3 border border-navy-200">
              <p className="text-xs text-navy-500">Müşteri</p>
              <p className="font-bold text-navy-900">{editingFile.musteri_ad} — {editingFile.hedef_ulke}</p>
              <p className="text-[11px] text-navy-400 mt-1">
                Dosyanın sonuç tarihi: {formatDateTR(editingFile.sonuc_tarihi)}
              </p>
            </div>
            <Input
              label="Prim Tarihi (hangi aya gitsin)"
              type="date"
              value={editingDate}
              onChange={(e) => setEditingDate(e.target.value)}
            />
            <p className="text-[11px] text-navy-500">
              Dosya farklı bir ayda çıkmış olsa bile, bu tarihi değiştirerek prim raporunu istediğin aya taşıyabilirsin.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditingFile(null)}>İptal</Button>
              <Button onClick={saveEditDate}>Kaydet</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
