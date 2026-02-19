"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { VisaFile, Company } from "@/lib/supabase/types";

type CompanyWithFiles = Company & {
  files: (VisaFile & { profiles: { name: string } | null })[];
  totalTL: number;
  totalEUR: number;
  totalUSD: number;
};

function fmt(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminFirmaCariPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [companiesRes, filesRes] = await Promise.all([
        supabase.from("companies").select("*").order("firma_adi"),
        supabase
          .from("visa_files")
          .select("*, profiles:assigned_user_id(name)")
          .eq("cari_tipi", "firma_cari")
          .eq("arsiv_mi", false),
      ]);

      const companiesData = companiesRes.data || [];
      const firmaCariFiles = filesRes.data || [];

      const companiesWithFiles: CompanyWithFiles[] = companiesData.map(company => {
        const files = firmaCariFiles.filter(f => f.company_id === company.id);
        return {
          ...company,
          files,
          totalTL: files.filter(f => f.ucret_currency === "TL").reduce((s, f) => s + (Number(f.ucret) || 0), 0),
          totalEUR: files.filter(f => f.ucret_currency === "EUR").reduce((s, f) => s + (Number(f.ucret) || 0), 0),
          totalUSD: files.filter(f => f.ucret_currency === "USD").reduce((s, f) => s + (Number(f.ucret) || 0), 0),
        };
      });

      setCompanies(companiesWithFiles);
    } catch (err) {
      console.error("Firma cari verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = search.trim()
    ? companies.filter(c => c.firma_adi.toLowerCase().includes(search.toLowerCase()))
    : companies;

  const selectedData = companies.find(c => c.id === selectedCompany);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-lg bg-navy-100 hover:bg-navy-200 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-navy-900">Firma Cari Hesapları</h1>
          <p className="text-navy-500 text-sm">Şirket bazında vize işlemleri</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sol Panel - Firmalar */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Firma ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2.5 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />

          <div className="bg-white rounded-xl border border-navy-200 divide-y divide-navy-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-navy-50">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Firmalar ({filteredCompanies.length})</p>
            </div>
            {filteredCompanies.length === 0 ? (
              <p className="text-center text-navy-400 text-sm py-8">
                {search.trim() ? "Firma bulunamadı" : "Henüz firma cari işlemi yok"}
              </p>
            ) : (
              filteredCompanies.map((company) => {
                const isActive = selectedCompany === company.id;
                return (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompany(isActive ? null : company.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isActive ? "bg-primary-50" : "hover:bg-navy-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-primary-700" : "text-navy-900"}`}>{company.firma_adi}</p>
                        <p className="text-xs text-navy-400 mt-0.5">{company.files.length} işlem</p>
                      </div>
                      <div className="text-right text-xs text-navy-500 space-y-0.5">
                        {company.totalTL > 0 && <p>₺{fmt(company.totalTL)}</p>}
                        {company.totalEUR > 0 && <p>€{fmt(company.totalEUR)}</p>}
                        {company.totalUSD > 0 && <p>${fmt(company.totalUSD)}</p>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Sağ Panel - Detay */}
        <div className="lg:col-span-2">
          {!selectedData ? (
            <div className="bg-white rounded-xl border border-navy-200 p-10 text-center">
              <svg className="w-12 h-12 text-navy-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
              </svg>
              <p className="text-navy-500 text-sm">Soldaki listeden bir firma seçin</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-100">
                <h2 className="text-lg font-bold text-navy-900">{selectedData.firma_adi}</h2>
                <p className="text-sm text-navy-500">{selectedData.files.length} işlem</p>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4">
                {[
                  { label: "TL", val: selectedData.totalTL, sym: "₺", color: "green" },
                  { label: "EUR", val: selectedData.totalEUR, sym: "€", color: "blue" },
                  { label: "USD", val: selectedData.totalUSD, sym: "$", color: "purple" },
                ].map(c => (
                  <div key={c.label} className={`bg-${c.color}-50 border border-${c.color}-200 rounded-lg p-3 text-center`}>
                    <p className={`text-lg font-bold text-${c.color}-700`}>{c.sym}{fmt(c.val)}</p>
                    <p className={`text-xs text-${c.color}-600`}>{c.label}</p>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4">
                {selectedData.files.length === 0 ? (
                  <p className="text-center text-navy-400 text-sm py-6">Bu firmaya ait işlem bulunamadı</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-100">
                        <th className="text-left py-2.5 px-3 text-navy-500 font-medium">Müşteri</th>
                        <th className="text-left py-2.5 px-3 text-navy-500 font-medium">Ülke</th>
                        <th className="text-right py-2.5 px-3 text-navy-500 font-medium">Ücret</th>
                        <th className="text-center py-2.5 px-3 text-navy-500 font-medium">Fatura</th>
                        <th className="text-right py-2.5 px-3 text-navy-500 font-medium">Personel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedData.files.map((file) => (
                        <tr key={file.id} className="border-b border-navy-50 hover:bg-navy-50/50">
                          <td className="py-2.5 px-3 font-medium text-navy-900">{file.musteri_ad}</td>
                          <td className="py-2.5 px-3 text-navy-600">{file.hedef_ulke}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {Number(file.ucret).toLocaleString("tr-TR")} {file.ucret_currency === "TL" ? "₺" : file.ucret_currency === "EUR" ? "€" : "$"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant={file.fatura_tipi === "isimli" ? "success" : "warning"} size="sm">
                              {file.fatura_tipi === "isimli" ? "İsimli" : "İsimsiz"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right text-navy-500">{file.profiles?.name || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
