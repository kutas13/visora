"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, VisaFile } from "@/lib/supabase/types";
import Image from "next/image";

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
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

function getDaysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi Günler";
  return "İyi Akşamlar";
}

export default function StaffDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("Kullanıcı");
  const [stats, setStats] = useState({
    randevu15Gun: 0,
    randevu2Gun: 0,
    islemde: 0,
    odenmedi: 0,
    aktif: 0,
    tamamlanan: 0,
    toplam: 0,
    onaylanan: 0,
    bugunRandevu: 0,
  });
  const [weeklyStats, setWeeklyStats] = useState({
    buHaftaOlusturulan: 0,
    buHaftaTahsilat: 0,
    tahsilatTL: 0,
    tahsilatEUR: 0,
    tahsilatUSD: 0,
  });
  const [statusDistribution, setStatusDistribution] = useState<{ label: string; count: number; color: string; bgLight: string }[]>([]);
  const [recentLogs, setRecentLogs] = useState<(ActivityLog & { visa_files?: { musteri_ad: string; hedef_ulke: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const timeGreeting = useMemo(() => getTimeGreeting(), []);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileCheck } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      if (profileCheck?.name === "ZAFER") {
        router.replace("/app/randevu-listesi");
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

      const [profileRes, filesRes, logsRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).single<any>(),
        supabase.from("visa_files").select("*").eq("assigned_user_id", user.id),
        supabase.from("activity_logs").select("*, visa_files(musteri_ad, hedef_ulke)").eq("actor_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("payments").select("*").eq("created_by", user.id).gte("created_at", weekStart.toISOString()),
      ]);

      if (profileRes.data && typeof profileRes.data.name === "string") {
        setUserName(profileRes.data.name);
      }

      const myFiles = filesRes.data as VisaFile[] | null;
      const myPayments = paymentsRes.data || [];
      setRecentLogs(logsRes.data || []);

      if (myFiles) {
        let randevu15 = 0, randevu2 = 0, bugunRandevu = 0;
        let islemde = 0, odenmedi = 0, aktif = 0, tamamlanan = 0, onaylanan = 0;
        let evrakGelmedi = 0, islemdeCount = 0, onaylandiCount = 0, reddedildiCount = 0;
        let buHaftaOlusturulan = 0;

        myFiles.forEach((file) => {
          if (!file.arsiv_mi) aktif++;
          if (file.sonuc) tamamlanan++;
          if (file.sonuc === "vize_onay") onaylanan++;

          if (file.islem_tipi === "randevulu" && file.randevu_tarihi) {
            const randevuTarihi = new Date(file.randevu_tarihi);
            randevuTarihi.setHours(0, 0, 0, 0);
            if (randevuTarihi.getTime() === today.getTime()) bugunRandevu++;
            if (!file.sonuc) {
              const daysUntil = getDaysUntil(file.randevu_tarihi);
              if (daysUntil !== null) {
                if (daysUntil <= 15 && daysUntil > 2) randevu15++;
                if (daysUntil <= 2 && daysUntil >= 0) randevu2++;
              }
            }
          }

          if (file.basvuru_yapildi && !file.sonuc) islemde++;
          if (file.odeme_durumu === "odenmedi") odenmedi++;
          if (new Date(file.created_at) >= weekStart) buHaftaOlusturulan++;
          if (file.evrak_durumu === "gelmedi") evrakGelmedi++;
          if (file.basvuru_yapildi && !file.sonuc) islemdeCount++;
          if (file.sonuc === "vize_onay") onaylandiCount++;
          if (file.sonuc === "red") reddedildiCount++;
        });

        setStats({ randevu15Gun: randevu15, randevu2Gun: randevu2, bugunRandevu, islemde, odenmedi, aktif, tamamlanan, toplam: myFiles.length, onaylanan });

        let tahsilatTL = 0, tahsilatEUR = 0, tahsilatUSD = 0;
        myPayments.forEach(p => {
          const curr = p.currency || "TL";
          if (curr === "TL") tahsilatTL += Number(p.tutar);
          if (curr === "EUR") tahsilatEUR += Number(p.tutar);
          if (curr === "USD") tahsilatUSD += Number(p.tutar);
        });

        setWeeklyStats({ buHaftaOlusturulan, buHaftaTahsilat: myPayments.length, tahsilatTL, tahsilatEUR, tahsilatUSD });

        setStatusDistribution([
          { label: "Evrak Gelmedi", count: evrakGelmedi, color: "bg-amber-500", bgLight: "bg-amber-500/10" },
          { label: "İşlemde", count: islemdeCount, color: "bg-blue-500", bgLight: "bg-blue-500/10" },
          { label: "Onaylandı", count: onaylandiCount, color: "bg-emerald-500", bgLight: "bg-emerald-500/10" },
          { label: "Reddedildi", count: reddedildiCount, color: "bg-red-500", bgLight: "bg-red-500/10" },
        ]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    router.prefetch("/app/files/new");
    router.prefetch("/app/payments");
    router.prefetch("/app/calendar");
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 animate-pulse">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const avatarSrc = USER_AVATARS[userName];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-7 shadow-xl border border-white/[0.06]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/[0.06] rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/[0.05] rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex items-center gap-5">
          {avatarSrc ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/10 shadow-xl flex-shrink-0">
              <Image src={avatarSrc} alt={userName} width={64} height={64} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ring-2 ring-white/10 shadow-xl flex-shrink-0">
              <span className="text-white text-2xl font-bold">{userName.charAt(0)}</span>
            </div>
          )}
          <div>
            <p className="text-slate-400 text-sm">{timeGreeting}</p>
            <h1 className="text-2xl font-bold text-white">{userName}</h1>
            <p className="text-slate-400 text-sm mt-1">
              <span className="text-blue-400 font-medium">{stats.aktif}</span> aktif dosya &middot;
              <span className="text-emerald-400 font-medium"> {stats.onaylanan}</span> onay &middot;
              <span className="text-slate-500"> {stats.toplam}</span> toplam
            </p>
            {stats.bugunRandevu > 0 && (
              <p className="text-amber-400 text-xs font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Bugün {stats.bugunRandevu} randevunuz var
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hızlı İşlemler */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => router.push("/app/files/new")}
          className="group flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" /></svg>
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-slate-800">Yeni Dosya</p>
            <p className="text-[11px] text-slate-400">Müşteri dosyası oluştur</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/app/payments")}
          className="group flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-slate-800">Tahsilat</p>
            <p className="text-[11px] text-slate-400">{stats.odenmedi} bekleyen ödeme</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/app/calendar")}
          className="group flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 hover:border-violet-200 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-slate-800">Takvim</p>
            <p className="text-[11px] text-slate-400">Randevularımı gör</p>
          </div>
        </button>
      </div>

      {/* Özet Kartlar - 4'lü grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">15 Gün</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.randevu15Gun}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Yaklaşan Randevu</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">Acil</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.randevu2Gun}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">2 Gün İçinde</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">İşlem</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.islemde}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Konsoloslukta</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-medium text-orange-500 uppercase tracking-wide">Ödeme</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.odenmedi}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Bekleyen Tahsilat</p>
        </div>
      </div>

      {/* Bu Hafta + Dosya Durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bu Hafta */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            Bu Hafta
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-slate-900">{weeklyStats.buHaftaOlusturulan}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Dosya Oluşturuldu</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-slate-900">{weeklyStats.buHaftaTahsilat}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tahsilat Yapıldı</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="text-sm font-bold text-emerald-700">{weeklyStats.tahsilatTL.toLocaleString("tr-TR")} ₺</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">TL</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <p className="text-sm font-bold text-blue-700">{weeklyStats.tahsilatEUR.toLocaleString("tr-TR")} &euro;</p>
              <p className="text-[10px] text-blue-500 mt-0.5">EUR</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-sm font-bold text-amber-700">{weeklyStats.tahsilatUSD.toLocaleString("tr-TR")} $</p>
              <p className="text-[10px] text-amber-500 mt-0.5">USD</p>
            </div>
          </div>
        </div>

        {/* Dosya Durumu Dağılımı */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            Dosya Durumu
          </h3>
          <div className="space-y-3">
            {statusDistribution.map((status, index) => {
              const percentage = stats.toplam > 0 ? (status.count / stats.toplam) * 100 : 0;
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status.color}`} />
                      <span className="text-xs font-medium text-slate-600">{status.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{status.count}</span>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${status.color}`}
                      style={{ width: `${Math.max(percentage, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Son İşlemler */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Son İşlemler</h3>
          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{recentLogs.length}</span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-600">Henüz işlem kaydı yok</p>
            <p className="text-xs text-slate-400 mt-1">İlk dosyanızı oluşturarak başlayın</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentLogs.map((log) => {
              const iconMap: Record<string, { icon: string; bg: string; color: string }> = {
                file_created: { icon: "M12 4v16m8-8H4", bg: "bg-blue-50", color: "text-blue-500" },
                file_updated: { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", bg: "bg-indigo-50", color: "text-indigo-500" },
                dosya_hazir: { icon: "M5 13l4 4L19 7", bg: "bg-emerald-50", color: "text-emerald-500" },
                isleme_girdi: { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", bg: "bg-blue-50", color: "text-blue-500" },
                islemden_cikti: { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-emerald-50", color: "text-emerald-500" },
                payment_added: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1", bg: "bg-green-50", color: "text-green-500" },
                transfer: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", bg: "bg-purple-50", color: "text-purple-500" },
              };
              const ic = iconMap[log.type] || { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", bg: "bg-slate-50", color: "text-slate-400" };

              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${ic.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <svg className={`w-4 h-4 ${ic.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ic.icon} /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-700">{log.message}</p>
                    {log.visa_files && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge variant="info" size="sm">{log.visa_files.musteri_ad}</Badge>
                        <Badge variant="default" size="sm">{log.visa_files.hedef_ulke}</Badge>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{formatDate(log.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
