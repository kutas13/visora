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
      .eq("arsiv_mi", false)
      .order("created_at", { ascending: false });

    setCariFiles(files || []);

    const { data: paymentData } = await supabase
      .from("payments")
      .select("*, visa_files(musteri_ad, hedef_ulke)")
      .eq("created_by", user.id)
      .eq("payment_type", "tahsilat")
      .order("created_at", { ascending: false });

    setPayments(paymentData || []);

    const calc: Record<string, CurrencyTotals> = {};
    (files || []).forEach((f) => {
      const c = f.ucret_currency || "TL";
      if (!calc[c]) calc[c] = { borc: 0, tahsilat: 0, kalan: 0 };
      calc[c].borc += Number(f.ucret) || 0;
    });

    (paymentData || []).forEach((p) => {
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
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{"Cari Hesabım"}</h1>
        <p className="text-navy-500 text-sm mt-1">{"Carili dosyalarınızın borç ve tahsilat özeti"}</p>
      </div>

      {/* KPI Kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currencies.length === 0 ? (
          <Card className="col-span-3 p-8 text-center">
            <div className="text-navy-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-navy-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">{"Cari hesabınızda borç bulunmuyor."}</p>
            </div>
          </Card>
        ) : (
          currencies.map((c) => {
            const t = totals[c];
            return (
              <Card key={c} className="p-0 overflow-hidden">
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
              </Card>
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
        <Card className="overflow-hidden">
          <div className="px-5 py-3 bg-navy-50 border-b border-navy-200">
            <h3 className="font-semibold text-navy-800">{"Tüm Carili Dosyalar"}</h3>
          </div>
          {cariFiles.length === 0 ? (
            <div className="p-8 text-center text-navy-400">
              {"Carili dosya bulunmuyor."}
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
                    <tr key={f.id} className="border-b border-navy-50 hover:bg-navy-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-navy-900">{f.musteri_ad}</td>
                      <td className="px-5 py-3 text-navy-600">{f.hedef_ulke}</td>
                      <td className="px-5 py-3 text-right font-semibold text-navy-900">
                        {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {f.odeme_durumu === "odendi" ? (
                          <Badge variant="success">{"Ödendi"}</Badge>
                        ) : (
                          <Badge variant="warning">{"Ödenmedi"}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-navy-500">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "dosyalar" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <h3 className="font-semibold text-red-800">{"Ödenmemiş Dosyalar"}</h3>
          </div>
          {unpaidFiles.length === 0 ? (
            <div className="p-8 text-center text-navy-400">
              <svg className="w-10 h-10 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {"Tüm dosyalar ödenmiş!"}
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
                    <tr key={f.id} className="border-b border-navy-50 hover:bg-red-50/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-navy-900">{f.musteri_ad}</td>
                      <td className="px-5 py-3 text-navy-600">{f.hedef_ulke}</td>
                      <td className="px-5 py-3 text-right font-bold text-red-600">
                        {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                      </td>
                      <td className="px-5 py-3 text-right text-navy-500">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "tahsilatlar" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 bg-green-50 border-b border-green-100">
            <h3 className="font-semibold text-green-800">{"Tahsilat Geçmişi"}</h3>
          </div>
          {payments.length === 0 ? (
            <div className="p-8 text-center text-navy-400">
              {"Henüz tahsilat yapılmamış."}
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
                      <td className="px-5 py-3 font-medium text-navy-900">
                        {p.visa_files?.musteri_ad || "-"}
                      </td>
                      <td className="px-5 py-3 text-navy-600">
                        {p.visa_files?.hedef_ulke || "-"}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-green-600">
                        {fmt(Number(p.tutar), p.currency || "TL")}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant={p.yontem === "nakit" ? "info" : "default"}>
                          {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right text-navy-500">{formatDate(p.created_at)}</td>
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
