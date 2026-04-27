"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, VisaFile } from "@/lib/supabase/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
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

const ACTIVITY_META: Record<string, { icon: string; gradient: string }> = {
  file_created: { icon: "M12 4v16m8-8H4", gradient: "from-indigo-500 to-violet-500" },
  file_updated: { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", gradient: "from-violet-500 to-fuchsia-500" },
  dosya_hazir: { icon: "M5 13l4 4L19 7", gradient: "from-emerald-500 to-teal-500" },
  isleme_girdi: { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", gradient: "from-amber-500 to-orange-500" },
  islemden_cikti: { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", gradient: "from-emerald-500 to-teal-500" },
  payment_added: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1", gradient: "from-emerald-500 to-green-500" },
  transfer: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", gradient: "from-purple-500 to-pink-500" },
};

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
    { label: string; count: number; color: string }[]
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
          { label: "Evrak gelmedi", count: evrakGelmedi, color: "from-amber-400 to-orange-500" },
          { label: "İşlemde", count: islemdeCount, color: "from-indigo-500 to-violet-500" },
          { label: "Onaylandı", count: onaylandiCount, color: "from-emerald-500 to-teal-500" },
          { label: "Reddedildi", count: reddedildiCount, color: "from-rose-500 to-red-500" },
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
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const onayOrani = stats.toplam > 0 ? Math.round((stats.onaylanan / stats.toplam) * 100) : 0;
  const niceName = userName.toLocaleLowerCase("tr-TR").replace(/\b\w/g, (c) => c.toLocaleUpperCase("tr-TR"));

  const heroChips = [
    { label: "Yaklaşan (15g)", value: stats.randevu15Gun, color: "bg-amber-300/20 text-amber-100 ring-amber-300/30" },
    { label: "Acil (2g)", value: stats.randevu2Gun, color: "bg-rose-300/20 text-rose-100 ring-rose-300/30" },
    { label: "Konsolosluk", value: stats.islemde, color: "bg-violet-300/20 text-violet-100 ring-violet-300/30" },
    { label: "Bekleyen tahsilat", value: stats.odenmedi, color: "bg-emerald-300/20 text-emerald-100 ring-emerald-300/30" },
  ];

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950" />
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-indigo-500 blur-3xl animate-blob" />
          <div className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-fuchsia-500 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        </div>

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {timeGreeting}
              </div>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">
                Merhaba <span className="bg-gradient-to-r from-indigo-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">{niceName}</span>
              </h1>
              <p className="mt-2 text-white/70 text-sm max-w-xl">
                Bugün <span className="font-bold text-white">{stats.bugunRandevu}</span> randevu,{" "}
                <span className="font-bold text-white">{stats.aktif}</span> aktif dosya ve{" "}
                <span className="font-bold text-white">{stats.onaylanan}</span> onaylanmış başvurun var.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push("/app/files/new")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 transition shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
                </svg>
                Yeni Dosya
              </button>
              <button
                onClick={() => router.push("/app/calendar")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 text-white text-sm font-semibold hover:bg-white/15 backdrop-blur transition"
              >
                Takvim
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {heroChips.map((c) => (
              <div key={c.label} className={`rounded-2xl ring-1 ${c.color} px-4 py-3 backdrop-blur`}>
                <p className="text-3xl font-black leading-none">{c.value}</p>
                <p className="mt-1.5 text-[10.5px] uppercase tracking-wider font-bold opacity-80">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 12-col grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* BU HAFTA — sol büyük kart */}
        <section className="col-span-12 lg:col-span-7 relative rounded-2xl bg-white ring-1 ring-slate-200/70 p-6 overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-indigo-100/60 blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between mb-5">
            <div className="flex items-start gap-3">
              <span className="w-1 h-10 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Bu Hafta</p>
                <h2 className="text-lg font-extrabold text-slate-900 mt-0.5 tracking-tight">Operasyon özeti</h2>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })}
            </span>
          </div>

          <div className="relative grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-white ring-1 ring-indigo-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-700">Yeni Dosya</p>
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">{weeklyStats.buHaftaOlusturulan}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Bu hafta oluşturuldu</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-white ring-1 ring-emerald-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider font-bold text-emerald-700">Tahsilat</p>
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
                </svg>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">{weeklyStats.buHaftaTahsilat}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">İşlem yapıldı</p>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-3 text-center">
              <p className="text-base font-extrabold text-slate-900">{fmt(weeklyStats.tahsilatTL)} ₺</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-bold tracking-wider uppercase">TRY</p>
            </div>
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-3 text-center">
              <p className="text-base font-extrabold text-slate-900">{fmt(weeklyStats.tahsilatEUR)} €</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-bold tracking-wider uppercase">EUR</p>
            </div>
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-3 text-center">
              <p className="text-base font-extrabold text-slate-900">{fmt(weeklyStats.tahsilatUSD)} $</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-bold tracking-wider uppercase">USD</p>
            </div>
          </div>
        </section>

        {/* DOSYA DAĞILIMI — sağ kart */}
        <section className="col-span-12 lg:col-span-5 relative overflow-hidden rounded-2xl text-white p-6 ring-1 ring-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950" />
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-indigo-500 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-fuchsia-500 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">Performans</p>
              <h2 className="text-lg font-extrabold text-white mt-0.5 tracking-tight">Dosya durumu</h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black bg-gradient-to-br from-emerald-300 to-teal-300 bg-clip-text text-transparent leading-none">{onayOrani}%</p>
              <p className="text-[10px] text-white/60 uppercase tracking-wider font-bold mt-1">Onay oranı</p>
            </div>
          </div>

          <div className="relative space-y-3">
            {statusDistribution.map((s, i) => {
              const pct = stats.toplam > 0 ? (s.count / stats.toplam) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-white/85 font-medium">{s.label}</span>
                    <span className="text-[12px] font-bold text-white">
                      {s.count}{" "}
                      <span className="text-white/50 font-normal text-[10px]">· %{pct.toFixed(0)}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all duration-700`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* SON İŞLEMLER — modern timeline */}
      <section className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-1 h-7 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Son İşlemler</h3>
              <p className="text-[11px] text-slate-500">Aktivite akışı</p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold">
            {recentLogs.length}
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-700">Henüz işlem kaydı yok</p>
            <p className="text-xs text-slate-400 mt-1">İlk dosyanızı oluşturarak başlayın</p>
            <button
              onClick={() => router.push("/app/files/new")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg hover:shadow-xl transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
              </svg>
              Yeni dosya oluştur
            </button>
          </div>
        ) : (
          <ol className="relative">
            {recentLogs.map((log, idx) => {
              const meta = ACTIVITY_META[log.type] || { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", gradient: "from-slate-400 to-slate-500" };
              return (
                <li key={log.id} className="relative pl-14 pr-6 py-3.5 hover:bg-slate-50 transition-colors">
                  {idx < recentLogs.length - 1 && (
                    <span className="absolute left-[31px] top-11 bottom-0 w-px bg-slate-200" />
                  )}
                  <div className={`absolute left-5 top-3.5 w-8 h-8 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-md`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={meta.icon} />
                    </svg>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-800 leading-snug">{log.message}</p>
                      {log.visa_files && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                            {log.visa_files.musteri_ad}
                          </span>
                          <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                            {log.visa_files.hedef_ulke}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 flex-shrink-0 mt-1 whitespace-nowrap font-semibold uppercase tracking-wider">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
