"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button, Input, Card, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("visora_remember_email");
      const savedPwd = localStorage.getItem("visora_remember_password");
      if (savedEmail) {
        setEmail(savedEmail);
      }
      if (savedPwd) {
        setPassword(atob(savedPwd));
        setRememberMe(true);
      }
    } catch {
      /* localStorage erişim hatası */
    }
  }, []);

  // Middleware tarafindan bloke edildiyse uyari goster
  useEffect(() => {
    const blocked = search?.get("blocked");
    if (blocked === "suspended") {
      setError("Şirket hesabınız askıya alınmıştır. Erişiminiz devre dışı bırakıldı. Lütfen platform sahibiyle iletişime geçin.");
    } else if (blocked === "cancelled") {
      setError("Şirket aboneliğiniz iptal edilmiştir. Erişiminiz kapatıldı. Lütfen platform sahibiyle iletişime geçin.");
    }
  }, [search]);

  const routeByRole = async (userId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { ok: false, reason: "Hesabınız sistemde bulunamadı. Lütfen yöneticinizle iletişime geçin." };
    }

    // Platform owner -> dogrudan visora paneline
    if (profile.role === "platform_owner") {
      router.push("/visora/companies");
      router.refresh();
      return { ok: true };
    }

    // Sirket statu kontrolu (sadece sirketle iliskilendirilmis kullanicilar icin)
    if (profile.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("status, name")
        .eq("id", profile.organization_id)
        .single();

      if (!org) {
        return {
          ok: false,
          reason: "Şirketiniz sistemde bulunamadı. Lütfen platform sahibine bildirin.",
        };
      }

      if (org.status !== "active") {
        const statusMsg =
          org.status === "suspended"
            ? `${org.name} hesabı askıya alınmıştır. Lütfen platform sahibiyle iletişime geçin.`
            : org.status === "cancelled"
              ? `${org.name} aboneliği iptal edilmiştir. Erişim kapalıdır.`
              : `${org.name} hesabı şu anda aktif değil (durum: ${org.status}). Lütfen platform sahibiyle iletişime geçin.`;
        return { ok: false, reason: statusMsg };
      }
    }

    if (profile.role === "admin") {
      router.push("/admin/dashboard");
    } else if (profile.role === "muhasebe") {
      router.push("/muhasebe");
    } else {
      router.push("/app");
    }
    router.refresh();
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
          // Sirket pasif -> oturumu hemen kapat ve uyari ver
          await supabase.auth.signOut();
          setError(result.reason);
          return;
        }
      }

      try {
        if (rememberMe) {
          localStorage.setItem("visora_remember_email", email.trim());
          localStorage.setItem("visora_remember_password", btoa(password));
        } else {
          localStorage.removeItem("visora_remember_email");
          localStorage.removeItem("visora_remember_password");
        }
      } catch {
        /* localStorage erişim hatası */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (resetLoading) return;

    if (!email.trim()) {
      setResetError("Önce e-posta adresinizi girin.");
      return;
    }
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: oldPassword,
      });

      if (signInError) {
        setResetError("Mevcut şifre hatalı.");
        setResetLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      try {
        if (rememberMe) {
          localStorage.setItem("visora_remember_password", btoa(newPassword));
        }
      } catch {
        /* localStorage erişim hatası */
      }

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[480px] h-[480px] rounded-full bg-indigo-600/30 -top-32 -left-20 blur-3xl animate-blob" />
        <div className="absolute w-[520px] h-[520px] rounded-full bg-fuchsia-600/25 top-1/3 -right-32 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-600/25 bottom-0 left-1/4 blur-3xl animate-blob" style={{ animationDelay: "10s" }} />
      </div>

      {/* Sol üst geri linki */}
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
        <div className="text-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 ring-1 ring-indigo-100 flex items-center justify-center shadow-[0_20px_50px_-20px_rgba(99,102,241,0.5)]">
            <Image
              src="/visora-logo.png"
              alt="Visora"
              width={56}
              height={56}
              priority
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-gradient-visora">Visora</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">Vize ofisleri için modern yönetim platformu</p>
        </div>

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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-navy-400">
          Visora &copy; {new Date().getFullYear()} &middot; Vize ofisleri için modern yönetim platformu
        </p>
      </Card>

      <Modal isOpen={showForgotModal} onClose={closeForgotModal} title="Şifre Değiştir" size="sm">
        <div className="py-4">
          {!resetSuccess ? (
            <div className="space-y-4">
              <div className="bg-navy-50 rounded-xl p-3 text-center">
                <p className="text-xs text-navy-500">Şifre değiştirilecek hesap</p>
                <p className="font-semibold text-navy-900 break-all">{email || "—"}</p>
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
