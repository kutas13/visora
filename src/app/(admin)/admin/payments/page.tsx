"use client";

import { useState, useEffect } from "react";
import { Select } from "@/components/ui";
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
  ERCAN: "/ercan-avatar.jpg",
  BAHAR: "/bahar-avatar.jpg",
};

function StaffAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const src = USER_AVATARS[name.toUpperCase()];
  if (src) {
    return (
      <div className="rounded-full overflow-hidden ring-1 ring-navy-200 flex-shrink-0" style={{ width: size, height: size }}>
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
      const [unpaidRes, paymentsRes] = await Promise.all([
        supabase.from("visa_files").select("*, profiles:assigned_user_id(name)").eq("arsiv_mi", false).eq("odeme_plani", "cari").neq("cari_tipi", "firma_cari").eq("odeme_durumu", "odenmedi").order("created_at", { ascending: false }),
        supabase.from("payments").select("*, visa_files(musteri_ad, hedef_ulke), profiles:created_by(name)").order("created_at", { ascending: false }),
      ]);

      setUnpaidFiles(unpaidRes.data || []);
      setPayments(paymentsRes.data || []);

      if (paymentsRes.data) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        const ns: Record<string, { bugun: number; hafta: number; toplam: number }> = {
          TL: { bugun: 0, hafta: 0, toplam: 0 },
          EUR: { bugun: 0, hafta: 0, toplam: 0 },
          USD: { bugun: 0, hafta: 0, toplam: 0 },
        };
        paymentsRes.data.forEach(p => {
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
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredPayments = filterCurrency === "all" ? payments : payments.filter(p => (p.currency || "TL") === filterCurrency);
  const currencyOptions = [{ value: "all", label: "Tümü" }, ...PARA_BIRIMLERI];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Ofis Ödemeleri</h1>
        <p className="text-navy-500 text-sm">Tüm ödeme ve tahsilat takibi</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(stats).map(([curr, s]) => {
          const colors: Record<string, string> = { TL: "text-green-600", EUR: "text-blue-600", USD: "text-amber-600" };
          return (
            <div key={curr} className="bg-white rounded-xl border border-navy-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-navy-400 uppercase">{curr}</span>
                <span className={`text-lg font-bold ${colors[curr]}`}>{sym(curr)}</span>
              </div>
              <div className="space-y-1 text-xs text-navy-500">
                <div className="flex justify-between"><span>Bugün</span><span className="font-medium text-navy-700">{fmtCur(s.bugun, curr)}</span></div>
                <div className="flex justify-between"><span>Bu Hafta</span><span className="font-medium text-navy-700">{fmtCur(s.hafta, curr)}</span></div>
                <div className="flex justify-between pt-1 border-t border-navy-100"><span className="font-semibold text-navy-600">Toplam</span><span className="font-bold text-navy-900">{fmtCur(s.toplam, curr)}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 border-b border-navy-200">
        {(["odenmemis", "tahsilatlar"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${activeTab === tab ? "text-primary-600" : "text-navy-500 hover:text-navy-700"}`}>
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
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          {unpaidFiles.length === 0 ? (
            <div className="text-center py-10"><p className="text-navy-400 text-sm">Tüm ödemeler tahsil edilmiş</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 bg-navy-50/50">
                  <th className="text-left py-2.5 px-4 text-navy-500 font-medium">Müşteri</th>
                  <th className="text-left py-2.5 px-4 text-navy-500 font-medium">Ülke</th>
                  <th className="text-right py-2.5 px-4 text-navy-500 font-medium">Ücret</th>
                  <th className="text-left py-2.5 px-4 text-navy-500 font-medium">Personel</th>
                  <th className="text-center py-2.5 px-4 text-navy-500 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {unpaidFiles.map(file => (
                  <tr key={file.id} className="border-b border-navy-50 hover:bg-navy-50/50">
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-navy-900">{file.musteri_ad}</p>
                      <p className="text-[11px] text-navy-400">{file.pasaport_no}</p>
                    </td>
                    <td className="py-2.5 px-4 text-navy-600">{file.hedef_ulke}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-navy-900">{fmtCur(file.ucret || 0, file.ucret_currency || "TL")}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <StaffAvatar name={file.profiles?.name || "?"} />
                        <span className="text-navy-700">{file.profiles?.name || "-"}</span>
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
        <div className="bg-white rounded-xl border border-navy-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-navy-100 flex items-center justify-between bg-navy-50/50">
            <span className="text-sm text-navy-500">{filteredPayments.length} kayıt</span>
            <div className="w-32">
              <Select options={currencyOptions} value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-200">
                <th className="text-left py-2.5 px-4 text-navy-500 font-medium">Müşteri</th>
                <th className="text-right py-2.5 px-4 text-navy-500 font-medium">Tutar</th>
                <th className="text-center py-2.5 px-4 text-navy-500 font-medium">Tip</th>
                <th className="text-center py-2.5 px-4 text-navy-500 font-medium">Yöntem</th>
                <th className="text-left py-2.5 px-4 text-navy-500 font-medium">Personel</th>
                <th className="text-right py-2.5 px-4 text-navy-500 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id} className="border-b border-navy-50 hover:bg-navy-50/50">
                  <td className="py-2.5 px-4">
                    <p className="font-medium text-navy-900">{p.visa_files?.musteri_ad || "-"}</p>
                    <p className="text-[11px] text-navy-400">{p.visa_files?.hedef_ulke}</p>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-navy-900">{fmtCur(Number(p.tutar), p.currency || "TL")}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.payment_type === "pesin_satis" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {p.payment_type === "pesin_satis" ? "Peşin" : "Tahsilat"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.yontem === "nakit" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {p.yontem === "nakit" ? "Nakit" : "Hesaba"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <StaffAvatar name={p.profiles?.name || "?"} />
                      <span className="text-navy-700">{p.profiles?.name || "-"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-navy-500 text-xs">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
