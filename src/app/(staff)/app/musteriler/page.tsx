"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, ParaBirimi, VizeSonucu } from "@/lib/supabase/types";

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
  lastSonuc: VizeSonucu | null;
  lastSonucTarihi: string | null;
  lastUcret: number;
  lastUcretCurrency: ParaBirimi;
  lastUpdatedAt: string | null;
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

function formatCurrency(amount: number, cur: ParaBirimi) {
  const n = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(amount);
  return `${n} ${cur}`;
}

function sonucLabel(s: VizeSonucu | null) {
  if (s === "vize_onay") return "Vize onayı";
  if (s === "red") return "Red";
  return "Sonuç bekleniyor";
}

function CustomerFlipCard({
  c,
  flipped,
  onToggleFlip,
}: {
  c: Customer;
  flipped: boolean;
  onToggleFlip: () => void;
}) {
  const router = useRouter();
  const initial = c.musteri_ad.charAt(0).toUpperCase();
  const isReturning = c.fileCount > 1;
  const detailHref = `/app/musteriler/${encodeURIComponent(c.pasaport_no)}`;

  const successBarClass =
    c.successRate >= 70 ? "bg-emerald-500" :
    c.successRate >= 40 ? "bg-navy-500" :
    "bg-rose-500";

  const openDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(detailHref);
    },
    [router, detailHref]
  );

  return (
    <div
      className="[perspective:1200px] group/card w-full min-h-[400px]"
      role="region"
      aria-label={`Müşteri: ${c.musteri_ad}`}
    >
      <div
        className={`relative h-full min-h-[400px] w-full transition-transform duration-700 ease-out [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Ön yüz */}
        <button
          type="button"
          onClick={onToggleFlip}
          className="absolute inset-0 flex h-full min-h-[400px] w-full flex-col rounded-2xl border border-navy-200/80 bg-white p-5 text-left shadow-sm transition-all [backface-visibility:hidden] hover:border-navy-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2"
        >
          {isReturning && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-navy-200 bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-800">
              <svg className="h-3 w-3 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Tekrarlayan
            </span>
          )}
          <div className="flex items-center gap-3 pr-20">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 text-lg font-bold text-white shadow-md ring-1 ring-navy-700/30">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold text-navy-900">{c.musteri_ad}</h3>
              <p className="font-mono text-xs text-navy-500">{c.pasaport_no}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-navy-100 bg-navy-50/80 p-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy-500">Dosya</p>
              <p className="text-lg font-bold text-navy-900">{c.fileCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Onay</p>
              <p className="text-lg font-bold text-emerald-800">{c.approved}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Red</p>
              <p className="text-lg font-bold text-rose-800">{c.rejected}</p>
            </div>
          </div>

          {c.approved + c.rejected > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-navy-500">Başarı oranı</span>
                <span className="font-bold text-navy-900">{c.successRate.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
                <div className={`h-full rounded-full transition-all ${successBarClass}`} style={{ width: `${c.successRate}%` }} />
              </div>
            </div>
          )}

          <div className="mt-auto space-y-1 border-t border-navy-100 pt-3 text-[11px] text-navy-500">
            <div className="flex items-center justify-between">
              <span>Son dosya</span>
              <span className="font-semibold text-navy-700">{formatDate(c.lastDate)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Son ülke</span>
              <span className="max-w-[140px] truncate font-semibold text-navy-700">{c.lastCountry || "—"}</span>
            </div>
            {c.telefon && (
              <div className="flex items-center justify-between gap-2">
                <span>Telefon</span>
                <span className="truncate font-mono text-[10px] font-semibold text-navy-700">{c.telefon}</span>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-[10px] font-medium text-navy-400">
            Kartı çevirmek için dokunun
          </p>
        </button>

        {/* Arka yüz */}
        <div className="absolute inset-0 flex min-h-[400px] flex-col rounded-2xl border border-navy-600 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 p-5 text-white shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy-300">Son işlem</p>
              <p className="mt-1 truncate text-lg font-bold">{c.musteri_ad}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFlip();
              }}
              className="shrink-0 rounded-lg border border-white/15 bg-white/5 p-1.5 text-navy-200 transition hover:bg-white/10 hover:text-white"
              aria-label="Kartı geri çevir"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <dl className="mt-4 space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-navy-300">Ülke</dt>
              <dd className="max-w-[55%] truncate text-right font-semibold">{c.lastCountry || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-navy-300">Dosya tarihi</dt>
              <dd className="font-semibold">{formatDate(c.lastDate)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-navy-300">Sonuç</dt>
              <dd
                className={`font-semibold ${
                  c.lastSonuc === "vize_onay"
                    ? "text-emerald-300"
                    : c.lastSonuc === "red"
                      ? "text-rose-300"
                      : "text-navy-100"
                }`}
              >
                {sonucLabel(c.lastSonuc)}
              </dd>
            </div>
            {c.lastSonucTarihi && (
              <div className="flex justify-between gap-2">
                <dt className="text-navy-300">Sonuç tarihi</dt>
                <dd className="font-semibold">{formatDate(c.lastSonucTarihi)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-navy-300">Ücret</dt>
              <dd className="font-mono text-xs font-semibold">{formatCurrency(c.lastUcret, c.lastUcretCurrency)}</dd>
            </div>
            {c.lastUpdatedAt && (
              <div className="flex justify-between gap-2 border-t border-white/10 pt-2">
                <dt className="text-navy-300">Güncellendi</dt>
                <dd className="text-xs font-medium text-navy-200">{formatDate(c.lastUpdatedAt)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="button"
              onClick={openDetail}
              className="w-full rounded-xl bg-white py-2.5 text-center text-sm font-bold text-navy-900 shadow-md transition hover:bg-navy-50"
            >
              Detay gör
            </button>
            <p className="text-center text-[10px] text-navy-400">360° kart — Visora</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MusterilerPage() {
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "count" | "name">("recent");
  const [filterStatus, setFilterStatus] = useState<"all" | "multi" | "approved" | "rejected">("all");
  const [flippedPasaport, setFlippedPasaport] = useState<string | null>(null);

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
          lastSonuc: null,
          lastSonucTarihi: null,
          lastUcret: 0,
          lastUcretCurrency: "TL",
          lastUpdatedAt: null,
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
        c.lastSonuc = f.sonuc;
        c.lastSonucTarihi = f.sonuc_tarihi;
        c.lastUcret = Number(f.ucret || 0);
        c.lastUcretCurrency = f.ucret_currency || "TL";
        c.lastUpdatedAt = f.updated_at;
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

  const toggleFlip = useCallback((pasaport: string) => {
    setFlippedPasaport((prev) => (prev === pasaport ? null : pasaport));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-navy-200 border-t-navy-700" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-navy-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-navy-300/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Hero — navy ağırlıklı, turuncu gradyan yok */}
        <div className="overflow-hidden rounded-3xl border border-navy-200 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 shadow-xl shadow-navy-900/20">
          <div className="relative p-6 sm:p-8 text-white">
            <div className="absolute inset-0 opacity-40">
              <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-40 w-64 rounded-full bg-navy-500/30 blur-2xl" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-navy-100">
                  <svg className="h-3.5 w-3.5 text-white/90" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Müşteri CRM
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Müşterilerim</h1>
                <p className="mt-2 text-sm text-navy-200 sm:text-base">
                  Pasaport bazlı kayıtlar, özet istatistikler ve detay için kartı çevirin.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {[
                  { k: "Müşteri", v: stats.total },
                  { k: "Tekrarlayan", v: stats.returning },
                  { k: "Onay var", v: stats.approved },
                  { k: "Dosya", v: stats.totalFiles },
                ].map((s) => (
                  <div
                    key={s.k}
                    className="min-w-[76px] rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-center backdrop-blur-sm"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy-200">{s.k}</p>
                    <p className="text-xl font-bold tabular-nums">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, pasaport no veya telefon ara..."
              className="w-full rounded-xl border border-navy-200 bg-white py-2.5 pl-10 pr-4 text-sm text-navy-900 shadow-sm focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-700/20"
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-navy-200 bg-navy-50/80 p-1">
            {[
              { v: "all", l: "Tümü" },
              { v: "multi", l: "Tekrarlayan" },
              { v: "approved", l: "Onaylı" },
              { v: "rejected", l: "Reddedilen" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setFilterStatus(o.v as typeof filterStatus)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  filterStatus === o.v
                    ? "bg-navy-900 text-white shadow-sm"
                    : "text-navy-600 hover:bg-white hover:text-navy-900"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-xl border border-navy-200 bg-navy-50/80 p-1">
            {[
              { v: "recent", l: "Son" },
              { v: "count", l: "Dosya" },
              { v: "name", l: "A-Z" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setSortBy(o.v as typeof sortBy)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  sortBy === o.v
                    ? "border border-navy-300 bg-white text-navy-900 shadow-sm"
                    : "text-navy-600 hover:bg-white"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-navy-200 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-100">
              <svg className="h-8 w-8 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-navy-600">Henüz müşteri yok veya aramaya uygun sonuç bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <CustomerFlipCard
                key={c.pasaport_no}
                c={c}
                flipped={flippedPasaport === c.pasaport_no}
                onToggleFlip={() => toggleFlip(c.pasaport_no)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
