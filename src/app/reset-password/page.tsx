"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Step = "loading" | "form" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("loading");
  const [errMsg, setErrMsg] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Yöntem 1: URL'de token_hash parametresi var (bizim custom link)
    const tokenHash = searchParams?.get("token_hash");
    const type = searchParams?.get("type");

    if (tokenHash) {
      // OTP verify ile oturum aç — Supabase redirect URL ayarlarından bağımsız
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: (type as any) || "recovery" })
        .then(({ error }) => {
          if (error) {
            console.error("[reset-password] verifyOtp error:", error.message);
            setErrMsg("Bağlantı geçersiz veya süresi dolmuş. Yeniden şifremi unuttum talebi oluşturun.");
            setStep("error");
          } else {
            setStep("form");
          }
        });
      return;
    }

    // Yöntem 2: Supabase hash fragment üzerinden (eski action_link fallback)
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setStep((prev) => (prev === "loading" ? "form" : prev));
      }
    });

    // 5 saniye içinde event gelmezse hata göster
    const timer = setTimeout(() => {
      setStep((prev) => {
        if (prev === "loading") {
          setErrMsg("Bağlantı geçersiz veya süresi dolmuş. Yeniden şifremi unuttum talebi oluşturun.");
          return "error";
        }
        return prev;
      });
    }, 5000);

    return () => {
      listener?.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setFormError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStep("success");
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      setFormError(err?.message || "Şifre güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[480px] h-[480px] rounded-full bg-indigo-600/30 -top-32 -left-20 blur-3xl" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-600/25 bottom-0 left-1/4 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md p-8" variant="elevated">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 ring-1 ring-indigo-100 flex items-center justify-center">
            <Image src="/visora-logo.png" alt="Visora" width={44} height={44} priority className="object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Yeni Şifre Belirle</h1>
        </div>

        {/* Yükleniyor */}
        {step === "loading" && (
          <div className="text-center py-8 text-slate-500">
            <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Bağlantı doğrulanıyor...</p>
          </div>
        )}

        {/* Hata */}
        {step === "error" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-slate-600">{errMsg}</p>
            <Link href="/login">
              <Button className="w-full">Giriş sayfasına dön</Button>
            </Link>
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 text-center mb-2">
              Hesabınız için yeni bir şifre belirleyin.
            </p>
            <div className="relative">
              <Input
                label="Yeni Şifre"
                type={showPwd ? "text" : "password"}
                placeholder="En az 8 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                aria-label="Şifreyi göster/gizle"
              >
                {showPwd ? (
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
            <Input
              label="Yeni Şifre (Tekrar)"
              type="password"
              placeholder="Şifrenizi tekrar girin"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
            />
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {formError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Güncelleniyor..." : "Şifremi Güncelle"}
            </Button>
          </form>
        )}

        {/* Başarı */}
        {step === "success" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Şifreniz güncellendi!</h3>
              <p className="text-sm text-slate-500 mt-1">Giriş sayfasına yönlendiriliyorsunuz...</p>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Visora &copy; {new Date().getFullYear()}
        </p>
      </Card>
    </div>
  );
}
