"use client";

import { useState, useEffect } from "react";
import { Card, Badge, Select, Input, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, Profile } from "@/lib/supabase/types";

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLogTypeInfo(type: string) {
  const types: Record<string, { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "default"; icon: string; gradient: string }> = {
    file_created: { label: "Dosya Oluşturuldu", variant: "success", icon: "📁", gradient: "from-green-500 to-emerald-600" },
    file_updated: { label: "Dosya Güncellendi", variant: "info", icon: "✏️", gradient: "from-blue-500 to-blue-600" },
    dosya_hazir: { label: "Dosya Hazır", variant: "purple", icon: "✅", gradient: "from-purple-500 to-purple-600" },
    isleme_girdi: { label: "İşleme Girdi", variant: "info", icon: "🔄", gradient: "from-blue-500 to-cyan-500" },
    islemden_cikti: { label: "İşlemden Çıktı", variant: "purple", icon: "🏁", gradient: "from-purple-500 to-indigo-600" },
    payment_added: { label: "Ödeme Eklendi", variant: "success", icon: "💰", gradient: "from-green-500 to-emerald-600" },
    transfer: { label: "Dosya Atandı", variant: "warning", icon: "🔀", gradient: "from-amber-500 to-orange-500" },
    notification_created: { label: "Bildirim", variant: "default", icon: "🔔", gradient: "from-navy-500 to-navy-600" },
  };
  return types[type] || { label: type, variant: "default", icon: "📝", gradient: "from-navy-500 to-navy-600" };
}

type ActivityLogWithProfile = ActivityLog & {
  profiles: Pick<Profile, "name"> | null;
  visa_files?: { musteri_ad: string; hedef_ulke: string } | null;
};

const TYPE_OPTIONS = [
  { value: "all", label: "Tüm İşlemler" },
  { value: "file_created", label: "Dosya Oluşturma" },
  { value: "file_updated", label: "Dosya Güncelleme" },
  { value: "dosya_hazir", label: "Dosya Hazır" },
  { value: "isleme_girdi", label: "İşleme Girdi" },
  { value: "islemden_cikti", label: "İşlemden Çıktı" },
  { value: "payment_added", label: "Ödeme" },
  { value: "transfer", label: "Dosya Atama" },
];

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ActivityLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [filterStaff, setFilterStaff] = useState("all");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      
      // Staff listesi
      const { data: staff } = await supabase.from("profiles").select("*").eq("role", "staff");
      setStaffList(staff || []);
      
      // Loglar
      let query = supabase
        .from("activity_logs")
        .select("*, profiles:actor_id(name), visa_files(musteri_ad, hedef_ulke)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterType !== "all") {
        query = query.eq("type", filterType);
      }
      if (filterStaff !== "all") {
        query = query.eq("actor_id", filterStaff);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Loglar yüklenirken hata:", error);
      } else {
        let filtered = data || [];
        if (searchTerm) {
          filtered = filtered.filter(l => 
            l.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.visa_files?.musteri_ad?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        setLogs(filtered);
      }
      setLoading(false);
    }

    loadData();
  }, [filterType, filterStaff, searchTerm]);

  const staffOptions = [
    { value: "all", label: "Tüm Personel" },
    ...staffList.map(s => ({ value: s.id, label: s.name }))
  ];

  const stats = {
    total: logs.length,
    today: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length,
    fileOps: logs.filter(l => ["file_created", "file_updated"].includes(l.type)).length,
    payments: logs.filter(l => l.type === "payment_added").length,
  };

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <span className="text-3xl">📋</span>
          Sistem Logları
        </h1>
        <p className="text-navy-500 mt-1">Tüm kullanıcı aktivitelerinin kaydını görüntüleyin</p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-blue-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Toplam Log</p>
              <p className="text-3xl font-bold text-navy-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl">📊</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-green-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Bugün</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.today}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl">📅</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Dosya İşlemi</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{stats.fileOps}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl">📁</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-amber-50 border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-500 font-medium">Ödeme</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.payments}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl">💰</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtreler */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-700 to-navy-800 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtreler
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input 
              label="Arama" 
              placeholder="Mesaj veya müşteri ara..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            <Select label="İşlem Tipi" options={TYPE_OPTIONS} value={filterType} onChange={(e) => setFilterType(e.target.value)} />
            <Select label="Personel" options={staffOptions} value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} />
            <div className="flex items-end">
              <Button onClick={() => { setFilterType("all"); setFilterStaff("all"); setSearchTerm(""); }} variant="outline" className="w-full">
                Temizle
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Log Listesi */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            📋 Aktivite Geçmişi
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{logs.length}</span>
          </h3>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📋</span>
              </div>
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Log Bulunamadı</h3>
              <p className="text-navy-500">Filtrelerinize uygun aktivite kaydı yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => {
                const typeInfo = getLogTypeInfo(log.type);
                return (
                  <div 
                    key={log.id} 
                    className={`flex items-start gap-4 p-4 rounded-xl transition-all hover:shadow-md ${index % 2 === 0 ? 'bg-navy-50' : 'bg-white'}`}
                  >
                    <div className={`w-12 h-12 bg-gradient-to-br ${typeInfo.gradient} rounded-xl flex items-center justify-center text-xl text-white shadow-md flex-shrink-0`}>
                      {typeInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                        {log.visa_files && (
                          <Badge variant="info" size="sm">{log.visa_files.musteri_ad}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-navy-900 font-medium">{log.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-navy-500">
                        <span className="flex items-center gap-1">
                          <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-bold text-[10px]">{log.profiles?.name?.charAt(0) || "?"}</span>
                          </span>
                          {log.profiles?.name || "Bilinmeyen"}
                        </span>
                        <span>🕐 {formatDateTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
