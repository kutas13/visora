"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Appointment {
  id: string;
  date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  clients?: any;
  applications?: { country: string; visa_type: string } | null;
}

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function startDay(y: number, m: number) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function urgencyBadge(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: "Geçmiş", cls: "bg-navy-100 text-navy-500" };
  if (diff === 0) return { label: "Bugün", cls: "bg-red-100 text-red-700 animate-pulse" };
  if (diff <= 3) return { label: `${diff} gün`, cls: "bg-red-100 text-red-700" };
  if (diff <= 7) return { label: `${diff} gün`, cls: "bg-amber-100 text-amber-700" };
  return { label: `${diff} gün`, cls: "bg-green-100 text-green-700" };
}

const CHIP_COLORS = [
  "bg-primary-100 text-primary-700",
  "bg-accent-100 text-accent-600",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-blue-100 text-blue-700",
];

export default function CalendarPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchAppointments = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*, clients(full_name, phone), applications(country, visa_type)")
      .eq("agency_id", agencyId)
      .order("date", { ascending: true });
    setAppointments(data || []);
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToday = () => { setMonth(now.getMonth()); setYear(now.getFullYear()); };

  const todayStr = now.toISOString().split("T")[0];
  const totalDays = daysInMonth(year, month);
  const offset = startDay(year, month);
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let i = 1; i <= totalDays; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const apptMap = new Map<string, Appointment[]>();
  appointments.forEach((a) => {
    const list = apptMap.get(a.date) || [];
    list.push(a);
    apptMap.set(a.date, list);
  });

  const upcoming = appointments.filter((a) => a.date >= todayStr).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Randevu Takvimi</h1>
            <p className="text-xs text-navy-400">{appointments.length} randevu</p>
          </div>
        </div>
      </div>

      {/* Calendar nav */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <button onClick={prevMonth} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition">← Önceki</button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">{MONTHS[month]} {year}</h2>
            <button onClick={goToday} className="mt-0.5 text-[11px] text-primary-300 hover:text-white transition">Bugüne Git</button>
          </div>
          <button onClick={nextMonth} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition">Sonraki →</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" />
          </div>
        ) : (
          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-navy-400">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} className="min-h-[80px] rounded-xl bg-navy-50/30" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const dayAppts = apptMap.get(dateStr) || [];

                return (
                  <div
                    key={idx}
                    className={`min-h-[80px] rounded-xl border p-1.5 transition-all ${
                      isToday
                        ? "ring-2 ring-primary-500 border-primary-300 bg-primary-50/50"
                        : "border-navy-100 hover:border-navy-200 hover:bg-navy-50/30"
                    }`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-primary-500 text-white" : "text-navy-700"
                    }`}>
                      {day}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayAppts.slice(0, 3).map((a, i) => (
                        <div
                          key={a.id}
                          className={`truncate rounded-md px-1 py-0.5 text-[10px] font-medium ${CHIP_COLORS[i % CHIP_COLORS.length]}`}
                          title={`${a.clients?.full_name || "—"} ${a.time || ""}`}
                        >
                          {a.time && <span className="mr-0.5">{a.time.slice(0, 5)}</span>}
                          {a.clients?.full_name?.split(" ")[0] || "—"}
                        </div>
                      ))}
                      {dayAppts.length > 3 && (
                        <div className="text-[10px] font-medium text-navy-400 pl-1">+{dayAppts.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming list */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="border-b border-navy-100 bg-navy-50/50 px-6 py-4">
          <h3 className="text-sm font-semibold text-navy-900">Yaklaşan Randevular</h3>
        </div>
        {upcoming.length === 0 ? (
          <div className="py-12 text-center text-sm text-navy-400">Yaklaşan randevu yok.</div>
        ) : (
          <div className="divide-y divide-navy-50">
            {upcoming.map((a) => {
              const badge = urgencyBadge(a.date);
              return (
                <div key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-primary-50/20 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-accent-50 text-sm font-bold text-primary-600">
                    {(a.clients?.full_name || "?")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy-900 truncate">{a.clients?.full_name || "—"}</p>
                    <p className="text-xs text-navy-400">
                      {new Date(a.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" })}
                      {a.time && ` • ${a.time.slice(0, 5)}`}
                      {a.applications?.country && ` • ${a.applications.country}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
