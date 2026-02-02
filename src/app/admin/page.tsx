"use client";

import { useState } from "react";
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
  
  // Password reset state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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

  const handlePasswordReset = async () => {
    if (resetLoading) return;

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(false);

    try {
      const supabase = createClient();
      
      // Get the current URL for the redirect
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(ADMIN_USER.email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setResetSuccess(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Şifre sıfırlama e-postası gönderilemedi");
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetSuccess(false);
    setResetError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8" variant="elevated">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="relative w-44 h-28 mx-auto mb-3">
            <Image
              src="/fox-logo.png"
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
            <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xl">D</span>
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
          
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            Şifremi Unuttum
          </button>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.push("/login")} className="flex-1">
              ← Geri
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Şifremi Unuttum Modal */}
      <Modal isOpen={showForgotModal} onClose={closeForgotModal} title="Şifre Sıfırlama" size="sm">
        <div className="py-4">
          {!resetSuccess ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="bg-navy-50 rounded-xl p-3 mb-4">
                  <p className="text-sm text-navy-500">Yönetici</p>
                  <p className="font-semibold text-navy-900">{ADMIN_USER.name}</p>
                  <p className="text-xs text-navy-400">{ADMIN_USER.email}</p>
                </div>
                <p className="text-navy-700 text-sm">
                  E-posta adresinize şifre sıfırlama bağlantısı gönderilecektir.
                </p>
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {resetError}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={closeForgotModal} className="flex-1">
                  İptal
                </Button>
                <Button onClick={handlePasswordReset} className="flex-1" disabled={resetLoading}>
                  {resetLoading ? "Gönderiliyor..." : "E-posta Gönder"}
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
              <h3 className="text-lg font-semibold text-navy-900">E-posta Gönderildi!</h3>
              <p className="text-sm text-navy-600">
                Şifre sıfırlama bağlantısı <strong>{ADMIN_USER.email}</strong> adresine gönderildi.
              </p>
              <p className="text-xs text-navy-400">
                E-postanızdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz.
              </p>
              <Button onClick={closeForgotModal} className="w-full">Tamam</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
