"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button } from "@/components/ui";
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
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
  const [statusDistribution, setStatusDistribution] = useState<{ label: string; count: number; color: string }[]>([]);
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

      // Tüm sorguları paralel çalıştır (hız optimizasyonu)
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
        let randevu15 = 0;
        let randevu2 = 0; 
        let bugunRandevu = 0;
        let islemde = 0;
        let odenmedi = 0;
        let aktif = 0;
        let tamamlanan = 0;
        let onaylanan = 0;

        // Durum dağılımı için
        let evrakGelmedi = 0;
        let islemdeCount = 0; 
        let onaylandiCount = 0;
        let reddedildiCount = 0;

        // Haftalık istatistikler
        let buHaftaOlusturulan = 0;
        const weeklyPayments = myPayments || [];

        myFiles.forEach((file) => {
          const toplam = true; // Tüm dosyalar (arşiv dahil)
          if (!file.arsiv_mi) aktif++;
          if (file.sonuc) tamamlanan++;
          if (file.sonuc === "vize_onay") onaylanan++;

          // Bugün randevuları
          if (file.islem_tipi === "randevulu" && file.randevu_tarihi) {
            const randevuTarihi = new Date(file.randevu_tarihi);
            randevuTarihi.setHours(0, 0, 0, 0);
            if (randevuTarihi.getTime() === today.getTime()) {
              bugunRandevu++;
            }

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

          // Bu hafta oluşturulan
          if (new Date(file.created_at) >= weekStart) {
            buHaftaOlusturulan++;
          }

          // Durum dağılımı
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
          onaylanan 
        });

        // Haftalık özet
        let tahsilatTL = 0, tahsilatEUR = 0, tahsilatUSD = 0;
        weeklyPayments.forEach(p => {
          const curr = p.currency || "TL";
          if (curr === "TL") tahsilatTL += Number(p.tutar);
          if (curr === "EUR") tahsilatEUR += Number(p.tutar);
          if (curr === "USD") tahsilatUSD += Number(p.tutar);
        });

        setWeeklyStats({
          buHaftaOlusturulan,
          buHaftaTahsilat: weeklyPayments.length,
          tahsilatTL,
          tahsilatEUR, 
          tahsilatUSD,
        });

        // Durum dağılımı
        setStatusDistribution([
          { label: "Evrak Gelmedi", count: evrakGelmedi, color: "bg-amber-500" },
          { label: "İşlemde", count: islemdeCount, color: "bg-blue-500" },
          { label: "Onaylandı", count: onaylandiCount, color: "bg-green-500" },
          { label: "Reddedildi", count: reddedildiCount, color: "bg-red-500" },
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
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Hoşgeldin */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <p className="text-primary-100 text-sm font-medium mb-1">{timeGreeting}</p>
          <h1 className="text-3xl font-bold mb-2">{userName}! 👋</h1>
          <div className="space-y-1">
            <p className="text-primary-100">Bugün {stats.aktif} aktif dosyanız var. {stats.toplam} toplam, {stats.onaylanan} onaylandı.</p>
            {stats.bugunRandevu > 0 && (
              <p className="text-yellow-200 font-medium flex items-center gap-1">
                ⚡ Dikkat: Bugün {stats.bugunRandevu} randevunuz var!
              </p>
            )}
          </div>
        </div>
        <div className="absolute bottom-4 right-4 text-6xl opacity-20">🦊</div>
      </div>

      {/* Hızlı İşlemler */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            onClick={() => router.push("/app/files/new")}
            className="bg-primary-500 hover:bg-primary-600 text-white p-4 h-auto flex items-center gap-3"
          >
            <span className="text-2xl">📁</span>
            <div className="text-left">
              <p className="font-medium">Yeni Dosya</p>
              <p className="text-xs opacity-80">Müşteri dosyası oluştur</p>
            </div>
          </Button>
          <Button 
            onClick={() => router.push("/app/payments")}
            className="bg-green-500 hover:bg-green-600 text-white p-4 h-auto flex items-center gap-3"
          >
            <span className="text-2xl">💰</span>
            <div className="text-left">
              <p className="font-medium">Tahsilat</p>
              <p className="text-xs opacity-80">{stats.odenmedi} bekleyen ödeme</p>
            </div>
          </Button>
          <Button 
            onClick={() => router.push("/app/calendar")}
            className="bg-blue-500 hover:bg-blue-600 text-white p-4 h-auto flex items-center gap-3"
          >
            <span className="text-2xl">📅</span>
            <div className="text-left">
              <p className="font-medium">Takvim</p>
              <p className="text-xs opacity-80">Randevularımı gör</p>
            </div>
          </Button>
        </div>
      </Card>

      {/* Haftalık Özet */}
      <Card className="p-6 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">Bu Hafta</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{weeklyStats.buHaftaOlusturulan}</p>
            <p className="text-sm text-navy-500">Dosya Oluşturuldu</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{weeklyStats.buHaftaTahsilat}</p>
            <p className="text-sm text-navy-500">Tahsilat Yapıldı</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-emerald-600">{weeklyStats.tahsilatTL.toLocaleString("tr-TR")} ₺</p>
            <p className="text-xs text-navy-500">TL Tahsilat</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">{weeklyStats.tahsilatEUR.toLocaleString("tr-TR")} €</p>
            <p className="text-xs text-navy-500">EUR Tahsilat</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-amber-600">{weeklyStats.tahsilatUSD.toLocaleString("tr-TR")} $</p>
            <p className="text-xs text-navy-500">USD Tahsilat</p>
          </div>
        </div>
      </Card>

      {/* Dosya Durumu Dağılımı */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">Dosya Durumu Dağılımı</h3>
        <div className="space-y-3">
          {statusDistribution.map((status, index) => {
            const percentage = stats.toplam > 0 ? (status.count / stats.toplam) * 100 : 0;
            return (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-navy-700">{status.label}</span>
                    <span className="text-sm text-navy-500">{status.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${status.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-navy-400 w-12 text-right">{percentage.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">15 Gün İçinde</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.randevu15Gun}</p>
              <p className="text-xs text-navy-400 mt-1">Yaklaşan Randevu</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center shadow-inner">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">2 Gün İçinde</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.randevu2Gun}</p>
              <p className="text-xs text-navy-400 mt-1">Acil Randevu</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center shadow-inner">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">İşlemde</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.islemde}</p>
              <p className="text-xs text-navy-400 mt-1">Konsoloslukta</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center shadow-inner">
              <span className="text-2xl">🔄</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Ödenmemiş</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.odenmedi}</p>
              <p className="text-xs text-navy-400 mt-1">Bekleyen Tahsilat</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center shadow-inner">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Son İşlemlerim */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">📋</span>
            Son İşlemlerim
          </h3>
        </div>
        <div className="p-6">
          {recentLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📝</span>
              </div>
              <p className="text-navy-500 font-medium">Henüz işlem kaydı yok</p>
              <p className="text-navy-400 text-sm mt-1">İlk dosyanızı oluşturarak başlayın</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-4 p-4 bg-gradient-to-r from-navy-50 to-white rounded-xl hover:shadow-md transition-all duration-200 group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
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
                    {log.visa_files && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="info" size="sm">{log.visa_files.musteri_ad}</Badge>
                        <Badge variant="default" size="sm">{log.visa_files.hedef_ulke}</Badge>
                      </div>
                    )}
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
