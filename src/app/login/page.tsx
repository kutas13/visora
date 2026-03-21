"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: fetchError } = await supabase
      .from("users")
      .select("id, agency_id, full_name, email, role, password_hash")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (fetchError || !data) {
      setError("Bu email ile kayıtlı kullanıcı bulunamadı.");
      setLoading(false);
      return;
    }

    if (data.password_hash !== password) {
      setError("Şifre hatalı.");
      setLoading(false);
      return;
    }

    document.cookie = `agency_id=${data.agency_id}; path=/; max-age=2592000`;
    document.cookie = `app_role=${data.role}; path=/; max-age=2592000`;
    localStorage.setItem("agency_id", data.agency_id);
    localStorage.setItem("user_id", data.id);
    localStorage.setItem("user_name", data.full_name);
    localStorage.setItem("user_role", data.role);

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500">
              <span className="text-xl font-black text-white">V</span>
            </div>
            <span className="text-2xl font-bold text-navy-900">Visora</span>
          </Link>
          <p className="mt-3 text-sm text-navy-500">Hesabınıza giriş yapın</p>
        </div>

        <div className="rounded-2xl border border-navy-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-navy-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 flex h-11 w-full rounded-xl border border-navy-200 bg-white px-4 text-sm text-navy-900 shadow-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="ornek@sirket.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700">Şifre</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 flex h-11 w-full rounded-xl border border-navy-200 bg-white px-4 text-sm text-navy-900 shadow-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Şifreniz"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-all hover:shadow-xl disabled:opacity-50"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-navy-500">
          Hesabınız yok mu?{" "}
          <Link href="/register" className="font-medium text-primary-500 hover:underline">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
