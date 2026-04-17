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

function getFileTotal(file: VisaFile) {
  const base = Number(file.ucret) || 0;
  const davetiye = Number(file.davetiye_ucreti) || 0;
  return base + davetiye;
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

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    const profileName = profile?.name?.toUpperCase() || "";

    const { data: allCariFiles } = await supabase
      .from("visa_files")
      .select("*")
      .eq("odeme_plani", "cari")
      .neq("cari_tipi", "firma_cari")
      .order("created_at", { ascending: false });

    const files = (allCariFiles || []).filter((f) =>
      f.cari_sahibi ? f.cari_sahibi.toUpperCase() === profileName : f.assigned_user_id === user.id
    );
    setCariFiles(files);

    const { data: allTahsilat } = await supabase
      .from("payments")
      .select("*, visa_files(musteri_ad, hedef_ulke)")
      .eq("payment_type", "tahsilat")
      .order("created_at", { ascending: false });

    const paymentData = (allTahsilat || []).filter((p) => files.some((f) => f.id === p.file_id));

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
      tutar: getFileTotal(file),
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

    const allPayments = [...paymentData, ...firmaCariAsPayments];
    setPayments(allPayments);

    const calc: Record<string, CurrencyTotals> = {};
    (files || []).forEach((f) => {
      const c = f.ucret_currency || "TL";
      if (!calc[c]) calc[c] = { borc: 0, tahsilat: 0, kalan: 0 };
      calc[c].borc += getFileTotal(f);
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
          <p className="text-slate-500 text-sm">{"Yükleniyor..."}</p>
        </div>
      </div>
    );
  }

  const currencies = Object.keys(totals).sort();
  const unpaidFiles = cariFiles.filter((f) => f.odeme_durumu === "odenmedi");

  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cari Hesabım</h1>
          <p className="text-slate-500 text-sm">Carili dosyalarınızın borç ve tahsilat özeti</p>
        </div>
      </div>

      {/* KPI Kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currencies.length === 0 ? (
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="font-semibold text-slate-600">{"Cari hesabınızda borç bulunmuyor."}</p>
            <p className="text-sm mt-1 text-slate-400">{"Tüm ödemeleriniz güncel"}</p>
          </div>
        ) : (
          currencies.map((c) => {
            const t = totals[c];
            return (
              <div key={c} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-xs font-semibold tracking-wider uppercase">
                      {c} Cari
                    </span>
                    <span className="text-2xl text-white/60">{getCurrencySymbol(c)}</span>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">{"Toplam Borç"}</span>
                    <span className="font-bold text-slate-800">{fmt(t.borc, c)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">{"Toplam Tahsilat"}</span>
                    <span className="font-bold text-green-600">{fmt(t.tahsilat, c)}</span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 text-sm font-semibold">{"Kalan Borç"}</span>
                    <span className={`text-lg font-black ${t.kalan > 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmt(t.kalan, c)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${t.borc > 0 ? Math.min((t.tahsilat / t.borc) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 text-right">
                    {`%${t.borc > 0 ? Math.round((t.tahsilat / t.borc) * 100) : 0} ödendi`}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
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
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? "bg-primary-100 text-primary-700" : "bg-slate-200 text-slate-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "ozet" && (
        <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-semibold text-slate-700 text-base tracking-tight">{"Tüm Carili Dosyalar"}</h3>
          </div>
          {cariFiles.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <p className="font-medium text-slate-600">{"Carili dosya bulunmuyor."}</p>
              <p className="text-sm text-slate-400 mt-1">{"Cari ödeme planlı dosyalar burada listelenir"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Müşteri"}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ülke"}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ücret"}</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Durum"}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Tarih"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cariFiles.map((f) => (
                    <tr key={f.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-800">{f.musteri_ad}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">{f.hedef_ulke}</td>
                      <td className="px-5 py-4 text-right font-bold text-slate-800 tabular-nums">
                        {fmt(getFileTotal(f), f.ucret_currency || "TL")}
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
                      <td className="px-5 py-4 text-right text-slate-500 text-sm">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "dosyalar" && (
        <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 bg-red-50 border-b border-red-100">
            <h3 className="font-semibold text-red-800 text-base tracking-tight">{"Ödenmemiş Dosyalar"}</h3>
          </div>
          {unpaidFiles.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="font-semibold text-emerald-700">{"Tüm dosyalar ödenmiş!"}</p>
              <p className="text-sm text-slate-400 mt-1">{"Harika iş çıkardınız"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Müşteri"}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ülke"}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Borç Tutarı"}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Dosya Tarihi"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unpaidFiles.map((f) => (
                    <tr key={f.id} className="group hover:bg-red-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-800">{f.musteri_ad}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">{f.hedef_ulke}</td>
                      <td className="px-5 py-4 text-right font-bold text-red-600 tabular-nums">
                        {fmt(getFileTotal(f), f.ucret_currency || "TL")}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-500 text-sm">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "tahsilatlar" && (
        <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 bg-green-50 border-b border-green-100">
            <h3 className="font-semibold text-green-800 text-base tracking-tight">{"Tahsilat Geçmişi"}</h3>
          </div>
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </div>
              <p className="font-medium text-slate-600">{"Henüz tahsilat yapılmamış."}</p>
              <p className="text-sm text-slate-400 mt-1">{"Tahsilatlar burada görünecek"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Müşteri"}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ülke"}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Tutar"}</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Yöntem"}</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Tarih"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-green-50/30 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {p.visa_files?.musteri_ad || "-"}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">
                        {p.visa_files?.hedef_ulke || "-"}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-green-600 tabular-nums">
                        {fmt(Number(p.tutar), p.currency || "TL")}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          p.yontem === "nakit"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          <span>{p.yontem === "nakit" ? "💵" : "🏦"}</span>
                          {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-500 text-sm">{formatDate(p.created_at)}</td>
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
