"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import FileDetailModal from "@/components/files/FileDetailModal";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  file_id: string | null;
  user_id: string;
  profiles?: { name: string } | null;
}

function getKindIcon(kind: string) {
  const icons: Record<string, { bg: string; gradient: string; icon: string }> = {
    file_created: { bg: "bg-green-100", gradient: "from-green-500 to-emerald-600", icon: "📁" },
    file_updated: { bg: "bg-blue-100", gradient: "from-blue-500 to-blue-600", icon: "✏️" },
    status_change: { bg: "bg-purple-100", gradient: "from-purple-500 to-purple-600", icon: "🔄" },
    dosya_hazir: { bg: "bg-emerald-100", gradient: "from-emerald-500 to-emerald-600", icon: "✅" },
    randevu_15: { bg: "bg-amber-100", gradient: "from-amber-500 to-orange-500", icon: "📅" },
    randevu_2: { bg: "bg-red-100", gradient: "from-red-500 to-red-600", icon: "⚠️" },
    evrak_gelmedi: { bg: "bg-orange-100", gradient: "from-orange-500 to-orange-600", icon: "📋" },
    evrak_eksik_5: { bg: "bg-yellow-100", gradient: "from-yellow-500 to-amber-500", icon: "📝" },
    vize_bitis: { bg: "bg-purple-100", gradient: "from-purple-500 to-indigo-600", icon: "🛂" },
    transfer: { bg: "bg-indigo-100", gradient: "from-indigo-500 to-indigo-600", icon: "🔀" },
    payment: { bg: "bg-emerald-100", gradient: "from-emerald-500 to-green-600", icon: "💰" },
    internal_message: { bg: "bg-blue-100", gradient: "from-blue-500 to-blue-600", icon: "💬" },
  };
  return icons[kind] || { bg: "bg-slate-100", gradient: "from-slate-500 to-slate-600", icon: "🔔" };
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Az önce";
  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 1) return "Dün";
  if (diffDays < 7) return `${diffDays} gün önce`;
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const KIND_OPTIONS = [
  { value: "all", label: "Tüm Türler" },
  { value: "file_created", label: "Dosya Oluşturma" },
  { value: "file_updated", label: "Dosya Güncelleme" },
  { value: "status_change", label: "Durum Değişikliği" },
  { value: "dosya_hazir", label: "Dosya Hazır" },
  { value: "transfer", label: "Transfer/Atama" },
  { value: "payment", label: "Ödeme" },
  { value: "randevu_15", label: "Randevu (15 Gün)" },
  { value: "randevu_2", label: "Randevu (2 Gün)" },
  { value: "vize_bitis", label: "Vize Bitiş" },
  { value: "internal_message", label: "Dahili Mesaj" },
];

export default function AdminBildirimlerPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState("all");
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    
    let query = supabase
      .from("notifications")
      .select("*, profiles:user_id(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filterKind !== "all") {
      query = query.eq("kind", filterKind);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Bildirimler yüklenirken hata:", error);
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  }, [filterKind]);

  const markAsRead = async (notifId: string) => {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const runCronManually = async () => {
    setCronRunning(true);
    setCronResult(null);
    try {
      const response = await fetch(`/api/cron/notify?secret=visora-cron-secret`);
      const data = await response.json();
      setCronResult(data.message || JSON.stringify(data));
      loadNotifications();
    } catch (err) {
      setCronResult("Hata oluştu");
    } finally {
      setCronRunning(false);
    }
  };

  const handleDetailClick = (fileId: string | null) => {
    if (fileId) {
      setDetailFileId(fileId);
      setShowDetailModal(true);
    }
  };

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.is_read).length,
    today: notifications.filter(n => {
      const today = new Date().toDateString();
      return new Date(n.created_at).toDateString() === today;
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-amber-500 via-orange-500 to-rose-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Sistem</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Tüm Bildirimler</h1>
            <p className="text-slate-500 text-sm mt-1">Sistem tarafından oluşturulan tüm bildirimleri yönet ve filtrele</p>
          </div>
        </div>
        <div className="flex gap-2">
        {stats.unread > 0 && (
          <Button onClick={markAllAsRead} variant="outline" className="shadow-md">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tümünü Oku ({stats.unread})
          </Button>
        )}
        <Button onClick={runCronManually} disabled={cronRunning} variant="outline" className="shadow-md">
          {cronRunning ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Çalışıyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Cron'u Elle Çalıştır
            </>
          )}
        </Button>
        </div>
      </div>

      {cronResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xl">✓</span>
          </div>
          <div>
            <p className="font-medium">Cron Tamamlandı</p>
            <p className="text-sm">{cronResult}</p>
          </div>
        </div>
      )}

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">TOPLAM</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Toplam Bildirim</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide">OKUNMAMIŞ</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.unread}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Okunmamış Bildirim</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-green-500 uppercase tracking-wide">BUGÜN</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.today}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Bugünkü Bildirim</p>
        </div>
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtreler
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Select
                label="Bildirim Türü"
                options={KIND_OPTIONS}
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
              />
            </div>
            <Button onClick={loadNotifications}>Filtrele</Button>
          </div>
        </div>
      </div>

      {/* Bildirim Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Bildirimler
          </h3>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">{notifications.length}</span>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Bildirim Bulunamadı</h3>
              <p className="text-slate-500">Filtrelerinize uygun bildirim yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif, index) => {
                const kindStyle = getKindIcon(notif.kind);
                return (
                  <div 
                    key={notif.id} 
                    className={`flex items-start gap-4 p-4 rounded-xl transition-all hover:shadow-md ${
                      notif.is_read ? (index % 2 === 0 ? "bg-slate-50" : "bg-white") : "bg-primary-50 border-l-4 border-l-primary-500"
                    }`}
                  >
                    <div className={`w-14 h-14 bg-gradient-to-br ${kindStyle.gradient} rounded-xl flex items-center justify-center text-2xl text-white shadow-lg flex-shrink-0`}>
                      {kindStyle.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-slate-800">{notif.title}</h4>
                        {!notif.is_read && <Badge variant="warning" size="sm" className="animate-pulse">Yeni</Badge>}
                      </div>
                      <p className="text-slate-600 text-sm">{notif.body}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-bold text-[10px]">{notif.profiles?.name?.charAt(0) || "?"}</span>
                          </span>
                          {notif.profiles?.name || "Bilinmeyen"}
                        </span>
                        <span>🕐 {formatTime(notif.created_at)}</span>
                        <Badge variant="default" size="sm">{notif.kind}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {notif.file_id && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDetailClick(notif.file_id)}
                        >
                          Detay
                        </Button>
                      )}
                      {!notif.is_read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          Okundu
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detay Modal */}
      <FileDetailModal
        fileId={detailFileId}
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setDetailFileId(null); }}
        scrollToHistoryOnOpen
        title="Dosya ve işlem geçmişi"
      />
    </div>
  );
}
