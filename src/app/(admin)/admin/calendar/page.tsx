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

export default function AdminCalendarPage() {
  const [allAppts, setAllAppts] = useState<VisaFileWithProfile[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day"|"week"|"month">("week");
  const [sel, setSel] = useState(new Date());
  const [filterStaff, setFilterStaff] = useState("all");
  const [editFile, setEditFile] = useState<VisaFile|null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    const sb = createClient();
    const today = new Date(); today.setHours(0,0,0,0);
    const { data: appts } = await sb.from("visa_files").select("*, profiles:assigned_user_id(name)")
      .eq("islem_tipi","randevulu").not("randevu_tarihi","is",null)
      .gte("randevu_tarihi", today.toISOString()).order("randevu_tarihi",{ascending:true});
    const { data: staffData } = await sb.from("profiles").select("*").eq("role","staff");
    setAllAppts(appts||[]); setStaff(staffData||[]); setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const appointments = useMemo(() => filterStaff==="all" ? allAppts : allAppts.filter(a => a.assigned_user_id===filterStaff), [allAppts, filterStaff]);

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

  const onEdit = (f: VisaFile) => { setEditFile(f); setShowEdit(true); };

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
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-pink-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">Operasyon</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Randevu Takvimi</h1>
            <p className="text-slate-500 text-sm mt-1">
              Tüm personelin randevularını takvimde görüntüle ve yönet · <span className="font-bold text-violet-600">{appointments.length}</span> yaklaşan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-w-[140px]">
            <option value="all">Tüm Personel</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {(["day","week","month"] as const).map(m => (
              <button key={m} onClick={() => setView(m)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view===m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                {m==="day"?"Gün":m==="week"?"Hafta":"Ay"}
              </button>
            ))}
          </div>
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
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5">
        <button onClick={() => nav(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">
            {view==="day" ? fmtDay(sel.toISOString()) : view==="week" ? `${fmtShort(wk[0].toISOString())} – ${fmtShort(wk[6].toISOString())}` : sel.toLocaleDateString("tr-TR",{year:"numeric",month:"long"})}
          </p>
          <button onClick={() => setSel(new Date())} className="text-[10px] text-primary-600 hover:text-primary-700 font-medium">
            {view==="day"?"Bugün":view==="week"?"Bu Hafta":"Bu Ay"}
          </button>
        </div>
        <button onClick={() => nav(1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      {/* Calendar */}
      {view === "day" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {dayAppts.length === 0 ? (
            <div className="text-center py-16"><p className="text-sm text-slate-400">Randevu yok</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dayAppts.map(a => (
                <button key={a.id} onClick={() => onEdit(a)} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left">
                  <div className="w-1 h-10 rounded-full bg-primary-500"/>
                  <div className="w-11 h-11 bg-primary-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    {fmtTime(a.randevu_tarihi!)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{a.musteri_ad}</p>
                    <p className="text-xs text-slate-400">{a.hedef_ulke} · {a.pasaport_no}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{a.profiles?.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : view === "week" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7">
            {wk.map((d, i) => {
              const k = dateKey(d);
              const appts = wkMap[k] || [];
              const today = isToday(d);
              return (
                <div key={k} className={`border-r last:border-r-0 border-slate-100 ${today ? "bg-primary-50/50" : ""}`}>
                  <div className={`text-center py-3 border-b border-slate-100 ${today ? "bg-primary-100/50" : "bg-slate-50/50"}`}>
                    <p className="text-[10px] font-medium text-slate-400 uppercase">{DAY_NAMES[i]}</p>
                    <p className={`text-lg font-bold mt-0.5 ${today ? "text-primary-600" : "text-slate-700"}`}>{d.getDate()}</p>
                  </div>
                  <div className="p-1.5 min-h-[120px] space-y-1">
                    {appts.slice(0,4).map(a => (
                      <button key={a.id} onClick={() => onEdit(a)} title={`${a.musteri_ad} · ${a.profiles?.name}`}
                        className="w-full text-left text-[11px] bg-primary-100 text-primary-700 rounded-lg px-2 py-1.5 hover:bg-primary-200 transition-colors">
                        <p className="font-bold">{fmtTime(a.randevu_tarihi!)}</p>
                        <p className="truncate">{a.musteri_ad.split(" ")[0]}</p>
                      </button>
                    ))}
                    {appts.length > 4 && <p className="text-[10px] text-slate-400 text-center font-medium">+{appts.length-4}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAY_NAMES.map(d => <div key={d} className="text-center py-2.5"><span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{d}</span></div>)}
          </div>
          <div className="grid grid-cols-7">
            {mo.dates.map(d => {
              const k = dateKey(d);
              const appts = moMap[k] || [];
              const today = isToday(d);
              const cur = d.getMonth() === sel.getMonth();
              return (
                <div key={k} className={`min-h-[88px] p-1 border-b border-r border-slate-100 transition-all ${today ? "bg-primary-50" : !cur ? "bg-gray-50/80" : ""}`}>
                  <div className="text-right px-1 mb-1">
                    <span className={`text-xs inline-flex items-center justify-center ${today ? "w-6 h-6 rounded-full bg-primary-600 text-white font-bold" : cur ? "text-slate-600 font-medium" : "text-slate-300"}`}>{d.getDate()}</span>
                  </div>
                  <div className="space-y-0.5">
                    {appts.slice(0,2).map(a => (
                      <button key={a.id} onClick={() => onEdit(a)} title={`${a.musteri_ad} · ${fmtTime(a.randevu_tarihi!)} · ${a.profiles?.name}`}
                        className="w-full text-[10px] bg-primary-100 text-primary-700 rounded px-1 py-0.5 truncate text-left hover:bg-primary-200 transition-colors">
                        <span className="font-bold">{fmtTime(a.randevu_tarihi!)}</span> {a.musteri_ad.split(" ")[0]}
                      </button>
                    ))}
                    {appts.length > 2 && <p className="text-[10px] text-slate-400 text-center">+{appts.length-2}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yaklaşan Randevular</p>
          </div>
          <div className="divide-y divide-slate-50">
            {upcoming.slice(0,20).map(a => {
              const d = daysUntil(a.randevu_tarihi!);
              return (
                <button key={a.id} onClick={() => onEdit(a)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                  <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold ${d<=2?"bg-red-500":d<=7?"bg-amber-500":"bg-emerald-500"}`}>
                    <span className="leading-none">{d}</span>
                    <span className="text-[7px] opacity-80">gün</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.musteri_ad}</p>
                    <p className="text-[11px] text-slate-400">{a.hedef_ulke}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700">{fmtShort(a.randevu_tarihi!)} · {fmtTime(a.randevu_tarihi!)}</p>
                    <p className="text-[10px] text-slate-400">{a.profiles?.name}</p>
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
