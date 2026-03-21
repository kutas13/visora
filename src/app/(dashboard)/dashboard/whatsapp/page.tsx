"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Appointment {
  id: string;
  date: string;
  time: string | null;
  clients?: any;
  applications?: any;
}

interface ExpiringVisa {
  id: string;
  visa_expiry_date: string;
  country: string;
  clients?: any;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function WhatsAppPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expiringVisas, setExpiringVisas] = useState<ExpiringVisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const sixtyDaysLater = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0];

    const [apptRes, visaRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, date, time, clients(full_name, phone), applications(country)")
        .eq("agency_id", agencyId)
        .gte("date", today)
        .lte("date", nextWeek)
        .order("date"),
      supabase
        .from("applications")
        .select("id, visa_expiry_date, country, clients(full_name, phone)")
        .eq("agency_id", agencyId)
        .eq("visa_result", "vize_onay")
        .not("visa_expiry_date", "is", null)
        .gte("visa_expiry_date", today)
        .lte("visa_expiry_date", sixtyDaysLater)
        .order("visa_expiry_date"),
    ]);

    setAppointments(apptRes.data || []);
    setExpiringVisas(visaRes.data || []);
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const sendSimulation = (id: string, name: string, type: string) => {
    setSentIds((prev) => new Set(prev).add(id));
    showToast(`${name} kişisine ${type} bildirimi gönderildi (simülasyon)`);
  };

  const connectionStatus = "Bağlı Değil (Simülasyon)";

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 animate-fade-in-up rounded-xl bg-[#25D366] px-5 py-3 text-sm font-medium text-white shadow-xl">
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] shadow-lg shadow-[#25D366]/20">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.704-1.228A11.947 11.947 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.806-6.32-2.157l-.182-.144-3.45.9.934-3.374-.16-.19A9.96 9.96 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy-900">WhatsApp Bildirimleri</h1>
          <p className="text-xs text-navy-400">Otomatik hatırlatmalar</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">Bağlantı Durumu</p>
              <p className="mt-1 text-sm font-bold text-amber-600">{connectionStatus}</p>
              <p className="mt-1 text-[11px] text-navy-400">Modül simülasyon modunda</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl">📡</div>
          </div>
        </div>
        <div className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">Yaklaşan Randevular</p>
              <p className="mt-1 text-3xl font-bold text-navy-900">{loading ? "..." : appointments.length}</p>
              <p className="mt-0.5 text-[11px] text-navy-400">Önümüzdeki 7 gün</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-xl text-white shadow-lg">📅</div>
          </div>
        </div>
        <div className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">Süresi Dolan Vizeler</p>
              <p className="mt-1 text-3xl font-bold text-navy-900">{loading ? "..." : expiringVisas.length}</p>
              <p className="mt-0.5 text-[11px] text-navy-400">60 gün içinde</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-xl text-white shadow-lg">⏰</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-[#25D366]" /></div>
      ) : (
        <>
          {/* Appointment reminders */}
          <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/50 px-6 py-4">
              <h3 className="text-sm font-semibold text-navy-900">Randevu Hatırlatmaları</h3>
              <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">{appointments.length} kişi</span>
            </div>
            {appointments.length === 0 ? (
              <div className="py-12 text-center text-sm text-navy-400">Yaklaşan randevu yok.</div>
            ) : (
              <div className="divide-y divide-navy-50">
                {appointments.map((a) => {
                  const days = daysUntil(a.date);
                  const isSent = sentIds.has(`appt-${a.id}`);
                  return (
                    <div key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-green-50/30 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-accent-50 text-sm font-bold text-primary-600">
                        {(a.clients?.full_name || "?")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-900">{a.clients?.full_name || "—"}</p>
                        <p className="text-xs text-navy-400">
                          {new Date(a.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" })}
                          {a.time && ` • ${a.time.slice(0, 5)}`}
                          {a.applications?.country && ` • ${a.applications.country}`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                        days <= 1 ? "bg-red-100 text-red-700" : days <= 3 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      }`}>
                        {days === 0 ? "Bugün" : `${days} gün`}
                      </span>
                      <button
                        onClick={() => sendSimulation(`appt-${a.id}`, a.clients?.full_name || "—", "randevu")}
                        disabled={isSent}
                        className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${
                          isSent ? "bg-navy-300 cursor-not-allowed" : "bg-[#25D366] hover:bg-[#1da851] shadow-[#25D366]/20"
                        }`}
                      >
                        {isSent ? "✓ Gönderildi" : "Gönder"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visa expiry notifications */}
          <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/50 px-6 py-4">
              <h3 className="text-sm font-semibold text-navy-900">Vize Bitiş Bildirimleri</h3>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">{expiringVisas.length} kişi</span>
            </div>
            {expiringVisas.length === 0 ? (
              <div className="py-12 text-center text-sm text-navy-400">Süresi dolan vize yok.</div>
            ) : (
              <div className="divide-y divide-navy-50">
                {expiringVisas.map((v) => {
                  const days = daysUntil(v.visa_expiry_date);
                  const isSent = sentIds.has(`visa-${v.id}`);
                  return (
                    <div key={v.id} className="flex items-center gap-4 px-6 py-4 hover:bg-green-50/30 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-orange-50 text-sm font-bold text-red-600">
                        {(v.clients?.full_name || "?")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-900">{v.clients?.full_name || "—"}</p>
                        <p className="text-xs text-navy-400">
                          {v.country} • Bitiş: {new Date(v.visa_expiry_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                        days <= 10 ? "bg-red-500 text-white animate-pulse" : days <= 30 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {days} gün
                      </span>
                      <button
                        onClick={() => sendSimulation(`visa-${v.id}`, v.clients?.full_name || "—", "vize bitiş")}
                        disabled={isSent}
                        className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${
                          isSent ? "bg-navy-300 cursor-not-allowed" : "bg-[#25D366] hover:bg-[#1da851] shadow-[#25D366]/20"
                        }`}
                      >
                        {isSent ? "✓ Gönderildi" : "Gönder"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
