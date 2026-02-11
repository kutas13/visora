"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button, Card, Input } from "@/components/ui";
import { STAFF_USERS } from "@/lib/constants";

// Profil fotosu olan kullanıcılar
const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
};

interface UserStats {
  tlTotal: number;
  eurTotal: number; 
  usdTotal: number;
  bekleyenOdemeler: number;
  sonTahsilatlar: any[];
}

export default function MuhasebePage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Kullanıcı seçildiğinde verileri yükle
  useEffect(() => {
    if (!selectedUser || selectedUser === "genel") {
      setUserStats(null);
      return;
    }

    const loadUserStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch(`/api/muhasebe/user-stats?userId=${selectedUser}`);
        if (res.ok) {
          const data = await res.json();
          setUserStats(data);
        }
      } catch (err) {
        console.error("Kullanıcı istatistikleri alınamadı:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    loadUserStats();
  }, [selectedUser]);

  const handleLogout = async () => {
    // Supabase logout
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    
    // Login sayfasına yönlendir
    window.location.href = "/login";
  };

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
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sol Panel - Kullanıcı Seçimi */}
            <div className="space-y-4">
              <Card className="p-4 bg-white/10 backdrop-blur border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">Görünüm Seçimi</h3>
                <div className="space-y-2">
                  {/* Genel Butonu */}
                  <button
                    onClick={() => setSelectedUser("genel")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      selectedUser === "genel" 
                        ? "bg-emerald-500 text-white" 
                        : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Genel</p>
                      <p className="text-xs opacity-70">Tüm Çalışanlar</p>
                    </div>
                  </button>
                  {STAFF_USERS.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        selectedUser === user.id 
                          ? "bg-primary-500 text-white" 
                          : "bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {USER_AVATARS[user.name] ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md ring-2 ring-primary-200">
                          <Image
                            src={USER_AVATARS[user.name]}
                            alt={user.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
                          <span className="text-white font-bold">{user.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="text-left">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs opacity-70">{user.email}</p>
                      </div>
                    </button>
                  ))}
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

            {/* Ana Panel - İçerik */}
            <div className="lg:col-span-3">
              {!selectedUser ? (
                <Card className="p-8 bg-white/10 backdrop-blur border border-white/20 text-center">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Personel Seçin</h3>
                  <p className="text-white/70">Soldaki panelden bir personel seçerek detayları görüntüleyin</p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Seçilen Kullanıcının Tahsilatları */}
                  <Card className="p-6 bg-white/10 backdrop-blur border border-white/20">
                    <h3 className="text-xl font-semibold text-white mb-4">
                      {STAFF_USERS.find(u => u.id === selectedUser)?.name} - Tahsilat Özeti
                    </h3>
                    
                    {loadingStats ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/60">Veriler alınıyor...</p>
                      </div>
                    ) : userStats ? (
                      <>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-green-300">₺{userStats.tlTotal.toLocaleString("tr-TR")}</p>
                            <p className="text-sm text-green-200">TL Tahsilat</p>
                          </div>
                          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-300">€{userStats.eurTotal.toLocaleString("tr-TR")}</p>
                            <p className="text-sm text-blue-200">EUR Tahsilat</p>
                          </div>
                          <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-purple-300">${userStats.usdTotal.toLocaleString("tr-TR")}</p>
                            <p className="text-sm text-purple-200">USD Tahsilat</p>
                          </div>
                        </div>

                        {/* Cari Durumu */}
                        <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 mb-4">
                          <h4 className="font-semibold text-amber-300 mb-2">Bekleyen Ödemeler</h4>
                          <p className="text-sm text-amber-200">
                            {userStats.bekleyenOdemeler > 0 
                              ? `${userStats.bekleyenOdemeler} bekleyen ödeme` 
                              : "Bekleyen ödeme yok"}
                          </p>
                        </div>

                        {/* Detaylı Tahsilat Listesi */}
                        <div className="bg-white/5 rounded-xl p-4">
                          <h4 className="font-semibold text-white mb-3">Son Tahsilatlar</h4>
                          {userStats.sonTahsilatlar.length === 0 ? (
                            <p className="text-sm text-white/50 text-center py-4">Henüz tahsilat yok</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {userStats.sonTahsilatlar.slice(0, 10).map((payment: any) => (
                                <div key={payment.id} className="bg-white/5 rounded-lg p-3 text-sm">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-white font-medium">{payment.visa_files?.musteri_ad}</p>
                                      <p className="text-white/60 text-xs">{payment.visa_files?.hedef_ulke}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-white font-bold">{payment.tutar} {payment.currency}</p>
                                      <p className="text-white/50 text-xs">{new Date(payment.created_at).toLocaleDateString("tr-TR")}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-white/60">Veri alınırken hata oluştu</p>
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
                  onClick={() => {
                    setShowCreateCompany(false);
                    setNewCompanyName("");
                  }}
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
                    } catch (err) {
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