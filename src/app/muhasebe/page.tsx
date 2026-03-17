"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button, Card, Badge, Input } from "@/components/ui";
import MuhasebeFileDetailModal from "@/components/muhasebe/MuhasebeFileDetailModal";
import type { Profile, VisaFile, Payment } from "@/lib/supabase/types";

type PaymentWithFile = Payment & {
  visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke" | "assigned_user_id"> | null;
};

type CurrencyTotals = { borc: number; tahsilat: number; kalan: number };

type StaffCari = {
  profile: Profile;
  totals: Record<string, CurrencyTotals>;
  files: VisaFile[];
  payments: PaymentWithFile[];
  bekleyenOdeme: number;
};

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ERCAN: "/ercan-avatar.jpg",
  BAHAR: "/bahar-avatar.jpg",
};

function getCurrencySymbol(c: string) {
  const s: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return s[c] || c;
}

function fmt(amount: number, currency: string) {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getCurrencySymbol(currency)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MuhasebePage() {
  const [staffList, setStaffList] = useState<StaffCari[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"dosyalar" | "tahsilatlar">("dosyalar");
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/muhasebe/user-stats");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staffList || []);
      } else {
        console.error("Muhasebe veri hatası:", await res.text());
      }
    } catch (err) {
      console.error("Muhasebe fetch hatası:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const generalTotals: Record<string, CurrencyTotals> = {};
  staffList.forEach((s) => {
    Object.entries(s.totals).forEach(([c, t]) => {
      if (!generalTotals[c]) generalTotals[c] = { borc: 0, tahsilat: 0, kalan: 0 };
      generalTotals[c].borc += t.borc;
      generalTotals[c].tahsilat += t.tahsilat;
      generalTotals[c].kalan += t.kalan;
    });
  });

  const selectedData = staffList.find((s) => s.profile.id === selectedStaff);

  const exportToExcel = () => {
    let csvContent = "Personel,Borç (TL),Tahsilat (TL),Kalan (TL),Borç (EUR),Tahsilat (EUR),Kalan (EUR),Borç (USD),Tahsilat (USD),Kalan (USD)\n";
    staffList.forEach(staff => {
      const tlData = staff.totals["TL"] || { borc: 0, tahsilat: 0, kalan: 0 };
      const eurData = staff.totals["EUR"] || { borc: 0, tahsilat: 0, kalan: 0 };
      const usdData = staff.totals["USD"] || { borc: 0, tahsilat: 0, kalan: 0 };
      csvContent += `${staff.profile.name},${tlData.borc},${tlData.tahsilat},${tlData.kalan},${eurData.borc},${eurData.tahsilat},${eurData.kalan},${usdData.borc},${usdData.tahsilat},${usdData.kalan}\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `muhasebe_cari_rapor_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur border-b border-white/20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">₺</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Muhasebe Paneli</h1>
              <p className="text-sm text-white/60">Fox Turizm - Finansal Yönetim</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={exportToExcel}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-300 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-green-500/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>
            <div className="text-right">
              <p className="text-sm font-medium text-white">SIRRI</p>
              <p className="text-xs text-white/60">muhasebe@foxturizm.com</p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Genel Toplam KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.keys(generalTotals).sort().map((c) => {
              const t = generalTotals[c];
              return (
                <Card key={c} className="p-0 overflow-hidden bg-white/10 backdrop-blur border border-white/20">
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-xs font-semibold tracking-wider uppercase">
                        {`Genel ${c} Toplam`}
                      </span>
                      <span className="text-2xl text-white/80">{getCurrencySymbol(c)}</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Toplam Borç</span>
                      <span className="font-bold text-white">{fmt(t.borc, c)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Toplam Tahsilat</span>
                      <span className="font-bold text-green-400">{fmt(t.tahsilat, c)}</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-sm font-semibold">Kalan Borç</span>
                      <span className={`text-lg font-black ${t.kalan > 0 ? "text-red-400" : "text-green-400"}`}>
                        {fmt(t.kalan, c)}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${t.borc > 0 ? Math.min((t.tahsilat / t.borc) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
            {Object.keys(generalTotals).length === 0 && (
              <Card className="col-span-3 p-8 text-center bg-white/10 backdrop-blur border border-white/20">
                <p className="text-white/50">Henüz cari verisi bulunmuyor.</p>
              </Card>
            )}
          </div>

          {/* Personel Listesi ve Detayları */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sol Panel - Personel Seçimi */}
            <div className="space-y-4">
              <Card className="p-4 bg-white/10 backdrop-blur border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">Personel Seçimi</h3>
                <div className="space-y-2">
                  {staffList.map((staff) => {
                    const isActive = selectedStaff === staff.profile.id;
                    const hasDebt = Object.values(staff.totals).some(t => t.kalan > 0);
                    const avatarKey = staff.profile.name?.toUpperCase() || "";

                    return (
                      <button
                        key={staff.profile.id}
                        onClick={() => {
                          setSelectedStaff(isActive ? null : staff.profile.id);
                          setDetailTab("dosyalar");
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isActive
                            ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                            : "bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {USER_AVATARS[avatarKey] ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md ring-2 ring-white/20 flex-shrink-0">
                            <Image
                              src={USER_AVATARS[avatarKey]}
                              alt={staff.profile.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            hasDebt ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-green-500 to-emerald-600"
                          }`}>
                            <span className="text-white font-bold">{staff.profile.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-semibold truncate">{staff.profile.name}</p>
                          <p className="text-xs opacity-70">
                            {staff.files.length} dosya &bull; {staff.payments.length} tahsilat
                          </p>
                        </div>
                        {hasDebt && (
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 animate-pulse" />
                        )}
                      </button>
                    );
                  })}

                  {staffList.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-4">Carisi olan personel yok</p>
                  )}
                </div>
              </Card>

              {/* Firma Yönetimi */}
              <Card className="p-4 bg-white/10 backdrop-blur border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">Firma Yönetimi</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => window.location.href = "/muhasebe/firmalar"}
                    className="w-full bg-purple-500 hover:bg-purple-600 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
                    </svg>
                    Firmaları Yönet
                  </Button>
                  <Button
                    onClick={() => setShowCreateCompany(true)}
                    className="w-full bg-green-500 hover:bg-green-600 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Hızlı Firma Oluştur
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sağ Panel - Detay */}
            <div className="lg:col-span-3">
              {!selectedData ? (
                <Card className="p-8 bg-white/10 backdrop-blur border border-white/20 text-center">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Personel Seçin</h3>
                  <p className="text-white/60">Soldaki panelden bir personel seçerek cari detaylarını görüntüleyin</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Kullanıcı Başlık */}
                  <Card className="p-5 bg-white/10 backdrop-blur border border-white/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {USER_AVATARS[selectedData.profile.name?.toUpperCase()] ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-white/20">
                            <Image
                              src={USER_AVATARS[selectedData.profile.name.toUpperCase()]}
                              alt={selectedData.profile.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-lg">{selectedData.profile.name?.charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-bold text-white">{selectedData.profile.name} - Cari Hesap</h3>
                          <p className="text-sm text-white/60">
                            {selectedData.files.length} cari dosya &bull; {selectedData.payments.length} tahsilat
                            {selectedData.bekleyenOdeme > 0 && (
                              <span className="text-red-400 ml-1">&bull; {selectedData.bekleyenOdeme} ödenmemiş</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={loadData}
                        className="bg-white/10 hover:bg-white/20 text-white/70 hover:text-white p-2 rounded-lg transition-colors"
                        title="Yenile"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </Card>

                  {/* Para birimi KPI'ları */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.keys(selectedData.totals).sort().map((c) => {
                      const t = selectedData.totals[c];
                      return (
                        <Card key={c} className="p-4 bg-white/10 backdrop-blur border border-white/20">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-semibold text-white/50 uppercase">{c}</span>
                            <span className="text-xl text-white/50">{getCurrencySymbol(c)}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/60">Borç:</span>
                              <span className="font-semibold text-white">{fmt(t.borc, c)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/60">Tahsilat:</span>
                              <span className="font-semibold text-green-400">{fmt(t.tahsilat, c)}</span>
                            </div>
                            <div className="h-px bg-white/10 my-1" />
                            <div className="flex justify-between">
                              <span className="font-semibold text-white/80">Kalan:</span>
                              <span className={`font-bold ${t.kalan > 0 ? "text-red-400" : "text-green-400"}`}>
                                {fmt(t.kalan, c)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${t.borc > 0 ? Math.min((t.tahsilat / t.borc) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Tab Seçimi */}
                  <div className="flex gap-1 bg-white/10 p-1 rounded-lg w-fit">
                    <button
                      onClick={() => setDetailTab("dosyalar")}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        detailTab === "dosyalar" ? "bg-white text-navy-900 shadow-sm" : "text-white/60 hover:text-white"
                      }`}
                    >
                      Dosyalar ({selectedData.files.length})
                    </button>
                    <button
                      onClick={() => setDetailTab("tahsilatlar")}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        detailTab === "tahsilatlar" ? "bg-white text-navy-900 shadow-sm" : "text-white/60 hover:text-white"
                      }`}
                    >
                      Tahsilatlar ({selectedData.payments.length})
                    </button>
                  </div>

                  {/* Dosyalar Tablosu - Sadece görüntüleme, tıklanınca özgeçmiş */}
                  {detailTab === "dosyalar" && (
                    <Card className="overflow-hidden bg-white/10 backdrop-blur border border-white/20">
                      {selectedData.files.length === 0 ? (
                        <p className="p-6 text-center text-white/40 text-sm">Cari dosya yok.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10 bg-white/5">
                                <th className="text-left px-4 py-3 text-white/50 font-medium">Müşteri</th>
                                <th className="text-left px-4 py-3 text-white/50 font-medium">Ülke</th>
                                <th className="text-right px-4 py-3 text-white/50 font-medium">Ücret</th>
                                <th className="text-center px-4 py-3 text-white/50 font-medium">Ödeme Durumu</th>
                                <th className="text-left px-4 py-3 text-white/50 font-medium">Dosyayı Yapan</th>
                                <th className="text-right px-4 py-3 text-white/50 font-medium">Tarih</th>
                                <th className="text-center px-4 py-3 text-white/50 font-medium">Özgeçmiş</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedData.files.map((f) => (
                                <tr key={f.id} className="border-b border-white/5 hover:bg-white/5">
                                  <td className="px-4 py-3 font-medium text-white">{f.musteri_ad}</td>
                                  <td className="px-4 py-3 text-white/70">{f.hedef_ulke}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-white">
                                    {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {f.odeme_durumu === "odendi" ? (
                                      <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">Ödendi</span>
                                    ) : (
                                      <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">Ödenmedi</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-white/70">{(f as any).profiles?.name || "-"}</td>
                                  <td className="px-4 py-3 text-right text-white/50">{formatDate(f.created_at)}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => { setDetailFileId(f.id); setShowDetailModal(true); }}
                                      className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 rounded-lg transition-colors"
                                    >
                                      Görüntüle
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Tahsilatlar Tablosu - Kimin yaptığını göster */}
                  {detailTab === "tahsilatlar" && (
                    <Card className="overflow-hidden bg-white/10 backdrop-blur border border-white/20">
                      {selectedData.payments.length === 0 ? (
                        <p className="p-6 text-center text-white/40 text-sm">Tahsilat yok.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10 bg-white/5">
                                <th className="text-left px-4 py-3 text-white/50 font-medium">Müşteri</th>
                                <th className="text-left px-4 py-3 text-white/50 font-medium">Ülke</th>
                                <th className="text-right px-4 py-3 text-white/50 font-medium">Tutar</th>
                                <th className="text-center px-4 py-3 text-white/50 font-medium">Yöntem</th>
                                <th className="text-left px-4 py-3 text-white/50 font-medium">Tahsilatı Yapan</th>
                                <th className="text-right px-4 py-3 text-white/50 font-medium">Tarih</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedData.payments.map((p) => (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-green-500/5">
                                  <td className="px-4 py-3 font-medium text-white">
                                    {p.visa_files?.musteri_ad || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-white/70">
                                    {p.visa_files?.hedef_ulke || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-green-400">
                                    {fmt(Number(p.tutar), p.currency || "TL")}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      p.yontem === "nakit"
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                        : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    }`}>
                                      {p.yontem === "nakit" ? "Nakit" : p.yontem === "hesaba" ? "Hesaba" : "Cari"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-white/70">{(p as any).profiles?.name || "-"}</td>
                                  <td className="px-4 py-3 text-right text-white/50">{formatDate(p.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MuhasebeFileDetailModal fileId={detailFileId} isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setDetailFileId(null); }} />

      {/* Firma Oluştur Modal */}
      {showCreateCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6 bg-white">
            <h3 className="text-lg font-semibold text-navy-900 mb-4">Yeni Firma Oluştur</h3>
            <div className="space-y-4">
              <Input
                label="Firma Adı"
                placeholder="Firma adını girin..."
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setShowCreateCompany(false); setNewCompanyName(""); }}
                  className="flex-1"
                >
                  İptal
                </Button>
                <Button
                  onClick={async () => {
                    if (!newCompanyName.trim()) return;
                    try {
                      const res = await fetch("/api/companies", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ firma_adi: newCompanyName.trim() }),
                      });
                      if (res.ok) {
                        setShowCreateCompany(false);
                        setNewCompanyName("");
                        alert(`${newCompanyName} firması oluşturuldu!`);
                      } else {
                        const data = await res.json().catch(() => ({}));
                        alert(`Hata: ${data.error || "Firma oluşturulamadı"}`);
                      }
                    } catch {
                      alert("Bağlantı hatası");
                    }
                  }}
                  disabled={!newCompanyName.trim()}
                  className="flex-1"
                >
                  Oluştur
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
