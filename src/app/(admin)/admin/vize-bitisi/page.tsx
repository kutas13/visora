"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, Button, Badge, Modal, Select } from "@/components/ui";
import { VisaFileForm } from "@/components/files";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Profile } from "@/lib/supabase/types";

type VisaFileWithProfile = VisaFile & { profiles: Pick<Profile, "name"> | null };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AdminVizeBitisiPage() {
  const [files, setFiles] = useState<VisaFileWithProfile[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "30" | "60">("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadData = async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("visa_files")
      .select("*, profiles:assigned_user_id(name)")
      .eq("sonuc", "vize_onay")
      .not("vize_bitis_tarihi", "is", null)
      .eq("arsiv_mi", false);

    const { data: staffData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "staff");

    setFiles(data || []);
    setStaff(staffData || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredFiles = useMemo(() => {
    let result = files.map(f => ({
      ...f,
      daysRemaining: getDaysUntil(f.vize_bitis_tarihi!),
    }));

    if (filterStaff !== "all") {
      result = result.filter(f => f.assigned_user_id === filterStaff);
    }

    result.sort((a, b) => a.daysRemaining - b.daysRemaining);

    if (filter === "30") {
      result = result.filter(f => f.daysRemaining <= 30 && f.daysRemaining >= 0);
    } else if (filter === "60") {
      result = result.filter(f => f.daysRemaining <= 60 && f.daysRemaining >= 0);
    }

    return result;
  }, [files, filter, filterStaff]);

  const stats = useMemo(() => {
    let targetFiles = files;
    if (filterStaff !== "all") {
      targetFiles = files.filter(f => f.assigned_user_id === filterStaff);
    }
    const all = targetFiles.map(f => getDaysUntil(f.vize_bitis_tarihi!));
    return {
      critical: all.filter(d => d <= 30 && d >= 0).length,
      warning: all.filter(d => d > 30 && d <= 60).length,
      total: all.filter(d => d >= 0).length,
    };
  }, [files, filterStaff]);

  const handleEditFile = (file: VisaFile) => {
    setEditingFile(file);
    setShowEditModal(true);
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
      {/* Sayfa Başlığı */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <span className="text-3xl">🛂</span>
            Vize Bitişi Takibi
          </h1>
          <p className="text-navy-500 mt-1">Tüm ofis için vize bitiş takibi</p>
        </div>
        <Select options={staffOptions} value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="min-w-[180px]" />
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
          <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">30 Gün İçinde</p>
                <p className="text-4xl font-bold mt-1">{stats.critical}</p>
                <p className="text-white/60 text-xs mt-1">Kritik Seviye</p>
              </div>
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <span className="text-4xl">🚨</span>
              </div>
            </div>
          </div>
        </Card>
        <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
          <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">30-60 Gün</p>
                <p className="text-4xl font-bold mt-1">{stats.warning}</p>
                <p className="text-white/60 text-xs mt-1">Dikkat Seviyesi</p>
              </div>
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <span className="text-4xl">⚠️</span>
              </div>
            </div>
          </div>
        </Card>
        <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
          <div className="p-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Toplam Aktif</p>
                <p className="text-4xl font-bold mt-1">{stats.total}</p>
                <p className="text-white/60 text-xs mt-1">Geçerli Vize</p>
              </div>
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <span className="text-4xl">✓</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtre */}
      <div className="bg-navy-100 p-1 rounded-xl inline-flex gap-1">
        <button
          onClick={() => setFilter("all")}
          className={`px-6 py-3 font-medium rounded-lg transition-all ${
            filter === "all" 
              ? "bg-white text-navy-900 shadow-md" 
              : "text-navy-600 hover:text-navy-900"
          }`}
        >
          Tümü
        </button>
        <button
          onClick={() => setFilter("30")}
          className={`px-6 py-3 font-medium rounded-lg transition-all ${
            filter === "30" 
              ? "bg-white text-navy-900 shadow-md" 
              : "text-navy-600 hover:text-navy-900"
          }`}
        >
          30 Günden Az
        </button>
        <button
          onClick={() => setFilter("60")}
          className={`px-6 py-3 font-medium rounded-lg transition-all ${
            filter === "60" 
              ? "bg-white text-navy-900 shadow-md" 
              : "text-navy-600 hover:text-navy-900"
          }`}
        >
          60 Günden Az
        </button>
      </div>

      {/* Liste */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-xl">📋</span>
            Vize Listesi
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{filteredFiles.length}</span>
          </h3>
        </div>
        <div className="p-6">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✓</span>
              </div>
              <h3 className="text-lg font-bold text-navy-900 mb-2">Harika!</h3>
              <p className="text-navy-500">Bu filtreye uyan vize bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file, index) => {
                const urgencyClass = file.daysRemaining <= 10 
                  ? "border-l-red-500 bg-red-50/50" 
                  : file.daysRemaining <= 30 
                    ? "border-l-amber-500 bg-amber-50/50" 
                    : "border-l-green-500 bg-green-50/50";
                const daysClass = file.daysRemaining <= 10 
                  ? "from-red-500 to-red-600" 
                  : file.daysRemaining <= 30 
                    ? "from-amber-500 to-orange-500" 
                    : "from-green-500 to-emerald-600";
                
                return (
                  <button
                    key={file.id}
                    onClick={() => handleEditFile(file)}
                    className={`w-full flex items-center gap-4 p-5 rounded-xl border-l-4 ${urgencyClass} hover:shadow-lg transition-all duration-200 text-left group`}
                  >
                    <div className={`w-16 h-16 bg-gradient-to-br ${daysClass} rounded-2xl flex flex-col items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform`}>
                      <span className="text-2xl font-bold">{file.daysRemaining}</span>
                      <span className="text-xs opacity-80">gün</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-navy-900 text-lg">{file.musteri_ad}</p>
                        {file.daysRemaining <= 10 && (
                          <Badge variant="error" size="sm" className="animate-pulse">ACİL</Badge>
                        )}
                      </div>
                      <p className="text-sm text-navy-500">{file.hedef_ulke} • {file.pasaport_no}</p>
                      <Badge variant="purple" size="sm" className="mt-1">{file.profiles?.name}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-navy-700">Bitiş: {formatDate(file.vize_bitis_tarihi!)}</p>
                      <Badge variant="success" size="sm" className="mt-1">Vize Onay</Badge>
                    </div>
                    <div className="text-navy-300 group-hover:text-primary-500 transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
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
        <VisaFileForm file={editingFile} onSuccess={() => { setShowEditModal(false); setEditingFile(null); loadData(); }} onCancel={() => setShowEditModal(false)} />
      </Modal>
    </div>
  );
}
