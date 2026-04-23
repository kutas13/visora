"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";

type Customer = {
  pasaport_no: string;
  musteri_ad: string;
  telefon: string | null;
  fileCount: number;
  approved: number;
  rejected: number;
  pending: number;
  lastDate: string | null;
  lastCountry: string | null;
  countries: string[];
  totalUcret: number;
  successRate: number;
};

function norm(s: string) {
  return s.toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/İ/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .trim();
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MusterilerPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "count" | "name">("recent");
  const [filterStatus, setFilterStatus] = useState<"all" | "multi" | "approved" | "rejected">("all");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("visa_files")
        .select("*")
        .eq("assigned_user_id", user.id)
        .order("created_at", { ascending: false });
      setFiles(data || []);
      setLoading(false);
    })();
  }, []);

  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();
    for (const f of files) {
      if (!f.pasaport_no) continue;
      const key = f.pasaport_no.trim().toUpperCase();
      let c = map.get(key);
      if (!c) {
        c = {
          pasaport_no: key,
          musteri_ad: f.musteri_ad,
          telefon: f.musteri_telefon,
          fileCount: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          lastDate: null,
          lastCountry: null,
          countries: [],
          totalUcret: 0,
          successRate: 0,
        };
        map.set(key, c);
      }
      c.fileCount += 1;
      if (f.sonuc === "vize_onay") c.approved += 1;
      else if (f.sonuc === "red") c.rejected += 1;
      else c.pending += 1;

      const d = f.created_at;
      if (!c.lastDate || d > c.lastDate) {
        c.lastDate = d;
        c.lastCountry = f.hedef_ulke;
        c.musteri_ad = f.musteri_ad;
        if (f.musteri_telefon) c.telefon = f.musteri_telefon;
      }
      if (f.hedef_ulke && !c.countries.includes(f.hedef_ulke)) {
        c.countries.push(f.hedef_ulke);
      }
      c.totalUcret += Number(f.ucret || 0);
    }
    const arr = Array.from(map.values());
    for (const c of arr) {
      const decided = c.approved + c.rejected;
      c.successRate = decided > 0 ? (c.approved / decided) * 100 : 0;
    }
    return arr;
  }, [files]);

  const filtered = useMemo(() => {
    let result = customers;
    if (filterStatus === "multi") result = result.filter(c => c.fileCount > 1);
    else if (filterStatus === "approved") result = result.filter(c => c.approved > 0);
    else if (filterStatus === "rejected") result = result.filter(c => c.rejected > 0);

    if (search.trim().length >= 2) {
      const term = norm(search.trim());
      result = result.filter(c =>
        norm(c.musteri_ad).includes(term) ||
        norm(c.pasaport_no).includes(term) ||
        (c.telefon && c.telefon.includes(term))
      );
    }

    const sorted = [...result];
    if (sortBy === "recent") {
      sorted.sort((a, b) => (a.lastDate && b.lastDate ? (b.lastDate.localeCompare(a.lastDate)) : 0));
    } else if (sortBy === "count") {
      sorted.sort((a, b) => b.fileCount - a.fileCount);
    } else {
      sorted.sort((a, b) => a.musteri_ad.localeCompare(b.musteri_ad, "tr"));
    }
    return sorted;
  }, [customers, search, filterStatus, sortBy]);

  const stats = useMemo(() => ({
    total: customers.length,
    returning: customers.filter(c => c.fileCount > 1).length,
    approved: customers.filter(c => c.approved > 0).length,
    totalFiles: files.length,
  }), [customers, files]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* HERO */}
      <div className="rounded-3xl overflow-hidden border border-navy-200 bg-gradient-to-br from-primary-500 via-primary-400 to-amber-400 shadow-xl">
        <div className="relative p-6 sm:p-8 text-white">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.4),transparent_50%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-widest">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                Müşteri CRM
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Müşterilerim</h1>
              <p className="mt-1 text-white/80 text-sm">Tüm müşterilerin geçmişi, onay oranları ve notları tek yerde.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <div className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-center min-w-[70px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Müşteri</p>
                <p className="text-xl font-black">{stats.total}</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-center min-w-[70px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Tekrarlayan</p>
                <p className="text-xl font-black">{stats.returning}</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-center min-w-[70px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Onay Var</p>
                <p className="text-xl font-black">{stats.approved}</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-center min-w-[70px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Dosya</p>
                <p className="text-xl font-black">{stats.totalFiles}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTRELER */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="w-4 h-4 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, pasaport no veya telefon ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-navy-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-navy-50 border border-navy-200">
          {[
            { v: "all", l: "Tümü" },
            { v: "multi", l: "Tekrarlayan" },
            { v: "approved", l: "Onaylı" },
            { v: "rejected", l: "Reddedilen" },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setFilterStatus(o.v as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === o.v ? "bg-white text-primary-600 shadow-sm" : "text-navy-500 hover:text-navy-700"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-navy-50 border border-navy-200">
          {[
            { v: "recent", l: "Son" },
            { v: "count", l: "Dosya" },
            { v: "name", l: "A-Z" },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setSortBy(o.v as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sortBy === o.v ? "bg-white text-primary-600 shadow-sm" : "text-navy-500 hover:text-navy-700"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* LISTE */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-block w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-navy-500 text-sm">Henüz müşteri yok veya aramaya uygun sonuç bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const initial = c.musteri_ad.charAt(0).toUpperCase();
            const isReturning = c.fileCount > 1;
            return (
              <Link
                key={c.pasaport_no}
                href={`/app/musteriler/${encodeURIComponent(c.pasaport_no)}`}
                className="group relative rounded-2xl p-5 bg-white border border-navy-200 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/10 transition-all"
              >
                {isReturning && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    Tekrarlayan
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-amber-500 flex items-center justify-center text-white font-black text-lg shadow-lg">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-navy-900 truncate group-hover:text-primary-600 transition-colors">
                      {c.musteri_ad}
                    </h3>
                    <p className="text-xs text-navy-500 font-mono">{c.pasaport_no}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-navy-50 p-2 text-center">
                    <p className="text-[10px] font-bold uppercase text-navy-400 tracking-wider">Dosya</p>
                    <p className="text-lg font-black text-navy-900">{c.fileCount}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-center">
                    <p className="text-[10px] font-bold uppercase text-emerald-500 tracking-wider">Onay</p>
                    <p className="text-lg font-black text-emerald-700">{c.approved}</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-2 text-center">
                    <p className="text-[10px] font-bold uppercase text-rose-500 tracking-wider">Red</p>
                    <p className="text-lg font-black text-rose-700">{c.rejected}</p>
                  </div>
                </div>

                {c.approved + c.rejected > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-navy-500 font-semibold">Başarı</span>
                      <span className="text-navy-900 font-black">{c.successRate.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-navy-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.successRate >= 70 ? "bg-gradient-to-r from-emerald-400 to-green-500" :
                          c.successRate >= 40 ? "bg-gradient-to-r from-amber-400 to-orange-500" :
                          "bg-gradient-to-r from-rose-400 to-red-500"
                        }`}
                        style={{ width: `${c.successRate}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-navy-100 text-[11px] text-navy-500 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Son dosya</span>
                    <span className="font-semibold text-navy-700">{formatDate(c.lastDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Son ülke</span>
                    <span className="font-semibold text-navy-700 truncate max-w-[140px]">{c.lastCountry || "-"}</span>
                  </div>
                  {c.telefon && (
                    <div className="flex items-center justify-between">
                      <span>Telefon</span>
                      <span className="font-semibold text-navy-700">{c.telefon}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
