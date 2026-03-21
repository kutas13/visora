"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Agency {
  id: string;
  name: string;
  phone: string | null;
  logo_url: string | null;
}

interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const MODULES: ModuleConfig[] = [
  { key: "email", label: "Email Bildirimleri", description: "Müşterilere otomatik email bildirimleri gönderin", icon: "📧", color: "from-blue-500 to-blue-600" },
  { key: "whatsapp", label: "WhatsApp Entegrasyonu", description: "WhatsApp üzerinden otomatik bildirimler", icon: "💬", color: "from-[#25D366] to-green-600" },
  { key: "sms", label: "SMS Bildirimleri", description: "SMS ile randevu ve vize hatırlatmaları", icon: "📱", color: "from-purple-500 to-violet-600" },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [contactModal, setContactModal] = useState<string | null>(null);

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchAgency = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase.from("agencies").select("*").eq("id", agencyId).single();
    if (data) {
      setAgency(data);
      setForm({ name: data.name || "", phone: data.phone || "" });
    }
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => {
    fetchAgency();
  }, [fetchAgency]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!agencyId || !form.name.trim()) return;
    setSaving(true);
    await supabase.from("agencies").update({ name: form.name, phone: form.phone || null }).eq("id", agencyId);
    localStorage.setItem("agency_name", form.name);
    setSaving(false);
    showToast("Bilgiler kaydedildi");
    fetchAgency();
  };

  const handleLogoUpload = async (file: File) => {
    if (!agencyId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${agencyId}/logo.${ext}`;

    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      await supabase.from("agencies").update({ logo_url: urlData.publicUrl }).eq("id", agencyId);
      showToast("Logo güncellendi");
      fetchAgency();
    }
    setUploading(false);
  };

  const toggleModule = (key: string) => {
    const next = new Set(activeModules);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      setContactModal(key);
    }
    setActiveModules(next);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 animate-fade-in-up rounded-xl bg-green-500 px-5 py-3 text-sm font-medium text-white shadow-xl">
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-800 shadow-lg">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy-900">Ayarlar</h1>
          <p className="text-xs text-navy-400">Şirket bilgileri ve modüller</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company info */}
        <div className="rounded-2xl border border-navy-200/60 bg-white shadow-sm">
          <div className="border-b border-navy-100 bg-navy-50/50 px-6 py-4">
            <h3 className="text-sm font-semibold text-navy-900">Şirket Bilgileri</h3>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="text-sm font-medium text-navy-700">Şirket Adı</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        {/* Logo upload */}
        <div className="rounded-2xl border border-navy-200/60 bg-white shadow-sm">
          <div className="border-b border-navy-100 bg-navy-50/50 px-6 py-4">
            <h3 className="text-sm font-semibold text-navy-900">Şirket Logosu</h3>
          </div>
          <div className="flex flex-col items-center p-6">
            {agency?.logo_url ? (
              <img src={agency.logo_url} alt="Logo" className="mb-4 h-24 w-24 rounded-2xl border border-navy-100 object-contain" />
            ) : (
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-100 to-navy-50 text-3xl text-navy-300">
                🏢
              </div>
            )}
            <label className={`cursor-pointer rounded-xl border-2 border-dashed px-8 py-4 text-center transition-colors ${
              uploading ? "border-primary-300 bg-primary-50" : "border-navy-200 hover:border-primary-400 hover:bg-primary-50/50"
            }`}>
              {uploading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-primary-500" />
                  <span className="text-sm text-primary-600">Yükleniyor...</span>
                </div>
              ) : (
                <>
                  <svg className="mx-auto h-6 w-6 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="mt-1 text-xs font-medium text-navy-500">Logo yüklemek için tıklayın</p>
                  <p className="text-[10px] text-navy-300">PNG, JPG (max 2MB)</p>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="border-b border-navy-100 bg-navy-50/50 px-6 py-4">
          <h3 className="text-sm font-semibold text-navy-900">Modüller</h3>
          <p className="mt-0.5 text-xs text-navy-400">Ek modülleri aktif edin</p>
        </div>
        <div className="divide-y divide-navy-50 p-2">
          {MODULES.map((mod) => {
            const isActive = activeModules.has(mod.key);
            return (
              <div key={mod.key} className="flex items-center gap-4 rounded-xl px-4 py-4 transition-colors hover:bg-navy-50/50">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${mod.color} text-lg text-white shadow-lg`}>
                  {mod.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-900">{mod.label}</p>
                  <p className="text-xs text-navy-400">{mod.description}</p>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => toggleModule(mod.key)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    isActive ? "bg-primary-500" : "bg-navy-200"
                  }`}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contact modal on module activation */}
      {contactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setContactModal(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-primary-500 to-accent-500 px-6 py-5 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl">
                {MODULES.find((m) => m.key === contactModal)?.icon}
              </div>
              <h3 className="text-lg font-bold text-white">Modül Aktivasyonu</h3>
              <p className="mt-1 text-sm text-white/80">
                {MODULES.find((m) => m.key === contactModal)?.label} modülünü aktif etmek için bizimle iletişime geçin
              </p>
            </div>
            <div className="p-6">
              <div className="rounded-xl bg-navy-50 p-4 text-center">
                <p className="text-sm font-medium text-navy-700">Bizi arayın veya yazın:</p>
                <p className="mt-2 text-2xl font-bold text-navy-900">0545 603 65 47</p>
                <a
                  href="https://wa.me/905456036547"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/20 hover:bg-[#1da851] transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
                  WhatsApp ile Yazın
                </a>
              </div>
              <button
                onClick={() => setContactModal(null)}
                className="mt-4 w-full rounded-xl border border-navy-200 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
