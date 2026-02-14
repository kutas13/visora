"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Input, Card, Modal } from "@/components/ui";
import { ADMIN_USER } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
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

  // Remember me
  const [rememberMe, setRememberMe] = useState(false);

  // Beni hatırla: sayfa yüklendiğinde kayıtlı şifreyi yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fox_remember_admin");
      if (saved) {
        setPassword(atob(saved));
        setRememberMe(true);
      }
    } catch { /* localStorage erişim hatası */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: ADMIN_USER.email,
        password,
      });

      if (authError) throw new Error("Şifre hatalı");

      // Beni hatırla: şifreyi kaydet veya sil
      try {
        if (rememberMe) {
          localStorage.setItem("fox_remember_admin", btoa(password));
        } else {
          localStorage.removeItem("fox_remember_admin");
        }
      } catch { /* localStorage erişim hatası */ }

      if (data.user) {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (resetLoading) return;

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
        email: ADMIN_USER.email,
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
          localStorage.setItem("fox_remember_admin", btoa(newPassword));
        }
      } catch { /* localStorage erişim hatası */ }

      // Oturumu kapat
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8" variant="elevated">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="relative w-44 h-28 mx-auto mb-3">
            <Image
                src="/fox-logo.jpg"
              alt="Fox Turizm"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-navy-900">Yönetim Paneli</h1>
        </div>

        {/* Admin Bilgisi */}
        <div className="bg-gradient-to-r from-navy-50 to-navy-100 rounded-2xl p-4 mb-6 border border-navy-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md ring-2 ring-primary-200">
              <Image
                src="/davut-avatar.png"
                alt={ADMIN_USER.name}
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-bold text-navy-900 text-lg">{ADMIN_USER.name}</p>
              <p className="text-sm text-navy-500">Sistem Yöneticisi</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              label="Şifre"
              type={showPassword ? "text" : "password"}
              placeholder="Yönetici şifrenizi girin"
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
            <Button type="button" variant="outline" onClick={() => router.push("/login")} className="flex-1">
              {"← Geri"}
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </div>
        </form>
      </Card>

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
                <div className="bg-navy-50 rounded-xl p-3 mb-2">
                  <p className="font-semibold text-navy-900">{ADMIN_USER.name}</p>
                  <p className="text-xs text-navy-400">{ADMIN_USER.email}</p>
                </div>
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
