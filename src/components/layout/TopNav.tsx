"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { logLogout } from "@/lib/audit/authLog";

const AIAssistant = dynamic(() => import("@/components/ai/AIAssistant"), { ssr: false });

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: string; // SVG path d
  exact?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/* ---------------------- Menü tanımları ---------------------- */

const ADMIN_GROUPS: NavGroup[] = [
  {
    id: "operasyon",
    label: "Operasyon",
    items: [
      {
        href: "/admin/files/new",
        label: "Yeni Dosya",
        description: "Hızlıca yeni vize dosyası oluştur",
        icon: "M12 4v16m8-8H4",
      },
      {
        href: "/admin/files",
        label: "Vize Dosyaları",
        description: "Tüm aktif & geçmiş dosyaları gör",
        icon: "M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zM14 4v5h5",
      },
      {
        href: "/admin/musteriler",
        label: "Müşteriler",
        description: "Müşteri kartları & geçmişi",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM5 21a7 7 0 0114 0",
      },
      {
        href: "/admin/vize-sonuc-takip",
        label: "Vize Sonuç Takip",
        description: "İşlemdeki dosyaların sonuç akışı",
        icon: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      {
        href: "/admin/vize-gorselleri",
        label: "Vize Görselleri",
        description: "Pasaport ve vize fotoğraf arşivi",
        icon: "M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v14H4z",
      },
    ],
  },
  {
    id: "randevu",
    label: "Randevu",
    items: [
      {
        href: "/admin/randevu-listesi",
        label: "Randevu Alınacak",
        description: "Bekleyen randevu işlemleri",
        icon: "M9 11l3 3 5-6M21 12A9 9 0 113 12a9 9 0 0118 0z",
      },
      {
        href: "/admin/calendar",
        label: "Takvim",
        description: "Tüm randevuları takvim üstünde",
        icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
      },
      {
        href: "/admin/vize-bitisi",
        label: "Vize Bitişi",
        description: "Süresi dolacak vizelerin takibi",
        icon: "M12 8v4l3 2M21 12A9 9 0 113 12a9 9 0 0118 0z",
      },
    ],
  },
  {
    id: "finans",
    label: "Finans",
    items: [
      {
        href: "/admin/kasa",
        label: "Kasa",
        description: "Nakit, peşin, hesaba EFT, cari",
        icon: "M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM12 14v2m-3-2h6",
      },
      {
        href: "/admin/payments",
        label: "Ödemeler",
        description: "Tüm tahsilat & ödemeler",
        icon: "M3 7h18M3 12h18M3 17h12",
      },
      {
        href: "/admin/cari-hesap",
        label: "Cari Hesap",
        description: "Firmalar bazında cari özet",
        icon: "M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
      },
    ],
  },
  {
    id: "raporlar",
    label: "Raporlar",
    items: [
      {
        href: "/admin/raporlar",
        label: "Raporlar",
        description: "Performans & operasyon raporları",
        icon: "M4 19V5m6 14V9m6 10v-6m4 6V3",
      },
      {
        href: "/admin/aylik-ozet-rapor",
        label: "Aylık Özet (PDF)",
        description: "İndirilebilir aylık özet",
        icon: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h4",
      },
      {
        href: "/admin/randevu-raporlari",
        label: "Randevu Raporları",
        description: "Randevu analiz raporları",
        icon: "M4 19V9m4 10v-6m4 6V5m4 14v-9m4 9V13",
      },
      {
        href: "/admin/groups",
        label: "Gruplar",
        description: "Müşteri grupları",
        icon: "M17 11a3 3 0 100-6 3 3 0 000 6zm-10 0a3 3 0 100-6 3 3 0 000 6zM2 21a5 5 0 0110 0M14 21a5 5 0 0110 0",
      },
    ],
  },
  {
    id: "yonetim",
    label: "Yönetim",
    items: [
      {
        href: "/admin/personel",
        label: "Personel",
        description: "Çalışan ekibinizi yönetin",
        icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM3 21a7 7 0 0118 0",
      },
      {
        href: "/admin/logs",
        label: "Sistem Logları",
        description: "Tüm işlem ve aktivite kayıtları",
        icon: "M9 5h6M9 9h6M9 13h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
      },
    ],
  },
];

const STAFF_GROUPS: NavGroup[] = [
  {
    id: "operasyon",
    label: "Operasyon",
    items: [
      {
        href: "/app/files",
        label: "Vize Dosyaları",
        description: "Aktif dosyalarınız",
        icon: "M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zM14 4v5h5",
      },
      {
        href: "/app/musteriler",
        label: "Müşterilerim",
        description: "Sizinle ilişkili müşteriler",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM5 21a7 7 0 0114 0",
      },
      {
        href: "/app/vize-sonuc-takip",
        label: "Vize Sonuç Takip",
        description: "Sizdeki dosyaların durumu",
        icon: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      {
        href: "/app/vize-gorselleri",
        label: "Vize Görselleri",
        description: "Pasaport & vize görselleri",
        icon: "M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v14H4z",
      },
    ],
  },
  {
    id: "randevu",
    label: "Randevu",
    items: [
      {
        href: "/app/randevu-listesi",
        label: "Randevu Alınacak",
        description: "Sizden beklenen randevu işlemleri",
        icon: "M9 11l3 3 5-6M21 12A9 9 0 113 12a9 9 0 0118 0z",
      },
      {
        href: "/app/calendar",
        label: "Takvim",
        description: "Randevularınız",
        icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
      },
      {
        href: "/app/vize-bitisi",
        label: "Vize Bitişi",
        description: "Süresi yaklaşan vizeler",
        icon: "M12 8v4l3 2M21 12A9 9 0 113 12a9 9 0 0118 0z",
      },
    ],
  },
  {
    id: "finans",
    label: "Finans",
    items: [
      {
        href: "/app/payments",
        label: "Ödemeler",
        description: "Tahsilat & ödeme akışı",
        icon: "M3 7h18M3 12h18M3 17h12",
      },
      {
        href: "/app/cari-hesap",
        label: "Cari Hesabım",
        description: "Cari kayıtlarım",
        icon: "M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
      },
    ],
  },
  {
    id: "raporlar",
    label: "Raporlar",
    items: [
      {
        href: "/app/raporlar",
        label: "Vize Raporlarım",
        description: "Performans analiziniz",
        icon: "M4 19V5m6 14V9m6 10v-6m4 6V3",
      },
      {
        href: "/app/aylik-ozet-rapor",
        label: "Aylık Özet (PDF)",
        description: "Aylık raporunuzu indirin",
        icon: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h4",
      },
      {
        href: "/app/randevu-raporlari",
        label: "Randevu Raporları",
        description: "Randevu analizleri",
        icon: "M4 19V9m4 10v-6m4 6V5m4 14v-9m4 9V13",
      },
      {
        href: "/app/groups",
        label: "Gruplar",
        description: "Müşteri grupları",
        icon: "M17 11a3 3 0 100-6 3 3 0 000 6zm-10 0a3 3 0 100-6 3 3 0 000 6zM2 21a5 5 0 0110 0M14 21a5 5 0 0110 0",
      },
    ],
  },
];

const PLATFORM_GROUPS: NavGroup[] = [
  {
    id: "yonetim",
    label: "Yönetim",
    items: [
      {
        href: "/visora/companies",
        label: "Şirketler",
        description: "Tüm Visora şirket hesapları",
        icon: "M3 21h18M5 21V7l8-4 8 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1",
      },
      {
        href: "/visora/forms",
        label: "Formlar",
        description: "Ana sayfadan gelen iletişim talepleri",
        icon: "M9 17h6M9 13h6M9 9h2M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
      },
      {
        href: "/visora/logs",
        label: "Giriş / Çıkış Logları",
        description: "Genel müdür ve personel oturum kayıtları",
        icon: "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1",
      },
    ],
  },
  {
    id: "finans",
    label: "Finans",
    items: [
      {
        href: "/visora/payments",
        label: "Aylık Ödeme Takibi",
        description: "Şirket abonelik ödemeleri",
        icon: "M3 7h18M3 12h18M3 17h12",
      },
      {
        href: "/visora/revenue",
        label: "Sistem Geliri",
        description: "Toplam Visora ciro analizi",
        icon: "M4 19V5m6 14V9m6 10v-6m4 6V3",
      },
    ],
  },
];

/* ---------------------- Yardımcı: ortak ikon ---------------------- */

const Icon = ({ d, className = "w-5 h-5" }: { d: string; className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d} />
  </svg>
);

/* ---------------------- TopNav ---------------------- */

interface TopNavProps {
  variant: "admin" | "staff" | "platform";
  userName?: string;
  orgName?: string;
}

export default function TopNav({ variant, userName = "Kullanıcı", orgName = "" }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const groups = variant === "admin" ? ADMIN_GROUPS : variant === "staff" ? STAFF_GROUPS : PLATFORM_GROUPS;
  const homeHref = variant === "admin" ? "/admin/dashboard" : variant === "staff" ? "/app" : "/visora";
  const notifHref = variant === "admin" ? "/admin/bildirimler" : variant === "staff" ? "/app/bildirimler" : null;

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bildirim sayacı
  useEffect(() => {
    if (!notifHref) return;
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (!cancelled) setUnread(count || 0);
    };
    load();
    const it = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(it);
    };
  }, [notifHref]);

  // Sayfa değişince menüleri kapat
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    setProfileOpen(false);
    setAiOpen(false);
  }, [pathname]);

  // Dış tıklama / ESC
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setProfileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setProfileOpen(false);
        setMobileOpen(false);
        setAiOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    // Audit log: signOut'tan ÖNCE yaz (sonra auth.uid() boşalır, RLS yazımı reddeder)
    await logLogout(supabase);
    await supabase.auth.signOut();
    router.push(variant === "admin" ? "/admin" : "/login");
    router.refresh();
  };

  const isItemActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const isGroupActive = (g: NavGroup) => g.items.some(isItemActive);

  return (
    <header
      ref={containerRef}
      className="sticky top-0 z-40 bg-slate-950 text-slate-200 border-b border-white/5"
    >
      {/* Dekoratif gradient çizgi */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

      <div className="relative max-w-[1600px] mx-auto px-4 lg:px-8 h-16 flex items-center gap-4">
        {/* Brand */}
        <Link href={homeHref} className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="relative w-9 h-9 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] group-hover:ring-indigo-400/40 transition">
            <Image src="/visora-logo.png" alt="Visora" width={26} height={26} className="object-contain" />
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-[14px] font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
                Visora
              </span>
              {orgName ? <span className="text-slate-500 font-normal"> — </span> : null}
              {orgName && <span className="text-slate-200">{orgName}</span>}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {variant === "admin" ? "Yönetim Paneli" : variant === "staff" ? "Personel Paneli" : "Platform Paneli"}
            </p>
          </div>
        </Link>

        {/* Ana men u00fc — desktop */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 ml-2">
          {/* Ana Sayfa link'i */}
          <Link
            href={homeHref}
            className={`px-3 py-2 text-[13px] font-medium rounded-lg transition ${
              pathname === homeHref
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            Ana Sayfa
          </Link>

          {groups.map((group) => {
            const active = isGroupActive(group);
            const isOpen = openGroup === group.id;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  onMouseEnter={() => setOpenGroup(group.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-lg transition ${
                    active || isOpen
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{group.label}</span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div
                    onMouseLeave={() => setOpenGroup(null)}
                    className="absolute left-0 top-full mt-2 w-[420px] rounded-2xl bg-white text-slate-900 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/60 overflow-hidden z-50"
                  >
                    <div className="p-2">
                      <div className="grid grid-cols-1 gap-0.5">
                        {group.items.map((item) => {
                          const itemActive = isItemActive(item);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-start gap-3 p-3 rounded-xl transition ${
                                itemActive ? "bg-indigo-50" : "hover:bg-slate-50"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                                  itemActive
                                    ? "bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_6px_18px_-6px_rgba(99,102,241,0.6)]"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <Icon d={item.icon} className="w-[18px] h-[18px]" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-[13px] font-semibold leading-tight ${
                                    itemActive ? "text-indigo-700" : "text-slate-900"
                                  }`}
                                >
                                  {item.label}
                                </p>
                                {item.description && (
                                  <p className="text-[11.5px] text-slate-500 mt-0.5">{item.description}</p>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sağ aksiyonlar */}
        <div className="ml-auto flex items-center gap-1 lg:gap-2">
          {/* AI Asistan (sadece admin/staff için) */}
          {variant !== "platform" && (
            <button
              onClick={() => setAiOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-200 bg-white/5 hover:bg-white/10 ring-1 ring-white/5 transition"
              title="Visora AI"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white">
                <Icon d="M13 10V3L4 14h7v7l9-11h-7z" className="w-3 h-3" />
              </span>
              <span className="hidden xl:inline">Visora AI</span>
            </button>
          )}

          {/* Bildirim */}
          {notifHref && (
            <Link
              href={notifHref}
              className="relative p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition"
              title="Bildirimler"
            >
              <Icon d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-slate-950">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}

          {/* Profil avatar dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 rounded-xl hover:bg-white/5 transition"
            >
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(99,102,241,0.6)]">
                <span className="text-white font-extrabold text-sm">{userName.charAt(0).toUpperCase()}</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              </div>
              <div className="hidden md:block text-left leading-tight pr-2">
                <p className="text-[12.5px] font-semibold text-white truncate max-w-[140px]">{userName}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  {variant === "admin" ? "Genel Müdür" : variant === "staff" ? "Personel" : "Owner"}
                </p>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white text-slate-900 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/60 overflow-hidden z-50">
                <div className="p-3 border-b border-slate-100 bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{userName}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {orgName ? orgName : variant === "platform" ? "Visora · Platform" : "Visora kullanıcısı"}
                  </p>
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Icon
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      className="w-4 h-4"
                    />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobil hamburger */}
          <button
            className="lg:hidden p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition"
            onClick={() => setMobileOpen(true)}
            aria-label="Menü"
          >
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
        </div>
      </div>

      {/* Mobil menü */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-slate-950 overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                <Image src="/visora-logo.png" alt="Visora" width={22} height={22} className="object-contain" />
              </div>
              <p className="text-sm font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
                  Visora
                </span>
                {orgName ? <span className="text-slate-500 font-normal"> — {orgName}</span> : null}
              </p>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 text-slate-300 hover:text-white"
              aria-label="Kapat"
            >
              <Icon d="M6 18L18 6M6 6l12 12" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            <Link
              href={homeHref}
              className={`block px-4 py-3 rounded-xl text-sm font-semibold ${
                pathname === homeHref
                  ? "bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/15 text-white ring-1 ring-white/10"
                  : "bg-white/5 text-slate-300"
              }`}
            >
              Ana Sayfa
            </Link>

            {groups.map((group) => (
              <div key={group.id}>
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const itemActive = isItemActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                          itemActive
                            ? "bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/15 text-white ring-1 ring-white/10"
                            : "text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            itemActive
                              ? "bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          <Icon d={item.icon} className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold leading-tight">{item.label}</p>
                          {item.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20 text-sm font-semibold"
            >
              <Icon
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                className="w-4 h-4"
              />
              Çıkış Yap
            </button>
          </div>
        </div>
      )}

      {/* AI Asistan modal */}
      {aiOpen && variant !== "platform" && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 lg:p-6 bg-slate-950/70 backdrop-blur-md">
          <div className="w-full md:max-w-3xl lg:max-w-4xl bg-white rounded-t-3xl md:rounded-2xl shadow-2xl ring-1 ring-slate-200/70 h-[92vh] md:h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-sm">
                  <Icon d="M13 10V3L4 14h7v7l9-11h-7z" className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 leading-tight">Visora AI</p>
                  <p className="text-[10.5px] text-slate-500 leading-tight">Akıllı asistan</p>
                </div>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
              >
                <Icon d="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AIAssistant isAdmin={variant === "admin"} embedded />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
