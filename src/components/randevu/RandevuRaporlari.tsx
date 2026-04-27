"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

interface RandevuRow {
  id: string;
  dosya_adi: string;
  ulkeler: string[];
  vize_tipi: string;
  gorseller: string[];
  randevu_tarihi: string | null;
  randevu_alan_id: string | null;
  arsivlendi: boolean;
  created_by: string | null;
  created_at: string;
  profiles: { name: string } | null;
  randevu_alan: { name: string } | null;
}

interface UserStat {
  name: string;
  talepPasaport: number;
  randevuPasaport: number;
  randevular: { dosya_adi: string; ulke: string; tarih: string; pasaportSayisi: number }[];
}

interface UlkeStat {
  ulke: string;
  count: number;
}

const VIZE_TIPLERI: Record<string, string> = {
  turistik: "Turistik",
  ticari: "Ticari",
  ogrenci: "Öğrenci",
  konferans: "Konferans",
  kulturel: "Kültürel",
  sportif: "Sportif",
  aile: "Aile",
  arkadas: "Arkadaş",
  ziyaret: "Ziyaret",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function pasaportSayisi(t: RandevuRow): number {
  return t.gorseller?.length || 1;
}

export default function RandevuRaporlari() {
  const [talepler, setTalepler] = useState<RandevuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"all" | "month" | "week">("all");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("randevu_talepleri")
      .select("id, dosya_adi, ulkeler, vize_tipi, gorseller, randevu_tarihi, randevu_alan_id, arsivlendi, created_by, created_at, profiles:created_by(name), randevu_alan:randevu_alan_id(name)")
      .order("created_at", { ascending: false });

    if (data) setTalepler(data as unknown as RandevuRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = talepler.filter(t => {
    if (dateRange === "all") return true;
    const d = new Date(t.created_at);
    const now = new Date();
    if (dateRange === "week") return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (dateRange === "month") return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return true;
  });

  const totalPasaport = filtered.reduce((sum, t) => sum + pasaportSayisi(t), 0);
  const randevuAlinan = filtered.filter(t => t.arsivlendi && t.randevu_tarihi);
  const totalRandevuPasaport = randevuAlinan.reduce((sum, t) => sum + pasaportSayisi(t), 0);
  const bekleyenler = filtered.filter(t => !t.arsivlendi || !t.randevu_tarihi);
  const totalBekleyenPasaport = bekleyenler.reduce((sum, t) => sum + pasaportSayisi(t), 0);

  const randevuSureleri = filtered
    .filter(t => t.randevu_tarihi && t.created_at)
    .map(t => Math.max(0, (new Date(t.randevu_tarihi!).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)));
  const avgSure = randevuSureleri.length > 0
    ? (randevuSureleri.reduce((a, b) => a + b, 0) / randevuSureleri.length).toFixed(1)
    : "—";

  // Per-user stats (pasaport bazlı)
  const userStats: Record<string, UserStat> = {};
  for (const t of filtered) {
    const creatorName = t.profiles?.name || "Bilinmiyor";
    if (!userStats[creatorName]) {
      userStats[creatorName] = { name: creatorName, talepPasaport: 0, randevuPasaport: 0, randevular: [] };
    }
    userStats[creatorName].talepPasaport += pasaportSayisi(t);
  }
  for (const t of filtered) {
    if (!t.randevu_alan || !t.randevu_tarihi) continue;
    const bookerName = t.randevu_alan.name;
    if (!userStats[bookerName]) {
      userStats[bookerName] = { name: bookerName, talepPasaport: 0, randevuPasaport: 0, randevular: [] };
    }
    const pCount = pasaportSayisi(t);
    userStats[bookerName].randevuPasaport += pCount;
    userStats[bookerName].randevular.push({
      dosya_adi: t.dosya_adi,
      ulke: t.ulkeler.join(", "),
      tarih: t.randevu_tarihi,
      pasaportSayisi: pCount,
    });
  }
  const sortedUsers = Object.values(userStats).sort((a, b) => (b.talepPasaport + b.randevuPasaport) - (a.talepPasaport + a.randevuPasaport));

  // Per-country stats (pasaport bazlı)
  const ulkeMap: Record<string, number> = {};
  for (const t of randevuAlinan) {
    const pCount = pasaportSayisi(t);
    for (const u of t.ulkeler) {
      ulkeMap[u] = (ulkeMap[u] || 0) + pCount;
    }
  }
  const ulkeStats: UlkeStat[] = Object.entries(ulkeMap)
    .map(([ulke, count]) => ({ ulke, count }))
    .sort((a, b) => b.count - a.count);

  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Analiz</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Randevu Raporları</h1>
            <p className="text-slate-500 text-sm mt-1">Pasaport bazlı randevu istatistikleri ve dönemsel performans</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["all", "month", "week"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                dateRange === range
                  ? "bg-primary-500 text-white shadow-lg"
                  : "bg-white text-navy-600 border border-navy-200 hover:bg-navy-50"
              }`}
            >
              {range === "all" ? "Tüm Zamanlar" : range === "month" ? "Son 30 Gün" : "Son 7 Gün"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg">
          <p className="text-xs text-blue-600 uppercase font-bold tracking-wide">Toplam Dosya</p>
          <p className="text-3xl font-extrabold text-blue-800 mt-1">{filtered.length}</p>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 shadow-lg">
          <p className="text-xs text-indigo-600 uppercase font-bold tracking-wide">Toplam Pasaport</p>
          <p className="text-3xl font-extrabold text-indigo-800 mt-1">{totalPasaport}</p>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
          <p className="text-xs text-green-600 uppercase font-bold tracking-wide">Alınan Randevu</p>
          <p className="text-3xl font-extrabold text-green-800 mt-1">{totalRandevuPasaport}</p>
          <p className="text-xs text-green-500 mt-0.5">{randevuAlinan.length} dosya</p>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-lg">
          <p className="text-xs text-amber-600 uppercase font-bold tracking-wide">Bekleyen</p>
          <p className="text-3xl font-extrabold text-amber-800 mt-1">{totalBekleyenPasaport}</p>
          <p className="text-xs text-amber-500 mt-0.5">{bekleyenler.length} dosya</p>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg">
          <p className="text-xs text-purple-600 uppercase font-bold tracking-wide">Ort. Süre (gün)</p>
          <p className="text-3xl font-extrabold text-purple-800 mt-1">{avgSure}</p>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Stats */}
        <Card className="p-5 shadow-lg">
          <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <span className="text-xl">👥</span> Kullanıcı Bazlı (Pasaport)
          </h2>
          <div className="space-y-2">
            {sortedUsers.map((user) => (
              <div key={user.name}>
                <button
                  onClick={() => setExpandedUser(expandedUser === user.name ? null : user.name)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-navy-50 hover:bg-navy-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-navy-800 text-sm">{user.name}</p>
                      <p className="text-xs text-navy-400">
                        {user.talepPasaport} pasaport talep • {user.randevuPasaport} pasaport randevu aldı
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{user.talepPasaport}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{user.randevuPasaport}</span>
                    <svg className={`w-4 h-4 text-navy-400 transition-transform ${expandedUser === user.name ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {expandedUser === user.name && user.randevular.length > 0 && (
                  <div className="mt-1 ml-12 space-y-1">
                    {user.randevular.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-navy-600 bg-white rounded-lg px-3 py-2 border border-navy-100">
                        <span className="font-medium">{r.dosya_adi}</span>
                        <span className="text-navy-400">•</span>
                        <span className="text-blue-600">🌍 {r.ulke}</span>
                        <span className="text-navy-400">•</span>
                        <span className="text-indigo-600">🛂 {r.pasaportSayisi} pasaport</span>
                        <span className="text-navy-400">•</span>
                        <span className="text-green-600">📅 {formatDate(r.tarih)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sortedUsers.length === 0 && (
              <p className="text-center text-navy-400 text-sm py-4">Veri bulunamadı</p>
            )}
          </div>
        </Card>

        {/* Country Stats */}
        <Card className="p-5 shadow-lg">
          <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <span className="text-xl">🌍</span> En Çok Randevu Alınan Ülkeler (Pasaport)
          </h2>
          <div className="space-y-3">
            {ulkeStats.map((stat, i) => {
              const maxCount = ulkeStats[0]?.count || 1;
              const pct = (stat.count / maxCount) * 100;
              return (
                <div key={stat.ulke} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-navy-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-navy-800">{stat.ulke}</span>
                      <span className="text-sm font-extrabold text-primary-600">{stat.count} pasaport</span>
                    </div>
                    <div className="w-full h-2.5 bg-navy-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {ulkeStats.length === 0 && (
              <p className="text-center text-navy-400 text-sm py-4">Henüz alınan randevu yok</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Booked Appointments */}
      <Card className="p-5 shadow-lg">
        <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
          <span className="text-xl">✅</span> Son Alınan Randevular
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-200">
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Dosya</th>
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Ülke</th>
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Vize Tipi</th>
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Pasaport</th>
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Randevu Tarihi</th>
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Oluşturan</th>
                <th className="text-left py-2 px-3 font-bold text-navy-500 text-xs uppercase">Alan</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .filter(t => t.arsivlendi && t.randevu_tarihi)
                .slice(0, 20)
                .map((t) => (
                  <tr key={t.id} className="border-b border-navy-50 hover:bg-navy-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-navy-800">{t.dosya_adi}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {t.ulkeler.map(u => (
                          <span key={u} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">{u}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-navy-600">{VIZE_TIPLERI[t.vize_tipi] || t.vize_tipi}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">{pasaportSayisi(t)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-green-600 font-medium">{t.randevu_tarihi ? formatDate(t.randevu_tarihi) : "-"}</td>
                    <td className="py-2.5 px-3 text-navy-600">{t.profiles?.name || "-"}</td>
                    <td className="py-2.5 px-3 text-navy-600">{t.randevu_alan?.name || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {filtered.filter(t => t.arsivlendi && t.randevu_tarihi).length === 0 && (
            <p className="text-center text-navy-400 text-sm py-6">Henüz alınan randevu yok</p>
          )}
        </div>
      </Card>
    </div>
  );
}
