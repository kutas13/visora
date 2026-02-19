"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui";
import type { VisaFile, Payment } from "@/lib/supabase/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  LineChart, Line,
} from "recharts";

interface Props {
  files: VisaFile[];
  allFiles: VisaFile[];
  payments: Payment[];
  allPayments: Payment[];
  staffName: string;
}

const COLORS = ["#f97316", "#2563eb", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b", "#ec4899"];
const RESULT_COLORS = { onay: "#10b981", red: "#ef4444", beklemede: "#f59e0b" };

function getCurrencySymbol(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-navy-700 text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString("tr-TR") : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function StaffReportsCharts({ files, allFiles, payments, allPayments, staffName }: Props) {
  // Aylık trend (son 6 ay, tüm veriler)
  const monthlyData = useMemo(() => {
    const months: Record<string, { dosya: number; tahsilat: number; gelirTL: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      months[key] = { dosya: 0, tahsilat: 0, gelirTL: 0 };
    }
    allFiles.forEach((f) => {
      const d = new Date(f.created_at);
      const key = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (months[key]) months[key].dosya++;
    });
    allPayments.forEach((p) => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (months[key]) {
        months[key].tahsilat++;
        months[key].gelirTL += Number(p.tutar);
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [allFiles, allPayments]);

  // Ülke dağılımı
  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    files.forEach((f) => { map[f.hedef_ulke] = (map[f.hedef_ulke] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [files]);

  // Vize sonuçları
  const resultData = useMemo(() => {
    const onay = files.filter((f) => f.sonuc === "vize_onay").length;
    const red = files.filter((f) => f.sonuc === "red").length;
    const beklemede = files.filter((f) => !f.sonuc && !f.arsiv_mi).length;
    return [
      { name: "Onay", value: onay },
      { name: "Red", value: red },
      { name: "Beklemede", value: beklemede },
    ].filter((d) => d.value > 0);
  }, [files]);

  // Döviz bazlı gelir
  const currencyRevenue = useMemo(() => {
    const map: Record<string, number> = { TL: 0, EUR: 0, USD: 0 };
    payments.forEach((p) => {
      map[p.currency || "TL"] = (map[p.currency || "TL"] || 0) + Number(p.tutar);
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [payments]);

  // Ödeme yöntemi
  const paymentMethods = useMemo(() => {
    const nakit = payments.filter((p) => p.yontem === "nakit").length;
    const hesaba = payments.filter((p) => p.yontem === "hesaba").length;
    return [
      { name: "Nakit", value: nakit },
      { name: "Hesaba", value: hesaba },
    ].filter((d) => d.value > 0);
  }, [payments]);

  // Haftalık trend (son 8 hafta, tüm veriler)
  const weeklyTrend = useMemo(() => {
    const weeks: { label: string; dosya: number; tahsilat: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
      const dosya = allFiles.filter((f) => { const d = new Date(f.created_at); return d >= weekStart && d < weekEnd; }).length;
      const tahsilat = allPayments.filter((p) => { const d = new Date(p.created_at); return d >= weekStart && d < weekEnd; }).length;
      weeks.push({ label, dosya, tahsilat });
    }
    return weeks;
  }, [allFiles, allPayments]);

  // Son tahsilatlar tablosu
  const recentPayments = useMemo(() => {
    return [...payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  }, [payments]);

  const renderPieLabel = ({ name, percent }: any) =>
    percent > 0.05 ? `${name} %${(percent * 100).toFixed(0)}` : "";

  return (
    <div className="space-y-6">
      {/* Row 1: Aylık Trend + Haftalık Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-navy-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Aylık Performans (6 Ay)</h3>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="dosya" name="Dosya" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tahsilat" name="Tahsilat" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-navy-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Haftalık Trend (8 Hafta)</h3>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="staffGradDosya" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="staffGradTahsilat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="dosya" name="Dosya" stroke="#2563eb" fill="url(#staffGradDosya)" strokeWidth={2} />
                <Area type="monotone" dataKey="tahsilat" name="Tahsilat" stroke="#f97316" fill="url(#staffGradTahsilat)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: 3 Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-navy-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Ülke Dağılımı</h3>
          </div>
          <div className="p-4">
            {countryData.length === 0 ? (
              <p className="text-center text-navy-400 py-12 text-sm">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={countryData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" label={renderPieLabel} labelLine={false} stroke="none">
                    {countryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-navy-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Vize Sonuçları</h3>
          </div>
          <div className="p-4">
            {resultData.length === 0 ? (
              <p className="text-center text-navy-400 py-12 text-sm">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={resultData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" label={renderPieLabel} labelLine={false} stroke="none">
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-navy-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Gelir & Ödeme</h3>
          </div>
          <div className="p-4 space-y-4">
            {currencyRevenue.length === 0 ? (
              <p className="text-center text-navy-400 py-6 text-sm">Tahsilat yok</p>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-navy-500 uppercase tracking-wider text-center mb-2">Döviz Dağılımı</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <PieChart>
                      <Pie data={currencyRevenue} cx="50%" cy="50%" outerRadius={40} innerRadius={20} dataKey="value" stroke="none">
                        {currencyRevenue.map((d, i) => (
                          <Cell key={i} fill={d.name === "TL" ? "#10b981" : d.name === "EUR" ? "#2563eb" : "#f97316"} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {paymentMethods.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-navy-500 uppercase tracking-wider text-center mb-2">Yöntem</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <PieChart>
                        <Pie data={paymentMethods} cx="50%" cy="50%" outerRadius={40} innerRadius={20} dataKey="value" stroke="none">
                          <Cell fill="#10b981" />
                          <Cell fill="#8b5cf6" />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3: Gelir Detayı + Son Tahsilatlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aylık gelir trendi */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-emerald-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Aylık Gelir Trendi</h3>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="gelirTL" name="Gelir" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Son Tahsilatlar */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-navy-800 px-5 py-3">
            <h3 className="text-white font-semibold text-sm">Son Tahsilatlar</h3>
          </div>
          <div className="p-4">
            {recentPayments.length === 0 ? (
              <p className="text-center text-navy-400 py-12 text-sm">Henüz tahsilat yok</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-navy-500">Tarih</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-navy-500">Tip</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-navy-500">Tutar</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-navy-500">Yöntem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="border-b border-navy-50 hover:bg-navy-50/50 transition-colors">
                        <td className="py-2 px-3 text-xs text-navy-600">
                          {new Date(p.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.payment_type === "pesin_satis" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                          }`}>
                            {p.payment_type === "pesin_satis" ? "Peşin" : "Tahsilat"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-navy-800 text-xs">
                          {Number(p.tutar).toLocaleString("tr-TR")} {getCurrencySymbol(p.currency || "TL")}
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-navy-500 capitalize">{p.yontem || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
