"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge } from "@/components/ui";
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
  return icons[kind] || { bg: "bg-navy-100", gradient: "from-navy-500 to-navy-600", icon: "🔔" };
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

export default function BildirimlerPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;
    setCurrentUserId(user.id);
    
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Bildirimler yüklenirken hata:", error);
    } else {
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    loadNotifications();
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", currentUserId)
      .eq("is_read", false);
    loadNotifications();
  };

  const handleDetailClick = (fileId: string | null) => {
    if (fileId) {
      setDetailFileId(fileId);
      setShowDetailModal(true);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">🔔</span>
            Bildirimlerim
          </h1>
          <p className="text-navy-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim var` : "Tüm bildirimler okundu ✓"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" className="shadow-md">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Tümünü Okundu Yap
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center shadow-lg">
          <div className="w-24 h-24 bg-gradient-to-br from-navy-100 to-navy-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🔔</span>
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Bildirim Yok</h3>
          <p className="text-navy-500">Henüz hiç bildiriminiz bulunmuyor. Yeni gelişmeler olduğunda burada göreceksiniz.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Okunmamış Bildirimler */}
          {unreadNotifications.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-navy-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></span>
                Okunmamış ({unreadNotifications.length})
              </h3>
              <div className="space-y-3">
                {unreadNotifications.map((notif) => {
                  const kindStyle = getKindIcon(notif.kind);
                  return (
                    <Card 
                      key={notif.id} 
                      className="p-5 border-l-4 border-l-primary-500 bg-gradient-to-r from-primary-50/50 to-white shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 bg-gradient-to-br ${kindStyle.gradient} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
                          {kindStyle.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-navy-900">{notif.title}</h4>
                            <Badge variant="warning" size="sm" className="animate-pulse">Yeni</Badge>
                          </div>
                          <p className="text-navy-600 text-sm leading-relaxed">{notif.body}</p>
                          <p className="text-navy-400 text-xs mt-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(notif.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {notif.file_id && (
                            <Button size="sm" variant="outline" onClick={() => handleDetailClick(notif.file_id)} className="shadow-sm">
                              Detay Gör
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => markAsRead(notif.id)}>
                            Okundu
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Okunmuş Bildirimler */}
          {readNotifications.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-navy-500 uppercase tracking-wide mb-4">
                Okunmuş ({readNotifications.length})
              </h3>
              <div className="space-y-2">
                {readNotifications.map((notif) => {
                  const kindStyle = getKindIcon(notif.kind);
                  return (
                    <Card key={notif.id} className="p-4 opacity-70 hover:opacity-100 transition-opacity">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 ${kindStyle.bg} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
                          {kindStyle.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-navy-700">{notif.title}</h4>
                          <p className="text-navy-500 text-sm">{notif.body}</p>
                          <p className="text-navy-400 text-xs mt-1">{formatTime(notif.created_at)}</p>
                        </div>
                        {notif.file_id && (
                          <Button size="sm" variant="outline" onClick={() => handleDetailClick(notif.file_id)} className="text-xs shrink-0">
                            Görüntüle
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
