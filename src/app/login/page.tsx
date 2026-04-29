"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { logLogin } from "@/lib/audit/authLog";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sifremi unuttum
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("visora_remember_email");
      const savedPwd = localStorage.getItem("visora_remember_password");
      if (savedEmail) setEmail(savedEmail);
      if (savedPwd) {
        setPassword(atob(savedPwd));
        setRememberMe(true);
      }
    } catch { /* localStorage erişim hatası */ }
  }, []);

  useEffect(() => {
    const blocked = search?.get("blocked");
    if (blocked === "suspended") {
      setError("Şirket hesabınız askıya alınmıştır. Lütfen platform sahibiyle iletişime geçin.");
    } else if (blocked === "cancelled") {
      setError("Şirket aboneliğiniz iptal edilmiştir. Lütfen platform sahibiyle iletişime geçin.");
    }
  }, [search]);

  const routeByRole = async (userId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id, organizations:organization_id ( status, name )")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { ok: false, reason: "Hesabınız sistemde bulunamadı. Lütfen yöneticinizle iletişime geçin." };
    }

    if (profile.role === "platform_owner") {
      router.push("/visora/companies");
      return { ok: true };
    }

    if (profile.organization_id) {
      const org = (profile as unknown as { organizations: { status: string; name: string } | null }).organizations;
      if (!org) {
        return { ok: false, reason: "Şirketiniz sistemde bulunamadı." };
      }
      if (org.status !== "active") {
        const msg =
          org.status === "suspended"
            ? `${org.name} hesabı askıya alınmıştır.`
            : org.status === "cancelled"
              ? `${org.name} aboneliği iptal edilmiştir.`
              : `${org.name} hesabı aktif değil (durum: ${org.status}).`;
        return { ok: false, reason: msg };
      }
    }

    if (profile.role === "admin") router.push("/admin/dashboard");
    else if (profile.role === "muhasebe") router.push("/muhasebe");
    else router.push("/app");
    return { ok: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw new Error("E-posta veya şifre hatalı");
      if (data.user) {
        const result = await routeByRole(data.user.id);
        if (!result.ok) {
          await supabase.auth.signOut();
          setError(result.reason);
          return;
        }
        void logLogin(supabase, data.user.id);
      }
      try {
        if (rememberMe) {
          localStorage.setItem("visora_remember_email", email.trim());
          localStorage.setItem("visora_remember_password", btoa(password));
        } else {
          localStorage.removeItem("visora_remember_email");
          localStorage.removeItem("visora_remember_password");
        }
      } catch { /* localStorage */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    const trimmed = (forgotEmail.trim() || email.trim()).toLowerCase();
    if (!trimmed) {
      setForgotError("E-posta adresinizi girin.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Bir hata oluştu.");
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err?.message || "Bir hata oluştu.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[480px] h-[480px] rounded-full bg-indigo-600/30 -top-32 -left-20 blur-3xl animate-blob" />
        <div className="absolute w-[520px] h-[520px] rounded-full bg-fuchsia-600/25 top-1/3 -right-32 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-600/25 bottom-0 left-1/4 blur-3xl animate-blob" style={{ animationDelay: "10s" }} />
      </div>

      <Link
        href="/"
        className="absolute top-5 left-5 z-20 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/10 backdrop-blur transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Ana sayfa
      </Link>

      <Card className="relative z-10 w-full max-w-md p-8" variant="elevated">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 ring-1 ring-indigo-100 flex items-center justify-center shadow-[0_20px_50px_-20px_rgba(99,102,241,0.5)]">
            <Image src="/visora-logo.png" alt="Visora" width={56} height={56} priority className="object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-gradient-visora">Visora</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">Vize ofisleri için modern yönetim platformu</p>
        </div>

        {/* ========== GİRİŞ FORMU ========== */}
        {!showForgot && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="E-posta"
                type="email"
                placeholder="ornek@firmaniz.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <div className="relative">
                <Input
                  label="Şifre"
                  type={showPassword ? "text" : "password"}
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 transition-colors"
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
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-600">Beni Hatırla</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotSent(false); setForgotError(null); }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Şifremi Unuttum
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>
          </>
        )}

        {/* ========== ŞİFREMİ UNUTTUM ========== */}
        {showForgot && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Şifremi Unuttum</h2>
              {!forgotSent && (
                <p className="text-sm text-slate-500 mt-1">
                  E-posta adresinize şifre sıfırlama bağlantısı gönderilecek.
                </p>
              )}
            </div>

            {!forgotSent ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <Input
                  label="E-posta adresiniz"
                  type="email"
                  placeholder="ornek@firmaniz.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                />
                {forgotError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {forgotError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 text-center"
                >
                  ← Giriş ekranına dön
                </button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Mail gönderildi!</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700">{forgotEmail}</span> adresine
                    şifre sıfırlama bağlantısı gönderildi. Birkaç dakika içinde gelen kutunuzu kontrol edin.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Spam/junk klasörünü de kontrol edin.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  ← Giriş ekranına dön
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Visora &copy; {new Date().getFullYear()} &middot; Vize ofisleri için modern yönetim platformu
        </p>
      </Card>
    </div>
  );
}
