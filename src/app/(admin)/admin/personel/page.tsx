"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  name: string;
  role: string;
  organization_id: string | null;
  is_active?: boolean | null;
};

const STAFF_LIMIT = 3;

export default function AdminPersonelPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string>("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const staffCount = profiles.filter((p) => p.role === "staff").length;
  const canAddStaff = staffCount < STAFF_LIMIT;

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfiles([]);
      setOrgName("");
      setLoading(false);
      return;
    }
    const { data: me } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    const oid = me?.organization_id as string | null;
    if (oid) {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", oid).maybeSingle();
      setOrgName((org as { name?: string } | null)?.name || "");
    } else {
      setOrgName("");
    }
    const { data: list } = await supabase
      .from("profiles")
      .select("id, name, role, organization_id, is_active")
      .order("role", { ascending: true })
      .order("name", { ascending: true });
    setProfiles((list as ProfileRow[]) || []);
    setLoading(false);
  }, [supabase]);

  const [toggling, setToggling] = useState<string | null>(null);
  async function handleToggle(p: ProfileRow) {
    const next = !(p.is_active !== false);
    const verb = next ? "aktifleştirilsin mi" : "devre dışı bırakılsın mı";
    if (!confirm(`${p.name} ${verb}?`)) return;
    setToggling(p.id);
    try {
      const res = await fetch("/api/org/toggle-staff-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: p.id, active: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: json.error || "İşlem başarısız." });
        return;
      }
      setMsg({ type: "ok", text: json.message || "Güncellendi." });
      await load();
    } finally {
      setToggling(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/org/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: json.error || "İşlem başarısız." });
        return;
      }
      setMsg({ type: "ok", text: json.message || "Personel oluşturuldu." });
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary-400/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="flex items-start gap-4">
        <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Yönetim</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Personel Hesapları</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            {orgName ? (
              <>
                Firma: <span className="font-semibold text-slate-700">{orgName}</span> — Genel müdür en fazla{" "}
                <span className="font-bold text-indigo-600">{STAFF_LIMIT}</span> personel hesabı açabilir.
              </>
            ) : (
              "Firma bağlamı bulunamadı. Önce platform kurulumunun tamamlandığından emin olun."
            )}
          </p>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-navy-900 mb-3">Mevcut kullanıcılar</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {profiles.map((p) => {
            const active = p.is_active !== false;
            const isStaff = p.role === "staff";
            return (
              <li key={p.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-medium ${active ? "text-navy-800" : "text-slate-400 line-through"}`}>
                    {p.name}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    p.role === "admin"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {p.role === "admin" ? "Genel müdür" : p.role === "staff" ? "Personel" : p.role}
                  </span>
                  {!active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                      Pasif
                    </span>
                  )}
                </div>
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => handleToggle(p)}
                    disabled={toggling === p.id}
                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors font-semibold ${
                      active
                        ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    } disabled:opacity-50`}
                  >
                    {toggling === p.id ? "..." : active ? "Devre Dışı Bırak" : "Aktifleştir"}
                  </button>
                )}
              </li>
            );
          })}
          {profiles.length === 0 && <li className="text-navy-500 py-2">Kayıt yok.</li>}
        </ul>
        <p className="text-xs text-navy-500 mt-3">
          Personel: {staffCount} / {STAFF_LIMIT}
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-navy-900 mb-4">Yeni personel (staff)</h2>
        {!canAddStaff && (
          <p className="text-sm text-amber-700 mb-4">Personel kotası doldu. Yeni hesap açılamaz.</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Ad soyad" value={name} onChange={(e) => setName(e.target.value)} required disabled={!canAddStaff} />
          <Input
            label="E-posta (giriş)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!canAddStaff}
          />
          <Input
            label="Şifre (min. 8 karakter)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={!canAddStaff}
          />
          {msg && (
            <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
          )}
          <Button type="submit" disabled={!canAddStaff || submitting}>
            {submitting ? "Oluşturuluyor…" : "Personel oluştur"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
