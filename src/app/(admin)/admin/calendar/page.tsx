"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, Modal, Select } from "@/components/ui";
import VisaFileForm from "@/components/files/VisaFileForm";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekDates(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  // getDay: 0=Pazar, 1=Pazartesi... Pazartesi'ye git
  start.setDate(start.getDate() - ((day + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function getMonthDates(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startDay = (firstDay.getDay() + 6) % 7;
  const dates = [];
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDay);
  
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d);
  }
  
  return { dates, firstDay, lastDay };
}

export default function AdminCalendarPage() {
  const [allAppointments, setAllAppointments] = useState<VisaFileWithProfile[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStaff, setFilterStaff] = useState("all");
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: appts } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("islem_tipi", "randevulu")
      .not("randevu_tarihi", "is", null)
      .eq("arsiv_mi", false)
      .gte("randevu_tarihi", today.toISOString())
      .order("randevu_tarihi", { ascending: true });

    const { data: staffData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "staff");

    setAllAppointments(appts || []);
    setStaff(staffData || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const appointments = useMemo(() => {
    if (filterStaff === "all") return allAppointments;
    return allAppointments.filter(a => a.assigned_user_id === filterStaff);
  }, [allAppointments, filterStaff]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter(a => {
      const d = new Date(a.randevu_tarihi!);
      return d >= today && d < tomorrow;
    });
  }, [appointments]);

  const filteredByDay = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return appointments.filter(a => {
      const d = new Date(a.randevu_tarihi!);
      return d >= start && d < end;
    });
  }, [appointments, selectedDate]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthData = useMemo(() => getMonthDates(selectedDate), [selectedDate]);

  const appointmentsByWeekDay = useMemo(() => {
    const map: Record<string, VisaFileWithProfile[]> = {};
    weekDates.forEach(d => {
      const key = toLocalDateKey(d);
      map[key] = [];
    });
    appointments.forEach(a => {
      const key = toLocalDateKey(new Date(a.randevu_tarihi!));
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [appointments, weekDates]);

  const appointmentsByMonthDay = useMemo(() => {
    const map: Record<string, VisaFileWithProfile[]> = {};
    monthData.dates.forEach(d => {
      const key = toLocalDateKey(d);
      map[key] = [];
    });
    appointments.forEach(a => {
      const key = toLocalDateKey(new Date(a.randevu_tarihi!));
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [appointments, monthData]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter(a => new Date(a.randevu_tarihi!) >= tomorrow);
  }, [appointments]);

  const handleEditFile = (file: VisaFile) => {
    setEditingFile(file);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setEditingFile(null);
    loadData();
  };

  const navigateDay = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    setSelectedDate(newDate);
  };

  const navigateWeek = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (delta * 7));
    setSelectedDate(newDate);
  };

  const navigateMonth = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  const staffOptions = [{ value: "all", label: "Tüm Personel" }, ...staff.map(s => ({ value: s.id, label: s.name }))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Randevu Takvimi</h1>
          <p className="text-navy-500 text-sm mt-1">{appointments.length} yaklaşan randevu</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Select options={staffOptions} value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="min-w-[180px]" />
          <div className="bg-navy-100 p-0.5 rounded-lg inline-flex gap-0.5">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === mode ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700"
                }`}
              >
                {mode === "day" ? "Gün" : mode === "week" ? "Hafta" : "Ay"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bugünün Randevuları */}
      {todayAppointments.length > 0 && (
        <Card className="overflow-hidden border border-navy-200">
          <div className="bg-primary-600 p-5 text-white">
            <h3 className="text-base font-semibold mb-3">Bugünün Randevuları ({todayAppointments.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {todayAppointments.map(apt => (
                <button
                  key={apt.id}
                  onClick={() => handleEditFile(apt)}
                  className="bg-white/15 hover:bg-white/25 rounded-lg p-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">
                      {formatTime(apt.randevu_tarihi!)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm">{apt.musteri_ad}</p>
                      <p className="text-xs text-white/70">{apt.hedef_ulke} · {apt.profiles?.name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Takvim Görünümü */}
      {viewMode === "day" ? (
        <Card className="overflow-hidden border border-navy-200">
          <div className="bg-navy-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <button onClick={() => navigateDay(-1)} className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Önceki
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">{formatDate(selectedDate.toISOString())}</p>
                <button onClick={() => setSelectedDate(new Date())} className="text-xs text-primary-300 hover:text-white transition-colors">Bugün</button>
              </div>
              <button onClick={() => navigateDay(1)} className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors">
                Sonraki
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <div className="p-5">
            {filteredByDay.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-navy-400 text-sm">Bu gün için randevu bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredByDay.map(apt => (
                  <button
                    key={apt.id}
                    onClick={() => handleEditFile(apt)}
                    className="w-full flex items-center gap-3 p-3 border border-navy-200 rounded-lg hover:bg-navy-50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {formatTime(apt.randevu_tarihi!)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900 text-sm">{apt.musteri_ad}</p>
                      <p className="text-xs text-navy-500">{apt.hedef_ulke} · {apt.pasaport_no}</p>
                    </div>
                    <span className="text-xs text-navy-500">{apt.profiles?.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : viewMode === "week" ? (
        <Card className="overflow-hidden border border-navy-200">
          <div className="bg-navy-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <button onClick={() => navigateWeek(-1)} className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Önceki Hafta
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">
                  {formatShortDate(weekDates[0].toISOString())} – {formatShortDate(weekDates[6].toISOString())}
                </p>
                <button onClick={() => setSelectedDate(new Date())} className="text-xs text-primary-300 hover:text-white transition-colors">Bu Hafta</button>
              </div>
              <button onClick={() => navigateWeek(1)} className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors">
                Sonraki Hafta
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map(date => {
                const key = toLocalDateKey(date);
                const dayAppts = appointmentsByWeekDay[key] || [];
                const isToday = new Date().toDateString() === date.toDateString();
                const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

                return (
                  <div key={key} className={`min-h-[130px] p-2 rounded-lg border transition-all ${
                    isToday ? "border-primary-500 bg-primary-50" : "border-navy-200"
                  }`}>
                    <div className="text-center mb-1.5">
                      <p className="text-[10px] font-medium text-navy-400 uppercase">{dayNames[(date.getDay() + 6) % 7]}</p>
                      <p className={`text-lg font-bold ${isToday ? "text-primary-600" : "text-navy-700"}`}>{date.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 3).map(apt => (
                        <button
                          key={apt.id}
                          onClick={() => handleEditFile(apt)}
                          className="w-full text-xs bg-primary-100 text-primary-700 rounded-lg p-1.5 truncate hover:bg-primary-200 transition-colors"
                          title={`${apt.musteri_ad} - ${apt.profiles?.name}`}
                        >
                          <span className="font-bold">{formatTime(apt.randevu_tarihi!)}</span> {apt.musteri_ad.split(" ")[0]}
                        </button>
                      ))}
                      {dayAppts.length > 3 && (
                        <p className="text-xs text-navy-500 text-center font-medium">+{dayAppts.length - 3} daha</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : (
        // Ay Görünümü - Admin
        <Card className="overflow-hidden border border-navy-200">
          <div className="bg-navy-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <button onClick={() => navigateMonth(-1)} className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Önceki Ay
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">
                  {selectedDate.toLocaleDateString("tr-TR", { year: "numeric", month: "long" })}
                </p>
                <button onClick={() => setSelectedDate(new Date())} className="text-xs text-primary-300 hover:text-white transition-colors">Bu Ay</button>
              </div>
              <button onClick={() => navigateMonth(1)} className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors">
                Sonraki Ay
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <div className="p-4">
            {/* Gün başlıkları */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map(day => (
                <div key={day} className="text-center py-2">
                  <span className="text-sm font-medium text-navy-600">{day}</span>
                </div>
              ))}
            </div>
            
            {/* Ay takvimi - profesyonel */}
            <div className="grid grid-cols-7 gap-2">
              {monthData.dates.map(date => {
                const key = toLocalDateKey(date);
                const dayAppts = appointmentsByMonthDay[key] || [];
                const isToday = new Date().toDateString() === date.toDateString();
                const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                
                return (
                  <div key={key} className={`min-h-[100px] p-2 rounded border transition-all ${
                    isToday ? "border-primary-500 bg-primary-50" : 
                    isCurrentMonth ? "border-navy-100 bg-white" : "border-transparent bg-gray-50/50"
                  }`}>
                    <div className="text-center mb-1">
                      <span className={`text-xs ${
                        isToday ? "text-primary-600 font-bold" : 
                        isCurrentMonth ? "text-navy-600 font-medium" : "text-gray-300"
                      }`}>{date.getDate()}</span>
                    </div>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 3).map(apt => (
                        <button
                          key={apt.id}
                          onClick={() => handleEditFile(apt)}
                          className="w-full text-xs bg-primary-100 text-primary-700 rounded-lg p-1.5 truncate hover:bg-primary-200 transition-colors"
                          title={`${apt.musteri_ad} - ${formatTime(apt.randevu_tarihi!)} - ${apt.profiles?.name}`}
                        >
                          <div className="font-bold">{formatTime(apt.randevu_tarihi!)}</div>
                          <div className="truncate">{apt.musteri_ad.split(" ")[0]}</div>
                        </button>
                      ))}
                      {dayAppts.length > 3 && (
                        <p className="text-xs text-navy-400 text-center">+{dayAppts.length - 3}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Yaklaşan Randevular Listesi */}
      <Card className="overflow-hidden border border-navy-200">
        <div className="bg-navy-800 px-6 py-3">
          <h3 className="text-sm font-semibold text-white">Yaklaşan Randevular</h3>
        </div>
        <div className="p-4">
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8 text-navy-400 text-sm">
              <p>Yaklaşan randevu bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcomingAppointments.slice(0, 20).map(apt => {
                const daysUntil = getDaysUntil(apt.randevu_tarihi!);
                const urgencyColor = daysUntil <= 2 ? "bg-red-600" : daysUntil <= 7 ? "bg-amber-500" : "bg-green-600";
                
                return (
                  <button
                    key={apt.id}
                    onClick={() => handleEditFile(apt)}
                    className="w-full flex items-center gap-3 p-3 border border-navy-100 rounded-lg hover:bg-navy-50 transition-colors text-left"
                  >
                    <div className={`w-10 h-10 ${urgencyColor} rounded-lg flex flex-col items-center justify-center text-white`}>
                      <span className="text-sm font-bold leading-none">{daysUntil}</span>
                      <span className="text-[8px] opacity-80">gün</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900 text-sm truncate">{apt.musteri_ad}</p>
                      <p className="text-xs text-navy-500">{apt.hedef_ulke}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-navy-700">{formatShortDate(apt.randevu_tarihi!)} · {formatTime(apt.randevu_tarihi!)}</p>
                      <p className="text-[11px] text-navy-400">{apt.profiles?.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Dosyayı Düzenle" size="xl">
        <VisaFileForm file={editingFile} onSuccess={handleEditSuccess} onCancel={() => setShowEditModal(false)} />
      </Modal>
    </div>
  );
}
