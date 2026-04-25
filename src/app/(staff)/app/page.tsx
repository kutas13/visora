"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, VisaFile } from "@/lib/supabase/types";

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
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

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
  const [statusDistribution, setStatusDistribution] = useState<
    { label: string; count: number; dot: string }[]
  >([]);
  const [recentLogs, setRecentLogs] = useState<
    (ActivityLog & { visa_files?: { musteri_ad: string; hedef_ulke: string } | null })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const timeGreeting = useMemo(() => getTimeGreeting(), []);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileCheck } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      if (profileCheck?.name === "ZAFER") {
        router.replace("/app/randevu-listesi");
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

      const [profileRes, filesRes, logsRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).single(),
        supabase.from("visa_files").select("*").eq("assigned_user_id", user.id),
        supabase
          .from("activity_logs")
          .select("*, visa_files(musteri_ad, hedef_ulke)")
          .eq("actor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("payments")
          .select("*")
          .eq("created_by", user.id)
          .gte("created_at", weekStart.toISOString()),
      ]);

      if (profileRes.data?.name) setUserName(profileRes.data.name);

      const myFiles = filesRes.data as VisaFile[] | null;
      const myPayments = paymentsRes.data || [];
      setRecentLogs(logsRes.data || []);

      if (myFiles) {
        let randevu15 = 0,
          randevu2 = 0,
          bugunRandevu = 0;
        let islemde = 0,
          odenmedi = 0,
          aktif = 0,
          tamamlanan = 0,
          onaylanan = 0;
        let evrakGelmedi = 0,
          islemdeCount = 0,
          onaylandiCount = 0,
          reddedildiCount = 0;
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

        setStats({
          randevu15Gun: randevu15,
          randevu2Gun: randevu2,
          bugunRandevu,
          islemde,
          odenmedi,
          aktif,
          tamamlanan,
          toplam: myFiles.length,
          onaylanan,
        });

        let tahsilatTL = 0,
          tahsilatEUR = 0,
          tahsilatUSD = 0;
        myPayments.forEach((p) => {
          const curr = p.currency || "TL";
          if (curr === "TL") tahsilatTL += Number(p.tutar);
          if (curr === "EUR") tahsilatEUR += Number(p.tutar);
          if (curr === "USD") tahsilatUSD += Number(p.tutar);
        });

        setWeeklyStats({
          buHaftaOlusturulan,
          buHaftaTahsilat: myPayments.length,
          tahsilatTL,
          tahsilatEUR,
          tahsilatUSD,
        });

        setStatusDistribution([
          { label: "Evrak gelmedi", count: evrakGelmedi, dot: "bg-amber-500" },
          { label: "İşlemde", count: islemdeCount, dot: "bg-primary-500" },
          { label: "Onaylandı", count: onaylandiCount, dot: "bg-emerald-500" },
          { label: "Reddedildi", count: reddedildiCount, dot: "bg-red-500" },
        ]);
      }

      setLoading(false);
    }
    loadData();
  }, [router]);

  useEffect(() => {
    router.prefetch("/app/files/new");
    router.prefetch("/app/payments");
    router.prefetch("/app/calendar");
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-primary-100 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-navy-400 animate-pulse">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const onayOrani = stats.toplam > 0 ? Math.round((stats.onaylanan / stats.toplam) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* HERO — Visora gradient */}
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
              {timeGreeting}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {userName.toLocaleLowerCase("tr-TR").replace(/\b\w/g, (c) => c.toLocaleUpperCase("tr-TR"))}
            </h1>
            <p className="mt-2 text-white/85 text-sm">
              Bugün <span className="font-semibold text-white">{stats.bugunRandevu}</span> randevu ·{" "}
              <span className="font-semibold text-white">{stats.aktif}</span> aktif dosya ·{" "}
              <span className="font-semibold text-white">{stats.onaylanan}</span> onaylanmış
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/app/files/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-700 bg-white hover:bg-navy-50 shadow-md transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
              </svg>
              Yeni dosya
            </button>
            <button
              onClick={() => router.push("/app/calendar")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Takvim
            </button>
          </div>
        </div>

        {/* Hero alt: mini KPI şeridi */}
        <div className="relative mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Yaklaşan (15 gün)", value: stats.randevu15Gun, accent: "bg-amber-300" },
            { label: "Acil (2 gün)", value: stats.randevu2Gun, accent: "bg-red-300" },
            { label: "Konsoloslukta", value: stats.islemde, accent: "bg-lilac-200" },
            { label: "Bekleyen tahsilat", value: stats.odenmedi, accent: "bg-emerald-300" },
          ].map((k) => (
            <div
              key={k.label}
              className="relative overflow-hidden rounded-2xl bg-white/12 border border-white/20 backdrop-blur px-4 py-3"
            >
              <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${k.accent}`} />
              <p className="text-3xl font-extrabold text-white leading-none">{k.value}</p>
              <p className="mt-1.5 text-[11px] text-white/80 uppercase tracking-wider font-semibold">
                {k.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ANA İZLEYEN ORTAK GRID: 12 kolon */}
      <div className="grid grid-cols-12 gap-4">
        {/* Bu Hafta */}
        <section className="col-span-12 lg:col-span-7 relative overflow-hidden rounded-3xl bg-white border border-navy-100 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-lilac-100/60 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary-600">
                Bu hafta
              </p>
              <h2 className="text-lg font-bold text-navy-900 mt-0.5">Operasyon özeti</h2>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-navy-100 text-navy-600 font-semibold">
              {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })}
            </span>
          </div>

          <div className="relative grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-white border border-primary-100 p-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-primary-600">
                Yeni dosya
              </p>
              <p className="mt-2 text-3xl font-extrabold text-navy-900">
                {weeklyStats.buHaftaOlusturulan}
              </p>
              <p className="text-xs text-navy-500 mt-0.5">Bu hafta oluşturuldu</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-accent-50 to-white border border-accent-100 p-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-accent-600">
                Tahsilat
              </p>
              <p className="mt-2 text-3xl font-extrabold text-navy-900">
                {weeklyStats.buHaftaTahsilat}
              </p>
              <p className="text-xs text-navy-500 mt-0.5">İşlem yapıldı</p>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
              <p className="text-base font-bold text-emerald-700">
                {fmt(weeklyStats.tahsilatTL)} ₺
              </p>
              <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold tracking-wider uppercase">
                TRY
              </p>
            </div>
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 text-center">
              <p className="text-base font-bold text-primary-700">
                {fmt(weeklyStats.tahsilatEUR)} €
              </p>
              <p className="text-[10px] text-primary-600 mt-0.5 font-semibold tracking-wider uppercase">
                EUR
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-base font-bold text-amber-700">
                {fmt(weeklyStats.tahsilatUSD)} $
              </p>
              <p className="text-[10px] text-amber-600 mt-0.5 font-semibold tracking-wider uppercase">
                USD
              </p>
            </div>
          </div>
        </section>

        {/* Onay oranı + dağılım */}
        <section className="col-span-12 lg:col-span-5 relative overflow-hidden rounded-3xl bg-navy-900 text-white p-6 shadow-2xl shadow-navy-900/20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary-500/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-accent-500/25 rounded-full blur-3xl" />
          </div>
          <div className="relative flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-lilac-300">
                Performans
              </p>
              <h2 className="text-lg font-bold text-white mt-0.5">Dosya durumu</h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold text-white leading-none">{onayOrani}%</p>
              <p className="text-[10px] text-lilac-300 uppercase tracking-wider font-semibold mt-1">
                Onay oranı
              </p>
            </div>
          </div>

          <div className="relative space-y-3">
            {statusDistribution.map((s, i) => {
              const pct = stats.toplam > 0 ? (s.count / stats.toplam) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className="text-[12px] text-white/85 font-medium">{s.label}</span>
                    </div>
                    <span className="text-[12px] font-bold text-white">
                      {s.count}{" "}
                      <span className="text-white/50 font-normal text-[10px]">
                        · {pct.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${s.dot}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* SON İŞLEMLER */}
      <section className="rounded-3xl bg-white border border-navy-100 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-navy-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-md shadow-primary-500/30">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-navy-900">Son işlemler</h3>
            <p className="text-[11px] text-navy-500">Aktivite akışı</p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 font-semibold border border-primary-100">
            {recentLogs.length}
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 border border-primary-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-navy-700">Henüz işlem kaydı yok</p>
            <p className="text-xs text-navy-400 mt-1">İlk dosyanızı oluşturarak başlayın</p>
            <button
              onClick={() => router.push("/app/files/new")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-600 shadow-md shadow-primary-500/30 hover:shadow-lg transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
              </svg>
              Yeni dosya oluştur
            </button>
          </div>
        ) : (
          <div className="divide-y divide-navy-100">
            {recentLogs.map((log) => {
              const iconMap: Record<string, { icon: string; bg: string; color: string }> = {
                file_created: {
                  icon: "M12 4v16m8-8H4",
                  bg: "bg-primary-50",
                  color: "text-primary-600",
                },
                file_updated: {
                  icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
                  bg: "bg-lilac-50",
                  color: "text-lilac-600",
                },
                dosya_hazir: {
                  icon: "M5 13l4 4L19 7",
                  bg: "bg-emerald-50",
                  color: "text-emerald-600",
                },
                isleme_girdi: {
                  icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
                  bg: "bg-primary-50",
                  color: "text-primary-600",
                },
                islemden_cikti: {
                  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                  bg: "bg-emerald-50",
                  color: "text-emerald-600",
                },
                payment_added: {
                  icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1",
                  bg: "bg-emerald-50",
                  color: "text-emerald-600",
                },
                transfer: {
                  icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
                  bg: "bg-accent-50",
                  color: "text-accent-600",
                },
              };
              const ic =
                iconMap[log.type] || {
                  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  bg: "bg-navy-100",
                  color: "text-navy-500",
                };

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-6 py-3.5 hover:bg-primary-50/40 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl ${ic.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <svg className={`w-4 h-4 ${ic.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d={ic.icon}
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-navy-700 leading-snug">{log.message}</p>
                    {log.visa_files && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant="info" size="sm">
                          {log.visa_files.musteri_ad}
                        </Badge>
                        <Badge variant="default" size="sm">
                          {log.visa_files.hedef_ulke}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-navy-400 flex-shrink-0 mt-1 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
