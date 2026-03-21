"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Company { id: string; firma_adi: string; created_at: string; }
interface CompanyFile {
  id: string; country: string; visa_type: string;
  ucret: number | null; ucret_currency: string | null;
  odeme_durumu: string | null; created_at: string;
  clients?: any;
}

function sym(c: string | null) { return c === "USD" ? "$" : c === "EUR" ? "€" : "₺"; }

export default function CompaniesPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payFile, setPayFile] = useState<CompanyFile | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [kurlar, setKurlar] = useState<{ USD: number; EUR: number } | null>(null);

  useEffect(() => { setAgencyId(localStorage.getItem("agency_id")); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const data = await res.json();
        setKurlar({ USD: Math.round((data.rates?.TRY || 38.5) * 100) / 100, EUR: Math.round(((data.rates?.TRY || 38.5) / (data.rates?.EUR || 0.92)) * 100) / 100 });
      } catch { setKurlar({ USD: 38.50, EUR: 41.80 }); }
    })();
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").eq("agency_id", agencyId).order("firma_adi");
    setCompanies(data || []); setLoading(false);
  }, [agencyId, supabase]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const selectCompany = async (c: Company) => {
    setSelected(c); setFilesLoading(true);
    const { data } = await supabase.from("applications").select("id, country, visa_type, ucret, ucret_currency, odeme_durumu, created_at, clients(full_name)").eq("agency_id", agencyId!).eq("company_id", c.id).order("created_at", { ascending: false });
    setFiles(data || []); setFilesLoading(false);
  };

  const openPay = (f: CompanyFile) => {
    setPayFile(f);
    const cur = f.ucret_currency || "TL";
    let tlAmount = Number(f.ucret || 0);
    if (cur === "USD" && kurlar) tlAmount = Math.round(tlAmount * kurlar.USD);
    if (cur === "EUR" && kurlar) tlAmount = Math.round(tlAmount * kurlar.EUR);
    setPayAmount(String(tlAmount));
    setPayModal(true);
  };

  const submitPay = async () => {
    if (!payFile || !agencyId) return;
    setPaySaving(true);
    await supabase.from("applications").update({ odeme_durumu: "odendi" }).eq("id", payFile.id);
    await supabase.from("payments").insert({ agency_id: agencyId, amount: Number(payAmount), payment_type: "firma_cari_odeme", status: "paid" });
    setPaySaving(false); setPayModal(false); setPayFile(null);
    if (selected) selectCompany(selected);
  };

  const totalBorc = files.filter(f => f.odeme_durumu !== "odendi").reduce((s, f) => s + Number(f.ucret || 0), 0);
  const totalOdenen = files.filter(f => f.odeme_durumu === "odendi").reduce((s, f) => s + Number(f.ucret || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        </div>
        <div><h1 className="text-xl font-bold text-navy-900">Firmalar</h1><p className="text-xs text-navy-400">{companies.length} firma</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
            <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-3"><p className="text-sm font-semibold text-navy-700">Firma Listesi</p></div>
            {loading ? <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-3 border-navy-200 border-t-primary-500" /></div>
            : companies.length === 0 ? <div className="py-12 text-center text-sm text-navy-400">Henüz firma yok.</div>
            : <div className="divide-y divide-navy-50">{companies.map(c => (
              <button key={c.id} onClick={() => selectCompany(c)} className={`w-full px-5 py-4 text-left transition-colors ${selected?.id === c.id ? "bg-primary-50" : "hover:bg-navy-50/50"}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white ${selected?.id === c.id ? "bg-primary-500" : "bg-purple-400"}`}>{c.firma_adi[0].toUpperCase()}</div>
                  <p className={`font-semibold ${selected?.id === c.id ? "text-primary-700" : "text-navy-900"}`}>{c.firma_adi}</p>
                </div>
              </button>
            ))}</div>}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white py-24"><p className="text-sm text-navy-400">Sol taraftan firma seçin.</p></div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">{selected.firma_adi}</h2>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-navy-50 p-3 text-center"><p className="text-[10px] font-semibold uppercase tracking-widest text-navy-400">Dosya</p><p className="text-xl font-bold text-navy-900">{files.length}</p></div>
                  <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Borç</p><p className="text-xl font-bold text-red-600">₺{totalBorc.toLocaleString("tr-TR")}</p></div>
                  <div className="rounded-xl bg-green-50 p-3 text-center"><p className="text-[10px] font-semibold uppercase tracking-widest text-green-400">Ödenen</p><p className="text-xl font-bold text-green-600">₺{totalOdenen.toLocaleString("tr-TR")}</p></div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
                <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-3"><p className="text-sm font-semibold text-navy-700">Dosyalar</p></div>
                {filesLoading ? <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-3 border-navy-200 border-t-primary-500" /></div>
                : files.length === 0 ? <div className="py-12 text-center text-sm text-navy-400">Bu firmaya ait dosya yok.</div>
                : <table className="w-full"><thead><tr className="border-b border-navy-100">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Müşteri</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ülke</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ücret</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Durum</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-navy-400">İşlem</th>
                </tr></thead><tbody className="divide-y divide-navy-50">
                  {files.map(f => (
                    <tr key={f.id} className="hover:bg-primary-50/20">
                      <td className="px-5 py-3.5 font-semibold text-navy-900">{f.clients?.full_name || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-navy-600">{f.country}</td>
                      <td className="px-4 py-3.5 font-bold text-navy-900">{sym(f.ucret_currency)}{Number(f.ucret).toLocaleString("tr-TR")}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${f.odeme_durumu === "odendi" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${f.odeme_durumu === "odendi" ? "bg-green-500" : "bg-red-500"}`} />
                          {f.odeme_durumu === "odendi" ? "Ödendi" : "Borç"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {f.odeme_durumu !== "odendi" && (
                          <button onClick={() => openPay(f)} className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:shadow-lg">Ödeme Yapıldı</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody></table>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && payFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/40" onClick={() => setPayModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <h3 className="font-semibold text-white">Ödeme Yapıldı</h3>
              <p className="text-xs text-white/70">{payFile.clients?.full_name} - {selected?.firma_adi}</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-xl bg-navy-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-navy-600">Dosya Ücreti</span>
                  <span className="text-xl font-bold text-navy-900">{sym(payFile.ucret_currency)}{Number(payFile.ucret).toLocaleString("tr-TR")} {payFile.ucret_currency}</span>
                </div>
                {payFile.ucret_currency !== "TL" && kurlar && (
                  <div className="mt-2 border-t border-navy-200 pt-2 flex items-center justify-between">
                    <span className="text-xs text-navy-400">TL karşılığı (otomatik)</span>
                    <span className="text-sm font-semibold text-green-600">
                      ₺{Math.round(Number(payFile.ucret) * (payFile.ucret_currency === "USD" ? kurlar.USD : kurlar.EUR)).toLocaleString("tr-TR")}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-navy-700">Tahsilat Tutarı (₺)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                <p className="mt-1 text-[10px] text-navy-400">Otomatik hesaplanan TL karşılığı. Manuel düzenleyebilirsiniz.</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-navy-100 pt-4">
                <button onClick={() => setPayModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium">İptal</button>
                <button onClick={submitPay} disabled={paySaving} className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{paySaving ? "Kaydediliyor..." : "Ödemeyi Onayla"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
