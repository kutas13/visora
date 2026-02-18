"use client";

import { useState, useEffect } from "react";
import { Card, Badge, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";
import type { Payment, VisaFile, Profile } from "@/lib/supabase/types";

type PaymentWithDetails = Payment & { 
  visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke"> | null;
  profiles: Pick<Profile, "name"> | null;
};

type UnpaidFileWithProfile = VisaFile & {
  profiles: Pick<Profile, "name"> | null;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
  return symbols[currency] || currency;
}

function formatCurrency(amount: number, currency: string) {
  return `${amount.toLocaleString("tr-TR")} ${getCurrencySymbol(currency)}`;
}

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState<"odenmemis" | "tahsilatlar">("odenmemis");
  const [unpaidFiles, setUnpaidFiles] = useState<UnpaidFileWithProfile[]>([]);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [stats, setStats] = useState<Record<string, { bugun: number; hafta: number; toplam: number }>>({
    TL: { bugun: 0, hafta: 0, toplam: 0 },
    EUR: { bugun: 0, hafta: 0, toplam: 0 },
    USD: { bugun: 0, hafta: 0, toplam: 0 },
  });

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      // Tüm ödenmemiş cari dosyalar
      const { data: unpaid } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .eq("arsiv_mi", false)
        .eq("odeme_plani", "cari")
        .neq("cari_tipi", "firma_cari")
        .eq("odeme_durumu", "odenmedi")
        .order("created_at", { ascending: false });

      setUnpaidFiles(unpaid || []);

      // Tüm ödemeler
      const { data } = await supabase
        .from("payments")
        .select("*, visa_files(musteri_ad, hedef_ulke), profiles:created_by(name)")
        .order("created_at", { ascending: false });

      setPayments(data || []);

      if (data) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

        const newStats: Record<string, { bugun: number; hafta: number; toplam: number }> = {
          TL: { bugun: 0, hafta: 0, toplam: 0 },
          EUR: { bugun: 0, hafta: 0, toplam: 0 },
          USD: { bugun: 0, hafta: 0, toplam: 0 },
        };

        data.forEach(p => {
          if (p.durum === "odendi") {
            const curr = p.currency || "TL";
            const pDate = new Date(p.created_at);
            pDate.setHours(0, 0, 0, 0);

            newStats[curr].toplam += Number(p.tutar);
            if (pDate.getTime() === today.getTime()) newStats[curr].bugun += Number(p.tutar);
            if (pDate >= weekAgo) newStats[curr].hafta += Number(p.tutar);
          }
        });

        setStats(newStats);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredPayments = filterCurrency === "all" 
    ? payments 
    : payments.filter(p => (p.currency || "TL") === filterCurrency);

  const currencyOptions = [{ value: "all", label: "Tümü" }, ...PARA_BIRIMLERI];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-navy-900">Ofis Ödemeleri</h2>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats).map(([curr, s]) => (
          <Card key={curr} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-navy-700">{curr}</h3>
              <span className={`text-2xl font-bold ${curr === "TL" ? "text-green-600" : curr === "EUR" ? "text-blue-600" : "text-amber-600"}`}>
                {getCurrencySymbol(curr)}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-navy-500">Bugün:</span><span className="font-medium">{formatCurrency(s.bugun, curr)}</span></div>
              <div className="flex justify-between"><span className="text-navy-500">Bu Hafta:</span><span className="font-medium">{formatCurrency(s.hafta, curr)}</span></div>
              <div className="flex justify-between border-t border-navy-100 pt-1 mt-1"><span className="text-navy-700 font-medium">Toplam:</span><span className="font-bold">{formatCurrency(s.toplam, curr)}</span></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab Seçimi */}
      <div className="flex gap-2 border-b border-navy-200">
        <button
          onClick={() => setActiveTab("odenmemis")}
          className={`px-6 py-3 font-medium transition-colors relative ${activeTab === "odenmemis" ? "text-primary-600" : "text-navy-500 hover:text-navy-700"}`}
        >
          Ödenmemişler
          {unpaidFiles.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">{unpaidFiles.length}</span>
          )}
          {activeTab === "odenmemis" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
        </button>
        <button
          onClick={() => setActiveTab("tahsilatlar")}
          className={`px-6 py-3 font-medium transition-colors relative ${activeTab === "tahsilatlar" ? "text-primary-600" : "text-navy-500 hover:text-navy-700"}`}
        >
          Tüm Tahsilatlar
          {activeTab === "tahsilatlar" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : activeTab === "odenmemis" ? (
        /* Ödenmemişler */
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">Tüm Ödenmemiş Cari Dosyalar</h3>
          {unpaidFiles.length === 0 ? (
            <div className="text-center py-12 text-navy-500">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <p>Tüm ödemeler tahsil edilmiş!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Müşteri</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Ülke</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Ücret</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Personel</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidFiles.map((file) => (
                    <tr key={file.id} className="border-b border-navy-100 hover:bg-navy-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                        <p className="text-xs text-navy-500">{file.pasaport_no}</p>
                      </td>
                      <td className="py-3 px-4"><Badge variant="info">{file.hedef_ulke}</Badge></td>
                      <td className="py-3 px-4 font-semibold text-navy-900">{formatCurrency(file.ucret || 0, file.ucret_currency || "TL")}</td>
                      <td className="py-3 px-4"><Badge variant="purple">{file.profiles?.name || "-"}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Badge variant="warning">Cari</Badge>
                          <Badge variant="error">Ödenmedi</Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Tüm Tahsilatlar */
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-navy-900">Tüm Ödeme Kayıtları ({filteredPayments.length})</h3>
            <Select options={currencyOptions} value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Müşteri</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Tutar</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Tip</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Yöntem</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Personel</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-navy-500">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="border-b border-navy-100 hover:bg-navy-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-navy-900">{p.visa_files?.musteri_ad || "-"}</p>
                      <p className="text-xs text-navy-500">{p.visa_files?.hedef_ulke}</p>
                    </td>
                    <td className="py-3 px-4 font-semibold text-navy-900">{formatCurrency(Number(p.tutar), p.currency || "TL")}</td>
                    <td className="py-3 px-4">
                      <Badge variant={p.payment_type === "pesin_satis" ? "success" : "info"}>
                        {p.payment_type === "pesin_satis" ? "Peşin Satış" : "Tahsilat"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={p.yontem === "nakit" ? "success" : "info"}>
                        {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4"><Badge variant="purple">{p.profiles?.name || "-"}</Badge></td>
                    <td className="py-3 px-4 text-sm text-navy-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
