"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

const GRADIENTS = [
  "from-primary-500 to-primary-600",
  "from-accent-500 to-green-500",
  "from-orange-400 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-violet-500",
];

const emptyForm = { full_name: "", email: "", password: "", phone: "", role: "staff" };

export default function StaffPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchStaff = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: true });
    setStaff(data || []);
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditId(s.id);
    setForm({ full_name: s.full_name, email: s.email, password: "", phone: s.phone || "", role: s.role });
    setModal(true);
  };

  const handleSave = async () => {
    if (!agencyId || !form.full_name.trim() || !form.email.trim()) return;
    setSaving(true);

    if (editId) {
      const updates: Record<string, string | null> = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
      };
      await supabase.from("users").update(updates).eq("id", editId);
    } else {
      if (!form.password) { setSaving(false); return; }
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, agency_id: agencyId, role: form.role } },
      });
      if (!authErr && authData.user) {
        await supabase.from("users").insert({
          id: authData.user.id,
          agency_id: agencyId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
        });
      }
    }

    setSaving(false);
    setModal(false);
    setForm(emptyForm);
    fetchStaff();
  };

  const handleAvatarUpload = async (staffId: string, file: File) => {
    setUploadingId(staffId);
    const ext = file.name.split(".").pop();
    const path = `${agencyId}/${staffId}.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("users").update({ avatar_url: urlData.publicUrl }).eq("id", staffId);
      fetchStaff();
    }
    setUploadingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Personel</h1>
            <p className="text-xs text-navy-400">{staff.length} kişi</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20"
        >
          + Yeni Personel
        </button>
      </div>

      {/* Staff grid */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
      ) : staff.length === 0 ? (
        <div className="rounded-2xl border border-navy-200/60 bg-white py-16 text-center shadow-sm">
          <p className="text-sm text-navy-400">Henüz personel eklenmedi.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s, i) => (
            <div key={s.id} className="group relative rounded-2xl border border-navy-200/60 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
              {/* Edit button */}
              <button
                onClick={() => openEdit(s)}
                className="absolute right-4 top-4 rounded-lg bg-navy-50 px-2.5 py-1 text-[11px] font-medium text-navy-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-primary-50 hover:text-primary-600"
              >
                Düzenle
              </button>

              <div className="flex items-start gap-4">
                {/* Avatar with camera upload */}
                <div className="relative">
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt={s.full_name} className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} text-xl font-bold text-white shadow-lg`}>
                      {s.full_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white shadow-md border border-navy-100 hover:bg-primary-50 transition-colors">
                    {uploadingId === s.id ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-navy-200 border-t-primary-500" />
                    ) : (
                      <svg className="h-3 w-3 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarUpload(s.id, file);
                      }}
                    />
                  </label>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-navy-900">{s.full_name}</h3>
                  <p className="text-xs text-navy-400 truncate">{s.email}</p>
                  {s.phone && <p className="mt-0.5 text-xs text-navy-400">{s.phone}</p>}
                  <div className="mt-2">
                    <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${
                      s.role === "agency_admin" ? "bg-primary-100 text-primary-700" : "bg-navy-100 text-navy-600"
                    }`}>
                      {s.role === "agency_admin" ? "Admin" : "Personel"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
              <h3 className="font-semibold text-white">{editId ? "Personel Düzenle" : "Yeni Personel"}</h3>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="text-sm font-medium text-navy-700">Ad Soyad *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-navy-700">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-navy-700">Telefon</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              {!editId && (
                <div>
                  <label className="text-sm font-medium text-navy-700">Şifre *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-navy-700">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="staff">Personel</option>
                  <option value="agency_admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
                <button onClick={() => setModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium text-navy-700">İptal</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : editId ? "Güncelle" : "Ekle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
