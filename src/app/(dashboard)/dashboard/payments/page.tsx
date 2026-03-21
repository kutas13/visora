"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Payment {
  id: string;
  amount: number;
  payment_type: string;
  status: string;
  created_at: string;
  application_id: string | null;
}

const TYPE_LABELS: Record<string, string> = { nakit: "Nakit", havale: "Havale", kredi_karti: "Kredi Kartı" };
const TYPE_COLORS: Record<string, string> = {
  nakit: "bg-green-100 text-green-700",
  havale: "bg-blue-100 text-blue-700",
  kredi_karti: "bg-purple-100 text-purple-700",
};

const emptyForm = { amount: "", payment_type: "nakit", status: "paid", application_id: "" };

export default function PaymentsPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleSave = async () => {
    if (!agencyId || !form.amount) return;
    setSaving(true);
    await supabase.from("payments").insert({
      agency_id: agencyId,
      amount: Number(form.amount),
      payment_type: form.payment_type,
      status: form.status,
      application_id: form.application_id || null,
    });
    setSaving(false);
    setModal(false);
    setForm(emptyForm);
    fetchPayments();
  };

  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  const summaryCards = [
    { title: "Toplam Gelir", value: `₺${totalRevenue.toLocaleString("tr-TR")}`, gradient: "from-green-500 to-green-600", icon: "💰" },
    { title: "Bekleyen", value: `₺${pendingTotal.toLocaleString("tr-TR")}`, gradient: "from-amber-400 to-amber-500", icon: "⏳" },
    { title: "Toplam İşlem", value: payments.length.toString(), gradient: "from-primary-500 to-primary-600", icon: "📊" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Ödemeler</h1>
            <p className="text-xs text-navy-400">{payments.length} işlem</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20"
        >
          + Yeni Ödeme
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">{c.title}</p>
                <p className="mt-1 text-3xl font-bold text-navy-900">{loading ? "..." : c.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} text-xl text-white shadow-lg`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-sm text-navy-400">Henüz ödeme kaydı yok.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tutar</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tür</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Durum</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-primary-50/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-navy-900">₺{p.amount.toLocaleString("tr-TR")}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${TYPE_COLORS[p.payment_type] || "bg-navy-100 text-navy-600"}`}>
                      {TYPE_LABELS[p.payment_type] || p.payment_type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      p.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${p.status === "paid" ? "bg-green-500" : "bg-amber-500"}`} />
                      {p.status === "paid" ? "Ödendi" : "Bekliyor"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-navy-500">
                    {new Date(p.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add payment modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
              <h3 className="font-semibold text-white">Yeni Ödeme</h3>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="text-sm font-medium text-navy-700">Tutar (₺)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-navy-700">Ödeme Türü</label>
                <select
                  value={form.payment_type}
                  onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="nakit">Nakit</option>
                  <option value="havale">Havale</option>
                  <option value="kredi_karti">Kredi Kartı</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-navy-700">Durum</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="paid">Ödendi</option>
                  <option value="pending">Bekliyor</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
                <button onClick={() => setModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium text-navy-700">İptal</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
