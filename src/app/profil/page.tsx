"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TopNav from "@/components/layout/TopNav";

export default function ProfilePage() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; name: string; role: string; avatar_url: string | null; org_name: string } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Şifre
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Foto
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseRef.current;
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) console.error("[profil] getUser error:", userErr);
        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, role, avatar_url, organization_id")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("[profil] profile fetch error:", error);
        }

        let orgName = "";
        if (data?.organization_id) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", data.organization_id)
            .maybeSingle();
          orgName = (org as any)?.name || "";
        }

        const fallbackName =
          (user.user_metadata as any)?.name ||
          (user.user_metadata as any)?.full_name ||
          user.email?.split("@")[0] ||
          "Kullanıcı";

        const finalProfile = {
          id: user.id,
          name: data?.name || fallbackName,
          role: data?.role || "staff",
          avatar_url: (data as any)?.avatar_url || null,
          org_name: orgName,
        };
        setProfile(finalProfile);
        if (finalProfile.avatar_url) setAvatarPreview(finalProfile.avatar_url);
      } catch (err: any) {
        console.error("[profil] fatal:", err);
        setPageError(err?.message || "Profil yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({ type: "err", text: "Foto 5MB'tan büyük olamaz." });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    setAvatarMsg(null);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !profile) return;
    setAvatarBusy(true);
    setAvatarMsg(null);
    try {
      const supabase = supabaseRef.current;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(avatarFile);
      });

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ base64 }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Yükleme hatası");

      setAvatarPreview(json.url);
      setProfile((p) => p ? { ...p, avatar_url: json.url } : p);
      setAvatarFile(null);
      setAvatarMsg({ type: "ok", text: "Profil fotoğrafınız güncellendi!" });
      setTimeout(() => setAvatarMsg(null), 3000);
    } catch (err: any) {
      setAvatarMsg({ type: "err", text: err?.message || "Foto yüklenemedi." });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!confirm("Profil fotoğrafını kaldırmak istiyor musunuz?")) return;
    setAvatarBusy(true);
    try {
      const supabase = supabaseRef.current;
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile!.id);
      setAvatarPreview(null);
      setAvatarFile(null);
      setProfile((p) => p ? { ...p, avatar_url: null } : p);
      setAvatarMsg({ type: "ok", text: "Profil fotoğrafı kaldırıldı." });
      setTimeout(() => setAvatarMsg(null), 3000);
    } catch (err: any) {
      setAvatarMsg({ type: "err", text: err?.message || "Hata." });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handlePwdChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (newPwd.length < 8) { setPwdMsg({ type: "err", text: "Yeni şifre en az 8 karakter olmalı." }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ type: "err", text: "Şifreler eşleşmiyor." }); return; }

    setPwdBusy(true);
    try {
      const supabase = supabaseRef.current;
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdMsg({ type: "ok", text: "Şifreniz başarıyla güncellendi!" });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => setPwdMsg(null), 4000);
    } catch (err: any) {
      setPwdMsg({ type: "err", text: err?.message || "Şifre güncellenemedi." });
    } finally {
      setPwdBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (pageError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-4">
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Profil yüklenemedi</h2>
          <p className="text-sm text-slate-500 mb-4">{pageError || "Bir sorun oluştu."}</p>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const initials = (profile.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navVariant: "admin" | "staff" | "platform" =
    profile.role === "platform_owner"
      ? "platform"
      : profile.role === "admin"
      ? "admin"
      : "staff";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <TopNav
        variant={navVariant}
        userName={profile.name}
        orgName={profile.org_name}
        avatarUrl={profile.avatar_url}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-start gap-4">
            <span className="w-1.5 h-12 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500 mt-1" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Hesap</p>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Profilim</h1>
              <p className="text-slate-500 text-sm mt-0.5">Profil fotoğrafınızı ve şifrenizi yönetin.</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Geri
          </button>
        </div>

        {/* Profil Foto */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-black">1</span>
            Profil Fotoğrafı
          </h2>

          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden ring-4 ring-white shadow-xl">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-white">{initials}</span>
                )}
              </div>
            </div>

            <div className="flex-1">
              <p className="text-base font-bold text-slate-900">{profile.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">
                {profile.role === "admin" ? "Genel Müdür" : profile.role === "staff" ? "Personel" : profile.role === "muhasebe" ? "Muhasebe" : profile.role === "platform_owner" ? "Platform Sahibi" : profile.role}
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Foto Seç
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
                </label>

                {avatarFile && (
                  <button
                    onClick={handleAvatarUpload}
                    disabled={avatarBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-[1.02] text-xs font-bold text-white shadow-md disabled:opacity-50 disabled:hover:scale-100 transition-all"
                  >
                    {avatarBusy ? "Yükleniyor..." : "Kaydet"}
                  </button>
                )}

                {profile.avatar_url && !avatarFile && (
                  <button
                    onClick={handleAvatarRemove}
                    disabled={avatarBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition disabled:opacity-50"
                  >
                    Kaldır
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-2">PNG, JPG veya WEBP. Max 5MB.</p>

              {avatarMsg && (
                <p className={`mt-2 text-xs font-medium ${avatarMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                  {avatarMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Şifre */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">2</span>
            Şifre Değiştir
          </h2>

          <form onSubmit={handlePwdChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Yeni Şifre</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Yeni Şifre (Tekrar)</label>
              <input
                type={showPwd ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Şifrenizi tekrar girin"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {pwdMsg && (
              <div className={`p-3 rounded-xl text-sm font-medium ${pwdMsg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {pwdMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={pwdBusy}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {pwdBusy ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
