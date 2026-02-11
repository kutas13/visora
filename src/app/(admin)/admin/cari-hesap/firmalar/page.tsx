"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge } from "@/components/ui";
import { createClient } from "@supabase/supabase-js";
import type { VisaFile, Company } from "@/lib/supabase/types";

type CompanyWithFiles = Company & {
  files: (VisaFile & { profiles: { name: string } | null })[];
  totalTL: number;
  totalEUR: number;
  totalUSD: number;
};

export default function AdminFirmaCariPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        throw new Error("Supabase yapılandırması eksik");
      }

      const supabase = createClient(supabaseUrl, serviceKey);

      // Firmaları ve firma cari dosyaları al
      const { data: companiesData } = await supabase.from("companies").select("*").order("firma_adi");
      const { data: firmaCariFiles } = await supabase
        .from("visa_files")
        .select("*, profiles:assigned_user_id(name)")
        .eq("cari_tipi", "firma_cari")
        .eq("arsiv_mi", false);

      const companiesWithFiles: CompanyWithFiles[] = (companiesData || []).map(company => {
        const files = (firmaCariFiles || []).filter(f => f.company_id === company.id);
        
        const tlTotal = files.filter(f => f.ucret_currency === "TL").reduce((sum, f) => sum + f.ucret, 0);
        const eurTotal = files.filter(f => f.ucret_currency === "EUR").reduce((sum, f) => sum + f.ucret, 0); 
        const usdTotal = files.filter(f => f.ucret_currency === "USD").reduce((sum, f) => sum + f.ucret, 0);

        return {
          ...company,
          files,
          totalTL: tlTotal,
          totalEUR: eurTotal,
          totalUSD: usdTotal,
        };
      });

      setCompanies(companiesWithFiles);
    } catch (err) {
      console.error("Firma cari verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-navy-500 text-sm">Veriler alınıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Firma Cari Hesapları</h1>
            <p className="text-navy-500">Şirket bazında vize işlemleri</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Panel - Firmalar */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-navy-900 mb-4">Firmalar ({companies.length})</h3>
            <div className="space-y-2">
              {companies.length === 0 ? (
                <p className="text-center text-navy-500 py-8">Henüz firma cari işlemi yok</p>
              ) : (
                companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompany(selectedCompany === company.id ? null : company.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedCompany === company.id
                        ? "border-primary-500 bg-primary-50"
                        : "border-navy-200 hover:border-navy-300 hover:bg-navy-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy-900 truncate">{company.firma_adi}</p>
                        <p className="text-xs text-navy-500 mt-1">{company.files.length} işlem</p>
                      </div>
                      <div className="text-right text-xs">
                        {company.totalTL > 0 && <p className="text-navy-600">₺{company.totalTL.toLocaleString("tr-TR")}</p>}
                        {company.totalEUR > 0 && <p className="text-navy-600">€{company.totalEUR.toLocaleString("tr-TR")}</p>}
                        {company.totalUSD > 0 && <p className="text-navy-600">${company.totalUSD.toLocaleString("tr-TR")}</p>}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Sağ Panel - Detaylar */}
        <div className="lg:col-span-2">
          {!selectedCompanyData ? (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-navy-900 mb-2">Firma Seçin</h3>
              <p className="text-navy-500">Soldaki listeden bir firma seçerek detayları görüntüleyin</p>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-2xl">🏢</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-navy-900">{selectedCompanyData.firma_adi}</h2>
                  <p className="text-navy-500">{selectedCompanyData.files.length} toplam işlem</p>
                </div>
              </div>

              {/* Toplam Tutarlar */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-green-700">₺{selectedCompanyData.totalTL.toLocaleString("tr-TR")}</p>
                  <p className="text-sm text-green-600">TL İşlemler</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-blue-700">€{selectedCompanyData.totalEUR.toLocaleString("tr-TR")}</p>
                  <p className="text-sm text-blue-600">EUR İşlemler</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-purple-700">${selectedCompanyData.totalUSD.toLocaleString("tr-TR")}</p>
                  <p className="text-sm text-purple-600">USD İşlemler</p>
                </div>
              </div>

              {/* İşlem Listesi */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-navy-900">Firma İşlemleri</h3>
                {selectedCompanyData.files.length === 0 ? (
                  <p className="text-center text-navy-500 py-8">Bu firmaya ait işlem bulunamadı</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCompanyData.files.map((file) => (
                      <div key={file.id} className="bg-navy-50 border border-navy-200 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-navy-900">{file.musteri_ad}</p>
                            <p className="text-sm text-navy-500">{file.hedef_ulke}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={file.fatura_tipi === "isimli" ? "success" : "warning"} size="sm">
                                {file.fatura_tipi === "isimli" ? "İsimli Fatura" : "İsimsiz Fatura"}
                              </Badge>
                              <Badge variant="info" size="sm">
                                {file.profiles?.name || "?"}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-navy-900">{file.ucret} {file.ucret_currency}</p>
                            <p className="text-xs text-navy-500">{new Date(file.created_at).toLocaleDateString("tr-TR")}</p>
                            <Badge variant={file.odeme_durumu === "odendi" ? "success" : "error"} size="sm" className="mt-1">
                              {file.odeme_durumu === "odendi" ? "Ödendi" : "Bekliyor"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}