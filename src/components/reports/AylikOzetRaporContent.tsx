"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MonthlySummary } from "@/lib/reports/buildMonthlySummary";
import { sumStaffBuckets } from "@/lib/reports/buildMonthlySummary";

// Visora: rapor erisimi role tabanli (admin/muhasebe/staff/platform_owner).
// Eski sabit isim listesi kaldirildi.
const ALLOWED_ROLES = ["admin", "muhasebe", "platform_owner", "staff"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtMoney(r: MonthlySummary["overall"]["revenue"]) {
  const parts: string[] = [];
  if (r.TL) parts.push(`${r.TL.toLocaleString("tr-TR")} TL`);
  if (r.EUR) parts.push(`${r.EUR.toLocaleString("tr-TR")} EUR`);
  if (r.USD) parts.push(`${r.USD.toLocaleString("tr-TR")} USD`);
  return parts.length ? parts.join(" · ") : "0";
}

type Props = { loginRedirectPath: string };

export default function AylikOzetRaporContent({ loginRedirectPath }: Props) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [reportMode, setReportMode] = useState<"org" | "staff" | null>(null);
  const [rawCount, setRawCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(loginRedirectPath);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", user.id)
        .single();
      const role = (profile?.role || "") as (typeof ALLOWED_ROLES)[number];
      if (!ALLOWED_ROLES.includes(role)) {
        setAllowed(false);
        return;
      }
      setViewerName(profile?.name || "");
      setAllowed(true);
    })();
  }, [router, loginRedirectPath]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/monthly-summary?year=${year}&month=${month}`, {
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Yükleme hatası");
        setSummary(null);
        return;
      }
      setSummary(j.summary as MonthlySummary);
      setRawCount(j.rawCount ?? 0);
      setReportMode(j.mode === "org" ? "org" : "staff");
    } catch {
      setError("Bağlantı hatası");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const downloadPdf = () => {
    window.location.href = `/api/reports/monthly-summary-pdf?year=${year}&month=${month}`;
  };

  if (allowed === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-navy-900">Erişim yok</h1>
        <p className="mt-2 text-sm text-navy-600">
          Bu sayfaya yalnızca Genel Müdür, Muhasebe ve atama yapılmış Personel
          erişebilir. Yetkiniz bulunmuyorsa lütfen şirket yöneticinizle
          iletişime geçin.
        </p>
      </div>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 8 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* PAGE HEADER */}
      <div className="flex items-start gap-4">
        <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Analiz</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Aylık Vize Özeti</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Görünüm: <span className="font-bold text-indigo-600">{viewerName}</span> · {viewerName === "DAVUT"
              ? "Tüm personelin birleşik özeti."
              : "Yalnızca size atanmış dosyalar."} Veri: seçilen ayda sonuç tarihi bulunan onaylı / reddedilen dosyalar.
          </p>
        </div>
      </div>

      {/* HERO BANNER */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950" />
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-indigo-500 blur-3xl animate-blob" />
          <div className="absolute -bottom-16 -right-10 w-72 h-72 rounded-full bg-fuchsia-500 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        </div>
        <div className="relative p-6 sm:p-7 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Aylık Rapor
          </div>
          <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-indigo-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">{viewerName}</span> · özet rapor
          </h2>
          <p className="mt-1.5 text-white/70 text-sm max-w-2xl">
            {viewerName === "DAVUT"
              ? "Tüm personelin birleşik özeti. PDF tüm ekibi ve personel tablosu altında toplamları içerir."
              : "Yalnızca size atanmış dosyalar. PDF dosya adı: ADINIZ + AY + AYLIK ÖZET."}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-navy-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-navy-500">Yıl</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-900"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500">Ay</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-900"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {pad2(m)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-navy-300 bg-navy-50 px-4 py-2 text-sm font-bold text-navy-800 hover:bg-navy-100 disabled:opacity-50"
        >
          {loading ? "Yükleniyor…" : "Yenile"}
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          className="ml-auto rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-white shadow hover:bg-navy-950"
        >
          PDF indir
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Sonuçlanan dosya", v: String(summary.overall.total) },
              { t: "Onay oranı", v: `${summary.overall.approvalRatePct.toFixed(1)}%` },
              {
                t: "Ort. süre (gün)",
                v: summary.overall.avgDaysToResult != null ? String(summary.overall.avgDaysToResult) : "—",
              },
              { t: "Sonuçlanan (bu rapor)", v: String(rawCount) },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-navy-500">{x.t}</p>
                <p className="mt-1 text-2xl font-bold text-navy-900">{x.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-navy-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Ciro (ücret toplamları)</p>
            <p className="mt-2 text-lg font-bold text-navy-900">{fmtMoney(summary.overall.revenue)}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-navy-200 bg-white shadow-sm">
            <div className="border-b border-navy-100 bg-navy-50 px-4 py-3">
              <h2 className="font-bold text-navy-900">Ülke bazlı</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-navy-100 text-xs uppercase text-navy-500">
                    <th className="px-4 py-2">Ülke</th>
                    <th className="px-4 py-2 text-right">Dosya</th>
                    <th className="px-4 py-2 text-right">Onay</th>
                    <th className="px-4 py-2 text-right">Red</th>
                    <th className="px-4 py-2 text-right">Onay %</th>
                    <th className="px-4 py-2 text-right">Ort. gün</th>
                    <th className="px-4 py-2">Ciro</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCountry.map((r) => (
                    <tr key={r.key} className="border-b border-navy-50 hover:bg-navy-50/50">
                      <td className="px-4 py-2 font-medium text-navy-900">{r.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{r.approved}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-rose-700">{r.rejected}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.approvalRatePct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.avgDaysToResult != null ? r.avgDaysToResult : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-navy-600">{fmtMoney(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-navy-200 bg-white shadow-sm">
            <div className="border-b border-navy-100 bg-navy-50 px-4 py-3">
              <h2 className="font-bold text-navy-900">
                {reportMode === "staff" ? "Sizin performansınız" : "Personel bazlı"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-navy-100 text-xs uppercase text-navy-500">
                    <th className="px-4 py-2">Personel</th>
                    <th className="px-4 py-2 text-right">Dosya</th>
                    <th className="px-4 py-2 text-right">Onay</th>
                    <th className="px-4 py-2 text-right">Red</th>
                    <th className="px-4 py-2 text-right">Onay %</th>
                    <th className="px-4 py-2 text-right">Ort. gün</th>
                    <th className="px-4 py-2">Ciro</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byStaff.map((r) => (
                    <tr key={r.staffId} className="border-b border-navy-50 hover:bg-navy-50/50">
                      <td className="px-4 py-2 font-medium text-navy-900">{r.staffName}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{r.approved}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-rose-700">{r.rejected}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.approvalRatePct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.avgDaysToResult != null ? r.avgDaysToResult : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-navy-600">{fmtMoney(r.revenue)}</td>
                    </tr>
                  ))}
                  {reportMode === "org" && summary.byStaff.length > 0 && (() => {
                    const t = sumStaffBuckets(summary.byStaff);
                    return (
                      <tr className="border-t-2 border-navy-300 bg-navy-100/80 font-bold">
                        <td className="px-4 py-2 text-navy-900">TOPLAM</td>
                        <td className="px-4 py-2 text-right tabular-nums">{t.total}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-800">{t.approved}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-800">{t.rejected}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{t.approvalRatePct.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {t.avgDaysToResult != null ? t.avgDaysToResult : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-navy-800">{fmtMoney(t.revenue)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
