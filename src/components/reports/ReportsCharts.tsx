"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Card } from "@/components/ui";
import type { VisaFile, Payment, Profile } from "@/lib/supabase/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ERCAN: "/ercan-avatar.jpg",
  BAHAR: "/bahar-avatar.jpg",
};

function StaffAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const src = USER_AVATARS[name.toUpperCase()];
  if (src) return <div className="rounded-full overflow-hidden ring-1 ring-navy-200 flex-shrink-0" style={{ width: size, height: size }}><Image src={src} alt={name} width={size} height={size} className="w-full h-full object-cover" /></div>;
  return <div className="rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}><span className="text-primary-600 font-bold" style={{ fontSize: size * 0.4 }}>{name.charAt(0)}</span></div>;
}

interface Props {
  files: VisaFile[];
  allFiles: VisaFile[];
  payments: Payment[];
  allPayments: Payment[];
  staff: Profile[];
  period: string;
  periodStart: Date;
}

const COLORS = ["#f97316", "#2563eb", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];
const CURRENCY_COLORS: Record<string, string> = { TL: "#10b981", EUR: "#2563eb", USD: "#f97316" };

function getCurrencySymbol(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}

// Tooltip özelleştirme
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

export default function ReportsCharts({ files, allFiles, payments, allPayments, staff, period, periodStart }: Props) {
  // 1. Aylık Tahsilat Grafiği (son 6 ay)
  const monthlyRevenue = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      months[key] = { TL: 0, EUR: 0, USD: 0 };
    }

    allPayments.forEach((p) => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (months[key]) {
        const curr = p.currency || "TL";
        months[key][curr] = (months[key][curr] || 0) + Number(p.tutar);
      }
    });

    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [allPayments]);

  // 2. Ülke Bazlı Başvuru Dağılımı
  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    files.forEach((f) => {
      map[f.hedef_ulke] = (map[f.hedef_ulke] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [files]);

  // 3. Personel Performans Karşılaştırması
  const staffPerformance = useMemo(() => {
    return staff.map((s) => {
      const sFiles = files.filter((f) => f.assigned_user_id === s.id);
      const sPayments = payments.filter((p) => p.created_by === s.id);
      const approved = sFiles.filter((f) => f.sonuc === "vize_onay").length;
      const rejected = sFiles.filter((f) => f.sonuc === "red").length;
      const revenue = sPayments.reduce((acc, p) => acc + Number(p.tutar), 0);

      return {
        name: s.name,
        dosya: sFiles.length,
        onay: approved,
        red: rejected,
        tahsilat: sPayments.length,
        gelir: revenue,
      };
    });
  }, [staff, files, payments]);

  // 4. Haftalık Trend (son 8 hafta)
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
      const dosya = allFiles.filter((f) => {
        const d = new Date(f.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const tahsilat = allPayments.filter((p) => {
        const d = new Date(p.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;

      weeks.push({ label, dosya, tahsilat });
    }
    return weeks;
  }, [allFiles, allPayments]);

  // 5. Ödeme Yöntemi Dağılımı
  const paymentMethodData = useMemo(() => {
    const nakit = payments.filter((p) => p.yontem === "nakit").length;
    const hesaba = payments.filter((p) => p.yontem === "hesaba").length;
    const pos = payments.filter((p) => p.yontem === "pos").length;
    const pesin = payments.filter((p) => p.payment_type === "pesin_satis").length;
    const cari = payments.filter((p) => p.payment_type === "tahsilat").length;
    const firmaCari = payments.filter((p) => p.payment_type === "firma_cari").length;

    return {
      method: [
        { name: "Nakit", value: nakit },
        { name: "Hesaba", value: hesaba },
        { name: "POS", value: pos },
      ].filter((d) => d.value > 0),
      type: [
        { name: "Peşin Satış", value: pesin },
        { name: "Tahsilat", value: cari },
        { name: "Firma Cari", value: firmaCari },
      ].filter((d) => d.value > 0),
    };
  }, [payments]);

  // 6. Vize Sonuç Dağılımı
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

  // 7. Personel Radar Chart
  const radarData = useMemo(() => {
    if (staffPerformance.length === 0) return [];
    const maxDosya = Math.max(...staffPerformance.map((s) => s.dosya), 1);
    const maxOnay = Math.max(...staffPerformance.map((s) => s.onay), 1);
    const maxTahsilat = Math.max(...staffPerformance.map((s) => s.tahsilat), 1);

    return staffPerformance.map((s) => ({
      name: s.name,
      Dosya: Math.round((s.dosya / maxDosya) * 100),
      Onay: Math.round((s.onay / maxOnay) * 100),
      Tahsilat: Math.round((s.tahsilat / maxTahsilat) * 100),
    }));
  }, [staffPerformance]);

  const renderPieLabel = ({ name, percent }: any) =>
    percent > 0.05 ? `${name} %${(percent * 100).toFixed(0)}` : "";

  return (
    <div className="space-y-6">
      {/* Row 1: Aylık Tahsilat + Haftalık Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aylık Tahsilat */}
        <Card className="overflow-hidden shadow-lg border-0">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">💰</span> Aylık Tahsilat (Son 6 Ay)
            </h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="TL" name="TL (₺)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EUR" name="EUR (€)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="USD" name="USD ($)" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Haftalık Trend */}
        <Card className="overflow-hidden shadow-lg border-0">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">📈</span> Haftalık Trend (8 Hafta)
            </h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="gradDosya" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradTahsilat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="dosya" name="Yeni Dosya" stroke="#2563eb" fill="url(#gradDosya)" strokeWidth={2} />
                <Area type="monotone" dataKey="tahsilat" name="Tahsilat" stroke="#f97316" fill="url(#gradTahsilat)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Ülke Dağılımı + Vize Sonuçları + Ödeme Dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ülke Dağılımı */}
        <Card className="overflow-hidden shadow-lg border-0">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">🌍</span> Ülke Dağılımı
            </h3>
          </div>
          <div className="p-4">
            {countryData.length === 0 ? (
              <p className="text-center text-navy-400 py-12">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={countryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                    stroke="none"
                  >
                    {countryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Vize Sonuçları */}
        <Card className="overflow-hidden shadow-lg border-0">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">✅</span> Vize Sonuçları
            </h3>
          </div>
          <div className="p-4">
            {resultData.length === 0 ? (
              <p className="text-center text-navy-400 py-12">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={resultData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                    stroke="none"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Ödeme Dağılımı */}
        <Card className="overflow-hidden shadow-lg border-0">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">💳</span> Ödeme Dağılımı
            </h3>
          </div>
          <div className="p-4">
            {paymentMethodData.type.length === 0 ? (
              <p className="text-center text-navy-400 py-12">Veri yok</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-navy-500 text-center mb-2 uppercase tracking-wider">Tip</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={paymentMethodData.type} cx="50%" cy="50%" outerRadius={45} innerRadius={25} dataKey="value" stroke="none">
                        {paymentMethodData.type.map((entry, i) => (
                          <Cell key={i} fill={["#2563eb", "#f97316", "#8b5cf6"][i] || COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {paymentMethodData.method.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-navy-500 text-center mb-2 uppercase tracking-wider">Yöntem</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={paymentMethodData.method} cx="50%" cy="50%" outerRadius={45} innerRadius={25} dataKey="value" stroke="none">
                          <Cell fill="#10b981" />
                          <Cell fill="#8b5cf6" />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3: Detaylı Gelir Raporu */}
      <Card className="overflow-hidden shadow-lg border-0">
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-lg">{"💵"}</span> {"Detaylı Gelir Raporu"}
          </h3>
          <p className="text-emerald-200 text-xs mt-1">{"Personel ve döviz bazlı tüm gelir detayları (tahsilat, peşin, firma cari)"}</p>
        </div>
        <div className="p-6 space-y-6">
          {/* Personel Bazlı Gelir Tablosu */}
          <div>
            <h4 className="text-sm font-bold text-navy-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {"Personel Bazlı Gelir"}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-navy-200 bg-navy-50">
                    <th className="text-left py-3 px-4 font-bold text-navy-700">{"Personel"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"TL (₺)"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"EUR (€)"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"USD ($)"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"Peşin"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"Tahsilat"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"Firma Cari"}</th>
                    <th className="text-center py-3 px-3 font-bold text-navy-700">{"Toplam İşlem"}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const sPayments = payments.filter((p) => p.created_by === s.id);
                    const tl = sPayments.filter(p => (p.currency || "TL") === "TL").reduce((a, p) => a + Number(p.tutar), 0);
                    const eur = sPayments.filter(p => p.currency === "EUR").reduce((a, p) => a + Number(p.tutar), 0);
                    const usd = sPayments.filter(p => p.currency === "USD").reduce((a, p) => a + Number(p.tutar), 0);
                    const pesin = sPayments.filter(p => p.payment_type === "pesin_satis").length;
                    const tahsilat = sPayments.filter(p => p.payment_type === "tahsilat").length;
                    const firmaCari = sPayments.filter(p => p.payment_type === "firma_cari").length;
                    return (
                      <tr key={s.id} className="border-b border-navy-100 hover:bg-emerald-50/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <StaffAvatar name={s.name} size={28} />
                            <span className="font-semibold text-navy-900">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {tl > 0 ? (
                            <span className="font-bold text-emerald-700">{tl.toLocaleString("tr-TR")} {"₺"}</span>
                          ) : (
                            <span className="text-navy-300">{"-"}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {eur > 0 ? (
                            <span className="font-bold text-blue-700">{eur.toLocaleString("tr-TR")} {"€"}</span>
                          ) : (
                            <span className="text-navy-300">{"-"}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {usd > 0 ? (
                            <span className="font-bold text-orange-600">{usd.toLocaleString("tr-TR")} {"$"}</span>
                          ) : (
                            <span className="text-navy-300">{"-"}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{pesin}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{tahsilat}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{firmaCari}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-navy-800">{sPayments.length}</td>
                      </tr>
                    );
                  })}
                  {/* Toplam Satırı */}
                  <tr className="border-t-2 border-navy-300 bg-navy-50 font-bold">
                    <td className="py-3 px-4 text-navy-900">{"TOPLAM"}</td>
                    <td className="py-3 px-3 text-center text-emerald-700">
                      {(() => { const v = payments.filter(p => (p.currency || "TL") === "TL").reduce((a, p) => a + Number(p.tutar), 0); return v > 0 ? `${v.toLocaleString("tr-TR")} ₺` : "-"; })()}
                    </td>
                    <td className="py-3 px-3 text-center text-blue-700">
                      {(() => { const v = payments.filter(p => p.currency === "EUR").reduce((a, p) => a + Number(p.tutar), 0); return v > 0 ? `${v.toLocaleString("tr-TR")} €` : "-"; })()}
                    </td>
                    <td className="py-3 px-3 text-center text-orange-600">
                      {(() => { const v = payments.filter(p => p.currency === "USD").reduce((a, p) => a + Number(p.tutar), 0); return v > 0 ? `${v.toLocaleString("tr-TR")} $` : "-"; })()}
                    </td>
                    <td className="py-3 px-3 text-center text-blue-700">{payments.filter(p => p.payment_type === "pesin_satis").length}</td>
                    <td className="py-3 px-3 text-center text-orange-600">{payments.filter(p => p.payment_type === "tahsilat").length}</td>
                    <td className="py-3 px-3 text-center text-purple-700">{payments.filter(p => p.payment_type === "firma_cari").length}</td>
                    <td className="py-3 px-3 text-center text-navy-900">{payments.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Döviz Bazlı Gelir Bar Chart */}
          <div>
            <h4 className="text-sm font-bold text-navy-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {"Personel Gelir Karşılaştırması (Döviz Bazlı)"}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={staff.map((s) => {
                const sp = payments.filter(p => p.created_by === s.id);
                return {
                  name: s.name,
                  TL: sp.filter(p => (p.currency || "TL") === "TL").reduce((a, p) => a + Number(p.tutar), 0),
                  EUR: sp.filter(p => p.currency === "EUR").reduce((a, p) => a + Number(p.tutar), 0),
                  USD: sp.filter(p => p.currency === "USD").reduce((a, p) => a + Number(p.tutar), 0),
                };
              })} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="TL" name={"TL (₺)"} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EUR" name={"EUR (€)"} fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="USD" name={"USD ($)"} fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Row 4: Personel Performans */}
      <Card className="overflow-hidden shadow-lg border-0">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-lg">👥</span> Personel Performans Karşılaştırması
          </h3>
        </div>
        <div className="p-6">
          {staffPerformance.length === 0 ? (
            <p className="text-center text-navy-400 py-12">Personel verisi yok</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart */}
              <div>
                <p className="text-sm font-semibold text-navy-600 mb-4 text-center">Dosya & Tahsilat Sayısı</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={staffPerformance} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="dosya" name="Dosya" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="onay" name="Onay" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="red" name="Red" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tahsilat" name="Tahsilat" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Performans Tablosu */}
              <div>
                <p className="text-sm font-semibold text-navy-600 mb-4 text-center">Detaylı Performans</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-navy-200">
                        <th className="text-left py-3 px-3 font-bold text-navy-700">Personel</th>
                        <th className="text-center py-3 px-2 font-bold text-navy-700">Dosya</th>
                        <th className="text-center py-3 px-2 font-bold text-navy-700">Onay</th>
                        <th className="text-center py-3 px-2 font-bold text-navy-700">Red</th>
                        <th className="text-center py-3 px-2 font-bold text-navy-700">Başarı</th>
                        <th className="text-center py-3 px-2 font-bold text-navy-700">Tahsilat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffPerformance.map((s, i) => {
                        const rate = s.onay + s.red > 0 ? Math.round((s.onay / (s.onay + s.red)) * 100) : 0;
                        return (
                          <tr key={i} className="border-b border-navy-100 hover:bg-navy-50 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <StaffAvatar name={s.name} size={28} />
                                <span className="font-semibold text-navy-900">{s.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-navy-800">{s.dosya}</td>
                            <td className="py-3 px-2 text-center">
                              <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{s.onay}</span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{s.red}</span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                rate >= 70 ? "bg-green-100 text-green-700" :
                                rate >= 40 ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>%{rate}</span>
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-amber-600">{s.tahsilat}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
