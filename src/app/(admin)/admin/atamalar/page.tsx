"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAFF_USERS } from "@/lib/constants";
import type { IdataAssignment, IdataAssignmentDurum } from "@/lib/supabase/types";

const CHECK_INTERVAL = 5 * 60; // 5 dakika (saniye)

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getAccountName(email: string) {
  const user = STAFF_USERS.find((u) => u.email === email);
  return user?.name || email;
}

function getRemainingTime(sonKayit: string | null): { text: string; urgent: boolean } | null {
  if (!sonKayit) return null;
  const now = new Date();
  const deadline = new Date(sonKayit);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return { text: "Süre doldu!", urgent: true };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { text: `${days}g ${hours % 24}s kaldı`, urgent: days < 2 };
  }
  return { text: `${hours}s ${mins}dk kaldı`, urgent: hours < 6 };
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AdminAtamalarPage() {
  const [assignments, setAssignments] = useState<IdataAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterDurum, setFilterDurum] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [countdown, setCountdown] = useState(CHECK_INTERVAL);
  const countdownRef = useRef(CHECK_INTERVAL);
  const [lastServerCheck, setLastServerCheck] = useState<number>(Date.now());

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("idata_assignments")
      .select("*")
      .order("created_at", { ascending: false });
    setAssignments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    
    // Son email check zamanını al
    const fetchLastCheck = async () => {
      try {
        const res = await fetch("/api/idata/last-check");
        if (res.ok) {
          const data = await res.json();
          const timeSinceLastCheck = Math.floor((Date.now() - data.lastCheckTime) / 1000);
          const remainingTime = Math.max(0, CHECK_INTERVAL - timeSinceLastCheck);
          countdownRef.current = remainingTime;
          setCountdown(remainingTime);
          setLastServerCheck(data.lastCheckTime);
        }
      } catch (err) {
        console.log("Son check zamanı alınamadı, varsayılan timer başlatılıyor");
      }
    };
    
    fetchLastCheck();
  }, [loadData]);

  const handleCheckEmails = useCallback(async (silent = false) => {
    setChecking(true);
    if (!silent) setCheckResult(null);
    try {
      const res = await fetch("/api/cron/check-emails", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        if (!silent || json.totalNew > 0) {
          setCheckResult(
            `${json.totalNew} yeni atama bulundu (${json.totalChecked} mail kontrol edildi)` +
              (json.errors?.length ? ` | Hatalar: ${json.errors.join(", ")}` : "")
          );
        }
        loadData();
      } else if (!silent) {
        setCheckResult(`Hata: ${json.error || "Bilinmeyen hata"}`);
      }
    } catch {
      if (!silent) setCheckResult("Bağlantı hatası oluştu");
    } finally {
      setChecking(false);
      
      // Server'a son check zamanını bildir
      try {
        await fetch("/api/idata/last-check", { method: "POST" });
      } catch {}
      
      // Timer'ı sıfırla
      countdownRef.current = CHECK_INTERVAL;
      setCountdown(CHECK_INTERVAL);
      setLastServerCheck(Date.now());
    }
  }, [loadData]);

  // Canli geri sayim + otomatik kontrol
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        handleCheckEmails(true);
      } else {
        setCountdown(countdownRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [handleCheckEmails]);

  const handleUpdateDurum = async (id: string, durum: IdataAssignmentDurum) => {
    const supabase = createClient();
    await supabase.from("idata_assignments").update({ durum }).eq("id", id);
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, durum } : a))
    );
  };

  const accountOptions = [
    { value: "all", label: "Tüm Hesaplar" },
    ...STAFF_USERS.map((u) => ({ value: u.email, label: `${u.name} (${u.email})` })),
  ];

  const durumOptions = [
    { value: "all", label: "Tümü" },
    { value: "yeni", label: "Yeni" },
    { value: "randevu_geldi", label: "Randevu Geldi" },
    { value: "randevu_alindi", label: "Randevu Alındı" },
    { value: "iptal", label: "İptal" },
    { value: "suresi_doldu", label: "Süresi Doldu" },
  ];

  const filtered = assignments.filter((a) => {
    if (filterAccount !== "all" && a.email_hesabi !== filterAccount) return false;
    if (filterDurum !== "all" && a.durum !== filterDurum) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const name = (a.musteri_ad || "").toLowerCase();
      const pnr = (a.pnr || "").toLowerCase();
      if (!name.includes(q) && !pnr.includes(q)) return false;
    }
    return true;
  });

  const yeniCount = assignments.filter((a) => a.durum === "yeni").length;
  const toplam = assignments.length;
  const randevuAlindiCount = assignments.filter((a) => a.durum === "randevu_alindi").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl animate-pulse">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const countdownPct = ((CHECK_INTERVAL - countdown) / CHECK_INTERVAL) * 100;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">iDATA Atamaları</h1>
            <p className="text-slate-500 text-sm">Email hesaplarından gelen randevu atamaları</p>
          </div>
        </div>
        <button
          onClick={() => handleCheckEmails(false)}
          disabled={checking}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-all disabled:opacity-50"
        >
          {checking ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          )}
          Şimdi Kontrol Et
        </button>
      </div>

      {/* Stats + Countdown Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {yeniCount > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{yeniCount}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">Yeni</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{randevuAlindiCount}</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">Alındı</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{toplam}</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">Toplam</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${checking ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
              <span className="text-xs text-slate-500 font-medium">
                {checking ? "Kontrol ediliyor..." : "Sonraki kontrol"}
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-slate-700">{formatCountdown(countdown)}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${countdownPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Check Result */}
      {checkResult && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-sm font-medium animate-in fade-in duration-300 ${
          checkResult.includes("Hata") || checkResult.includes("hata")
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            checkResult.includes("Hata") ? "bg-red-100" : "bg-emerald-100"
          }`}>
            {checkResult.includes("Hata") ? "!" : "✓"}
          </div>
          {checkResult}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="İsim veya PNR ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-3 h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all w-full sm:w-56" />
        </div>
        <div className="flex-1">
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          >
            {accountOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {durumOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => setFilterDurum(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterDurum === o.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1.5">Atama Bulunamadı</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">Henüz iDATA ataması yok veya filtrelere uygun kayıt bulunamadı.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((a) => {
            const remaining = a.durum === "yeni" ? getRemainingTime(a.son_kayit_tarihi) : null;
            const isNew = a.durum === "yeni";
            const isRandevuGeldi = a.durum === "randevu_geldi"; 
            const isDone = a.durum === "randevu_alindi";
            const isCancelled = a.durum === "iptal";

            return (
              <div
                key={a.id}
                className={`group bg-white rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden ${
                  isNew ? "border-amber-200/80" : isDone ? "border-emerald-200/80" : isCancelled ? "border-red-200/80" : "border-slate-200"
                }`}
              >
                {/* Color accent bar */}
                <div className={`h-1 ${
                  isNew ? "bg-gradient-to-r from-amber-400 to-orange-400" :
                  isDone ? "bg-gradient-to-r from-emerald-400 to-teal-400" :
                  isCancelled ? "bg-gradient-to-r from-red-400 to-rose-400" :
                  "bg-gradient-to-r from-slate-300 to-slate-400"
                }`} />

                <div className="p-5">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg ${
                        isNew ? "bg-gradient-to-br from-amber-500 to-orange-600" :
                        isDone ? "bg-gradient-to-br from-emerald-500 to-teal-600" :
                        "bg-gradient-to-br from-violet-500 to-indigo-600"
                      }`}>
                        {a.musteri_ad.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-base leading-tight">{a.musteri_ad}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs font-mono bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded">{a.pnr}</code>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{getAccountName(a.email_hesabi)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        isNew ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        isRandevuGeldi ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        isDone ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        isCancelled ? "bg-red-50 text-red-700 border border-red-200" :
                        "bg-slate-50 text-slate-600 border border-slate-200"
                      }`}>
                        {isNew ? "Yeni" : isRandevuGeldi ? "Randevu Geldi" : isDone ? "Randevu Alındı" : isCancelled ? "İptal" : "Süresi Doldu"}
                      </span>
                      {remaining && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          remaining.urgent ? "bg-red-100 text-red-700 animate-pulse" : "bg-blue-50 text-blue-600"
                        }`}>
                          {remaining.text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Ülke / Amaç</p>
                      <p className="text-sm font-semibold text-slate-700">{a.ulke_amac || "-"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Ofis</p>
                      <p className="text-sm font-semibold text-slate-700">{a.ofis || "-"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Randevu</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {a.randevu_baslangic && a.randevu_bitis
                          ? `${formatDate(a.randevu_baslangic)} - ${formatDate(a.randevu_bitis)}`
                          : "-"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Son Kayıt</p>
                      <p className="text-sm font-semibold text-slate-700">{formatDateTime(a.son_kayit_tarihi)}</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{formatDateTime(a.created_at)}</span>
                      {a.whatsapp_bildirim && (
                        <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                          WP
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {(isNew || isRandevuGeldi) && (
                        <>
                          <button
                            onClick={() => handleUpdateDurum(a.id, "randevu_alindi")}
                            className="text-xs font-semibold px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm"
                          >
                            ✓ Randevu Onaylandı
                          </button>
                          <button
                            onClick={() => handleUpdateDurum(a.id, "iptal")}
                            className="text-xs font-semibold px-3.5 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                          >
                            İptal
                          </button>
                        </>
                      )}
                      {(isDone || isCancelled) && (
                        <button
                          onClick={() => handleUpdateDurum(a.id, "yeni")}
                          className="text-xs font-medium px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          Geri Al
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
