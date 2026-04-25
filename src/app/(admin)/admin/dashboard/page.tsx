"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile, ActivityLog, Payment } from "@/lib/supabase/types";

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ZAFER: "/zafer-avatar.png",
  ERCAN: "/ercan-avatar.png",
  BAHAR: "/bahar-avatar.jpg",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

      // Tüm sorguları paralel çalıştır (hız optimizasyonu)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-[3px] border-primary-100 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-navy-400 animate-pulse">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const greetingTime = new Date().getHours();
  let timeGreeting = "Merhaba";
  if (greetingTime < 12) timeGreeting = "Günaydın";
  else if (greetingTime < 18) timeGreeting = "İyi Günler";
  else timeGreeting = "İyi Akşamlar";

  const successRate = stats.approvedVisa + stats.rejectedVisa > 0 
    ? Math.round((stats.approvedVisa / (stats.approvedVisa + stats.rejectedVisa)) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* HERO — Visora */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-accent-600 p-7 sm:p-9 shadow-2xl shadow-primary-500/30">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-10 w-72 h-72 rounded-full bg-accent-400/40 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
        </div>

        <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur text-white text-[11px] font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Yönetim Paneli · {timeGreeting}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {adminName}
            </h1>
            <p className="mt-2 text-white/85 text-sm">
              Ofis genelinde <span className="font-semibold text-white">{stats.totalActive}</span> aktif dosya ·{" "}
              <span className="font-semibold text-white">{stats.todayAppointments}</span> bugün randevu ·{" "}
              <span className="font-semibold text-white">{stats.unpaidCari}</span> bekleyen tahsilat
            </p>
          </div>

          <div className="rounded-2xl bg-white/15 border border-white/25 backdrop-blur px-5 py-4 text-center min-w-[120px]">
            <p className="text-3xl font-extrabold text-white leading-none">{successRate}%</p>
            <p className="mt-1.5 text-[10px] text-white/85 uppercase tracking-wider font-semibold">
              Başarı oranı
            </p>
          </div>
        </div>
      </section>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-white border border-navy-100 p-5 shadow-sm hover:shadow-lg hover:border-primary-200 transition-all group">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary-100/60 group-hover:bg-primary-100 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md shadow-primary-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-navy-900">{stats.totalActive}</p>
            <p className="text-[11px] text-navy-500 mt-0.5 font-medium uppercase tracking-wider">Aktif dosya</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white border border-navy-100 p-5 shadow-sm hover:shadow-lg hover:border-accent-200 transition-all group">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-accent-100/60 group-hover:bg-accent-100 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-md shadow-accent-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-navy-900">{stats.todayAppointments}</p>
            <p className="text-[11px] text-navy-500 mt-0.5 font-medium uppercase tracking-wider">Bugün randevu</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white border border-navy-100 p-5 shadow-sm hover:shadow-lg hover:border-red-200 transition-all group">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-red-100/60 group-hover:bg-red-100 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md shadow-red-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-navy-900">{stats.unpaidCari}</p>
            <p className="text-[11px] text-navy-500 mt-0.5 font-medium uppercase tracking-wider">Ödenmemiş cari</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white border border-navy-100 p-5 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all group">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-100/60 group-hover:bg-emerald-100 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="mt-3 space-y-0.5">
              {Object.entries(stats.totalRevenue).map(([curr, val]) =>
                val > 0 ? (
                  <p key={curr} className="text-base font-extrabold text-navy-900 leading-tight">
                    {val.toLocaleString("tr-TR")} {getCurrencySymbol(curr)}
                  </p>
                ) : null
              )}
              {Object.values(stats.totalRevenue).every((v) => v === 0) && (
                <p className="text-3xl font-extrabold text-navy-900">—</p>
              )}
            </div>
            <p className="text-[11px] text-navy-500 mt-0.5 font-medium uppercase tracking-wider">Toplam gelir</p>
          </div>
        </div>
      </div>

      {/* Sonuç İstatistikleri */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">VİZE ONAY</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.approvedVisa}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Onaylanan Başvuru</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">REDDEDİLEN</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.rejectedVisa}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Red Başvuru</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">BAŞARI ORANI</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">%{successRate}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Onay / Toplam</p>
        </div>
      </div>

      {/* Personel Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Personel Performansı
          </h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Personel</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Aktif</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">7 Gün Randevu</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Tamamlanan</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Ödenmemiş</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map((s, index) => (
                  <tr
                    key={s.id}
                    onClick={() => handleStaffClick(s.id)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-all duration-200"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {USER_AVATARS[s.name.toUpperCase()] ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-200 flex-shrink-0">
                            <Image src={USER_AVATARS[s.name.toUpperCase()]} alt={s.name} width={40} height={40} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-600 font-bold">{s.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="font-semibold text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant="info" className="text-base px-3 py-1">{s.activeFiles}</Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant={s.upcomingAppointments > 0 ? "warning" : "default"} className="text-base px-3 py-1">
                        {s.upcomingAppointments}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant="success" className="text-base px-3 py-1">{s.completedFiles}</Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant={s.unpaidFiles > 0 ? "error" : "success"} className="text-base px-3 py-1">
                        {s.unpaidFiles}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Son Aktiviteler */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Son Aktiviteler
          </h3>
        </div>
        <div className="p-6">
          {recentLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">Henüz aktivite yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl hover:shadow-md transition-all duration-200">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-base">
                      {log.type === "file_created" && "📁"}
                      {log.type === "file_updated" && "✏️"}
                      {log.type === "dosya_hazir" && "✅"}
                      {log.type === "isleme_girdi" && "🔄"}
                      {log.type === "islemden_cikti" && "🏁"}
                      {log.type === "payment_added" && "💰"}
                      {log.type === "transfer" && "🔀"}
                      {!["file_created", "file_updated", "dosya_hazir", "isleme_girdi", "islemden_cikti", "payment_added", "transfer"].includes(log.type) && "📝"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium">{log.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {log.profiles && <Badge variant="purple" size="sm">{log.profiles.name}</Badge>}
                      {log.visa_files && <Badge variant="info" size="sm">{log.visa_files.musteri_ad}</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
