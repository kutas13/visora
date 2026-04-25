"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Input, Card, Modal, Badge } from "@/components/ui";
import { STAFF_USERS, MUHASEBE_USER, ZAFER_USER } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile } from "@/lib/supabase/types";


// Profil fotosu olan kullanicilar
const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ERCAN: "/ercan-avatar.png",
  BAHAR: "/bahar-avatar.jpg",
  ZAFER: "/zafer-avatar.png",
};

type SelectedUser = typeof STAFF_USERS[number] | null;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStatusInfo(file: VisaFile) {
  if (file.sonuc === "vize_onay") return { text: "Vize Çıktı", variant: "success" as const };
  if (file.sonuc === "red") return { text: "Red", variant: "error" as const };
  if (file.islemden_cikti) return { text: "İşlemden Çıktı", variant: "info" as const };
  if (file.basvuru_yapildi) return { text: "İşlemde", variant: "info" as const };
  if (file.dosya_hazir) return { text: "Dosya Hazır", variant: "warning" as const };
  return { text: "Yeni", variant: "default" as const };
}

export default function LoginPage() {
  const router = useRouter();
  
  // Gate/Curtain state
  const [gateVisible, setGateVisible] = useState(true);
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState(false);
  const [gateClosing, setGateClosing] = useState(false);
  const [gateClosed, setGateClosed] = useState(false);
  const gateInputRef = useRef<HTMLInputElement>(null);

  // Bu tarayicida 4750 gate sifresini daha once girdiyse tekrar sorma.
  // localStorage her tarayici/cihaz icin ayridir; kullanici bazli degildir.
  useEffect(() => {
    try {
      if (localStorage.getItem("fox_gate_passed") === "1") {
        setGateVisible(false);
        setGateClosed(true);
      }
    } catch { /* localStorage erisim hatasi - gate aciliyor */ }
  }, []);

  // Login state
  const [selectedUser, setSelectedUser] = useState<SelectedUser>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Password change state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  // Remember me state
  const [rememberMe, setRememberMe] = useState(false);

  // Gate auto-focus
  useEffect(() => {
    if (gateVisible && !gateClosed && gateInputRef.current) {
      gateInputRef.current.focus();
    }
  }, [gateVisible, gateClosed]);

  const openGate = useCallback(() => {
    try {
      localStorage.setItem("fox_gate_passed", "1");
    } catch { /* localStorage erisim hatasi - sadece bu oturum icin acilir */ }
    setGateError(false);
    setGateClosing(true);
    setTimeout(() => {
      setGateClosed(true);
      setGateVisible(false);
    }, 700);
  }, []);

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gatePassword === "4750") {
      openGate();
    } else {
      setGateError(true);
      setGatePassword("");
      gateInputRef.current?.focus();
    }
  };

  // 4750 yazilinca Enter'a basmaya gerek kalmadan otomatik gec
  useEffect(() => {
    if (gatePassword === "4750" && !gateClosing && !gateClosed) {
      openGate();
    }
  }, [gatePassword, gateClosing, gateClosed, openGate]);

  // Passport query state
  const [passportNo, setPassportNo] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<VisaFile[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const queryAbortRef = useRef<AbortController | null>(null);
  const passportInputRef = useRef(passportNo);
  passportInputRef.current = passportNo;

  const fetchPassportByTerm = useCallback(async (term: string) => {
    if (term.length < 2) return;

    queryAbortRef.current?.abort();
    const ac = new AbortController();
    queryAbortRef.current = ac;

    let loadingTimer: number | null = null;
    const clearLoadingTimer = () => {
      if (loadingTimer !== null) {
        window.clearTimeout(loadingTimer);
        loadingTimer = null;
      }
    };
    ac.signal.addEventListener("abort", clearLoadingTimer, { once: true });
    loadingTimer = window.setTimeout(() => {
      if (ac.signal.aborted || passportInputRef.current.trim() !== term) return;
      setQueryLoading(true);
    }, 80);

    setQueryError(null);

    try {
      const res = await fetch("/api/passport-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportNo: term }),
        signal: ac.signal,
      });

      const json = await res.json();

      if (ac.signal.aborted) return;
      if (passportInputRef.current.trim() !== term) return;

      if (!res.ok) {
        setQueryResult(null);
        throw new Error(json.error || "Sorgulama hatası");
      }

      if (!json.data || json.data.length === 0) {
        setQueryResult(null);
        setQueryError("Eşleşen dosya bulunamadı.");
      } else {
        setQueryResult(json.data as VisaFile[]);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      if (passportInputRef.current.trim() !== term) return;
      setQueryResult(null);
      setQueryError(err instanceof Error ? err.message : "Sorgulama sırasında bir hata oluştu.");
    } finally {
      clearLoadingTimer();
      if (!ac.signal.aborted && passportInputRef.current.trim() === term) {
        setQueryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const term = passportNo.trim();
    if (term.length < 2) {
      queryAbortRef.current?.abort();
      setQueryResult(null);
      setQueryError(null);
      setQueryLoading(false);
      return;
    }
    void fetchPassportByTerm(term);
  }, [passportNo, fetchPassportByTerm]);

  const handleUserSelect = (user: typeof STAFF_USERS[number]) => {
    setSelectedUser(user);
    setError(null);
    // Beni hatırla: kayıtlı şifreyi yükle
    try {
      const saved = localStorage.getItem(`fox_remember_${user.id}`);
      if (saved) {
        setPassword(atob(saved));
        setRememberMe(true);
      } else {
        setPassword("");
        setRememberMe(false);
      }
    } catch {
      setPassword("");
      setRememberMe(false);
    }
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPassword("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || isLoading) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password,
      });

      if (authError) throw new Error("Şifre hatalı");

      // Beni hatırla: şifreyi kaydet veya sil
      if (selectedUser) {
        try {
          if (rememberMe) {
            localStorage.setItem(`fox_remember_${selectedUser.id}`, btoa(password));
          } else {
            localStorage.removeItem(`fox_remember_${selectedUser.id}`);
          }
        } catch { /* localStorage erişim hatası */ }
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, name")
          .eq("id", data.user.id)
          .single();

        if (profile?.role === "admin") {
          router.push("/admin/dashboard");
        } else if (profile?.role === "muhasebe") {
          router.push("/muhasebe");
        } else if (profile?.name === "ZAFER") {
          router.push("/app/randevu-listesi");
        } else {
          router.push("/app");
        }
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedUser || resetLoading) return;

    // Doğrulamalar
    if (!oldPassword.trim()) {
      setResetError("Mevcut şifrenizi girin.");
      return;
    }
    if (!newPassword.trim()) {
      setResetError("Yeni şifrenizi girin.");
      return;
    }
    if (newPassword.length < 6) {
      setResetError("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setResetError("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (oldPassword === newPassword) {
      setResetError("Yeni şifre eski şifreyle aynı olamaz.");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(false);

    try {
      const supabase = createClient();
      
      // Önce eski şifreyle giriş yaparak doğrula
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password: oldPassword,
      });

      if (signInError) {
        setResetError("Mevcut şifre hatalı.");
        setResetLoading(false);
        return;
      }

      // Şifreyi güncelle
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Beni hatırla aktifse yeni şifreyi kaydet
      try {
        if (rememberMe) {
          localStorage.setItem(`fox_remember_${selectedUser.id}`, btoa(newPassword));
        }
      } catch { /* localStorage erişim hatası */ }

      // Oturumu kapat (yeni şifreyle tekrar giriş yapsın)
      await supabase.auth.signOut();

      setResetSuccess(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Şifre değiştirilemedi.");
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetSuccess(false);
    setResetError(null);
    setOldPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
  };

  const handlePassportQuery = () => {
    const term = passportNo.trim();
    if (term.length < 2) return;
    void fetchPassportByTerm(term);
  };

  const handleClearQuery = () => {
    queryAbortRef.current?.abort();
    setPassportNo("");
    setQueryResult(null);
    setQueryError(null);
    setQueryLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gate Curtain Overlay */}
      {gateVisible && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center transition-transform duration-700 ease-in-out ${
            gateClosing ? "-translate-y-full" : "translate-y-0"
          }`}
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)",
          }}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute w-72 h-72 rounded-full bg-white/[0.03] -top-20 -left-10" />
            <div className="absolute w-96 h-96 rounded-full bg-white/[0.02] top-1/3 -right-20" />
            <div className="absolute w-56 h-56 rounded-full bg-amber-500/[0.04] bottom-10 left-1/4" />
            <div className="absolute w-40 h-40 rounded-full bg-white/[0.03] top-10 right-1/3" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 px-6">
            <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/30">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">Fox Turizm</h1>
              <p className="text-slate-400 text-sm">Erişim için şifreyi girin</p>
            </div>

            <form onSubmit={handleGateSubmit} className="w-72 space-y-4">
              <div className="relative">
                <input
                  ref={gateInputRef}
                  type="password"
                  value={gatePassword}
                  onChange={(e) => {
                    setGatePassword(e.target.value);
                    setGateError(false);
                  }}
                  placeholder="Şifre"
                  maxLength={10}
                  className={`w-full px-5 py-3.5 bg-white/10 backdrop-blur-sm border-2 rounded-xl text-white text-center text-xl tracking-[0.3em] placeholder:text-slate-500 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all ${
                    gateError
                      ? "border-red-500 animate-[shake_0.5s_ease-in-out]"
                      : "border-white/20 focus:border-amber-400"
                  }`}
                />
              </div>

              {gateError && (
                <p className="text-red-400 text-sm text-center animate-pulse">
                  Hatalı şifre, tekrar deneyin
                </p>
              )}

              <button
                type="submit"
                disabled={!gatePassword}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all duration-200 active:scale-[0.98]"
              >
                Giriş
              </button>
            </form>

            <div className="flex gap-1 mt-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                    i < gatePassword.length
                      ? "bg-amber-400 scale-110"
                      : "bg-slate-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Sol - Pasaport Sorgulama */}
        <Card className="p-6 order-2 lg:order-1 max-h-[85vh] overflow-y-auto" variant="elevated">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy-900">Dosya Sorgulama</h2>
              <p className="text-sm text-navy-500">Dosya durumunu görüntüleyin</p>
            </div>
          </div>

          <p className="text-navy-600 text-sm mb-4">
            Pasaport veya adınızı yazın; en az 2 karakterden sonra sonuçlar yazdığınız anda sorgulanır (bekleme yok).{" "}
            <span className="font-medium text-navy-700">Sorgula</span> ile beklemeden arayabilirsiniz. Kayıtta{" "}
            <span className="font-medium">IBRAHIM</span>, siz <span className="font-medium">İBRAHİM</span> yazsanız da eşleşir.
          </p>

          <div className="space-y-4">
            <Input
              label="Pasaport Numarası veya Müşteri Adı"
              placeholder="Örn: U12345678 veya Mehmet Kaya"
              value={passportNo}
              onChange={(e) => setPassportNo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePassportQuery()}
            />

            <div className="flex gap-3">
              <Button 
                onClick={handlePassportQuery} 
                disabled={passportNo.trim().length < 2}
                className="flex-1"
              >
                {queryLoading ? "Sorgulanıyor..." : "Sorgula"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClearQuery}
              >
                Temizle
              </Button>
            </div>
          </div>

          {/* Sonuç Alanı */}
          <div className="mt-6 min-h-[200px]">
            {queryError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-700">{queryError}</p>
              </div>
            )}

            {queryResult && queryResult.length > 0 && (() => {
              const aktifFiles = queryResult.filter(f => !f.sonuc);
              const sonuclananFiles = queryResult.filter(f => !!f.sonuc);

              const renderFile = (file: VisaFile) => {
                const status = getStatusInfo(file);
                return (
                  <div key={file.id} className={`rounded-xl p-4 border ${file.sonuc ? "bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200" : "bg-gradient-to-r from-navy-50 to-navy-100 border-navy-200"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-navy-900 text-lg">{file.musteri_ad}</h3>
                        <p className="text-sm text-navy-500">{file.pasaport_no}</p>
                        {(file as any).profiles?.name && (
                          <p className="text-xs text-primary-600 bg-primary-50 inline-block px-2 py-1 rounded-full mt-1">
                            {(file as any).profiles.name}
                          </p>
                        )}
                      </div>
                      <Badge variant={status.variant}>{status.text}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-navy-400 text-xs">Hedef Ülke</p>
                        <p className="font-medium text-navy-800">{file.hedef_ulke}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-navy-400 text-xs">İşlem Tipi</p>
                        <p className="font-medium text-navy-800">
                          {file.islem_tipi === "randevulu" ? "Randevulu" : "Randevusuz"}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-navy-400 text-xs">Ödeme Planı</p>
                        <p className="font-medium text-navy-800">
                          {file.odeme_plani === "pesin" ? "Peşin" : "Cari"}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-navy-400 text-xs">Ödeme Durumu</p>
                        <Badge variant={file.odeme_durumu === "odendi" ? "success" : "warning"} size="sm">
                          {file.odeme_durumu === "odendi" ? "Ödendi" : "Ödenmedi"}
                        </Badge>
                      </div>
                    </div>
                    {file.vize_tipleri && file.vize_tipleri.length > 0 && (
                      <div className="mt-3 bg-indigo-50 rounded-lg p-2 border border-indigo-100">
                        <p className="text-xs text-indigo-600">Vize Tipi</p>
                        <p className="font-medium text-indigo-800">
                          {file.vize_tipleri.map(t => {
                            const labels: Record<string, string> = {
                              "3/1": "3 Ay / 1 Giriş",
                              "6/2": "6 Ay / 2 Giriş",
                              "MULTI": "Çoklu Giriş",
                              "S": "S Vizesi",
                              "Z": "Z Vizesi",
                              "X": "X Vizesi",
                              "TBD": "Belirlenecek",
                            };
                            return labels[t] || t;
                          }).join(", ")}
                        </p>
                      </div>
                    )}
                    {file.tahmini_cikis_tarihi && (
                      <div className="mt-3 bg-purple-50 rounded-lg p-2 border border-purple-100">
                        <p className="text-xs text-purple-600">Tahmini Çıkış Tarihi</p>
                        <p className="font-medium text-purple-800">{formatDate(file.tahmini_cikis_tarihi)}</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={file.evrak_durumu === "geldi" ? "success" : "warning"} size="sm">
                        Evrak: {file.evrak_durumu === "geldi" ? "Geldi" : "Gelmedi"}
                      </Badge>
                      {file.evrak_eksik_mi && (
                        <Badge variant="error" size="sm">Eksik Evrak Var</Badge>
                      )}
                    </div>
                    {file.islem_tipi === "randevulu" && file.randevu_tarihi && (
                      <div className="mt-3 bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <p className="text-xs text-blue-600">Randevu Tarihi</p>
                        <p className="font-medium text-blue-800">{formatDate(file.randevu_tarihi)}</p>
                      </div>
                    )}
                    {file.sonuc === "vize_onay" && file.vize_bitis_tarihi && (
                      <div className="mt-3 bg-green-50 rounded-lg p-2 border border-green-100">
                        <p className="text-xs text-green-600">Vize Bitiş Tarihi</p>
                        <p className="font-medium text-green-800">{formatDate(file.vize_bitis_tarihi)}</p>
                      </div>
                    )}
                    {file.vize_gorseli && (
                      <div className="mt-3 bg-violet-50 rounded-lg p-3 border border-violet-100">
                        <p className="text-xs text-violet-600 mb-2 font-medium">🛂 Vize Görseli</p>
                        <div className="relative group inline-block">
                          <img
                            src={file.vize_gorseli}
                            alt={`${file.musteri_ad} - ${file.hedef_ulke} Vizesi`}
                            className="max-w-full max-h-48 rounded-lg border border-violet-200 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={async () => {
                              const url = file.vize_gorseli!;
                              const safeName = (file.musteri_ad || "musteri").replace(/\s+/g, "_");
                              const safeCountry = (file.hedef_ulke || "ulke").replace(/\s+/g, "_");
                              try {
                                const res = await fetch(url);
                                const blob = await res.blob();
                                const ext = blob.type.split("/")[1] || "jpg";
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = blobUrl;
                                link.download = `${safeName}_${safeCountry}_Vizesi.${ext}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(blobUrl);
                              } catch {
                                window.open(url, "_blank");
                              }
                            }}
                          />
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-black/60 text-white text-xs rounded-lg">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              İndir
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  {aktifFiles.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Aktif Dosyalar ({aktifFiles.length})
                      </p>
                      {aktifFiles.map(renderFile)}
                    </div>
                  )}
                  {sonuclananFiles.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Sonuçlanan Dosyalar ({sonuclananFiles.length})
                      </p>
                      {sonuclananFiles.map(renderFile)}
                    </div>
                  )}
                </div>
              );
            })()}

            {!queryError && !queryResult && queryLoading && (
              <div className="bg-navy-50 rounded-xl p-6 text-center border border-navy-200">
                <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-navy-600 font-medium">Dosyalar aranıyor…</p>
                <p className="text-navy-400 text-sm mt-1">Yazmaya devam edebilirsiniz</p>
              </div>
            )}

            {!queryError && !queryResult && !queryLoading && passportNo.trim().length < 2 && (
              <div className="bg-navy-50 rounded-xl p-6 text-center border border-navy-200">
                <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-navy-500">Aramaya başlamak için yazın</p>
                <p className="text-navy-400 text-sm mt-1">En az 2 karakter; yazmaya devam edin veya Sorgula ile anında arayın</p>
              </div>
            )}
          </div>
        </Card>

        {/* Sağ - Kullanıcı Girişi */}
        <Card className="p-6 order-1 lg:order-2" variant="elevated">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="relative w-40 h-28 mx-auto mb-4">
              <Image
                src="/fox-logo.jpg"
                alt="Fox Turizm"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-navy-500">Vize Yönetim Sistemi</p>
          </div>

          {!selectedUser ? (
            /* Kullanıcı Seçimi */
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-navy-700 text-center mb-4">Personel Girişi</h2>
              <div className="grid grid-cols-1 gap-3">
                {STAFF_USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="flex items-center gap-4 p-4 bg-gradient-to-r from-navy-50 to-navy-100 hover:from-primary-50 hover:to-primary-100 border-2 border-navy-200 hover:border-primary-400 rounded-xl transition-all duration-200 group"
                  >
                    {USER_AVATARS[user.name] ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all ring-2 ring-primary-200">
                        <Image
                          src={USER_AVATARS[user.name]}
                          alt={user.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
                        <span className="text-white font-bold text-lg">{user.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="text-left flex-1">
                      <p className="font-bold text-navy-900">{user.name}</p>
                      <p className="text-xs text-navy-500">Personel</p>
                    </div>
                    <svg className="w-5 h-5 text-navy-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
              
              {/* Muhasebe Girişi */}
              <div className="pt-3 border-t border-navy-200">
                <button
                  onClick={() => handleUserSelect(MUHASEBE_USER as any)}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 border-2 border-amber-200 hover:border-amber-400 rounded-xl transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
                    <span className="text-white font-bold text-lg">₺</span>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-navy-900">{MUHASEBE_USER.name}</p>
                    <p className="text-xs text-amber-600">Muhasebe</p>
                  </div>
                  <svg className="w-5 h-5 text-navy-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Zafer Girişi */}
              <div className="pt-3 border-t border-navy-200">
                <button
                  onClick={() => handleUserSelect(ZAFER_USER as any)}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 border-2 border-teal-200 hover:border-teal-400 rounded-xl transition-all duration-200 group"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all ring-2 ring-teal-200">
                    <Image
                      src="/zafer-avatar.png"
                      alt="ZAFER"
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-navy-900">{ZAFER_USER.name}</p>
                    <p className="text-xs text-teal-600">Randevu Takip</p>
                  </div>
                  <svg className="w-5 h-5 text-navy-400 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="pt-4 text-center border-t border-navy-200">
                <a href="/admin" className="text-sm text-navy-500 hover:text-primary-600 hover:underline">
                  Yönetici girişi için tıklayın
                </a>
              </div>
            </div>
          ) : (
            /* Şifre Girişi */
            <div className="flex gap-5 items-start">
              {/* Sol - Form */}
              <div className="flex-1 space-y-4">
                <p className="text-sm font-medium text-navy-500">Hoş geldiniz</p>
                <h2 className="text-xl font-bold text-navy-900">{selectedUser.name}</h2>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Input
                      label="Şifre"
                      type={showPassword ? "text" : "password"}
                      placeholder="Şifrenizi girin"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-9 text-navy-400 hover:text-navy-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-navy-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                      <span className="text-sm text-navy-600">Beni Hatırla</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      Şifre Değiştir
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                      ← Geri
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Sağ - Avatar */}
              <div className="flex-shrink-0 flex flex-col items-center pt-2">
                {USER_AVATARS[selectedUser.name] ? (
                  <div className="w-36 h-44 rounded-2xl overflow-hidden shadow-xl ring-4 ring-primary-200 bg-white">
                    <Image
                      src={USER_AVATARS[selectedUser.name]}
                      alt={selectedUser.name}
                      width={144}
                      height={176}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-36 h-44 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-primary-200">
                    <span className="text-white font-bold text-4xl">{selectedUser.name.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Yuna Form Butonu */}
        <div className="order-3 lg:col-span-2 flex justify-center">
          <a
            href="https://visora.com.tr/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Yuna Form Doldur
          </a>
        </div>

      </div>

      {/* Şifre Değiştirme Modal */}
      <Modal isOpen={showForgotModal} onClose={closeForgotModal} title="Şifre Değiştir" size="sm">
        <div className="py-4">
          {!resetSuccess ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                {selectedUser && (
                  <div className="bg-navy-50 rounded-xl p-3 mb-2">
                    <p className="font-semibold text-navy-900">{selectedUser.name}</p>
                    <p className="text-xs text-navy-400">{selectedUser.email}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  label="Mevcut Şifre"
                  type="password"
                  placeholder="Eski şifrenizi girin"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <Input
                  label="Yeni Şifre"
                  type="password"
                  placeholder="Yeni şifrenizi girin"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label="Yeni Şifre (Tekrar)"
                  type="password"
                  placeholder="Yeni şifrenizi tekrar girin"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                />
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {resetError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={closeForgotModal} className="flex-1">
                  İptal
                </Button>
                <Button onClick={handlePasswordChange} className="flex-1" disabled={resetLoading}>
                  {resetLoading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-navy-900">Şifre Değiştirildi!</h3>
              <p className="text-sm text-navy-600">
                Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
              </p>
              <Button onClick={closeForgotModal} className="w-full">Tamam</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
