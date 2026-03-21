"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", companyName: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ register: form, checkout: { planType: "monthly", selectedModules: [], totalPrice: 0 } }),
    });

    const result = await res.json();
    if (!res.ok) { setError(result.message || "Kayıt başarısız."); setLoading(false); return; }

    document.cookie = `agency_id=${result.agencyId}; path=/; max-age=2592000`;
    document.cookie = `app_role=agency_admin; path=/; max-age=2592000`;
    localStorage.setItem("agency_id", result.agencyId);
    localStorage.setItem("agency_name", form.companyName);
    localStorage.setItem("user_id", result.userId);
    localStorage.setItem("user_name", form.fullName);
    localStorage.setItem("user_role", "agency_admin");

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary-500 to-navy-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0"><div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" /><div className="absolute bottom-20 right-10 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" /></div>
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><span className="text-xl font-black text-white">V</span></div>
            <span className="text-2xl font-bold text-white">Visora</span>
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white">Acentenizi<br />dijitalleştirin.</h2>
          <p className="mt-4 max-w-md text-base text-white/70">Kayıt olun, saniyeler içinde müşteri ve dosya yönetimine başlayın.</p>
        </div>
        <p className="relative z-10 text-xs text-white/40">&copy; 2026 Visora</p>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500"><span className="text-lg font-black text-white">V</span></div>
              <span className="text-xl font-bold text-navy-900">Visora</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Hesap Oluştur</h1>
          <p className="mt-2 text-sm text-navy-500">Bilgilerinizi girin, hemen başlayalım.</p>

          {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-navy-700">İsim Soyisim</label>
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 flex h-11 w-full rounded-xl border border-navy-200 px-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="Ahmet Yılmaz" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700">Şirket / Acente İsmi</label>
              <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="mt-1 flex h-11 w-full rounded-xl border border-navy-200 px-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="ABC Vize Danışmanlık" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700">Telefon</label>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 flex h-11 w-full rounded-xl border border-navy-200 px-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="+90 5XX XXX XX XX" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 flex h-11 w-full rounded-xl border border-navy-200 px-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="ornek@sirket.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700">Şifre</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 flex h-11 w-full rounded-xl border border-navy-200 px-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="En az 6 karakter" />
            </div>
            <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 hover:shadow-xl disabled:opacity-50">
              {loading ? "Hesap oluşturuluyor..." : "Kayıt Ol ve Başla →"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-navy-500">Zaten hesabınız var mı? <Link href="/login" className="font-medium text-primary-500 hover:underline">Giriş Yap</Link></p>
        </div>
      </div>
    </div>
  );
}
