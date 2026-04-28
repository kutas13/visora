"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  trial_ends_at: string | null;
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

const monthLong = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

// Sistemin abone dönemi başlangıcı: Nisan 2026 (04/26)
const PLATFORM_START_YEAR = 2026;
const PLATFORM_START_MONTH = 4;

/**
 * Nisan 2026 (sistem başlangıcı) ile bugün arasındaki + N ay ileri olacak şekilde
 * gösterilecek ay aralığını hesaplar. Geçmiş aylar (örn. 11/25) eklenmez.
 */
function buildMonthRange(forwardMonths: number): { year: number; month: number; key: string }[] {
  const today = new Date();
  const startCandidate = new Date(PLATFORM_START_YEAR, PLATFORM_START_MONTH - 1, 1);
  // Bugünden GERİYE doğru max forwardMonths kadar göster, ancak start'tan eski olmasın
  const earliest =
    today.getFullYear() * 12 + today.getMonth() - (forwardMonths - 1);
  const startIdx = Math.max(
    earliest,
    startCandidate.getFullYear() * 12 + startCandidate.getMonth()
  );
  const endIdx = today.getFullYear() * 12 + today.getMonth() + 2; // bugün + 2 ay ileri
  const result: { year: number; month: number; key: string }[] = [];
  for (let idx = startIdx; idx <= endIdx; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
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

  const months = useMemo(() => buildMonthRange(monthsToShow), [monthsToShow]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [{ data: o, error: oe }, { data: s }, { data: p }] = await Promise.all([
      supabase.from("organizations").select("id, name, status").order("name"),
      supabase.from("platform_subscriptions").select("organization_id, monthly_fee, currency, status, trial_ends_at"),
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

  // İstatistikler — sadece Nisan 2026 ve sonrası dönem için
  const platformStartIdx = PLATFORM_START_YEAR * 12 + (PLATFORM_START_MONTH - 1);
  const inPlatformRange = (p: Payment) =>
    p.period_year * 12 + (p.period_month - 1) >= platformStartIdx;

  const scopedPayments = payments.filter(inPlatformRange);
  const totalPaidAll = scopedPayments.filter((p) => p.paid).reduce((s, p) => s + Number(p.amount), 0);
  const totalUnpaidAll = scopedPayments.filter((p) => !p.paid).reduce((s, p) => s + Number(p.amount), 0);
  const overdueCount = scopedPayments.filter((p) => {
    if (p.paid) return false;
    const today = new Date();
    return p.period_year < today.getFullYear() || (p.period_year === today.getFullYear() && p.period_month < today.getMonth() + 1);
  }).length;
  const paidCount = scopedPayments.filter((p) => p.paid).length;
  const totalAccrualCount = scopedPayments.length;
  const collectionRate = totalAccrualCount > 0 ? Math.round((paidCount / totalAccrualCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-8 text-white shadow-xl shadow-emerald-500/20">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/20 text-[11px] font-bold uppercase tracking-[0.18em] mb-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
              </svg>
              Platform · Finans
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Aylık Tahsilat Takibi</h1>
            <p className="text-emerald-50/90 text-sm mt-2 max-w-xl">
              Şirket aboneliklerinin aylık tahakkukları, ödemeleri ve bakiyeleri.{" "}
              <span className="font-semibold text-white">Platform başlangıç ayı: {monthLong(PLATFORM_START_YEAR, PLATFORM_START_MONTH)}.</span>
              <span className="block text-emerald-50/80 text-xs mt-1">Yeni şirketlere 15 gün ücretsiz deneme süresi tanımlanır; ücretli tahakkuk deneme süresi bittikten sonraki ilk aydan itibaren başlar.</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100/80">Tahsilat Oranı</span>
            <div className="text-4xl font-black tabular-nums">%{collectionRate}</div>
            <div className="w-44 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${collectionRate}%` }} />
            </div>
            <span className="text-[10px] text-emerald-50/80">{paidCount} ödendi · {totalAccrualCount - paidCount} bekliyor</span>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Tahsil edilen",
            value: fmtTRY(totalPaidAll),
            sub: `${paidCount} ödeme`,
            gradient: "from-emerald-500 to-teal-500",
            iconBg: "bg-emerald-100 text-emerald-600",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />,
          },
          {
            label: "Açık bakiye",
            value: fmtTRY(totalUnpaidAll),
            sub: `${totalAccrualCount - paidCount} bekleyen tahakkuk`,
            gradient: "from-amber-500 to-orange-500",
            iconBg: "bg-amber-100 text-amber-600",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
          },
          {
            label: "Gecikmiş",
            value: overdueCount,
            sub: "geç ödeme",
            gradient: "from-rose-500 to-red-500",
            iconBg: "bg-rose-100 text-rose-600",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
          },
          {
            label: "Aktif şirket",
            value: orgs.length,
            sub: "abonelik",
            gradient: "from-indigo-500 to-violet-500",
            iconBg: "bg-indigo-100 text-indigo-600",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h2m0 4h2m4-4h2m-2 4h2" />,
          },
        ].map((s) => (
          <div key={s.label} className="group relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 p-5 hover:ring-slate-300 hover:shadow-lg hover:shadow-slate-200/40 transition-all">
            <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${s.gradient} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`} />
            <div className="relative flex items-start justify-between mb-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
              <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{s.icon}</svg>
              </div>
            </div>
            <p className="relative text-2xl font-black text-slate-900 tracking-tight tabular-nums">{s.value}</p>
            <p className="relative text-[11px] text-slate-400 font-medium mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* CONTROLS */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Aralık:</span>
          {[6, 12, 18, 24].map((n) => (
            <button
              key={n}
              onClick={() => setMonthsToShow(n)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                monthsToShow === n
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Son {n} ay
            </button>
          ))}
        </div>
        <Button
          onClick={generateInvoices}
          disabled={genBusy}
          className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-md shadow-indigo-500/20 text-white font-bold"
        >
          {genBusy ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Oluşturuluyor…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Eksik Ay Tahakkuklarını Oluştur
            </span>
          )}
        </Button>
      </div>

      {err && (
        <Card className="p-4 text-red-600 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {err}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Yükleniyor…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 backdrop-blur border-b-2 border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 sticky left-0 bg-slate-50/80 backdrop-blur z-10 min-w-[220px]">
                    Şirket
                  </th>
                  {months.map((m) => {
                    const today = new Date();
                    const isCurrent = m.year === today.getFullYear() && m.month === today.getMonth() + 1;
                    return (
                      <th
                        key={m.key}
                        className={`text-center px-2 py-3.5 text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap ${
                          isCurrent ? "text-emerald-700 bg-emerald-50/60" : "text-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9.5px] text-slate-400 font-semibold">{m.year.toString().slice(-2)}</span>
                          <span>{monthShort(m.year, m.month).split(" ")[0]}</span>
                          {isCurrent && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                        </div>
                      </th>
                    );
                  })}
                  <th className="text-right px-4 py-3.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={months.length + 2} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
                        </svg>
                        <p className="text-sm">Şirket kaydı yok.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => {
                    const orgPayments = payments.filter((p) => p.organization_id === org.id && inPlatformRange(p));
                    const balance = orgPayments.filter((p) => !p.paid).reduce((s, p) => s + Number(p.amount), 0);
                    const orgPaid = orgPayments.filter((p) => p.paid).length;
                    const orgRate = orgPayments.length > 0 ? Math.round((orgPaid / orgPayments.length) * 100) : 0;
                    return (
                      <tr key={org.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-4 py-3 sticky left-0 bg-white hover:bg-emerald-50/30 z-10">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${
                              balance > 0
                                ? "bg-gradient-to-br from-amber-500 to-orange-500"
                                : "bg-gradient-to-br from-emerald-500 to-teal-500"
                            }`}>
                              {org.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate max-w-[180px]" title={org.name}>{org.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${org.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                                <span className="text-[10px] text-slate-500 font-medium">{org.status}</span>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className="text-[10px] text-slate-500 font-medium tabular-nums">%{orgRate}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {months.map((m) => {
                          const p = findPayment(org.id, m.year, m.month);
                          const today = new Date();
                          const isPast =
                            m.year < today.getFullYear() ||
                            (m.year === today.getFullYear() && m.month < today.getMonth() + 1);
                          const isCurrent =
                            m.year === today.getFullYear() && m.month === today.getMonth() + 1;

                          // Deneme süresi: bu ay, aboneliğin trial_ends_at ayından KESİNLİKLE ÖNCE mi?
                          // (Deneme bitiş ayı zaten ücretli aboneliğin ilk ayı olduğu için tahakkuklu olacak.)
                          const sub = subs.find((s) => s.organization_id === org.id);
                          const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at + "T00:00:00") : null;
                          const isTrialMonth =
                            trialEndsAt !== null &&
                            (m.year < trialEndsAt.getFullYear() ||
                              (m.year === trialEndsAt.getFullYear() && m.month < trialEndsAt.getMonth() + 1));

                          let cls = "bg-slate-50 text-slate-300 hover:bg-slate-100 ring-1 ring-slate-100";
                          let icon: React.ReactNode = <span className="text-base leading-none">−</span>;
                          let title = "Tahakkuk yok";

                          // Deneme ayı + tahakkuk yok → Deneme rozeti göster
                          if (!p && isTrialMonth) {
                            cls = "bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 ring-1 ring-indigo-200 hover:from-indigo-200 hover:to-violet-200";
                            icon = (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                            );
                            title = `Deneme süresi · ${trialEndsAt!.toLocaleDateString("tr-TR")} sonuna kadar ücretsiz`;
                          }

                          if (p) {
                            title = `${fmtTRY(Number(p.amount))} · ${p.paid ? "Ödendi" : isPast ? "Gecikmiş" : isCurrent ? "Bu ay bekliyor" : "Bekliyor"}`;
                            if (p.paid) {
                              cls = "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/25 hover:shadow-md hover:scale-[1.04]";
                              icon = (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              );
                            } else if (isPast) {
                              cls = "bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm shadow-rose-500/25 hover:shadow-md hover:scale-[1.04] ring-2 ring-rose-200";
                              icon = (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              );
                            } else if (isCurrent) {
                              cls = "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30 hover:shadow-md hover:scale-[1.04] ring-2 ring-amber-200 animate-pulse";
                              icon = (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3" />
                                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                                </svg>
                              );
                            } else {
                              cls = "bg-slate-100 text-slate-500 hover:bg-slate-200 ring-1 ring-slate-200";
                              icon = <span className="text-base leading-none">•</span>;
                            }
                          }
                          return (
                            <td key={m.key} className="text-center px-1.5 py-2.5">
                              <button
                                onClick={() => openCell(org, m.year, m.month)}
                                className={`w-11 h-11 rounded-xl text-xs font-black inline-flex items-center justify-center transition-all ${cls}`}
                                title={title}
                              >
                                {icon}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black tabular-nums ${
                            balance > 0
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {fmtTRY(balance)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-gradient-to-br from-slate-50 to-white">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-3">Lejant</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-200">
            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </span>
            <span className="font-semibold text-slate-700">Ödendi</span>
          </span>
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-200">
            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-rose-500 to-red-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </span>
            <span className="font-semibold text-slate-700">Gecikmiş</span>
          </span>
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-200">
            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={3} /></svg>
            </span>
            <span className="font-semibold text-slate-700">Bu ay bekliyor</span>
          </span>
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-200">
            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center font-bold">•</span>
            <span className="font-semibold text-slate-700">Gelecek tahakkuk</span>
          </span>
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-200">
            <span className="w-5 h-5 rounded-md bg-slate-50 text-slate-300 flex items-center justify-center font-bold ring-1 ring-slate-100">−</span>
            <span className="font-semibold text-slate-700">Tahakkuk yok</span>
          </span>
          <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-200">
            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-200">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </span>
            <span className="font-semibold text-slate-700">Deneme süresi (15 gün)</span>
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
