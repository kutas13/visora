"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile, ActivityLog, Payment } from "@/lib/supabase/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return symbols[currency] || currency;
}

interface StaffStats {
  id: string;
  name: string;
  activeFiles: number;
  upcomingAppointments: number;
  unpaidFiles: number;
  completedFiles: number;
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  file_created: { icon: "M12 4v16m8-8H4", color: "from-indigo-500 to-violet-500" },
  file_updated: { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", color: "from-violet-500 to-fuchsia-500" },
  dosya_hazir: { icon: "M5 13l4 4L19 7", color: "from-emerald-500 to-teal-500" },
  isleme_girdi: { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", color: "from-amber-500 to-orange-500" },
  islemden_cikti: { icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z", color: "from-blue-500 to-indigo-500" },
  payment_added: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "from-emerald-500 to-green-500" },
  transfer: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", color: "from-purple-500 to-pink-500" },
};

export default function AdminDashboard() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("Admin");
  const [stats, setStats] = useState({
    totalActive: 0,
    todayAppointments: 0,
    unpaidCari: 0,
    totalRevenue: { TL: 0, EUR: 0, USD: 0 },
    approvedVisa: 0,
    rejectedVisa: 0,
  });
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [recentLogs, setRecentLogs] = useState<(ActivityLog & { profiles?: { name: string } | null; visa_files?: { musteri_ad: string; hedef_ulke: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const [profileRes, filesRes, staffRes, paymentsRes] = await Promise.all([
        user ? supabase.from("profiles").select("name").eq("id", user.id).single<{ name: string }>() : null,
        supabase.from("visa_files").select("*").returns<VisaFile[]>(),
        supabase.from("profiles").select("*").eq("role", "staff").returns<Profile[]>(),
        supabase.from("payments").select("*").eq("durum", "odendi").returns<Payment[]>(),
      ]);

      if (profileRes?.data?.name) setAdminName(profileRes.data.name);
      const files = filesRes.data;
      const staffData = staffRes.data;
      const payments = paymentsRes.data;

      if (files && staffData) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekLater = new Date(today);
        weekLater.setDate(weekLater.getDate() + 7);

        const totalActive = files.filter(f => !f.sonuc).length;
        const todayAppointments = files.filter(f => {
          if (!f.randevu_tarihi) return false;
          const d = new Date(f.randevu_tarihi);
          return d >= today && d < tomorrow;
        }).length;
        const unpaidCari = files.filter(f => f.odeme_plani === "cari" && f.odeme_durumu === "odenmedi").length;
        const approvedVisa = files.filter(f => f.sonuc === "vize_onay").length;
        const rejectedVisa = files.filter(f => f.sonuc === "red").length;

        const revenue = { TL: 0, EUR: 0, USD: 0 };
        (payments || []).forEach(p => {
          const curr = p.currency || "TL";
          revenue[curr as keyof typeof revenue] += Number(p.tutar);
        });

        setStats({ totalActive, todayAppointments, unpaidCari, totalRevenue: revenue, approvedVisa, rejectedVisa });

        const staffStatsArr: StaffStats[] = staffData.map(s => {
          const staffFiles = files.filter(f => f.assigned_user_id === s.id);
          const upcomingAppts = staffFiles.filter(f => {
            if (!f.randevu_tarihi || f.sonuc) return false;
            const d = new Date(f.randevu_tarihi);
            return d >= today && d < weekLater;
          }).length;
          const unpaid = staffFiles.filter(f => f.odeme_plani === "cari" && f.odeme_durumu === "odenmedi").length;
          const completed = staffFiles.filter(f => f.sonuc !== null).length;

          return {
            id: s.id,
            name: s.name,
            activeFiles: staffFiles.filter(f => !f.sonuc).length,
            upcomingAppointments: upcomingAppts,
            unpaidFiles: unpaid,
            completedFiles: completed,
          };
        });

        setStaffStats(staffStatsArr.sort((a, b) => b.activeFiles - a.activeFiles));
      }

      const { data: logs } = await supabase
        .from("activity_logs")
        .select("*, profiles:actor_id(name), visa_files(musteri_ad, hedef_ulke)")
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentLogs(logs || []);
      setLoading(false);
    }

    loadData();
  }, []);

  const handleStaffClick = (staffId: string) => {
    router.push(`/admin/files?staff=${staffId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const greetingTime = new Date().getHours();
  let timeGreeting = "Merhaba";
  if (greetingTime < 12) timeGreeting = "Günaydın";
  else if (greetingTime < 18) timeGreeting = "İyi günler";
  else timeGreeting = "İyi akşamlar";

  const successRate = stats.approvedVisa + stats.rejectedVisa > 0
    ? Math.round((stats.approvedVisa / (stats.approvedVisa + stats.rejectedVisa)) * 100)
    : 0;

  const kpis = [
    {
      label: "Aktif Dosya",
      value: stats.totalActive.toString(),
      sub: "İşlemde olanlar",
      gradient: "from-indigo-500 via-violet-500 to-fuchsia-500",
      onClick: () => router.push("/admin/files"),
      icon: "M9 17V7a4 4 0 014-4h2a4 4 0 014 4v10M5 9h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z",
    },
    {
      label: "Bugün Randevu",
      value: stats.todayAppointments.toString(),
      sub: "Bugünkü randevular",
      gradient: "from-amber-400 to-orange-500",
      onClick: () => router.push("/admin/calendar"),
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    {
      label: "Ödenmemiş Cari",
      value: stats.unpaidCari.toString(),
      sub: "Bekleyen tahsilat",
      gradient: "from-rose-500 to-red-500",
      onClick: () => router.push("/admin/cari-hesap"),
      icon: "M12 8v4l3 2M21 12A9 9 0 113 12a9 9 0 0118 0z",
    },
    {
      label: "Başarı Oranı",
      value: `%${successRate}`,
      sub: `${stats.approvedVisa} onay · ${stats.rejectedVisa} red`,
      gradient: "from-emerald-500 to-teal-500",
      onClick: () => router.push("/admin/raporlar"),
      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    },
  ];

  return (
    <div className="space-y-6">
      {/* HERO — Cam efektli karanlık */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950" />
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-indigo-500 blur-3xl animate-blob" />
          <div className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-fuchsia-500 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
          <div className="absolute top-1/3 right-1/4 w-60 h-60 rounded-full bg-violet-500 blur-3xl animate-blob" style={{ animationDelay: "9s" }} />
        </div>

        <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-end p-6 sm:p-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {timeGreeting}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">
              Hoş geldin, <span className="bg-gradient-to-r from-indigo-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">{adminName}</span>
            </h1>
            <p className="mt-2.5 text-white/70 text-sm max-w-xl">
              Bugün ofiste{" "}
              <span className="font-bold text-white">{stats.totalActive}</span> aktif dosya,{" "}
              <span className="font-bold text-white">{stats.todayAppointments}</span> randevu ve{" "}
              <span className="font-bold text-white">{stats.unpaidCari}</span> bekleyen tahsilat var.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => router.push("/admin/files/new")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 transition shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Yeni Dosya
              </button>
              <button
                onClick={() => router.push("/admin/payments")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 text-white text-sm font-semibold hover:bg-white/15 backdrop-blur transition"
              >
                Ödemeleri Aç
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:flex md:flex-col md:gap-2 md:min-w-[160px]">
            {Object.entries(stats.totalRevenue).map(([curr, val]) =>
              val > 0 ? (
                <div key={curr} className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-3 py-2.5">
                  <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">{curr} Geliri</p>
                  <p className="mt-0.5 text-base sm:text-lg font-extrabold text-white">
                    {val.toLocaleString("tr-TR")} <span className="text-white/70">{getCurrencySymbol(curr)}</span>
                  </p>
                </div>
              ) : null
            )}
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <button
            key={i}
            onClick={kpi.onClick}
            className="group relative overflow-hidden text-left rounded-2xl bg-white ring-1 ring-slate-200/70 p-4 hover:ring-indigo-300 hover:-translate-y-0.5 transition-all"
          >
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
            <div className="relative flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.icon} />
                </svg>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="relative text-3xl font-black text-slate-900 leading-none tracking-tight">{kpi.value}</p>
            <p className="relative mt-2 text-[12px] font-semibold text-slate-700">{kpi.label}</p>
            <p className="relative text-[11px] text-slate-400 mt-0.5">{kpi.sub}</p>
          </button>
        ))}
      </div>

      {/* Ana içerik: 2 sütun split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Personel Performansı (2/3 genişlik) */}
        <div className="xl:col-span-2 rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Personel Performansı</h3>
                <p className="text-[11px] text-slate-500">Aktif dosya yüküne göre sıralı</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {staffStats.length} personel
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {staffStats.length === 0 ? (
              <div className="text-center py-14 text-sm text-slate-400">Henüz personel kaydı yok.</div>
            ) : (
              staffStats.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleStaffClick(s.id)}
                  className="group w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 w-5 text-right">{String(i + 1).padStart(2, "0")}</span>
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md flex-shrink-0">
                      <span className="text-white font-extrabold text-sm">{s.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate text-[13.5px]">{s.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {s.activeFiles} aktif · {s.completedFiles} tamamlanan
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-lg bg-indigo-50 text-indigo-700 text-[12px] font-bold">
                      {s.activeFiles}
                    </span>
                    <span className={`inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-lg text-[12px] font-bold ${
                      s.upcomingAppointments > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {s.upcomingAppointments}
                    </span>
                    <span className={`inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-lg text-[12px] font-bold ${
                      s.unpaidFiles > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {s.unpaidFiles}
                    </span>
                  </div>

                  <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))
            )}
          </div>

          {staffStats.length > 0 && (
            <div className="hidden sm:flex items-center justify-end gap-1.5 px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-2">Sütunlar:</span>
              <span className="text-[10px] text-indigo-600 font-bold">Aktif</span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] text-amber-600 font-bold">7G Randevu</span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] text-rose-600 font-bold">Ödenmemiş</span>
            </div>
          )}
        </div>

        {/* Aktivite akışı (1/3 genişlik) */}
        <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Son Aktiviteler</h3>
              <p className="text-[11px] text-slate-500">Canlı operasyon akışı</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[520px]">
            {recentLogs.length === 0 ? (
              <div className="text-center py-14 px-5 text-sm text-slate-400">Henüz aktivite yok.</div>
            ) : (
              <ol className="relative">
                {recentLogs.map((log, idx) => {
                  const meta = ACTIVITY_ICONS[log.type] || { icon: "M9 17H7A2 2 0 015 15V5a2 2 0 012-2h7l5 5v3", color: "from-slate-400 to-slate-500" };
                  return (
                    <li key={log.id} className="relative pl-12 pr-5 py-3 hover:bg-slate-50 transition-colors">
                      {idx < recentLogs.length - 1 && (
                        <span className="absolute left-[27px] top-9 bottom-0 w-px bg-slate-200" />
                      )}
                      <div className={`absolute left-4 top-3 w-7 h-7 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-md`}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={meta.icon} />
                        </svg>
                      </div>
                      <p className="text-[13px] text-slate-800 leading-snug">{log.message}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10.5px] text-slate-500">
                        {log.profiles && (
                          <span className="font-semibold text-slate-700">{log.profiles.name}</span>
                        )}
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
