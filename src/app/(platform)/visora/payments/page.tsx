"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Modal, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Org = {
  id: string;
  name: string;
  status: string;
};

type Subscription = {
  organization_id: string;
  monthly_fee: number;
  currency: string;
  status: string;
};

type Payment = {
  id: string;
  organization_id: string;
  period_year: number;
  period_month: number;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  note: string | null;
};

const fmtTRY = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);

const monthShort = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });

function buildLastNMonths(n: number): { year: number; month: number; key: string }[] {
  const result: { year: number; month: number; key: string }[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    result.push({ year: y, month: m, key: `${y}-${m}` });
  }
  return result;
}

export default function VisoraPaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthsToShow, setMonthsToShow] = useState(6);
  const [err, setErr] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  // Cell modal
  const [editing, setEditing] = useState<{
    org: Org;
    year: number;
    month: number;
    payment: Payment | null;
    sub: Subscription | undefined;
  } | null>(null);
  const [eAmount, setEAmount] = useState("");
  const [eMethod, setEMethod] = useState("");
  const [eNote, setENote] = useState("");
  const [eBusy, setEBusy] = useState(false);

  const months = useMemo(() => buildLastNMonths(monthsToShow), [monthsToShow]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [{ data: o, error: oe }, { data: s }, { data: p }] = await Promise.all([
      supabase.from("organizations").select("id, name, status").order("name"),
      supabase.from("platform_subscriptions").select("organization_id, monthly_fee, currency, status"),
      supabase
        .from("platform_payments")
        .select("id, organization_id, period_year, period_month, amount, paid, paid_at, payment_method, note")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false }),
    ]);
    if (oe) {
      setErr(oe.message);
      setLoading(false);
      return;
    }
    setOrgs((o as Org[] | null) || []);
    setSubs((s as Subscription[] | null) || []);
    setPayments((p as Payment[] | null) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function findPayment(orgId: string, year: number, month: number): Payment | null {
    return (
      payments.find((p) => p.organization_id === orgId && p.period_year === year && p.period_month === month) ||
      null
    );
  }

  function openCell(org: Org, year: number, month: number) {
    const existing = findPayment(org.id, year, month);
    const sub = subs.find((s) => s.organization_id === org.id);
    setEditing({ org, year, month, payment: existing, sub });
    setEAmount(existing ? String(existing.amount) : sub ? String(sub.monthly_fee) : "0");
    setEMethod(existing?.payment_method || "");
    setENote(existing?.note || "");
  }

  async function setPaid(paid: boolean) {
    if (!editing) return;
    setEBusy(true);
    try {
      const res = await fetch("/api/visora/upsert-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: editing.org.id,
          periodYear: editing.year,
          periodMonth: editing.month,
          amount: Number(eAmount || 0),
          paid,
          paymentMethod: eMethod || null,
          note: eNote || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "Kayıt başarısız.");
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setEBusy(false);
    }
  }

  async function generateInvoices() {
    setGenBusy(true);
    try {
      const res = await fetch("/api/visora/ensure-invoices", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "İşlem başarısız.");
        return;
      }
      await load();
    } finally {
      setGenBusy(false);
    }
  }

  // İstatistikler
  const totalPaidAll = payments.filter((p) => p.paid).reduce((s, p) => s + Number(p.amount), 0);
  const totalUnpaidAll = payments.filter((p) => !p.paid).reduce((s, p) => s + Number(p.amount), 0);
  const overdueCount = payments.filter((p) => {
    if (p.paid) return false;
    const today = new Date();
    return p.period_year < today.getFullYear() || (p.period_year === today.getFullYear() && p.period_month < today.getMonth() + 1);
  }).length;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex items-start gap-4">
        <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-emerald-500 via-teal-500 to-cyan-500" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Platform · Finans</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Şirket Tahsilatları</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">Aylık abonelik tahakkukları, bakiyeler ve geciken ödemeler.</p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Toplam tahsil edilen", value: fmtTRY(totalPaidAll), gradient: "from-emerald-500 to-teal-500" },
          { label: "Toplam bakiye", value: fmtTRY(totalUnpaidAll), gradient: "from-amber-500 to-orange-500" },
          { label: "Gecikmiş kayıt", value: overdueCount, gradient: "from-rose-500 to-red-500" },
          { label: "Şirket sayısı", value: orgs.length, gradient: "from-indigo-500 to-violet-500" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 p-4">
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-10`} />
            <p className="relative text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="relative text-2xl font-black text-slate-900 mt-1 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Görünüm:</span>
          {[3, 6, 12, 24].map((n) => (
            <button
              key={n}
              onClick={() => setMonthsToShow(n)}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                monthsToShow === n ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Son {n} ay
            </button>
          ))}
        </div>
        <Button onClick={generateInvoices} disabled={genBusy} className="bg-primary-500 hover:bg-primary-600">
          {genBusy ? "Oluşturuluyor…" : "Eksik Ay Tahakkuklarını Oluştur"}
        </Button>
      </div>

      {err && <Card className="p-4 text-red-600 text-sm">{err}</Card>}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                  Şirket
                </th>
                {months.map((m) => (
                  <th key={m.key} className="text-center px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">
                    {monthShort(m.year, m.month)}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={months.length + 2} className="px-4 py-8 text-center text-slate-500">
                    Şirket kaydı yok.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => {
                  const orgPayments = payments.filter((p) => p.organization_id === org.id);
                  const balance = orgPayments.filter((p) => !p.paid).reduce((s, p) => s + Number(p.amount), 0);
                  return (
                    <tr key={org.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-800 sticky left-0 bg-white z-10">
                        <div className="truncate max-w-[200px]" title={org.name}>{org.name}</div>
                        <div className="text-[10px] text-slate-400">{org.status}</div>
                      </td>
                      {months.map((m) => {
                        const p = findPayment(org.id, m.year, m.month);
                        const today = new Date();
                        const isPast =
                          m.year < today.getFullYear() ||
                          (m.year === today.getFullYear() && m.month < today.getMonth() + 1);
                        const isCurrent =
                          m.year === today.getFullYear() && m.month === today.getMonth() + 1;
                        let cls = "bg-slate-100 text-slate-400 hover:bg-slate-200";
                        let label = "—";
                        if (p) {
                          if (p.paid) {
                            cls = "bg-emerald-100 text-emerald-700 hover:bg-emerald-200";
                            label = "✓";
                          } else if (isPast) {
                            cls = "bg-red-100 text-red-700 hover:bg-red-200";
                            label = "✗";
                          } else if (isCurrent) {
                            cls = "bg-amber-100 text-amber-700 hover:bg-amber-200";
                            label = "•";
                          } else {
                            cls = "bg-slate-100 text-slate-500 hover:bg-slate-200";
                            label = "•";
                          }
                        }
                        return (
                          <td key={m.key} className="text-center px-2 py-2">
                            <button
                              onClick={() => openCell(org, m.year, m.month)}
                              className={`w-12 h-9 rounded-lg text-xs font-bold ${cls}`}
                              title={p ? `${fmtTRY(Number(p.amount))} - ${p.paid ? "Ödendi" : "Bekliyor"}` : "Tahakkuk yok"}
                            >
                              {label}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                        <span className={balance > 0 ? "text-amber-600" : "text-emerald-600"}>{fmtTRY(balance)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Açıklama</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
            Ödendi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold">✗</span>
            Gecikmiş / Ödenmedi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold">•</span>
            Bu ay (bekliyor)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-bold">•</span>
            Gelecek ay tahakkuk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-slate-100 text-slate-400 flex items-center justify-center font-bold">—</span>
            Tahakkuk yok
          </span>
        </div>
      </Card>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.org.name} · ${monthShort(editing.year, editing.month)}` : ""}
        size="md"
      >
        {editing && (
          <div className="space-y-4">
            <Input
              label="Tutar (TRY)"
              type="number"
              min={0}
              value={eAmount}
              onChange={(e) => setEAmount(e.target.value)}
            />
            <Input label="Ödeme yöntemi (opsiyonel)" value={eMethod} onChange={(e) => setEMethod(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Not (opsiyonel)</label>
              <textarea
                value={eNote}
                onChange={(e) => setENote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-navy-300 rounded-lg"
              />
            </div>
            {editing.payment && (
              <div className="text-xs text-slate-500">
                Mevcut durum:{" "}
                <span className={editing.payment.paid ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                  {editing.payment.paid ? "Ödendi" : "Ödenmedi"}
                </span>
                {editing.payment.paid_at && (
                  <span> · {new Date(editing.payment.paid_at).toLocaleDateString("tr-TR")}</span>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={() => setPaid(false)}
                disabled={eBusy}
                className="bg-amber-500 hover:bg-amber-600"
              >
                Ödenmedi olarak işaretle
              </Button>
              <Button
                type="button"
                onClick={() => setPaid(true)}
                disabled={eBusy}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {eBusy ? "Kaydediliyor…" : "Ödendi olarak işaretle"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
