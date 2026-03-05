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
  ERCAN: "/ercan-avatar.jpg",
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
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
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
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-primary-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-navy-300 text-sm font-medium mb-1">{timeGreeting}</p>
            <h1 className="text-3xl font-bold mb-2">{adminName} 👑</h1>
            <p className="text-navy-300">Ofis genelinde {stats.totalActive} aktif dosya, {stats.todayAppointments} bugünkü randevu var.</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center bg-white/10 backdrop-blur rounded-2xl px-6 py-4">
              <p className="text-3xl font-bold text-primary-400">{successRate}%</p>
              <p className="text-xs text-navy-300">Başarı Oranı</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 right-4 text-7xl opacity-10">🦊</div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Aktif Dosya</p>
              <p className="text-3xl font-bold text-navy-900 mt-1">{stats.totalActive}</p>
              <p className="text-xs text-navy-400 mt-1">Devam Eden</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📁</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-primary-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Bugün Randevu</p>
              <p className="text-3xl font-bold text-primary-600 mt-1">{stats.todayAppointments}</p>
              <p className="text-xs text-navy-400 mt-1">Randevu</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-red-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Ödenmemiş</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.unpaidCari}</p>
              <p className="text-xs text-navy-400 mt-1">Cari Dosya</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-green-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Toplam Gelir</p>
              <div className="mt-1 space-y-0.5">
                {Object.entries(stats.totalRevenue).map(([curr, val]) => (
                  val > 0 && (
                    <p key={curr} className="text-sm font-bold text-navy-700">
                      {val.toLocaleString("tr-TR")} {getCurrencySymbol(curr)}
                    </p>
                  )
                ))}
                {Object.values(stats.totalRevenue).every(v => v === 0) && (
                  <p className="text-sm text-navy-400">-</p>
                )}
              </div>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">💵</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Sonuç İstatistikleri */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Vize Onay</p>
              <p className="text-4xl font-bold mt-1">{stats.approvedVisa}</p>
            </div>
            <span className="text-5xl opacity-50">🎉</span>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Reddedilen</p>
              <p className="text-4xl font-bold mt-1">{stats.rejectedVisa}</p>
            </div>
            <span className="text-5xl opacity-50">❌</span>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm">Başarı Oranı</p>
              <p className="text-4xl font-bold mt-1">%{successRate}</p>
            </div>
            <span className="text-5xl opacity-50">📈</span>
          </div>
        </Card>
      </div>

      {/* Personel Tablosu */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">👥</span>
            Personel Performansı
          </h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-navy-200">
                  <th className="text-left py-3 px-4 text-sm font-bold text-navy-700">Personel</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-navy-700">Aktif</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-navy-700">7 Gün Randevu</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-navy-700">Tamamlanan</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-navy-700">Ödenmemiş</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map((s, index) => (
                  <tr
                    key={s.id}
                    onClick={() => handleStaffClick(s.id)}
                    className="border-b border-navy-100 hover:bg-gradient-to-r hover:from-primary-50 hover:to-white cursor-pointer transition-all duration-200"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {USER_AVATARS[s.name.toUpperCase()] ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-navy-200 flex-shrink-0">
                            <Image src={USER_AVATARS[s.name.toUpperCase()]} alt={s.name} width={40} height={40} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-600 font-bold">{s.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="font-semibold text-navy-900">{s.name}</span>
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
      </Card>

      {/* Son Aktiviteler */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">📋</span>
            Son Aktiviteler
          </h3>
        </div>
        <div className="p-6">
          {recentLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📝</span>
              </div>
              <p className="text-navy-500 font-medium">Henüz aktivite yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-gradient-to-r from-navy-50 to-white rounded-xl hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-xl">
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
                    <p className="text-sm text-navy-900 font-medium">{log.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {log.profiles && <Badge variant="purple" size="sm">{log.profiles.name}</Badge>}
                      {log.visa_files && <Badge variant="info" size="sm">{log.visa_files.musteri_ad}</Badge>}
                    </div>
                    <p className="text-xs text-navy-400 mt-2">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
