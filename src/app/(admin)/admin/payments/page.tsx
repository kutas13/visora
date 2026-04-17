"use client";

import { useState, useEffect } from "react";
import { Select, CustomerAvatar, resolveAvatarStatus } from "@/components/ui";
import Image from "next/image";
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

const USER_AVATARS: Record<string, string> = {
  YUSUF: "/yusuf-avatar.png",
  DAVUT: "/davut-avatar.png",
  SIRRI: "/sirri-avatar.png",
  ZAFER: "/zafer-avatar.png",
  ERCAN: "/ercan-avatar.png",
  BAHAR: "/bahar-avatar.jpg",
};

function StaffAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const src = USER_AVATARS[name.toUpperCase()];
  if (src) {
    return (
      <div className="rounded-full overflow-hidden ring-1 ring-slate-200 flex-shrink-0" style={{ width: size, height: size }}>
        <Image src={src} alt={name} width={size} height={size} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <span className="text-primary-600 font-bold" style={{ fontSize: size * 0.4 }}>{name.charAt(0)}</span>
    </div>
  );
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function sym(c: string) { return ({ TL: "₺", EUR: "€", USD: "$" } as Record<string, string>)[c] || c; }
function fmtCur(n: number, c: string) { return `${n.toLocaleString("tr-TR")} ${sym(c)}`; }
function getFileTotal(file: VisaFile) { return (Number(file.ucret) || 0) + (Number(file.davetiye_ucreti) || 0); }

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
    }
    loadData();
  }, []);

  const filteredPayments = filterCurrency === "all" ? payments : payments.filter(p => (p.currency || "TL") === filterCurrency);
  const currencyOptions = [{ value: "all", label: "Tümü" }, ...PARA_BIRIMLERI];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ofis Ödemeleri</h1>
          <p className="text-slate-500 text-sm">Tüm personellerin tahsilatlarını görüntüleyin, döviz bazında filtreleyin ve ödeme geçmişini inceleyin</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(stats).map(([curr, s]) => {
          const colorMap: Record<string, { bg: string; text: string }> = {
            TL: { bg: "bg-green-50", text: "text-green-500" },
            EUR: { bg: "bg-blue-50", text: "text-blue-500" },
            USD: { bg: "bg-amber-50", text: "text-amber-500" },
          };
          const c = colorMap[curr] || colorMap.TL;
          return (
            <div key={curr} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <span className={`text-sm font-bold ${c.text}`}>{sym(curr)}</span>
                </div>
                <span className={`text-[10px] font-medium ${c.text} uppercase tracking-wide`}>{curr}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{fmtCur(s.toplam, curr)}</p>
              <div className="space-y-1 text-xs text-slate-500 mt-2">
                <div className="flex justify-between"><span>Bugün</span><span className="font-medium text-slate-700">{fmtCur(s.bugun, curr)}</span></div>
                <div className="flex justify-between"><span>Bu Hafta</span><span className="font-medium text-slate-700">{fmtCur(s.hafta, curr)}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["odenmemis", "tahsilatlar"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${activeTab === tab ? "text-primary-600" : "text-slate-500 hover:text-slate-700"}`}>
            {tab === "odenmemis" ? "Ödenmemişler" : "Tüm Tahsilatlar"}
            {tab === "odenmemis" && unpaidFiles.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">{unpaidFiles.length}</span>
            )}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : activeTab === "odenmemis" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {unpaidFiles.length === 0 ? (
            <div className="text-center py-10"><p className="text-slate-400 text-sm">Tüm ödemeler tahsil edilmiş</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ülke</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ücret</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Personel</th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                </tr>
              </thead>
              <tbody>
                {unpaidFiles.map(file => (
                  <tr key={file.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar name={file.musteri_ad} size="sm" status={resolveAvatarStatus(file)} />
                        <div>
                          <p className="font-medium text-slate-800">{file.musteri_ad}</p>
                          <p className="text-[11px] text-slate-400">{file.pasaport_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{file.hedef_ulke}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{fmtCur(getFileTotal(file), file.ucret_currency || "TL")}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <StaffAvatar name={file.profiles?.name || "?"} />
                        <span className="text-slate-700">{file.profiles?.name || "-"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Ödenmedi</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-sm text-slate-500">{filteredPayments.length} kayıt</span>
            <div className="w-32">
              <Select options={currencyOptions} value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tutar</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tip</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Yöntem</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Personel</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-4">
                    <p className="font-medium text-slate-800">{p.visa_files?.musteri_ad || "-"}</p>
                    <p className="text-[11px] text-slate-400">{p.visa_files?.hedef_ulke}</p>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{fmtCur(Number(p.tutar), p.currency || "TL")}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.payment_type === "pesin_satis" ? "bg-green-100 text-green-700" : p.payment_type === "firma_cari" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {p.payment_type === "pesin_satis" ? "Peşin" : p.payment_type === "firma_cari" ? "Firma Cari" : "Tahsilat"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {p.payment_type === "firma_cari" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-600">Fatura</span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.yontem === "nakit" ? "bg-green-100 text-green-700" : p.yontem === "pos" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                        {p.yontem === "nakit" ? "Nakit" : p.yontem === "pos" ? "POS" : "Hesaba"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <StaffAvatar name={p.profiles?.name || "?"} />
                        <span className="text-slate-700">{p.profiles?.name || "-"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-500 text-xs">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
