"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Select, CustomerAvatar, resolveAvatarStatus } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";
import type { Payment, VisaFile, Profile } from "@/lib/supabase/types";

const TahsilatModal = dynamic(() => import("@/components/payments/TahsilatModal"), { ssr: false });

type PaymentWithDetails = Payment & {
  visa_files: Pick<VisaFile, "musteri_ad" | "hedef_ulke"> | null;
  profiles: Pick<Profile, "name"> | null;
};

type UnpaidFileWithProfile = VisaFile & {
  profiles: Pick<Profile, "name"> | null;
};

function StaffPill({ name }: { name: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 ring-1 ring-slate-200">
      <span className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-[10px] font-extrabold text-white">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="text-[11.5px] font-semibold text-slate-700">{name}</span>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function sym(c: string) {
  return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c;
}
function fmtCur(n: number, c: string) {
  return `${n.toLocaleString("tr-TR")} ${sym(c)}`;
}
function getFileTotal(file: VisaFile) {
  return (Number(file.ucret) || 0) + (Number(file.davetiye_ucreti) || 0);
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
  const [tahsilatFile, setTahsilatFile] = useState<VisaFile | null>(null);
  const [showTahsilatModal, setShowTahsilatModal] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [unpaidRes, paymentsRes, firmaCariRes] = await Promise.all([
      supabase.from("visa_files").select("*, profiles:assigned_user_id(name)").eq("odeme_plani", "cari").neq("cari_tipi", "firma_cari").eq("odeme_durumu", "odenmedi").order("created_at", { ascending: false }),
      supabase.from("payments").select("*, visa_files(musteri_ad, hedef_ulke), profiles:created_by(name)").order("created_at", { ascending: false }),
      supabase.from("visa_files").select("*, profiles:assigned_user_id(name)").eq("cari_tipi", "firma_cari").order("created_at", { ascending: false }),
    ]);

    setUnpaidFiles(unpaidRes.data || []);

    const firmaCariAsPayments: PaymentWithDetails[] = (firmaCariRes.data || []).map((file: any) => ({
      id: `firma_${file.id}`,
      file_id: file.id,
      tutar: getFileTotal(file),
      currency: file.ucret_currency || "TL",
      yontem: "firma_cari" as any,
      durum: "odendi" as any,
      payment_type: "firma_cari" as any,
      created_by: file.assigned_user_id,
      created_at: file.created_at,
      visa_files: { musteri_ad: file.musteri_ad, hedef_ulke: file.hedef_ulke },
      profiles: file.profiles,
    }));

    const allPayments = [...(paymentsRes.data || []), ...firmaCariAsPayments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPayments(allPayments);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const ns: Record<string, { bugun: number; hafta: number; toplam: number }> = {
      TL: { bugun: 0, hafta: 0, toplam: 0 },
      EUR: { bugun: 0, hafta: 0, toplam: 0 },
      USD: { bugun: 0, hafta: 0, toplam: 0 },
    };
    allPayments.forEach(p => {
      if (p.durum === "odendi") {
        const curr = p.currency || "TL";
        const pDate = new Date(p.created_at); pDate.setHours(0, 0, 0, 0);
        if (ns[curr]) {
          ns[curr].toplam += Number(p.tutar);
          if (pDate.getTime() === today.getTime()) ns[curr].bugun += Number(p.tutar);
          if (pDate >= weekAgo) ns[curr].hafta += Number(p.tutar);
        }
      }
    });
    setStats(ns);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPayments = filterCurrency === "all" ? payments : payments.filter(p => (p.currency || "TL") === filterCurrency);
  const currencyOptions = [{ value: "all", label: "Tümü" }, ...PARA_BIRIMLERI];

  const currencyMeta: Record<string, { label: string; gradient: string; chip: string }> = {
    TL: { label: "Türk Lirası", gradient: "from-emerald-500 to-teal-500", chip: "bg-emerald-50 text-emerald-700" },
    EUR: { label: "Euro", gradient: "from-indigo-500 to-violet-500", chip: "bg-indigo-50 text-indigo-700" },
    USD: { label: "US Dollar", gradient: "from-amber-500 to-orange-500", chip: "bg-amber-50 text-amber-700" },
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-emerald-500 via-teal-500 to-cyan-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Finans</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
              Ofis Ödemeleri
            </h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Tüm personellerin tahsilatları, döviz bazında özet ve geçmiş.
            </p>
          </div>
        </div>
      </div>

      {/* DÖVİZ KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(stats).map(([curr, s]) => {
          const meta = currencyMeta[curr] || currencyMeta.TL;
          return (
            <div key={curr} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 p-5">
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${meta.gradient} opacity-10`} />
              <div className="relative flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-lg`}>
                  <span className="text-white font-extrabold text-lg">{sym(curr)}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${meta.chip}`}>{curr}</span>
              </div>
              <p className="relative text-3xl font-black text-slate-900 tracking-tight">{fmtCur(s.toplam, curr)}</p>
              <p className="relative text-[11px] text-slate-500 mt-1">Toplam · {meta.label}</p>
              <div className="relative mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bugün</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{fmtCur(s.bugun, curr)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bu Hafta</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{fmtCur(s.hafta, curr)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TAB SWITCH */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("odenmemis")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "odenmemis"
                ? "bg-white text-rose-700 shadow-sm ring-1 ring-rose-100"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Ödenmemişler
            {unpaidFiles.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "odenmemis" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
                {unpaidFiles.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tahsilatlar")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "tahsilatlar"
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tüm Tahsilatlar
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "tahsilatlar" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              {payments.length}
            </span>
          </button>
        </div>
        {activeTab === "tahsilatlar" && (
          <div className="sm:ml-auto sm:w-40">
            <Select options={currencyOptions} value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} />
          </div>
        )}
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex justify-center py-16 rounded-2xl bg-white ring-1 ring-slate-200/70">
          <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : activeTab === "odenmemis" ? (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
          {unpaidFiles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">Tüm ödemeler tahsil edilmiş</p>
              <p className="text-xs text-slate-400 mt-1">Bekleyen tahsilat yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-50/0">
                    <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Müşteri</th>
                    <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Ülke</th>
                    <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Ücret</th>
                    <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Personel</th>
                    <th className="text-center py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unpaidFiles.map(file => (
                    <tr key={file.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar name={file.musteri_ad} size="sm" status={resolveAvatarStatus(file)} />
                          <div>
                            <p className="font-bold text-slate-900">{file.musteri_ad}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{file.pasaport_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{file.hedef_ulke}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-base font-extrabold text-slate-900">
                          {fmtCur(getFileTotal(file), file.ucret_currency || "TL")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StaffPill name={file.profiles?.name || "?"} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => { setTahsilatFile(file); setShowTahsilatModal(true); }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11.5px] font-bold rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25 hover:shadow-lg transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
                          </svg>
                          Tahsilat Al
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-50/0">
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Müşteri</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tutar</th>
                  <th className="text-center py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tip</th>
                  <th className="text-center py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Yöntem</th>
                  <th className="text-left py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Personel</th>
                  <th className="text-right py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{p.visa_files?.musteri_ad || "-"}</p>
                      <p className="text-[11px] text-slate-400">{p.visa_files?.hedef_ulke}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">{fmtCur(Number(p.tutar), p.currency || "TL")}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${p.payment_type === "pesin_satis" ? "bg-emerald-50 text-emerald-700" : p.payment_type === "firma_cari" ? "bg-fuchsia-50 text-fuchsia-700" : "bg-indigo-50 text-indigo-700"}`}>
                        {p.payment_type === "pesin_satis" ? "Peşin" : p.payment_type === "firma_cari" ? "Firma Cari" : "Tahsilat"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.payment_type === "firma_cari" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-fuchsia-50 text-fuchsia-600 uppercase tracking-wider">Fatura</span>
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${p.yontem === "nakit" ? "bg-emerald-50 text-emerald-700" : p.yontem === "pos" ? "bg-violet-50 text-violet-700" : "bg-indigo-50 text-indigo-700"}`}>
                          {p.yontem === "nakit" ? "Nakit" : p.yontem === "pos" ? "POS" : "Hesaba"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StaffPill name={p.profiles?.name || "?"} />
                    </td>
                    <td className="py-3 px-4 text-right text-[11.5px] font-semibold text-slate-500">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TahsilatModal
        isOpen={showTahsilatModal}
        onClose={() => { setShowTahsilatModal(false); setTahsilatFile(null); }}
        file={tahsilatFile}
        onSuccess={() => { void loadData(); }}
      />
    </div>
  );
}
