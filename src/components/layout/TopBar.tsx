"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TopBarProps {
  title: string;
  userName?: string;
  variant?: "staff" | "admin";
}

export default function TopBar({ title, userName = "Kullanıcı", variant = "staff" }: TopBarProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUnreadCount() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      // Sadece kendi bildirimlerini say
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      setUnreadCount(count || 0);
    }
    
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(variant === "admin" ? "/admin" : "/login");
    router.refresh();
  };

  const notifPath = variant === "admin" ? "/admin/bildirimler" : "/app/bildirimler";

  return (
    <header className="h-16 bg-white border-b border-navy-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <h1 className="text-xl font-bold text-navy-900">{title}</h1>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push(notifPath)}
          className="relative p-2 text-navy-500 hover:bg-navy-100 rounded-xl transition-colors"
          title="Bildirimler"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 shadow-lg animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-navy-200">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-navy-900">{userName}</p>
            <p className="text-xs text-navy-500">{variant === "admin" ? "Yönetici" : "Personel"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="Çıkış Yap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
