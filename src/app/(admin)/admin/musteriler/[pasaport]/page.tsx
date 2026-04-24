"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FileDetailModal from "@/components/files/FileDetailModal";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "id" | "name"> | null };

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(n: number, c?: string) {
  const sym = c === "EUR" ? "€" : c === "USD" ? "$" : "₺";
  return `${sym}${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
}

export default function AdminMusteriDetayPage() {
  const params = useParams();
  const router = useRouter();
  const pasaportNo = decodeURIComponent(String(params.pasaport || "")).toUpperCase();

  const [files, setFiles] = useState<VisaFileWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!pasaportNo) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(id, name)")
        .ilike("pasaport_no", pasaportNo)
        .order("created_at", { ascending: false });
      setFiles((data as VisaFileWithProfile[] | null) || []);
      setLoading(false);
    })();
  }, [pasaportNo]);

  const latest = files[0];

  const stats = useMemo(() => {
    const approved = files.filter((f) => f.sonuc === "vize_onay").length;
    const rejected = files.filter((f) => f.sonuc === "red").length;
    const pending = files.length - approved - rejected;
    const decided = approved + rejected;
    const successRate = decided > 0 ? (approved / decided) * 100 : 0;

    const countryMap = new Map<string, number>();
    for (const f of files) {
      if (!f.hedef_ulke) continue;
      countryMap.set(f.hedef_ulke, (countryMap.get(f.hedef_ulke) || 0) + 1);
    }
    const topCountry = Array.from(countryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const totalsByCurrency = new Map<string, number>();
    for (const f of files) {
      const cur = f.ucret_currency || "TL";
      totalsByCurrency.set(cur, (totalsByCurrency.get(cur) || 0) + Number(f.ucret || 0));
    }
    const totalEntries = Array.from(totalsByCurrency.entries())
      .filter(([, v]) => v > 0)
      .map(([currency, amount]) => ({ currency, amount }));

    const staffSet = new Set<string>();
    for (const f of files) {
      if (f.profiles?.name) staffSet.add(f.profiles.name);
    }

    return {
      approved,
      rejected,
      pending,
      successRate,
      topCountry,
      totalEntries,
      staffList: Array.from(staffSet),
    };
  }, [files]);

  const timeline = useMemo(() => {
    const events: { date: string; file: VisaFileWithProfile; label: string; color: string; staff: string | null }[] = [];
    for (const f of files) {
      const staff = f.profiles?.name || null;
      events.push({ date: f.created_at, file: f, label: "Dosya oluşturuldu", color: "bg-blue-500", staff });
      if (f.basvuru_yapildi_at)
        events.push({ date: f.basvuru_yapildi_at, file: f, label: "Başvuru yapıldı", color: "bg-purple-500", staff });
      if (f.sonuc && f.sonuc_tarihi)
        events.push({
          date: f.sonuc_tarihi,
          file: f,
          label: f.sonuc === "vize_onay" ? "Vize onaylandı" : "Vize reddedildi",
          color: f.sonuc === "vize_onay" ? "bg-emerald-500" : "bg-rose-500",
          staff,
        });
    }
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  }, [files]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-navy-900">Müşteri bulunamadı</h2>
        <button onClick={() => router.back()} className="text-sm text-primary-600 font-semibold hover:underline">
          Geri dön
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/admin/musteriler"
        className="inline-flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Müşterilere dön
      </Link>

      {/* HERO */}
      <div className="rounded-3xl overflow-hidden border border-navy-200 bg-gradient-to-br from-navy-900 via-indigo-900 to-fuchsia-900 shadow-2xl">
        <div className="relative p-6 sm:p-8 text-white">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_70%_20%,rgba(251,146,60,0.35),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.35),transparent_45%)]" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-fuchsia-500 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-fuchsia-500/30">
              {latest.musteri_ad.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{latest.musteri_ad}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur font-mono">
                  {pasaportNo}
                </span>
                {latest.musteri_telefon && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    {latest.musteri_telefon}
                  </span>
                )}
                {files.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[11px] font-black uppercase tracking-wider shadow">
                    Tekrarlayan müşteri
                  </span>
                )}
                {stats.staffList.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur text-[11px] font-semibold"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Toplam Dosya</p>
              <p className="text-2xl font-black">{files.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-400/20 backdrop-blur border border-emerald-300/30 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Onay</p>
              <p className="text-2xl font-black">{stats.approved}</p>
            </div>
            <div className="rounded-xl bg-rose-400/20 backdrop-blur border border-rose-300/30 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Red</p>
              <p className="text-2xl font-black">{stats.rejected}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Başarı</p>
              <p className="text-2xl font-black">{stats.successRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ana grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dosyalar */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-navy-500 px-1">
            Vize Dosyaları ({files.length})
          </h2>
          {files.map((f) => {
            const statusLabel =
              f.sonuc === "vize_onay"
                ? "Onaylandı"
                : f.sonuc === "red"
                  ? "Reddedildi"
                  : f.islemden_cikti
                    ? "İşlemden Çıktı"
                    : f.basvuru_yapildi
                      ? "Başvuru Yapıldı"
                      : f.dosya_hazir
                        ? "Dosya Hazır"
                        : "Açık";
            const statusColor =
              f.sonuc === "vize_onay"
                ? "bg-emerald-100 text-emerald-700"
                : f.sonuc === "red"
                  ? "bg-rose-100 text-rose-700"
                  : f.basvuru_yapildi
                    ? "bg-purple-100 text-purple-700"
                    : f.dosya_hazir
                      ? "bg-blue-100 text-blue-700"
                      : "bg-navy-100 text-navy-700";
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setDetailFileId(f.id)}
                className="w-full text-left block rounded-2xl border border-navy-200 bg-white p-4 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/10 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-navy-900 group-hover:text-primary-600 transition-colors">
                        {f.hedef_ulke || "-"}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusColor}`}>
                        {statusLabel}
                      </span>
                      {f.profiles?.name && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {f.profiles.name}
                        </span>
                      )}
                      {f.eski_pasaport && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                          Eski pasaport
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-500">
                      <span>
                        Oluşturuldu: <b className="text-navy-700">{formatDate(f.created_at)}</b>
                      </span>
                      {f.randevu_tarihi && (
                        <span>
                          Randevu: <b className="text-navy-700">{formatDate(f.randevu_tarihi)}</b>
                        </span>
                      )}
                      {f.sonuc_tarihi && (
                        <span>
                          Sonuç: <b className="text-navy-700">{formatDate(f.sonuc_tarihi)}</b>
                        </span>
                      )}
                      {f.vize_bitis_tarihi && (
                        <span>
                          Vize bitiş: <b className="text-navy-700">{formatDate(f.vize_bitis_tarihi)}</b>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-navy-400">Ücret</p>
                    <p className="font-black text-navy-900 tabular-nums">
                      {formatMoney(Number(f.ucret || 0), f.ucret_currency)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Yan panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-navy-200 bg-white p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-navy-500">Özet</h3>
            <div className="mt-3 space-y-2.5 text-sm">
              {stats.topCountry && (
                <div className="flex items-center justify-between">
                  <span className="text-navy-500">En çok gittiği</span>
                  <span className="font-bold text-navy-900">{stats.topCountry}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-navy-500">İlk dosya</span>
                <span className="font-bold text-navy-900">
                  {formatDate(files[files.length - 1].created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-navy-500">Son dosya</span>
                <span className="font-bold text-navy-900">{formatDate(latest.created_at)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-navy-500">Toplam ücret</span>
                <span className="text-right font-bold text-navy-900 tabular-nums">
                  {stats.totalEntries.length === 0 ? (
                    "-"
                  ) : (
                    stats.totalEntries.map((t, i) => (
                      <span key={t.currency} className={i > 0 ? "block" : undefined}>
                        {formatMoney(t.amount, t.currency)}
                      </span>
                    ))
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-navy-500">İlgilenen</span>
                <span className="font-bold text-navy-900 text-right">
                  {stats.staffList.length > 0 ? stats.staffList.join(", ") : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-navy-200 bg-white p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-navy-500">Geçmiş</h3>
            <div className="mt-3 space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {timeline.map((ev, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full ${ev.color} mt-1.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-navy-900">{ev.label}</p>
                    <p className="text-[11px] text-navy-500">
                      {ev.file.hedef_ulke} · {formatDate(ev.date)}
                      {ev.staff && ` · ${ev.staff}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FileDetailModal
        fileId={detailFileId}
        isOpen={!!detailFileId}
        onClose={() => setDetailFileId(null)}
        scrollToHistoryOnOpen
        title="Dosya ve işlem geçmişi"
      />
    </div>
  );
}
