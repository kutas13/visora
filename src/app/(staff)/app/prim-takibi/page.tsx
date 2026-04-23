"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select, Modal } from "@/components/ui";
import type { VisaFile, CommissionRate } from "@/lib/supabase/types";

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
  return d.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const i = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[i] || m} ${y}`;
}

function getPrimDate(f: VisaFile): string | null {
  return (f.prim_tarihi as any) || f.sonuc_tarihi;
}

function formatMoney(n: number, currency: "EUR" | "USD" | "TL") {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "₺";
  return `${symbol}${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "TL", label: "TL" },
];

export default function PrimTakibiPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [myName, setMyName] = useState<string>("");
  const [myId, setMyId] = useState<string>("");

  const [files, setFiles] = useState<VisaFile[]>([]);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [fx, setFx] = useState<{ USD: number; EUR: number; TL: number } | null>(null);
  const [fxUpdate, setFxUpdate] = useState<string>("");

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const [showRatesModal, setShowRatesModal] = useState(false);
  const [rateDraft, setRateDraft] = useState<{ country: string; amount: string; currency: "EUR" | "USD" | "TL" }>({
    country: "",
    amount: "",
    currency: "EUR",
  });

  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [editingDate, setEditingDate] = useState<string>("");

  // Yetkilendirme
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

  // Veri yükle — sadece KENDİ dosyaları + paylaşılan oranlar + kur
  const loadData = useCallback(async () => {
    if (!authorized || !myId) return;
    const supabase = createClient();

    const [{ data: filesData }, { data: ratesData }] = await Promise.all([
      supabase
        .from("visa_files")
        .select("*")
        .eq("assigned_user_id", myId)
        .eq("sonuc", "vize_onay")
        .not("sonuc_tarihi", "is", null),
      supabase
        .from("commission_rates")
        .select("*")
        .order("country", { ascending: true }),
    ]);

    setFiles((filesData || []) as VisaFile[]);
    setRates((ratesData || []) as CommissionRate[]);

    try {
      const r = await fetch("/api/exchange-rates");
      const d = await r.json();
      if (d?.rates) setFx(d.rates);
      if (d?.lastUpdate) setFxUpdate(d.lastUpdate);
    } catch {
      // ignore
    }

    setLoading(false);
  }, [authorized, myId]);

  useEffect(() => { loadData(); }, [loadData]);

  const rateByCountry = useMemo(() => {
    const m = new Map<string, CommissionRate>();
    for (const r of rates) m.set(r.country, r);
    return m;
  }, [rates]);

  const missingCountries = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      if (!f.hedef_ulke) continue;
      if (!rateByCountry.has(f.hedef_ulke)) set.add(f.hedef_ulke);
    }
    return Array.from(set).sort();
  }, [files, rateByCountry]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      const d = getPrimDate(f);
      if (d) set.add(monthKey(d));
    }
    set.add(currentMonthKey);
    return Array.from(set).sort().reverse();
  }, [files, currentMonthKey]);

  const monthFiles = useMemo(() => {
    if (selectedMonth === "all") return files;
    return files.filter(f => {
      const d = getPrimDate(f);
      return d ? monthKey(d) === selectedMonth : false;
    });
  }, [files, selectedMonth]);

  const monthEntries = useMemo(() => {
    return monthFiles
      .map(f => {
        const rate = rateByCountry.get(f.hedef_ulke);
        return {
          file: f,
          rate,
          country: f.hedef_ulke,
          primDate: getPrimDate(f)!,
          amount: rate ? Number(rate.amount) : 0,
          currency: (rate?.currency || "EUR") as "EUR" | "USD" | "TL",
          hasRate: !!rate,
        };
      })
      .sort((a, b) => (a.primDate > b.primDate ? -1 : 1));
  }, [monthFiles, rateByCountry]);

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
      eur, usd, tl,
      eurTl, usdTl,
      grandTl: eurTl + usdTl + tl,
      approved: monthEntries.length,
    };
  }, [monthEntries, fx]);

  // Actions
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

  const openEditDate = (f: VisaFile) => {
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

  const resetPrimDate = async (f: VisaFile) => {
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

  // Render guards
  if (authorized === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-navy-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-14 h-14 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4.15a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-navy-900">Erişim yetkiniz yok</h2>
        <p className="text-sm text-navy-500">Prim Takibi sayfası sadece yetkili personele açıktır.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-navy-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-navy-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Finans · {myName}</p>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Prim Takibi</h1>
          <p className="mt-0.5 text-sm text-navy-500">
            {selectedMonth === "all" ? "Tüm aylar" : monthLabel(selectedMonth)} · {totals.approved} onaylı dosya
          </p>
        </div>

        <div className="flex items-center gap-2">
          {fx && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="px-2.5 py-1.5 rounded-md bg-navy-50 border border-navy-200">
                <span className="text-navy-500 font-semibold">USD</span>
                <span className="ml-1.5 font-bold text-navy-900 tabular-nums">₺{fx.USD.toFixed(2)}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-navy-50 border border-navy-200">
                <span className="text-navy-500 font-semibold">EUR</span>
                <span className="ml-1.5 font-bold text-navy-900 tabular-nums">₺{fx.EUR.toFixed(2)}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowRatesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white hover:bg-navy-50 text-navy-700 text-xs font-semibold border border-navy-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Ülke & Oranlar
            {missingCountries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {missingCountries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Ay seçici */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSelectedMonth("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            selectedMonth === "all"
              ? "bg-navy-900 text-white"
              : "bg-white text-navy-600 border border-navy-200 hover:bg-navy-50"
          }`}
        >
          Tümü
        </button>
        {monthOptions.map(k => (
          <button
            key={k}
            onClick={() => setSelectedMonth(k)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              selectedMonth === k
                ? "bg-navy-900 text-white"
                : "bg-white text-navy-600 border border-navy-200 hover:bg-navy-50"
            }`}
          >
            {monthLabel(k)}
          </button>
        ))}
      </div>

      {/* KPI kartları — sade, profesyonel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-navy-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">Onaylı Dosya</p>
            <svg className="w-4 h-4 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 tabular-nums">{totals.approved}</p>
        </div>

        <div className="rounded-lg border border-navy-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">EUR</p>
            <span className="text-navy-400 font-bold">€</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 tabular-nums">
            €{totals.eur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-0.5 text-xs text-navy-500 tabular-nums">
            ≈ ₺{totals.eurTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="rounded-lg border border-navy-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">USD</p>
            <span className="text-navy-400 font-bold">$</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 tabular-nums">
            ${totals.usd.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-0.5 text-xs text-navy-500 tabular-nums">
            ≈ ₺{totals.usdTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="rounded-lg border-2 border-navy-900 bg-navy-900 text-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-300">Toplam (₺)</p>
            <span className="text-navy-300 font-bold">₺</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            ₺{totals.grandTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-0.5 text-[11px] text-navy-400">
            {totals.tl > 0 ? `İçinde ₺${totals.tl.toFixed(0)} TL prim` : "EUR + USD TL karşılığı"}
          </p>
        </div>
      </div>

      {/* Kur bilgisi */}
      {fxUpdate && (
        <p className="text-[11px] text-navy-400">
          Kur: TCMB · {fxUpdate} · USD ₺{fx?.USD.toFixed(2)} · EUR ₺{fx?.EUR.toFixed(2)}
        </p>
      )}

      {/* Eksik ülkeler uyarısı */}
      {missingCountries.length > 0 && (
        <div className="rounded-lg p-3 bg-amber-50 border border-amber-300 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4.15a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Oran tanımsız ülkeler</p>
            <p className="text-xs text-amber-700 mt-0.5">Bu dosyalar için prim 0 olarak hesaplanır. Aşağıdakilere tıklayarak ekleyebilirsin.</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {missingCountries.map(c => (
                <button
                  key={c}
                  onClick={() => { setRateDraft({ country: c, amount: "", currency: "EUR" }); setShowRatesModal(true); }}
                  className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
                >
                  + {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div className="rounded-lg border border-navy-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-navy-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Prim Kayıtları</h2>
          <span className="text-xs text-navy-500">{monthEntries.length} kayıt</span>
        </div>

        {monthEntries.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 mx-auto text-navy-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm text-navy-500">Bu ayda prim kaydı yok.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-navy-500 bg-navy-50 border-b border-navy-200">
                  <th className="px-4 py-2.5">Müşteri</th>
                  <th className="px-4 py-2.5">Ülke</th>
                  <th className="px-4 py-2.5">Sonuç Tarihi</th>
                  <th className="px-4 py-2.5">Prim Tarihi</th>
                  <th className="px-4 py-2.5 text-right">Tutar</th>
                  <th className="px-4 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {monthEntries.map((e) => {
                  const isOverridden = !!e.file.prim_tarihi;
                  return (
                    <tr key={e.file.id} className="border-b border-navy-100 hover:bg-navy-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-navy-900">{e.file.musteri_ad}</p>
                        <p className="text-[11px] text-navy-500 font-mono">{e.file.pasaport_no}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          e.hasRate ? "bg-navy-100 text-navy-700" : "bg-rose-100 text-rose-700"
                        }`}>
                          {e.country}
                          {!e.hasRate && " · oran yok"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy-600 text-xs tabular-nums">{formatDateTR(e.file.sonuc_tarihi)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs tabular-nums ${isOverridden ? "text-primary-700 font-semibold" : "text-navy-700"}`}>
                          {formatDateTR(e.primDate)}
                          {isOverridden && <span className="ml-1 text-[10px] text-primary-500">(taşındı)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-navy-900 tabular-nums">
                        {e.hasRate ? formatMoney(e.amount, e.currency) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => openEditDate(e.file)}
                            className="px-2 py-1 rounded text-[11px] font-semibold text-navy-600 hover:text-navy-900 hover:bg-navy-100 transition-colors"
                            title="Prim tarihini değiştir"
                          >
                            Tarih
                          </button>
                          {isOverridden && (
                            <button
                              onClick={() => resetPrimDate(e.file)}
                              className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
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

      {/* Ülke & Oranlar modal */}
      <Modal isOpen={showRatesModal} onClose={() => setShowRatesModal(false)} title="Ülke & Prim Oranları">
        <div className="space-y-4">
          <div className="rounded-lg border border-navy-200 bg-navy-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-500 mb-2">Ülke ekle / güncelle</p>
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
                  options={CURRENCY_OPTIONS}
                  value={rateDraft.currency}
                  onChange={(e) => setRateDraft({ ...rateDraft, currency: e.target.value as any })}
                />
              </div>
              <div className="col-span-12 sm:col-span-2">
                <Button onClick={saveRate} className="w-full">Kaydet</Button>
              </div>
            </div>
            <p className="text-[11px] text-navy-500 mt-2">
              Bir ülke eklendiğinde/değiştirildiğinde <b>tüm personelde</b> aynı oran geçerli olur.
            </p>
          </div>

          <div className="rounded-lg border border-navy-200 bg-white max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-navy-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-navy-500">
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
                    <td className="px-3 py-2 text-navy-700 font-mono text-xs">{r.currency}</td>
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

      {/* Prim tarihi düzenleme */}
      <Modal isOpen={!!editingFile} onClose={() => setEditingFile(null)} title="Prim Tarihini Değiştir">
        {editingFile && (
          <div className="space-y-4">
            <div className="rounded-lg bg-navy-50 p-3 border border-navy-200">
              <p className="text-xs text-navy-500">Müşteri</p>
              <p className="font-semibold text-navy-900">{editingFile.musteri_ad} — {editingFile.hedef_ulke}</p>
              <p className="text-[11px] text-navy-500 mt-1">
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
