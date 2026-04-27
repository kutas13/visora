"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  {
    href: "/visora/companies",
    label: "Şirketler",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0v-5a2 2 0 00-2-2h-2a2 2 0 00-2 2v5m-6 0v-5a2 2 0 012-2h2a2 2 0 012 2v5" />
      </svg>
    ),
  },
  {
    href: "/visora/payments",
    label: "Aylık Ödeme Takibi",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m-6 4h6m-6 4h4m4 6H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/visora/revenue",
    label: "Sistem Geliri (Ciro)",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8m0 0v6m0-6h-6" />
      </svg>
    ),
  },
  {
    href: "/visora/forms",
    label: "Formlar",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2a4 4 0 014-4h4M5 19a2 2 0 002 2h10a2 2 0 002-2V7l-5-5H7a2 2 0 00-2 2v15zM13 3v4a2 2 0 002 2h4" />
      </svg>
    ),
  },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <aside className="h-full w-[260px] bg-navy-900 flex flex-col border-r border-white/[0.06]">
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0">
        <div className="relative w-10 h-10 flex-shrink-0 rounded-xl bg-white/95 p-1 shadow-lg shadow-primary-500/30 ring-1 ring-white/20">
          <Image
            src="/visora-logo.png"
            alt="Visora"
            fill
            sizes="40px"
            className="object-contain p-0.5"
          />
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-white text-sm leading-tight truncate">Visora</h1>
          <p className="text-[10px] text-lilac-300 font-medium">Platform Sahibi</p>
        </div>
      </div>

      <div className="h-px bg-white/[0.06] mx-3" />

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="px-2.5 mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Ana Menü</p>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md mb-[1px] transition-all duration-100 group text-[13px] ${
                isActive
                  ? "bg-gradient-to-r from-primary-500 to-accent-600 text-white font-medium shadow-sm shadow-primary-500/30"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
              }`}
            >
              <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-white/[0.06] flex-shrink-0 space-y-2">
        <div className="text-[10px] text-slate-500 truncate" title={email}>
          {email || "—"}
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-[12px] px-3 py-2 rounded-md bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
        >
          Çıkış yap
        </button>
        <p className="text-[9px] text-slate-700 text-center pt-1">Visora &copy; {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
