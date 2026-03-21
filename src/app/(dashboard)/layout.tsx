"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const allItems = [
  { href: "/dashboard", label: "Dashboard", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/clients", label: "Müşteriler", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/visa-files", label: "Vize Dosyaları", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/calendar", label: "Randevu Takvimi", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/visa-expiry", label: "Vize Bitiş Takibi", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/whatsapp", label: "WhatsApp", roles: ["agency_admin"] },
  { href: "/dashboard/payments", label: "Ödemeler", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/reports", label: "Raporlarım", roles: ["agency_admin", "staff"] },
  { href: "/dashboard/staff", label: "Personel", roles: ["agency_admin"] },
  { href: "/dashboard/settings", label: "Ayarlar", roles: ["agency_admin"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState("agency_admin");
  const [userName, setUserName] = useState("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("user_role") || "agency_admin");
    setUserName(localStorage.getItem("user_name") || "");
    setAgencyName(localStorage.getItem("agency_name") || "");
  }, []);

  const items = allItems.filter((i) => i.roles.includes(role));

  return (
    <div className="min-h-screen bg-navy-50 lg:flex">
      {/* Sidebar */}
      <aside className="flex w-full flex-col bg-navy-800 lg:w-[260px]">
        <div className="border-b border-white/5 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-sm font-black text-white">
              {(agencyName || "V")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{agencyName || "Acente"}</p>
              <p className="text-[10px] font-medium text-primary-400">VISORA</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-navy-500">Ana Menü</p>
          {items.map((item) => {
            const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                  active ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" : "text-navy-300 hover:bg-white/5 hover:text-white"
                }`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-4">
          {userName && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-xs font-bold text-white">
                {userName[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="text-[10px] text-navy-400">{role === "agency_admin" ? "Admin" : "Personel"}</p>
              </div>
            </div>
          )}
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-navy-400 hover:bg-red-500/10 hover:text-red-400">
            Çıkış Yap
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden p-5 lg:p-8">
        {children}
      </main>
    </div>
  );
}
