"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";

type Row = Pick<
  VisaFile,
  | "id"
  | "musteri_ad"
  | "pasaport_no"
  | "hedef_ulke"
  | "takip_no"
  | "dogum_tarihi"
  | "randevu_tarihi"
  | "basvuru_yapildi"
  | "basvuru_yapildi_at"
  | "islemden_cikti"
  | "created_at"
>;

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/İ/gi, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c");
}

export default function StaffVizeSonucTakipPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("visa_files")
      .select(
        "id, musteri_ad, pasaport_no, hedef_ulke, takip_no, dogum_tarihi, randevu_tarihi, basvuru_yapildi, basvuru_yapildi_at, islemden_cikti, created_at"
      )
      .eq("assigned_user_id", user.id)
      .eq("basvuru_yapildi", true)
      .eq("islemden_cikti", false)
      .eq("arsiv_mi", false)
      .order("basvuru_yapildi_at", { ascending: false });

    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.hedef_ulke) set.add(r.hedef_ulke);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterCountry !== "all") list = list.filter((r) => r.hedef_ulke === filterCountry);
    if (search.trim()) {
      const q = norm(search.trim());
      list = list.filter(
        (r) =>
          norm(r.musteri_ad || "").includes(q) ||
          norm(r.pasaport_no || "").includes(q) ||
          norm(r.takip_no || "").includes(q)
      );
    }
    return list;
  }, [rows, search, filterCountry]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697A3.42 3.42 0 001.946 6.586a3.42 3.42 0 002.357 5.34 3.42 3.42 0 001.279 5.591 3.42 3.42 0 005.32-2.31 3.42 3.42 0 005.62 1.61 3.42 3.42 0 002.31-5.32 3.42 3.42 0 001.61-5.62 3.42 3.42 0 00-5.32-2.31 3.42 3.42 0 00-5.62-1.61z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Vize Sonuç Takip</h1>
                <p className="text-xs text-slate-500">
                  Başvurusu yapılmış dosyalarınız. Pasaport size geri gelince
                  (işlemden çıktı) listeden otomatik düşer.
                </p>
              </div>
            </div>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Yenile
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-[400px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Müşteri, pasaport veya takip no ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-slate-400"
            />
          </div>

          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tüm Ülkeler</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="ml-auto inline-flex items-center gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{filtered.length}</span>
            <span>aktif takip</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500">Yükleniyor…</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Şu an takip edilen sonuç bekleyen dosyanız yok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Müşteri
                    </th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Pasaport
                    </th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Doğum Tarihi
                    </th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Takip No
                    </th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Ülke
                    </th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Başvuru
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{r.musteri_ad}</td>
                      <td className="py-3 px-4 text-slate-700 font-mono text-xs">{r.pasaport_no}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(r.dogum_tarihi)}</td>
                      <td className="py-3 px-4">
                        {r.takip_no ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 font-mono text-xs font-semibold border border-primary-100">
                            {r.takip_no}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{r.hedef_ulke}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {formatDate(r.basvuru_yapildi_at) || formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
