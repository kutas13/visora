"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Payment } from "@/lib/supabase/types";

type PaymentWithFile = Payment & {
  visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke"> | null;
};

function getCurrencySymbol(c: string) {
  const s: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return s[c] || c;
}

function fmt(amount: number, currency: string) {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getCurrencySymbol(currency)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type CurrencyTotals = { borc: number; tahsilat: number; kalan: number };

export default function CariHesapPage() {
  const [cariFiles, setCariFiles] = useState<VisaFile[]>([]);
  const [payments, setPayments] = useState<PaymentWithFile[]>([]);
  const [totals, setTotals] = useState<Record<string, CurrencyTotals>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ozet" | "dosyalar" | "tahsilatlar">("ozet");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: files } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("odeme_plani", "cari")
      .neq("cari_tipi", "firma_cari")
      .order("created_at", { ascending: false });

    setCariFiles(files || []);

    const { data: paymentData } = await supabase
      .from("payments")
      .select("*, visa_files(musteri_ad, hedef_ulke)")
      .eq("created_by", user.id)
      .eq("payment_type", "tahsilat")
      .order("created_at", { ascending: false });

    // Firma cari dosyaları da dahil et (otomatik tahsilat olarak)
    const { data: firmaCariFiles } = await supabase
      .from("visa_files")
      .select("*")
      .eq("assigned_user_id", user.id)
      .eq("cari_tipi", "firma_cari")
      .order("created_at", { ascending: false });

    // Firma cari dosyaları payment formatına dönüştür
    const firmaCariAsPayments = (firmaCariFiles || []).map(file => ({
      id: `firma_${file.id}`,
      file_id: file.id,
      tutar: file.ucret || 0,
      currency: file.ucret_currency || "TL",
      yontem: "firma_cari" as any,
      durum: "odendi" as any,
      payment_type: "firma_cari" as any,
      created_by: user.id,
      created_at: file.created_at,
      visa_files: {
        musteri_ad: file.musteri_ad,
        hedef_ulke: file.hedef_ulke
      }
    }));

    const allPayments = [...(paymentData || []), ...firmaCariAsPayments];
    setPayments(allPayments);

    const calc: Record<string, CurrencyTotals> = {};
    (files || []).forEach((f) => {
      const c = f.ucret_currency || "TL";
      if (!calc[c]) calc[c] = { borc: 0, tahsilat: 0, kalan: 0 };
      calc[c].borc += Number(f.ucret) || 0;
    });

    allPayments.forEach((p) => {
      const c = p.currency || "TL";
      if (!calc[c]) calc[c] = { borc: 0, tahsilat: 0, kalan: 0 };
      calc[c].tahsilat += Number(p.tutar) || 0;
    });

    Object.keys(calc).forEach((c) => {
      calc[c].kalan = calc[c].borc - calc[c].tahsilat;
    });

    setTotals(calc);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-navy-500 text-sm">{"Yükleniyor..."}</p>
        </div>
      </div>
    );
  }

  const currencies = Object.keys(totals).sort();
  const unpaidFiles = cariFiles.filter((f) => f.odeme_durumu === "odenmedi");

  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-800 via-navy-700 to-primary-600 px-6 py-5 shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white tracking-tight">{"Cari Hesabım"}</h1>
          <p className="text-white/80 text-sm mt-1">{"Carili dosyalarınızın borç ve tahsilat özeti"}</p>
        </div>
      </div>

      {/* KPI Kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currencies.length === 0 ? (
          <div className="col-span-3 relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 p-8 text-center backdrop-blur-xl shadow-xl">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-primary-500/10" />
            <div className="absolute inset-[1px] rounded-[15px] border border-white/40" />
            <div className="relative text-navy-400">
              <div className="text-5xl mb-3">✨</div>
              <p className="font-semibold text-navy-600">{"Cari hesabınızda borç bulunmuyor."}</p>
              <p className="text-sm mt-1 text-navy-400">{"Tüm ödemeleriniz güncel"}</p>
            </div>
          </div>
        ) : (
          currencies.map((c) => {
            const t = totals[c];
            return (
              <div key={c} className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 p-0 backdrop-blur-xl shadow-xl">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-navy-500/20 via-primary-500/10 to-emerald-500/20" />
                <div className="absolute inset-[1px] rounded-[15px] border border-white/40" />
                <div className="relative">
                <div className="bg-gradient-to-r from-navy-800 to-navy-700 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-xs font-semibold tracking-wider uppercase">
                      {c} Cari
                    </span>
                    <span className="text-2xl">{getCurrencySymbol(c)}</span>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-navy-500 text-sm">{"Toplam Borç"}</span>
                    <span className="font-bold text-navy-900">{fmt(t.borc, c)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-navy-500 text-sm">{"Toplam Tahsilat"}</span>
                    <span className="font-bold text-green-600">{fmt(t.tahsilat, c)}</span>
                  </div>
                  <div className="h-px bg-navy-100" />
                  <div className="flex justify-between items-center">
                    <span className="text-navy-700 text-sm font-semibold">{"Kalan Borç"}</span>
                    <span className={`text-lg font-black ${t.kalan > 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmt(t.kalan, c)}
                    </span>
                  </div>
                  <div className="w-full bg-navy-100 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${t.borc > 0 ? Math.min((t.tahsilat / t.borc) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-navy-400 text-right">
                    {`%${t.borc > 0 ? Math.round((t.tahsilat / t.borc) * 100) : 0} ödendi`}
                  </p>
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-100 p-1 rounded-xl w-fit">
        {[
          { key: "ozet" as const, label: "Özet", count: cariFiles.length },
          { key: "dosyalar" as const, label: "Ödenmemiş Dosyalar", count: unpaidFiles.length },
          { key: "tahsilatlar" as const, label: "Tahsilat Geçmişi", count: payments.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white text-navy-900 shadow-sm"
                : "text-navy-500 hover:text-navy-700"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? "bg-primary-100 text-primary-700" : "bg-navy-200 text-navy-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "ozet" && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 via-primary-400 to-emerald-500 rounded-l-2xl" />
            <div className="px-5 py-4 bg-navy-50/80 border-b border-navy-200/60">
              <h3 className="font-semibold text-navy-800 text-base tracking-tight">{"Tüm Carili Dosyalar"}</h3>
            </div>
          </div>
          {cariFiles.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📂</div>
              <p className="font-medium text-navy-600">{"Carili dosya bulunmuyor."}</p>
              <p className="text-sm text-navy-400 mt-1">{"Cari ödeme planlı dosyalar burada listelenir"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100">
                    <th className="text-left px-5 py-3 text-navy-500 font-medium">{"Müşteri"}</th>
                    <th className="text-left px-5 py-3 text-navy-500 font-medium">{"Ülke"}</th>
                    <th className="text-right px-5 py-3 text-navy-500 font-medium">{"Ücret"}</th>
                    <th className="text-center px-5 py-3 text-navy-500 font-medium">{"Durum"}</th>
                    <th className="text-right px-5 py-3 text-navy-500 font-medium">{"Tarih"}</th>
                  </tr>
                </thead>
                <tbody>
                  {cariFiles.map((f) => (
                    <tr key={f.id} className="group border-b border-navy-50 hover:bg-navy-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-0.5 h-8 bg-gradient-to-b from-primary-400 to-emerald-400 rounded-full group-hover:from-primary-500 group-hover:to-emerald-500 transition-colors" />
                          <span className="font-semibold text-navy-900">{f.musteri_ad}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-navy-600 font-medium">{f.hedef_ulke}</td>
                      <td className="px-5 py-4 text-right font-bold text-navy-900 tabular-nums">
                        {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {f.odeme_durumu === "odendi" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <span>✓</span> {"Ödendi"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            <span>⏳</span> {"Ödenmedi"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-navy-500 text-sm">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "dosyalar" && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 via-red-400 to-rose-500 rounded-l-2xl" />
            <div className="px-5 py-4 bg-red-50/80 border-b border-red-100/60">
              <h3 className="font-semibold text-red-800 text-base tracking-tight">{"Ödenmemiş Dosyalar"}</h3>
            </div>
          </div>
          {unpaidFiles.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <p className="font-semibold text-emerald-700">{"Tüm dosyalar ödenmiş!"}</p>
              <p className="text-sm text-navy-400 mt-1">{"Harika iş çıkardınız"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100">
                    <th className="text-left px-5 py-3 text-navy-500 font-medium">{"Müşteri"}</th>
                    <th className="text-left px-5 py-3 text-navy-500 font-medium">{"Ülke"}</th>
                    <th className="text-right px-5 py-3 text-navy-500 font-medium">{"Borç Tutarı"}</th>
                    <th className="text-right px-5 py-3 text-navy-500 font-medium">{"Dosya Tarihi"}</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidFiles.map((f) => (
                    <tr key={f.id} className="group border-b border-navy-50 hover:bg-red-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-0.5 h-8 bg-gradient-to-b from-amber-400 to-red-400 rounded-full group-hover:from-amber-500 group-hover:to-red-500 transition-colors" />
                          <span className="font-semibold text-navy-900">{f.musteri_ad}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-navy-600 font-medium">{f.hedef_ulke}</td>
                      <td className="px-5 py-4 text-right font-bold text-red-600 tabular-nums">
                        {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                      </td>
                      <td className="px-5 py-4 text-right text-navy-500 text-sm">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "tahsilatlar" && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 via-green-400 to-teal-500 rounded-l-2xl" />
            <div className="px-5 py-4 bg-green-50/80 border-b border-green-100/60">
              <h3 className="font-semibold text-green-800 text-base tracking-tight">{"Tahsilat Geçmişi"}</h3>
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">💳</div>
              <p className="font-medium text-navy-600">{"Henüz tahsilat yapılmamış."}</p>
              <p className="text-sm text-navy-400 mt-1">{"Tahsilatlar burada görünecek"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100">
                    <th className="text-left px-5 py-3 text-navy-500 font-medium">{"Müşteri"}</th>
                    <th className="text-left px-5 py-3 text-navy-500 font-medium">{"Ülke"}</th>
                    <th className="text-right px-5 py-3 text-navy-500 font-medium">{"Tutar"}</th>
                    <th className="text-center px-5 py-3 text-navy-500 font-medium">{"Yöntem"}</th>
                    <th className="text-right px-5 py-3 text-navy-500 font-medium">{"Tarih"}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-navy-50 hover:bg-green-50/30 transition-colors">
                      <td className="px-5 py-4 font-semibold text-navy-900">
                        {p.visa_files?.musteri_ad || "-"}
                      </td>
                      <td className="px-5 py-4 text-navy-600 font-medium">
                        {p.visa_files?.hedef_ulke || "-"}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-green-600 tabular-nums">
                        {fmt(Number(p.tutar), p.currency || "TL")}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          p.yontem === "nakit"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-navy-100 text-navy-700"
                        }`}>
                          <span>{p.yontem === "nakit" ? "💵" : "🏦"}</span>
                          {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-navy-500 text-sm">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
