"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PlatformSidebar } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";

const pageTitles: Record<string, string> = {
  "/visora": "Genel Bakış",
  "/visora/companies": "Şirketler",
  "/visora/payments": "Aylık Ödeme Takibi",
  "/visora/revenue": "Sistem Geliri",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<"checking" | "ok" | "denied">("checking");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = pageTitles[pathname] || "Visora";

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      if (profile?.role === "platform_owner") {
        setAuthorized("ok");
      } else {
        setAuthorized("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (authorized === "checking") {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 animate-pulse">
            <span className="text-white font-bold text-2xl">V</span>
          </div>
          <div className="w-8 h-8 border-4 border-primary-200/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-slate-400">Yetki kontrolü…</p>
        </div>
      </div>
    );
  }

  if (authorized === "denied") {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Yetkisiz erişim</h1>
          <p className="text-sm text-slate-400 mb-6">
            Bu alan yalnızca Visora platform sahibi içindir. Hesabınızda <code>platform_owner</code> rolü tanımlı değil.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-accent-600 hover:opacity-90 text-white text-sm font-medium"
          >
            Giriş ekranına dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div
        className={`fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <PlatformSidebar />
      </div>

      <div className="lg:ml-[260px]">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Menü"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
            <p className="text-xs text-slate-500">Visora · Platform Sahibi</p>
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
