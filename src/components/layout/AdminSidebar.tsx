"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import dynamic from "next/dynamic";

const AIAssistant = dynamic(() => import("@/components/ai/AIAssistant"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
    </div>
  ),
});

const menuGroups = [
  {
    title: "Ana Menü",
    items: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
      },
      {
        href: "/admin/files",
        label: "Vize Dosyaları",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      },
      {
        href: "/admin/bildirimler",
        label: "Bildirimler",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
      },
    ],
  },
  {
    title: "Randevu",
    items: [
      {
        href: "/admin/randevu-listesi",
        label: "Randevu Alınacak",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      },
      {
        href: "/admin/calendar",
        label: "Randevu Takvimi",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      },
    ],
  },
  {
    title: "Takip",
    items: [
      {
        href: "/admin/vize-bitisi",
        label: "Vize Bitiş Takibi",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      },
      {
        href: "/admin/groups",
        label: "Gruplar",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      },
    ],
  },
  {
    title: "Raporlar & Finans",
    items: [
      {
        href: "/admin/raporlar",
        label: "Raporlar",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      },
      {
        href: "/admin/randevu-raporlari",
        label: "Randevu Raporları",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      },
      {
        href: "/admin/gunluk-raporlar",
        label: "Günlük Raporlar",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      },
      {
        href: "/admin/payments",
        label: "Ödemeler",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      },
      {
        href: "/admin/cari-hesap",
        label: "Cari Hesap",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
      },
    ],
  },
  {
    title: "Sistem",
    items: [
      {
        href: "/admin/atamalar",
        label: "iDATA Atamaları",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      },
      {
        href: "/admin/logs",
        label: "Sistem Logları",
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
      },
      {
        href: "/admin/whatsapp",
        label: "WhatsApp",
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 2.121.555 4.11 1.527 5.835L0 24l6.315-1.527A11.962 11.962 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm6 16.2c-.247.7-1.4 1.3-2.3 1.5-.7.1-1.3.2-4.4-1-3.3-1.3-5.4-4.7-5.6-4.9-.2-.2-1.4-1.9-1.4-3.6s.9-2.5 1.2-2.9c.3-.3.7-.5 1-.5s.6 0 .8 0c.3 0 .6 0 .9.7.3.8 1.1 2.7 1.2 2.9.1.2.2.4.1.7-.1.3-.2.4-.4.6-.2.2-.4.5-.6.7-.2.2-.4.4-.2.8.2.4 1 1.6 2.1 2.6 1.4 1.3 2.6 1.7 3 1.9.3.2.5.2.7 0s.8-.9 1-1.2c.2-.3.5-.2.8-.1.3.1 1.9.9 2.2 1.1.3.2.6.3.7.5.1.4.1 1-.1 1.7z"/></svg>,
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <aside className="h-full w-[260px] bg-[#0b1120] flex flex-col border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white shadow-lg shadow-black/30 flex-shrink-0">
          <Image src="/fox-logo.jpg" alt="Fox Turizm" width={36} height={36} className="object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-white text-sm leading-tight">Fox Turizm</h1>
          <p className="text-[10px] text-orange-400 font-medium">Admin Panel</p>
        </div>
      </div>

      <div className="h-px bg-white/[0.06] mx-3" />

      {/* Menü - scrollable */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 sidebar-scroll">
        {menuGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            <p className="px-2.5 mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
              {group.title}
            </p>
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md mb-[1px] transition-all duration-100 group text-[13px] ${
                    isActive
                      ? "bg-orange-500/90 text-white font-medium shadow-sm shadow-orange-500/20"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                  }`}
                >
                  <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* AI Panel - kompakt */}
      <div className="flex-shrink-0 px-2.5 pb-2">
        {!aiOpen ? (
          <button
            onClick={() => setAiOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all group"
          >
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-[12px] font-medium text-slate-300 group-hover:text-white transition-colors">FOX AI</p>
              <p className="text-[10px] text-slate-600">Asistanı aç</p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-600 ml-auto group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        ) : (
          <div className="rounded-lg border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04]">
              <p className="text-[11px] font-medium text-slate-400">FOX AI Asistan</p>
              <button onClick={() => setAiOpen(false)} className="p-0.5 rounded text-slate-600 hover:text-slate-300 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              <AIAssistant isAdmin />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/[0.04] flex-shrink-0">
        <p className="text-[9px] text-slate-700 text-center">Fox Turizm &copy; 2026 &middot; Yusuf Kutas</p>
      </div>
    </aside>
  );
}
