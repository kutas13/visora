"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui";
import VisaFileForm from "@/components/files/VisaFileForm";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

function fmtTime(d: string) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); }
function fmtDay(d: string) { return new Date(d).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" }); }
function fmtShort(d: string) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }); }

function daysUntil(d: string) {
  const t = new Date(d), n = new Date();
  t.setHours(0,0,0,0); n.setHours(0,0,0,0);
  return Math.ceil((t.getTime() - n.getTime()) / 86400000);
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function weekDates(d: Date) {
  const s = new Date(d); s.setDate(s.getDate() - ((s.getDay()+6)%7)); s.setHours(0,0,0,0);
  return Array.from({length:7}, (_,i) => { const x = new Date(s); x.setDate(s.getDate()+i); return x; });
}

function monthDates(d: Date) {
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y,m,1), last = new Date(y,m+1,0);
  const off = (first.getDay()+6)%7;
  const start = new Date(first); start.setDate(start.getDate()-off);
  return { dates: Array.from({length:42}, (_,i) => { const x = new Date(start); x.setDate(start.getDate()+i); return x; }), first, last };
}

const DAY_NAMES = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<VisaFileWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day"|"week"|"month">("week");
  const [sel, setSel] = useState(new Date());
  const [editFile, setEditFile] = useState<VisaFile|null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [uid, setUid] = useState<string|null>(null);

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) setUid(user.id);
    const today = new Date(); today.setHours(0,0,0,0);
    const { data } = await sb.from("visa_files").select("*, profiles:assigned_user_id(name)")
      .eq("islem_tipi","randevulu").not("randevu_tarihi","is",null).eq("arsiv_mi",false)
      .gte("randevu_tarihi", today.toISOString()).order("randevu_tarihi",{ascending:true});
    setAppointments(data||[]); setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const todayAppts = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    const tm = new Date(t); tm.setDate(tm.getDate()+1);
    return appointments.filter(a => { const d = new Date(a.randevu_tarihi!); return d>=t && d<tm; });
  }, [appointments]);

  const dayAppts = useMemo(() => {
    const s = new Date(sel); s.setHours(0,0,0,0);
    const e = new Date(s); e.setDate(e.getDate()+1);
    return appointments.filter(a => { const d = new Date(a.randevu_tarihi!); return d>=s && d<e; });
  }, [appointments, sel]);

  const wk = useMemo(() => weekDates(sel), [sel]);
  const mo = useMemo(() => monthDates(sel), [sel]);

  const wkMap = useMemo(() => {
    const m: Record<string, VisaFileWithProfile[]> = {};
    wk.forEach(d => m[dateKey(d)]=[]);
    appointments.forEach(a => { const k = dateKey(new Date(a.randevu_tarihi!)); if(m[k]) m[k].push(a); });
    return m;
  }, [appointments, wk]);

  const moMap = useMemo(() => {
    const m: Record<string, VisaFileWithProfile[]> = {};
    mo.dates.forEach(d => m[dateKey(d)]=[]);
    appointments.forEach(a => { const k = dateKey(new Date(a.randevu_tarihi!)); if(m[k]) m[k].push(a); });
    return m;
  }, [appointments, mo]);

  const upcoming = useMemo(() => {
    const tm = new Date(); tm.setHours(0,0,0,0); tm.setDate(tm.getDate()+1);
    return appointments.filter(a => new Date(a.randevu_tarihi!)>=tm);
  }, [appointments]);

  const onEdit = (f: VisaFile) => {
    if (f.assigned_user_id !== uid) { alert("Bu dosya size ait değil."); return; }
    setEditFile(f); setShowEdit(true);
  };

  const nav = (d: number) => {
    const n = new Date(sel);
    if (view==="day") n.setDate(n.getDate()+d);
    else if (view==="week") n.setDate(n.getDate()+d*7);
    else n.setMonth(n.getMonth()+d);
    setSel(n);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin"/></div>;

  const isToday = (d: Date) => new Date().toDateString() === d.toDateString();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Randevu Takvimi</h1>
          <p className="text-xs text-navy-400 mt-0.5">{appointments.length} yaklaşan randevu</p>
        </div>
        <div className="flex gap-1 bg-navy-100 rounded-lg p-0.5">
          {(["day","week","month"] as const).map(m => (
            <button key={m} onClick={() => setView(m)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view===m ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"}`}>
              {m==="day"?"Gün":m==="week"?"Hafta":"Ay"}
            </button>
          ))}
        </div>
      </div>

      {/* Today banner */}
      {todayAppts.length > 0 && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-4 text-white">
          <p className="text-xs font-semibold opacity-80 mb-3 uppercase tracking-wider">Bugün · {todayAppts.length} randevu</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayAppts.map(a => (
              <button key={a.id} onClick={() => onEdit(a)} className="flex items-center gap-3 bg-white/15 hover:bg-white/25 rounded-lg p-3 text-left transition-all">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-xs font-bold">{fmtTime(a.randevu_tarihi!)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{a.musteri_ad}</p>
                  <p className="text-[11px] opacity-70">{a.hedef_ulke} · {a.profiles?.name}</p>
                </div>
                {a.assigned_user_id === uid && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-medium">Ben</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-navy-200 px-4 py-2.5">
        <button onClick={() => nav(-1)} className="p-1.5 hover:bg-navy-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-navy-900">
            {view==="day" ? fmtDay(sel.toISOString()) : view==="week" ? `${fmtShort(wk[0].toISOString())} – ${fmtShort(wk[6].toISOString())}` : sel.toLocaleDateString("tr-TR",{year:"numeric",month:"long"})}
          </p>
          <button onClick={() => setSel(new Date())} className="text-[10px] text-primary-600 hover:text-primary-700 font-medium">
            {view==="day"?"Bugün":view==="week"?"Bu Hafta":"Bu Ay"}
          </button>
        </div>
        <button onClick={() => nav(1)} className="p-1.5 hover:bg-navy-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      {/* Calendar view */}
      {view === "day" ? (
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          {dayAppts.length === 0 ? (
            <div className="text-center py-16"><p className="text-sm text-navy-400">Randevu yok</p></div>
          ) : (
            <div className="divide-y divide-navy-100">
              {dayAppts.map(a => {
                const mine = a.assigned_user_id === uid;
                return (
                  <button key={a.id} onClick={() => onEdit(a)} className="w-full flex items-center gap-3 p-4 hover:bg-navy-50/50 transition-colors text-left">
                    <div className={`w-1 h-10 rounded-full ${mine ? "bg-emerald-500" : "bg-primary-500"}`}/>
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xs font-bold text-white ${mine ? "bg-emerald-600" : "bg-primary-600"}`}>
                      {fmtTime(a.randevu_tarihi!)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900 text-sm">{a.musteri_ad}</p>
                      <p className="text-xs text-navy-400">{a.hedef_ulke} · {a.pasaport_no}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-navy-500">{a.profiles?.name}</p>
                      {mine && <span className="text-[10px] text-emerald-600 font-medium">Benim</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : view === "week" ? (
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          <div className="grid grid-cols-7">
            {wk.map((d, i) => {
              const k = dateKey(d);
              const appts = wkMap[k] || [];
              const today = isToday(d);
              return (
                <div key={k} className={`border-r last:border-r-0 border-navy-100 ${today ? "bg-primary-50/50" : ""}`}>
                  <div className={`text-center py-3 border-b border-navy-100 ${today ? "bg-primary-100/50" : "bg-navy-50/50"}`}>
                    <p className="text-[10px] font-medium text-navy-400 uppercase">{DAY_NAMES[i]}</p>
                    <p className={`text-lg font-bold mt-0.5 ${today ? "text-primary-600" : "text-navy-700"}`}>{d.getDate()}</p>
                  </div>
                  <div className="p-1.5 min-h-[120px] space-y-1">
                    {appts.slice(0,4).map(a => {
                      const mine = a.assigned_user_id === uid;
                      return (
                        <button key={a.id} onClick={() => onEdit(a)} title={`${a.musteri_ad} · ${a.profiles?.name}`}
                          className={`w-full text-left text-[11px] rounded-lg px-2 py-1.5 transition-all hover:shadow-sm ${mine ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-primary-100 text-primary-700 hover:bg-primary-200"}`}>
                          <p className="font-bold">{fmtTime(a.randevu_tarihi!)}</p>
                          <p className="truncate">{a.musteri_ad.split(" ")[0]}</p>
                        </button>
                      );
                    })}
                    {appts.length > 4 && <p className="text-[10px] text-navy-400 text-center font-medium">+{appts.length-4}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-navy-100">
            {DAY_NAMES.map(d => <div key={d} className="text-center py-2.5"><span className="text-[11px] font-semibold text-navy-500 uppercase tracking-wider">{d}</span></div>)}
          </div>
          <div className="grid grid-cols-7">
            {mo.dates.map((d, i) => {
              const k = dateKey(d);
              const appts = moMap[k] || [];
              const today = isToday(d);
              const cur = d.getMonth() === sel.getMonth();
              return (
                <div key={k} className={`min-h-[88px] p-1 border-b border-r border-navy-100 transition-all ${today ? "bg-primary-50" : !cur ? "bg-gray-50/80" : ""}`}>
                  <div className="text-right px-1 mb-1">
                    <span className={`text-xs inline-flex items-center justify-center ${today ? "w-6 h-6 rounded-full bg-primary-600 text-white font-bold" : cur ? "text-navy-600 font-medium" : "text-navy-300"}`}>{d.getDate()}</span>
                  </div>
                  <div className="space-y-0.5">
                    {appts.slice(0,2).map(a => {
                      const mine = a.assigned_user_id === uid;
                      return (
                        <button key={a.id} onClick={() => onEdit(a)} title={`${a.musteri_ad} · ${fmtTime(a.randevu_tarihi!)} · ${a.profiles?.name}`}
                          className={`w-full text-[10px] rounded px-1 py-0.5 truncate text-left transition-colors ${mine ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-primary-100 text-primary-700 hover:bg-primary-200"}`}>
                          <span className="font-bold">{fmtTime(a.randevu_tarihi!)}</span> {a.musteri_ad.split(" ")[0]}
                        </button>
                      );
                    })}
                    {appts.length > 2 && <p className="text-[10px] text-navy-400 text-center">+{appts.length-2}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming list */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-navy-100">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Yaklaşan Randevular</p>
          </div>
          <div className="divide-y divide-navy-50">
            {upcoming.slice(0,15).map(a => {
              const d = daysUntil(a.randevu_tarihi!);
              const mine = a.assigned_user_id === uid;
              return (
                <button key={a.id} onClick={() => onEdit(a)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-50/50 transition-colors text-left">
                  <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold ${d<=2?"bg-red-500":d<=7?"bg-amber-500":"bg-emerald-500"}`}>
                    <span className="leading-none">{d}</span>
                    <span className="text-[7px] opacity-80">gün</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy-900 truncate">{a.musteri_ad}</p>
                    <p className="text-[11px] text-navy-400">{a.hedef_ulke}{mine ? " · benim" : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-navy-700">{fmtShort(a.randevu_tarihi!)} · {fmtTime(a.randevu_tarihi!)}</p>
                    <p className="text-[10px] text-navy-400">{a.profiles?.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Dosyayı Düzenle" size="xl">
        <VisaFileForm file={editFile} onSuccess={() => { setShowEdit(false); setEditFile(null); load(); }} onCancel={() => setShowEdit(false)} />
      </Modal>
    </div>
  );
}
