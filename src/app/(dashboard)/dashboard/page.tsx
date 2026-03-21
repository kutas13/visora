"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function DashboardPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({ clients: 0, activeApps: 0, pendingDocs: 0, upcomingAppts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
    setUserName(localStorage.getItem("user_name") || "");
  }, []);

  const fetchStats = useCallback(async () => {
    if (!agencyId) { setLoading(false); return; }
    const today = new Date().toISOString().split("T")[0];
    const [c, a, d, ap] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).neq("status", "Tamamlandı"),
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).eq("status", "eksik"),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).gte("date", today),
    ]);
    setStats({ clients: c.count ?? 0, activeApps: a.count ?? 0, pendingDocs: d.count ?? 0, upcomingAppts: ap.count ?? 0 });
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  const cards = [
    { title: "Müşteriler", value: stats.clients, color: "from-primary-500 to-primary-600", link: "/dashboard/clients" },
    { title: "Aktif Dosyalar", value: stats.activeApps, color: "from-orange-400 to-orange-500", link: "/dashboard/visa-files" },
    { title: "Bekleyen Evrak", value: stats.pendingDocs, color: "from-amber-400 to-amber-500", link: "/dashboard/visa-files" },
    { title: "Randevular", value: stats.upcomingAppts, color: "from-accent-500 to-green-500", link: "/dashboard/calendar" },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up rounded-2xl bg-navy-800 p-7">
        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs text-navy-400">Çevrimiçi</span></div>
        <h1 className="mt-2 text-2xl font-bold text-white">{greeting}, {userName.split(" ")[0] || "Admin"}</h1>
        <p className="mt-1 text-sm text-navy-400">{new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, i) => (
          <Link key={card.title} href={card.link}>
            <div className="group animate-fade-in-up cursor-pointer rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white text-lg font-bold shadow-lg`}>
                  {card.value}
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-navy-900">{loading ? "..." : card.value}</p>
              <p className="mt-0.5 text-xs font-medium text-navy-400">{card.title}</p>
            </div>
          </Link>
        ))}
      </section>

      <div className="animate-fade-in-up delay-400">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">Hızlı İşlemler</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Yeni Müşteri", href: "/dashboard/clients" },
            { label: "Vize Dosyası", href: "/dashboard/visa-files" },
            { label: "Randevu Planla", href: "/dashboard/calendar" },
            { label: "Raporlar", href: "/dashboard/reports" },
          ].map((ql) => (
            <Link key={ql.label} href={ql.href} className="group rounded-2xl border border-navy-200/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-primary-300">
              <span className="text-sm font-semibold text-navy-900">{ql.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
