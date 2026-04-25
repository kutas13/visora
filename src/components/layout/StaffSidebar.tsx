"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const AIAssistant = dynamic(() => import("@/components/ai/AIAssistant"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
    </div>
  ),
});

type Item = { href: string; label: string; exact?: boolean; icon: React.ReactNode };

const Icon = ({ d }: { d: string }) => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={d} />
  </svg>
);

const menuGroups: { title: string; items: Item[] }[] = [
  {
    title: "Genel",
    items: [
      { href: "/app", label: "Ana Sayfa", exact: true, icon: <Icon d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /> },
      { href: "/app/bildirimler", label: "Bildirimler", icon: <Icon d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1" /> },
    ],
  },
  {
    title: "Vize",
    items: [
      { href: "/app/files", label: "Vize Dosyaları", icon: <Icon d="M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zM14 4v5h5" /> },
      { href: "/app/musteriler", label: "Müşterilerim", icon: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM5 21a7 7 0 0114 0" /> },
      { href: "/app/vize-gorselleri", label: "Vize Görselleri", icon: <Icon d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v14H4z" /> },
      { href: "/app/vize-sonuc-takip", label: "Vize Sonuç Takip", icon: <Icon d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    ],
  },
  {
    title: "Randevu",
    items: [
      { href: "/app/randevu-listesi", label: "Randevu Alınacak", icon: <Icon d="M9 11l3 3 5-6M21 12A9 9 0 113 12a9 9 0 0118 0z" /> },
      { href: "/app/calendar", label: "Takvim", icon: <Icon d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" /> },
      { href: "/app/vize-bitisi", label: "Vize Bitişi", icon: <Icon d="M12 8v4l3 2M21 12A9 9 0 113 12a9 9 0 0118 0z" /> },
    ],
  },
  {
    title: "Finans",
    items: [
      { href: "/app/cari-hesap", label: "Cari Hesabım", icon: <Icon d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" /> },
      { href: "/app/payments", label: "Ödemeler", icon: <Icon d="M3 7h18M3 12h18M3 17h12" /> },
      { href: "/app/prim-takibi", label: "Prim Takibi", icon: <Icon d="M3 17l6-6 4 4 8-8M14 7h7v7" /> },
    ],
  },
  {
    title: "Raporlar",
    items: [
      { href: "/app/raporlar", label: "Vize Raporlarım", icon: <Icon d="M4 19V5m6 14V9m6 10v-6m4 6V3" /> },
      { href: "/app/aylik-ozet-rapor", label: "Aylık özet (PDF)", icon: <Icon d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h4" /> },
      { href: "/app/randevu-raporlari", label: "Randevu Raporları", icon: <Icon d="M4 19V9m4 10v-6m4 6V5m4 14v-9m4 9V13" /> },
      { href: "/app/groups", label: "Gruplar", icon: <Icon d="M17 11a3 3 0 100-6 3 3 0 000 6zm-10 0a3 3 0 100-6 3 3 0 000 6zM2 21a5 5 0 0110 0M14 21a5 5 0 0110 0" /> },
    ],
  },
];

export default function StaffSidebar() {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const [orgName, setOrgName] = useState<string>("Visora");

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
    <aside className="h-full w-[230px] bg-white border-r border-slate-200 flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-200 flex-shrink-0">
        <div className="relative w-7 h-7 flex-shrink-0">
          <Image
            src="/visora-logo.png"
            alt="Visora"
            fill
            sizes="28px"
            className="object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 leading-tight truncate">{orgName}</p>
          <p className="text-[10px] text-slate-500 leading-tight">Personel</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 sidebar-scroll">
        {menuGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4 px-3" : "px-3"}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-[1px]">
              {group.items.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`relative flex items-center gap-2.5 px-2 py-[7px] rounded-md text-[13px] transition-colors ${
                        isActive
                          ? "bg-slate-100 text-slate-900 font-medium"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary-600" />
                      )}
                      <span className={`flex-shrink-0 ${isActive ? "text-primary-600" : "text-slate-400"}`}>
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

      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200">
        {!aiOpen ? (
          <button
            onClick={() => setAiOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
              <Icon d="M13 10V3L4 14h7v7l9-11h-7z" />
            </span>
            <span className="font-medium">Visora AI</span>
            <span className="ml-auto text-slate-400">
              <Icon d="M9 5l7 7-7 7" />
            </span>
          </button>
        ) : (
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[11px] font-medium text-slate-700">Visora AI</p>
              <button
                onClick={() => setAiOpen(false)}
                className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Kapat"
              >
                <Icon d="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              <AIAssistant isAdmin={false} />
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-200 flex-shrink-0">
        <p className="text-[10px] text-slate-400 text-center">Visora &copy; {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
