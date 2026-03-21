"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Client {
  id: string; full_name: string; phone: string | null; email: string | null;
  passport_no: string | null; notes: string | null; created_at: string;
}

const empty = { full_name: "", phone: "", email: "", passport_no: "", notes: "" };

export default function ClientsPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Client | null>(null);

  useEffect(() => { setAgencyId(localStorage.getItem("agency_id")); }, []);

  const fetch = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").eq("agency_id", agencyId).order("created_at", { ascending: false });
    setClients(data || []);
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm({ full_name: c.full_name, phone: c.phone || "", email: c.email || "", passport_no: c.passport_no || "", notes: c.notes || "" }); setModal(true); };

  const save = async () => {
    if (!form.full_name.trim() || !agencyId) { alert("Ad soyad zorunludur."); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("clients").update({ full_name: form.full_name, phone: form.phone || null, email: form.email || null, passport_no: form.passport_no || null, notes: form.notes || null }).eq("id", editing.id);
      if (error) { alert("Hata: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("clients").insert({ agency_id: agencyId, full_name: form.full_name, phone: form.phone || null, email: form.email || null, passport_no: form.passport_no || null, notes: form.notes || null });
      if (error) { alert("Hata: " + error.message); setSaving(false); return; }
    }
    setSaving(false); setModal(false); fetch();
  };

  const del = async () => {
    if (!delTarget) return;
    await supabase.from("clients").delete().eq("id", delTarget.id);
    setDelTarget(null); fetch();
  };

  const filtered = clients.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div><h1 className="text-xl font-bold text-navy-900">Müşteriler</h1><p className="text-xs text-navy-400">{clients.length} kayıt</p></div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20">+ Yeni Müşteri</button>
      </div>

      <div className="relative">
        <svg className="absolute left-4 top-3 h-4 w-4 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input placeholder="İsim, email veya telefon ile ara..." className="h-11 w-full rounded-xl border border-navy-200 bg-white pl-10 pr-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-navy-400">{search ? "Arama sonucu bulunamadı." : "Henüz müşteri eklenmedi."}</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-navy-100 bg-navy-50/50">
              <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Müşteri</th>
              <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">İletişim</th>
              <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Pasaport</th>
              <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-navy-400">İşlem</th>
            </tr></thead>
            <tbody className="divide-y divide-navy-50">
              {filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-primary-50/30">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary-50 text-xs font-bold text-primary-600">{c.full_name[0]}</div><span className="font-semibold text-navy-900">{c.full_name}</span></div></td>
                  <td className="px-4 py-4 text-sm text-navy-500">{c.phone || c.email || "—"}</td>
                  <td className="px-4 py-4">{c.passport_no ? <span className="rounded-lg bg-navy-50 px-2 py-1 text-xs font-medium text-navy-700">{c.passport_no}</span> : <span className="text-xs text-navy-300">—</span>}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(c)} className="mr-2 text-xs text-navy-400 hover:text-primary-500">Düzenle</button>
                    <button onClick={() => setDelTarget(c)} className="text-xs text-navy-400 hover:text-red-500">Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-navy-900">{editing ? "Müşteri Düzenle" : "Yeni Müşteri"}</h3>
            <div className="space-y-3">
              <input placeholder="Ad Soyad *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <input placeholder="Pasaport No" value={form.passport_no} onChange={(e) => setForm({ ...form, passport_no: e.target.value })} className="h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              <textarea placeholder="Not" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-navy-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium text-navy-700">İptal</button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50">{saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Ekle"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/40" onClick={() => setDelTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <p className="text-sm text-navy-600">&ldquo;{delTarget.full_name}&rdquo; silinecek. Emin misiniz?</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setDelTarget(null)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm">İptal</button>
              <button onClick={del} className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
