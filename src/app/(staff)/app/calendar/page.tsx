"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, Button, Badge, Modal } from "@/components/ui";
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

function getWeekDates(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<VisaFileWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("islem_tipi", "randevulu")
      .not("randevu_tarihi", "is", null)
      .eq("arsiv_mi", false)
      .gte("randevu_tarihi", today.toISOString())
      .order("randevu_tarihi", { ascending: true });

    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

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

  const appointmentsByWeekDay = useMemo(() => {
    const map: Record<string, VisaFileWithProfile[]> = {};
    weekDates.forEach(d => {
      const key = d.toISOString().split("T")[0];
      map[key] = [];
    });
    appointments.forEach(a => {
      const key = a.randevu_tarihi!.split("T")[0];
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [appointments, weekDates]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter(a => new Date(a.randevu_tarihi!) >= tomorrow);
  }, [appointments]);

  const handleEditFile = (file: VisaFile) => {
    if (file.assigned_user_id !== currentUserId) {
      alert("Bu dosya size ait değil. Sadece görüntüleyebilirsiniz.");
      return;
    }
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
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">📅</span>
            Randevu Takvimi
          </h1>
          <p className="text-navy-500 mt-1">{appointments.length} yaklaşan randevu (tüm ofis)</p>
        </div>
        <div className="bg-navy-100 p-1 rounded-xl inline-flex gap-1">
          <button
            onClick={() => setViewMode("day")}
            className={`px-6 py-2 font-medium rounded-lg transition-all ${
              viewMode === "day" 
                ? "bg-white text-navy-900 shadow-md" 
                : "text-navy-600 hover:text-navy-900"
            }`}
          >
            Gün
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-6 py-2 font-medium rounded-lg transition-all ${
              viewMode === "week" 
                ? "bg-white text-navy-900 shadow-md" 
                : "text-navy-600 hover:text-navy-900"
            }`}
          >
            Hafta
          </button>
        </div>
      </div>

      {/* Bugünün Randevuları */}
      {todayAppointments.length > 0 && (
        <Card className="overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 p-6 text-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🕐</span>
              Bugünün Randevuları ({todayAppointments.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todayAppointments.map(apt => (
                <button
                  key={apt.id}
                  onClick={() => handleEditFile(apt)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl p-4 text-left transition-all hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/30 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">{formatTime(apt.randevu_tarihi!)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{apt.musteri_ad}</p>
                      <p className="text-sm text-white/80">{apt.hedef_ulke}</p>
                      <p className="text-xs text-white/60">{apt.profiles?.name}</p>
                    </div>
                    {apt.assigned_user_id === currentUserId && (
                      <Badge variant="success" size="sm" className="bg-green-500/30 text-white border-0">Benim</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Takvim Görünümü */}
      {viewMode === "day" ? (
        <Card className="overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigateDay(-1)} className="text-white hover:bg-white/10">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Önceki
              </Button>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{formatDate(selectedDate.toISOString())}</p>
                <button onClick={() => setSelectedDate(new Date())} className="text-sm text-primary-300 hover:text-white transition-colors">Bugün</button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigateDay(1)} className="text-white hover:bg-white/10">
                Sonraki
                <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="p-6">
            {filteredByDay.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">📅</span>
                </div>
                <p className="text-lg font-semibold text-navy-700 mb-1">Randevu Yok</p>
                <p className="text-navy-500">Bu gün için planlanmış randevu bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredByDay.map(apt => {
                  const isMine = apt.assigned_user_id === currentUserId;
                  return (
                    <button
                      key={apt.id}
                      onClick={() => handleEditFile(apt)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left group hover:shadow-lg ${
                        isMine ? "bg-gradient-to-r from-green-50 to-white border-l-4 border-l-green-500" : "bg-gradient-to-r from-navy-50 to-white border-l-4 border-l-primary-500"
                      }`}
                    >
                      <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shadow-lg ${
                        isMine ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white" : "bg-gradient-to-br from-primary-500 to-primary-600 text-white"
                      }`}>
                        <span className="text-lg font-bold">{formatTime(apt.randevu_tarihi!)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-navy-900">{apt.musteri_ad}</p>
                        <p className="text-sm text-navy-500">{apt.hedef_ulke} • {apt.pasaport_no}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="purple">{apt.profiles?.name}</Badge>
                        {isMine && <Badge variant="success" size="sm">Benim</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)} className="text-white hover:bg-white/10">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Önceki Hafta
              </Button>
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {formatShortDate(weekDates[0].toISOString())} - {formatShortDate(weekDates[6].toISOString())}
                </p>
                <button onClick={() => setSelectedDate(new Date())} className="text-sm text-primary-300 hover:text-white transition-colors">Bu Hafta</button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)} className="text-white hover:bg-white/10">
                Sonraki Hafta
                <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map(date => {
                const key = date.toISOString().split("T")[0];
                const dayAppts = appointmentsByWeekDay[key] || [];
                const isToday = new Date().toDateString() === date.toDateString();
                const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

                return (
                  <div key={key} className={`min-h-[140px] p-3 rounded-xl border-2 transition-all ${
                    isToday ? "border-primary-500 bg-primary-50 shadow-lg" : "border-navy-200 hover:border-primary-300"
                  }`}>
                    <div className="text-center mb-2">
                      <p className="text-xs font-medium text-navy-500">{dayNames[(date.getDay() + 6) % 7]}</p>
                      <p className={`text-xl font-bold ${isToday ? "text-primary-600" : "text-navy-700"}`}>{date.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 3).map(apt => {
                        const isMine = apt.assigned_user_id === currentUserId;
                        return (
                          <button
                            key={apt.id}
                            onClick={() => handleEditFile(apt)}
                            className={`w-full text-xs rounded-lg p-1.5 truncate transition-all hover:shadow ${
                              isMine ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                            }`}
                            title={`${apt.musteri_ad} - ${apt.profiles?.name}`}
                          >
                            <span className="font-bold">{formatTime(apt.randevu_tarihi!)}</span> {apt.musteri_ad.split(" ")[0]}
                          </button>
                        );
                      })}
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
      )}

      {/* Yaklaşan Randevular Listesi */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-xl">📋</span>
            Yaklaşan Randevular (Tüm Ofis)
          </h3>
        </div>
        <div className="p-6">
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-12 text-navy-500">
              <p>Yaklaşan randevu bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 20).map(apt => {
                const daysUntil = getDaysUntil(apt.randevu_tarihi!);
                const isMine = apt.assigned_user_id === currentUserId;
                const urgencyClass = daysUntil <= 2 
                  ? "from-red-500 to-red-600" 
                  : daysUntil <= 7 
                    ? "from-amber-500 to-orange-500" 
                    : "from-green-500 to-emerald-600";
                
                return (
                  <button
                    key={apt.id}
                    onClick={() => handleEditFile(apt)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left hover:shadow-lg ${
                      isMine ? "bg-gradient-to-r from-green-50 to-white" : "bg-gradient-to-r from-navy-50 to-white"
                    }`}
                  >
                    <div className={`w-16 h-16 bg-gradient-to-br ${urgencyClass} rounded-xl flex flex-col items-center justify-center text-white shadow-lg`}>
                      <span className="text-xl font-bold">{daysUntil}</span>
                      <span className="text-xs opacity-80">gün</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy-900 truncate">{apt.musteri_ad}</p>
                      <p className="text-sm text-navy-500">{apt.hedef_ulke}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-navy-700">{formatShortDate(apt.randevu_tarihi!)}</p>
                      <p className="text-sm text-navy-500">{formatTime(apt.randevu_tarihi!)}</p>
                      <div className="flex gap-1 justify-end mt-1">
                        <Badge variant="purple" size="sm">{apt.profiles?.name}</Badge>
                        {isMine && <Badge variant="success" size="sm">Benim</Badge>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Dosyayı Düzenle" size="lg">
        <VisaFileForm file={editingFile} onSuccess={handleEditSuccess} onCancel={() => setShowEditModal(false)} />
      </Modal>
    </div>
  );
}
