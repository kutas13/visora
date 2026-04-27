"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TopNav } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";

const pageTitles: Record<string, string> = {
  "/visora": "Genel Bakış",
  "/visora/companies": "Şirketler",
  "/visora/payments": "Aylık Ödeme Takibi",
  "/visora/revenue": "Sistem Geliri",
  "/visora/forms": "Formlar",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<"checking" | "ok" | "denied">("checking");
  const [userName, setUserName] = useState<string>("Owner");
  const title = pageTitles[pathname] || "Visora";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = title ? `${title} · Visora` : "Visora";
    }
  }, [title]);

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
        .select("role, name")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      if (profile?.role === "platform_owner") {
        setAuthorized("ok");
        if (profile.name) setUserName(profile.name);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600 blur-3xl animate-blob" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-fuchsia-600 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-[0_20px_60px_-20px_rgba(99,102,241,0.6)] animate-pulse">
            <span className="text-white font-bold text-2xl">V</span>
          </div>
          <div className="w-8 h-8 border-4 border-white/10 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-slate-400">Yetki kontrolü…</p>
        </div>
      </div>
    );
  }

  if (authorized === "denied") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Yetkisiz erişim</h1>
          <p className="text-sm text-slate-400 mb-6">
            Bu alan yalnızca Visora platform sahibi içindir. Hesabınızda <code>platform_owner</code> rolü tanımlı değil.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-90 text-white text-sm font-medium"
          >
            Giriş ekranına dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav variant="platform" userName={userName} />
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-6">{children}</main>
    </div>
  );
}
