"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Input, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role, must_change_password")
        .eq("id", user.id)
        .single();

      if (!profile?.must_change_password) {
        if (profile?.role === "admin") router.replace("/admin/dashboard");
        else if (profile?.role === "muhasebe") router.replace("/muhasebe");
        else router.replace("/app");
        return;
      }

      setUserName(profile.name || "");
      setChecking(false);
    }
    check();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      let targetRole = "staff";
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (prof?.role) targetRole = prof.role;
      }

      if (targetRole === "admin") router.replace("/admin/dashboard");
      else if (targetRole === "muhasebe") router.replace("/muhasebe");
      else router.replace("/app");

      supabase.auth.updateUser({ password: newPassword }).then(() => {
        if (!user) return;
        supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id).then(() => {
          if (targetRole === "admin") {
            supabase.from("profiles").select("organization_id").eq("id", user.id).single().then(({ data }) => {
              if (data?.organization_id) {
                supabase.from("organizations").update({ admin_initial_password: null }).eq("id", data.organization_id);
              }
            });
          }
        });
      });
    } catch (err: any) {
      setError(err?.message || "Şifre güncellenemedi.");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[480px] h-[480px] rounded-full bg-indigo-600/30 -top-32 -left-20 blur-3xl animate-blob" />
        <div className="absolute w-[520px] h-[520px] rounded-full bg-fuchsia-600/25 top-1/3 -right-32 blur-3xl animate-blob" style={{ animationDelay: "5s" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-600/25 bottom-0 left-1/4 blur-3xl animate-blob" style={{ animationDelay: "10s" }} />
      </div>

      <Card className="relative z-10 w-full max-w-md p-8" variant="elevated">
        <div className="text-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 ring-1 ring-indigo-100 flex items-center justify-center shadow-[0_20px_50px_-20px_rgba(99,102,241,0.5)]">
            <Image src="/visora-logo.png" alt="Visora" width={56} height={56} priority className="object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Yeni Şifre Belirleyin
          </h1>
          {userName && (
            <p className="text-sm text-slate-500 mt-1.5">
              Merhaba <span className="font-semibold text-slate-700">{userName}</span>, güvenliğiniz için lütfen yeni bir şifre oluşturun.
            </p>
          )}
        </div>

        {!success ? (
          <>
            <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-[13px] text-amber-800 leading-snug">
                  İlk girişiniz olduğu için size verilen geçici şifreyi değiştirmeniz gerekmektedir.
                </p>
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
                  label="Yeni Şifre"
                  type={showPwd ? "text" : "password"}
                  placeholder="En az 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 transition-colors"
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
                type={showPwd ? "text" : "password"}
                placeholder="Şifrenizi tekrar girin"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              {newPassword.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${newPassword.length >= 8 ? "bg-emerald-500" : "bg-red-400"}`} />
                  <span className={newPassword.length >= 8 ? "text-emerald-600" : "text-red-500"}>
                    {newPassword.length >= 8 ? "En az 8 karakter" : `${8 - newPassword.length} karakter daha gerekli`}
                  </span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Kaydediliyor..." : "Şifremi Değiştir"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Şifreniz başarıyla güncellendi!</h3>
              <p className="text-sm text-slate-500 mt-1">Yönlendiriliyorsunuz...</p>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Visora &copy; {new Date().getFullYear()} &middot; Vize ofisleri için modern yönetim platformu
        </p>
      </Card>
    </div>
  );
}
