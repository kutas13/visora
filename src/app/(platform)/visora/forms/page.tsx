"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LeadStatus = "yeni" | "iletisim_kuruldu" | "kapatildi";

interface Lead {
  id: string;
  ad: string;
  soyad: string;
  iletisim_no: string;
  note: string | null;
  durum: LeadStatus;
  ip_adresi: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<LeadStatus, { label: string; bg: string; text: string; ring: string }> = {
  yeni: { label: "Yeni", bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
  iletisim_kuruldu: { label: "İletişim Kuruldu", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  kapatildi: { label: "Kapatıldı", bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200" },
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} gün önce`;
  return fmtDateTime(d);
}

export default function FormsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [search, setSearch] = useState("");
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("landing_leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const updateStatus = async (id: string, durum: LeadStatus) => {
    const supabase = createClient();
    const { error } = await supabase.from("landing_leads").update({ durum, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, durum } : l)));
      setActiveLead((prev) => (prev && prev.id === id ? { ...prev, durum } : prev));
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("landing_leads").delete().eq("id", id);
    if (!error) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setActiveLead(null);
    }
  };

  const stats = useMemo(() => {
    const yeni = leads.filter((l) => l.durum === "yeni").length;
    const iletisim = leads.filter((l) => l.durum === "iletisim_kuruldu").length;
    const kapali = leads.filter((l) => l.durum === "kapatildi").length;
    return { yeni, iletisim, kapali, toplam: leads.length };
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return leads.filter((l) => {
      if (filter !== "all" && l.durum !== filter) return false;
      if (!q) return true;
      const blob = `${l.ad} ${l.soyad} ${l.iletisim_no} ${l.note || ""}`.toLocaleLowerCase("tr");
      return blob.includes(q);
    });
  }, [leads, filter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Platform</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Formlar</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">Ana sayfadan kayıt bırakan müşteri adayları ve iletişim talepleri.</p>
          </div>
        </div>
        <button
          onClick={loadLeads}
          className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Yenile
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Toplam", value: stats.toplam, color: "from-slate-700 to-slate-900" },
          { label: "Yeni", value: stats.yeni, color: "from-indigo-500 to-blue-600" },
          { label: "İletişime Geçildi", value: stats.iletisim, color: "from-emerald-500 to-teal-600" },
          { label: "Kapatıldı", value: stats.kapali, color: "from-slate-400 to-slate-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-black mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Ad, soyad, telefon veya not ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(["all", "yeni", "iletisim_kuruldu", "kapatildi"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === f ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f === "all" ? "Tümü" : STATUS_META[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2a4 4 0 014-4h4M5 19a2 2 0 002 2h10a2 2 0 002-2V7l-5-5H7a2 2 0 00-2 2v15z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              {search || filter !== "all" ? "Aramayla eşleşen kayıt bulunamadı." : "Henüz form kaydı yok."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((lead) => {
              const meta = STATUS_META[lead.durum];
              return (
                <button
                  key={lead.id}
                  onClick={() => setActiveLead(lead)}
                  className="w-full text-left flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20 flex-shrink-0">
                    {lead.ad.charAt(0).toUpperCase()}
                    {lead.soyad.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 truncate">
                        {lead.ad} {lead.soyad}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${meta.bg} ${meta.text} ring-1 ${meta.ring}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {lead.iletisim_no}
                      </span>
                      <span>•</span>
                      <span>{relativeTime(lead.created_at)}</span>
                    </div>
                    {lead.note && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">"{lead.note}"</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setActiveLead(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 to-fuchsia-600 p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Form Kaydı</p>
                  <h3 className="text-2xl font-black mt-1">
                    {activeLead.ad} {activeLead.soyad}
                  </h3>
                  <p className="text-sm text-white/90 mt-1">{relativeTime(activeLead.created_at)}</p>
                </div>
                <button
                  onClick={() => setActiveLead(null)}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">İletişim Numarası</p>
                <a
                  href={`tel:${activeLead.iletisim_no}`}
                  className="text-lg font-extrabold text-slate-900 hover:text-indigo-600 transition-colors block mt-1"
                >
                  {activeLead.iletisim_no}
                </a>
              </div>

              {activeLead.note && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mesaj</p>
                  <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {activeLead.note}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Durum</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["yeni", "iletisim_kuruldu", "kapatildi"] as const).map((s) => {
                    const meta = STATUS_META[s];
                    const isActive = activeLead.durum === s;
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(activeLead.id, s)}
                        className={`px-2 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                          isActive
                            ? `${meta.bg} ${meta.text} border-current shadow-sm`
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5 pt-3 border-t border-slate-100">
                <p>Oluşturulma: {fmtDateTime(activeLead.created_at)}</p>
                {activeLead.ip_adresi && <p>IP: {activeLead.ip_adresi}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                <a
                  href={`tel:${activeLead.iletisim_no}`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold text-center transition-colors"
                >
                  Ara
                </a>
                <button
                  onClick={() => deleteLead(activeLead.id)}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold border border-rose-200 transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
