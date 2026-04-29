"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";

const AIAssistant = dynamic(() => import("@/components/ai/AIAssistant"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
    </div>
  ),
});

type Item = { href: string; label: string; icon: React.ReactNode };

const Icon = ({ d }: { d: string }) => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={d} />
  </svg>
);

const menuGroups: { title: string; items: Item[] }[] = [
  {
    title: "Genel",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: <Icon d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /> },
      { href: "/admin/bildirimler", label: "Bildirimler", icon: <Icon d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1" /> },
      { href: "/admin/personel", label: "Personel", icon: <Icon d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM3 21a7 7 0 0118 0" /> },
    ],
  },
  {
    title: "Operasyon",
    items: [
      { href: "/admin/files/new", label: "Yeni Dosya", icon: <Icon d="M12 4v16m8-8H4" /> },
      { href: "/admin/files", label: "Vize Dosyaları", icon: <Icon d="M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zM14 4v5h5" /> },
      { href: "/admin/musteriler", label: "Müşteriler", icon: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM5 21a7 7 0 0114 0" /> },
      { href: "/admin/vize-gorselleri", label: "Vize Görselleri", icon: <Icon d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v14H4z" /> },
      { href: "/admin/vize-sonuc-takip", label: "Vize Sonuç Takip", icon: <Icon d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    ],
  },
  {
    title: "Randevu",
    items: [
      { href: "/admin/randevu-listesi", label: "Randevu Alınacak", icon: <Icon d="M9 11l3 3 5-6M21 12A9 9 0 113 12a9 9 0 0118 0z" /> },
      { href: "/admin/calendar", label: "Takvim", icon: <Icon d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" /> },
      { href: "/admin/vize-bitisi", label: "Vize Bitişi", icon: <Icon d="M12 8v4l3 2M21 12A9 9 0 113 12a9 9 0 0118 0z" /> },
    ],
  },
  {
    title: "Finans",
    items: [
      { href: "/admin/kasa", label: "Kasa", icon: <Icon d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM12 14v2m-3-2h6" /> },
      { href: "/admin/banka-hesaplari", label: "Banka Hesapları", icon: <Icon d="M4 10h16M4 6l8-3 8 3M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" /> },
      { href: "/admin/cari-hesap", label: "Cari Hesap", icon: <Icon d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" /> },
      { href: "/admin/payments", label: "Ödemeler", icon: <Icon d="M3 7h18M3 12h18M3 17h12" /> },
    ],
  },
  {
    title: "Raporlar",
    items: [
      { href: "/admin/raporlar", label: "Raporlar", icon: <Icon d="M4 19V5m6 14V9m6 10v-6m4 6V3" /> },
      { href: "/admin/aylik-ozet-rapor", label: "Aylık özet (PDF)", icon: <Icon d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h4" /> },
      { href: "/admin/randevu-raporlari", label: "Randevu Raporları", icon: <Icon d="M4 19V9m4 10v-6m4 6V5m4 14v-9m4 9V13" /> },
      { href: "/admin/groups", label: "Gruplar", icon: <Icon d="M17 11a3 3 0 100-6 3 3 0 000 6zm-10 0a3 3 0 100-6 3 3 0 000 6zM2 21a5 5 0 0110 0M14 21a5 5 0 0110 0" /> },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/logs", label: "Sistem Logları", icon: <Icon d="M9 5h6M9 9h6M9 13h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /> },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const [orgName, setOrgName] = useState<string>("");

  const activeHref = (() => {
    let best = "";
    for (const group of menuGroups) {
      for (const item of group.items) {
        const matches =
          pathname === item.href || pathname.startsWith(item.href + "/");
        if (matches && item.href.length > best.length) best = item.href;
      }
    }
    return best;
  })();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();
        if (!profile?.organization_id) return;
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profile.organization_id)
          .single();
        if (!cancelled && org?.name) setOrgName(org.name);
      } catch {
        /* sessizce devam */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="h-full w-[260px] relative flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      {/* dekoratif arka plan blob'lar */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-indigo-600 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-fuchsia-600 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
        <div className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-violet-600 blur-3xl animate-blob" style={{ animationDelay: "8s" }} />
      </div>

      {/* Brand */}
      <div className="relative h-16 flex items-center gap-3 px-5 border-b border-white/5 flex-shrink-0">
        <div className="relative w-9 h-9 flex-shrink-0 rounded-xl bg-white/5 backdrop-blur-sm ring-1 ring-white/10 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)]">
          <Image src="/visora-logo.png" alt="Visora" width={26} height={26} className="object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold leading-tight truncate tracking-tight">
            <span className="bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">Visora</span>
            {orgName ? <span className="text-slate-500 font-normal"> — </span> : null}
            {orgName && <span className="text-slate-200">{orgName}</span>}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 leading-tight mt-0.5">Yönetim</p>
        </div>
      </div>

      {/* Menü */}
      <nav className="relative flex-1 overflow-y-auto py-3 sidebar-scroll">
        {menuGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5 px-3" : "px-3"}>
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeHref === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/15 text-white font-semibold ring-1 ring-white/10 shadow-[0_4px_18px_-6px_rgba(99,102,241,0.55)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-indigo-400 via-violet-400 to-fuchsia-400" />
                      )}
                      <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-500 group-hover:text-white"}`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* AI Asistan */}
      <div className="relative flex-shrink-0 px-3 py-2 border-t border-white/5">
        {!aiOpen ? (
          <button
            onClick={() => setAiOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[13px] text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_6px_18px_-6px_rgba(168,85,247,0.6)]">
              <Icon d="M13 10V3L4 14h7v7l9-11h-7z" />
            </span>
            <span className="font-semibold">Visora AI</span>
            <span className="ml-auto text-slate-500">
              <Icon d="M9 5l7 7-7 7" />
            </span>
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-900/80 backdrop-blur">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
              <p className="text-[11px] font-semibold text-slate-200">Visora AI</p>
              <button
                onClick={() => setAiOpen(false)}
                className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                aria-label="Kapat"
              >
                <Icon d="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <div className="max-h-[260px] overflow-y-auto bg-white text-slate-900">
              <AIAssistant isAdmin />
            </div>
          </div>
        )}
      </div>

      <div className="relative px-3 py-2 border-t border-white/5 flex-shrink-0">
        <p className="text-[10px] text-slate-500 text-center">Visora &copy; {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
