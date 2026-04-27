"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// Eski hardcoded avatar listesi kaldirildi.
// Her kullanici default initial avatar kullanir; ileride
// profile.avatar_url eklenecek.
const USER_AVATARS: Record<string, string> = {};

interface TopBarProps {
  title: string;
  userName?: string;
  variant?: "staff" | "admin";
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function TopBar({ title, userName = "Kullanıcı", variant = "staff", onMenuToggle, sidebarOpen = false }: TopBarProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUnreadCount() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
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
    <header className="h-16 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        {/* Hamburger / Kapat - sadece mobilde */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors relative z-[60]"
            aria-label={sidebarOpen ? "Menüyü Kapat" : "Menü"}
          >
            {sidebarOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <span className="hidden md:inline-block w-1.5 h-7 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <h1 className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 truncate">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => router.push(notifPath)}
          className="relative p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
          title="Bildirimler"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-3 border-l border-slate-200">
          {USER_AVATARS[userName.toUpperCase()] ? (
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl overflow-hidden ring-2 ring-white shadow-md">
              <Image
                src={USER_AVATARS[userName.toUpperCase()]}
                alt={userName}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="relative w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(99,102,241,0.6)]">
              <span className="text-white font-extrabold text-sm tracking-wide">{userName.charAt(0).toUpperCase()}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
          )}
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-slate-900">{userName}</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">
              {variant === "admin" ? "Genel Müdür" : "Personel"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-1 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
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
