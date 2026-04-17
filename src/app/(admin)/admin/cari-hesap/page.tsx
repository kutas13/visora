"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile, VisaFile, Payment } from "@/lib/supabase/types";

type PaymentWithFile = Payment & {
  visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke" | "assigned_user_id"> | null;
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

type StaffCari = {
  profile: Profile;
  totals: Record<string, CurrencyTotals>;
  files: VisaFile[];
  payments: PaymentWithFile[];
};

export default function AdminCariHesapPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffCari[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"dosyalar" | "tahsilatlar">("dosyalar");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Paralel sorgular (hız optimizasyonu)
    const [profilesRes, filesRes, paymentsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("visa_files").select("*").eq("odeme_plani", "cari").neq("cari_tipi", "firma_cari").order("created_at", { ascending: false }),
      supabase.from("payments").select("*, visa_files(musteri_ad, hedef_ulke, assigned_user_id, cari_sahibi)").eq("payment_type", "tahsilat").order("created_at", { ascending: false }),
    ]);

    const profiles = profilesRes.data;
    const allFiles = filesRes.data;
    const allPayments = paymentsRes.data;

    const getCariKey = (f: { cari_sahibi?: string | null; assigned_user_id: string }) => {
      if (f.cari_sahibi) return f.cari_sahibi.toUpperCase();
      const prof = (profiles || []).find((p: Profile) => p.id === f.assigned_user_id);
      return prof?.name?.toUpperCase() || f.assigned_user_id;
    };

    const result: StaffCari[] = [];

    (profiles || []).forEach((profile: Profile) => {
      const profileKey = profile.name?.toUpperCase() || profile.id;
      const files = (allFiles || []).filter((f) => getCariKey(f) === profileKey);
      const payments = (allPayments || []).filter((p) => files.some((f) => f.id === p.file_id));

      const totals: Record<string, CurrencyTotals> = {};

      files.forEach((f) => {
        const c = f.ucret_currency || "TL";
        if (!totals[c]) totals[c] = { borc: 0, tahsilat: 0, kalan: 0 };
        totals[c].borc += Number(f.ucret) || 0;
      });

      payments.forEach((p) => {
        const c = p.currency || "TL";
        if (!totals[c]) totals[c] = { borc: 0, tahsilat: 0, kalan: 0 };
        totals[c].tahsilat += Number(p.tutar) || 0;
      });

      Object.keys(totals).forEach((c) => {
        totals[c].kalan = totals[c].borc - totals[c].tahsilat;
      });

      if (files.length > 0 || payments.length > 0) {
        result.push({ profile, totals, files, payments });
      }
    });

    setStaffList(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const generalTotals: Record<string, CurrencyTotals> = {};
  staffList.forEach((s) => {
    Object.entries(s.totals).forEach(([c, t]) => {
      if (!generalTotals[c]) generalTotals[c] = { borc: 0, tahsilat: 0, kalan: 0 };
      generalTotals[c].borc += t.borc;
      generalTotals[c].tahsilat += t.tahsilat;
      generalTotals[c].kalan += t.kalan;
    });
  });

  const selectedData = staffList.find((s) => s.profile.id === selectedStaff);

  const exportToExcel = () => {
    // CSV formatında export (Excel açabilir)
    let csvContent = "Personel,Borç (TL),Tahsilat (TL),Kalan (TL),Borç (EUR),Tahsilat (EUR),Kalan (EUR),Borç (USD),Tahsilat (USD),Kalan (USD)\n";
    
    staffList.forEach(staff => {
      const tlData = staff.totals["TL"] || { borc: 0, tahsilat: 0, kalan: 0 };
      const eurData = staff.totals["EUR"] || { borc: 0, tahsilat: 0, kalan: 0 };
      const usdData = staff.totals["USD"] || { borc: 0, tahsilat: 0, kalan: 0 };
      
      csvContent += `${staff.profile.name},${tlData.borc},${tlData.tahsilat},${tlData.kalan},${eurData.borc},${eurData.tahsilat},${eurData.kalan},${usdData.borc},${usdData.tahsilat},${usdData.kalan}\n`;
    });

    // CSV dosyası oluştur ve indir
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cari_hesap_raporu_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{"Cari Hesap Yönetimi"}</h1>
            <p className="text-slate-500 text-sm">{"Tüm personellerin borç ve alacak durumunu görüntüleyin, cari bakiyeleri takip edin ve firma hesaplarını yönetin"}</p>
          </div>
        </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/cari-hesap/firmalar")}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
              </svg>
              Firma Cari Hesapları
            </button>
            <button
              onClick={() => exportToExcel()}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel&apos;e Aktar
            </button>
          </div>
      </div>

      {/* Genel Toplam KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.keys(generalTotals).sort().map((c) => {
          const t = generalTotals[c];
          return (
            <Card key={c} className="p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-xs font-semibold tracking-wider uppercase">
                    {`Genel ${c} Toplam`}
                  </span>
                  <span className="text-2xl">{getCurrencySymbol(c)}</span>
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
                  <span className="text-slate-700 text-sm font-semibold">{"Kalan Borç"}</span>
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
              </div>
            </Card>
          );
        })}
        {Object.keys(generalTotals).length === 0 && (
          <Card className="col-span-3 p-8 text-center">
            <p className="text-slate-400">{"Hiçbir personelin carisi bulunmuyor."}</p>
          </Card>
        )}
      </div>

      {/* Personel Listesi */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{"Personel Cari Özeti"}</h3>
        </div>
        {staffList.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {"Carisi olan personel bulunamadı."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staffList.map((staff) => {
              const isOpen = selectedStaff === staff.profile.id;
              const currencies = Object.keys(staff.totals).sort();
              const hasDebt = currencies.some((c) => staff.totals[c].kalan > 0);
              const unpaidCount = staff.files.filter((f) => f.odeme_durumu === "odenmedi").length;

              return (
                <div key={staff.profile.id}>
                  <button
                    onClick={() => {
                      setSelectedStaff(isOpen ? null : staff.profile.id);
                      setDetailTab("dosyalar");
                    }}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${
                        hasDebt ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-green-500 to-emerald-600"
                      }`}>
                        {staff.profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-800">{staff.profile.name}</p>
                        <p className="text-xs text-slate-500">
                          {`${staff.files.length} dosya • ${staff.payments.length} tahsilat`}
                          {unpaidCount > 0 && (
                            <span className="text-red-500 ml-1">{`• ${unpaidCount} ödenmemiş`}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {currencies.map((c) => (
                        <div key={c} className="text-right">
                          <p className={`font-bold text-sm ${staff.totals[c].kalan > 0 ? "text-red-600" : "text-green-600"}`}>
                            {fmt(staff.totals[c].kalan, c)}
                          </p>
                          <p className="text-[10px] text-slate-400">kalan</p>
                        </div>
                      ))}
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && selectedData && (
                    <div className="bg-slate-50/30 border-t border-slate-100 px-5 py-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {currencies.map((c) => {
                          const t = staff.totals[c];
                          return (
                            <div key={c} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase">{c}</span>
                                <span className="text-lg">{getCurrencySymbol(c)}</span>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">{"Borç:"}</span>
                                  <span className="font-semibold">{fmt(t.borc, c)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">{"Tahsilat:"}</span>
                                  <span className="font-semibold text-green-600">{fmt(t.tahsilat, c)}</span>
                                </div>
                                <div className="h-px bg-slate-100 my-1" />
                                <div className="flex justify-between">
                                  <span className="font-semibold text-slate-700">{"Kalan:"}</span>
                                  <span className={`font-bold ${t.kalan > 0 ? "text-red-600" : "text-green-600"}`}>
                                    {fmt(t.kalan, c)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                        <button
                          onClick={() => setDetailTab("dosyalar")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            detailTab === "dosyalar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                          }`}
                        >
                          {`Dosyalar (${selectedData.files.length})`}
                        </button>
                        <button
                          onClick={() => setDetailTab("tahsilatlar")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            detailTab === "tahsilatlar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                          }`}
                        >
                          {`Tahsilatlar (${selectedData.payments.length})`}
                        </button>
                      </div>

                      {detailTab === "dosyalar" && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          {selectedData.files.length === 0 ? (
                            <p className="p-4 text-center text-slate-400 text-sm">{"Dosya yok."}</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Müşteri"}</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ülke"}</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ücret"}</th>
                                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Durum"}</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Tarih"}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedData.files.map((f) => (
                                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-slate-800">{f.musteri_ad}</td>
                                    <td className="px-4 py-2.5 text-slate-600">{f.hedef_ulke}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold">
                                      {fmt(Number(f.ucret) || 0, f.ucret_currency || "TL")}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      {f.odeme_durumu === "odendi" ? (
                                        <Badge variant="success">{"Ödendi"}</Badge>
                                      ) : (
                                        <Badge variant="warning">{"Ödenmedi"}</Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-500">{formatDate(f.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {detailTab === "tahsilatlar" && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          {selectedData.payments.length === 0 ? (
                            <p className="p-4 text-center text-slate-400 text-sm">{"Tahsilat yok."}</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Müşteri"}</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Ülke"}</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Tutar"}</th>
                                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Yöntem"}</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Tarih"}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedData.payments.map((p) => (
                                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-slate-800">
                                      {p.visa_files?.musteri_ad || "-"}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600">
                                      {p.visa_files?.hedef_ulke || "-"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-green-600">
                                      {fmt(Number(p.tutar), p.currency || "TL")}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <Badge variant={p.yontem === "nakit" ? "info" : "default"}>
                                        {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-500">{formatDate(p.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
