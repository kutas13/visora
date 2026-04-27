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

  const exportToPDF = () => {
    const today = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const fmtCell = (n: number, c: string) =>
      `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getCurrencySymbol(c)}`;

    const generalRows = Object.keys(generalTotals)
      .sort()
      .map((c) => {
        const t = generalTotals[c];
        const oran = t.borc > 0 ? Math.min(Math.round((t.tahsilat / t.borc) * 100), 100) : 0;
        return `
          <div class="kpi">
            <div class="kpi-head">
              <span class="kpi-label">Genel ${c} Toplam</span>
              <span class="kpi-symbol">${getCurrencySymbol(c)}</span>
            </div>
            <div class="kpi-row"><span>Borç</span><strong>${fmtCell(t.borc, c)}</strong></div>
            <div class="kpi-row"><span>Tahsilat</span><strong class="green">${fmtCell(t.tahsilat, c)}</strong></div>
            <div class="kpi-divider"></div>
            <div class="kpi-row"><span class="bold">Kalan</span><strong class="${t.kalan > 0 ? "red" : "green"} big">${fmtCell(t.kalan, c)}</strong></div>
            <div class="kpi-bar"><span style="width:${oran}%"></span></div>
            <div class="kpi-foot">Tahsilat oranı: %${oran}</div>
          </div>
        `;
      })
      .join("");

    const staffRows = staffList
      .map((s) => {
        const currs = Object.keys(s.totals).sort();
        const cells = currs
          .map((c) => {
            const t = s.totals[c];
            return `
              <td class="cell">
                <div class="curlbl">${c}</div>
                <div class="line"><span>Borç</span><b>${fmtCell(t.borc, c)}</b></div>
                <div class="line"><span>Tahs.</span><b class="green">${fmtCell(t.tahsilat, c)}</b></div>
                <div class="line"><span>Kalan</span><b class="${t.kalan > 0 ? "red" : "green"}">${fmtCell(t.kalan, c)}</b></div>
              </td>
            `;
          })
          .join("");
        return `
          <tr>
            <td class="staff-name"><div class="avatar">${escapeHtml(s.profile.name.charAt(0).toUpperCase())}</div><div><strong>${escapeHtml(s.profile.name)}</strong><div class="muted">${s.files.length} dosya · ${s.payments.length} tahsilat</div></div></td>
            ${cells || '<td class="cell muted">—</td>'}
          </tr>
        `;
      })
      .join("");

    // Ödenmemiş dosya detay listesi (her personel için)
    const unpaidSections = staffList
      .map((s) => {
        const unpaid = s.files.filter((f) => f.odeme_durumu !== "odendi");
        if (unpaid.length === 0) return "";
        const rows = unpaid
          .map((f) => {
            const ucret = fmtCell(Number(f.ucret) || 0, f.ucret_currency || "TL");
            const tarih = formatDate(f.created_at);
            const ulke = f.hedef_ulke || "—";
            return `<tr>
              <td><strong>${escapeHtml(f.musteri_ad || "—")}</strong></td>
              <td>${escapeHtml(ulke)}</td>
              <td class="num">${ucret}</td>
              <td class="muted">${tarih}</td>
            </tr>`;
          })
          .join("");

        const owedTotals = Object.entries(s.totals)
          .filter(([, t]) => t.kalan > 0)
          .map(([c, t]) => `<span class="pill">${fmtCell(t.kalan, c)} ${c}</span>`)
          .join("");

        return `
          <div class="unpaid-block">
            <div class="unpaid-head">
              <div class="unpaid-title">
                <div class="avatar sm">${escapeHtml(s.profile.name.charAt(0).toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(s.profile.name)}</strong>
                  <span class="muted">· ${unpaid.length} ödenmemiş dosya</span>
                </div>
              </div>
              <div class="unpaid-totals">${owedTotals}</div>
            </div>
            <table class="sub-table">
              <thead>
                <tr>
                  <th>Müşteri</th>
                  <th>Hedef Ülke</th>
                  <th class="num">Ücret</th>
                  <th>Açılış Tarihi</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Cari Hesap Raporu — ${today}</title>
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin:0; padding:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:#0f172a; background:#fff; }
  .page { padding: 28px 32px; max-width: 1024px; margin: 0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:16px; border-bottom: 2px solid #6366f1; margin-bottom: 22px; }
  .brand { display:flex; gap:12px; align-items:center; }
  .brand .logo { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #4f46e5, #c026d3); color:#fff; font-weight: 900; display:flex; align-items:center; justify-content:center; font-size: 18px; }
  .brand h1 { font-size: 22px; margin:0 0 2px 0; letter-spacing: -0.02em; }
  .brand .sub { color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .12em; }
  .meta { text-align: right; font-size: 11px; color: #475569; }
  .meta strong { color: #0f172a; font-size: 13px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: #6366f1; margin: 0 0 10px 0; font-weight: 800; }
  .kpi-grid { display:grid; grid-template-columns: repeat(${Math.max(Object.keys(generalTotals).length || 1, 1)}, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: linear-gradient(180deg, #ffffff, #f8fafc); }
  .kpi-head { display:flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #64748b; font-weight: 800; }
  .kpi-symbol { font-size: 18px; font-weight: 900; color: #4f46e5; }
  .kpi-row { display:flex; justify-content:space-between; font-size: 12px; padding: 3px 0; color: #334155; }
  .kpi-row .bold { font-weight: 700; color: #0f172a; }
  .kpi-row strong.big { font-size: 16px; }
  .kpi-divider { height: 1px; background:#e2e8f0; margin: 6px 0; }
  .kpi-bar { height: 5px; background:#f1f5f9; border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .kpi-bar span { display:block; height: 100%; background: linear-gradient(90deg, #10b981, #059669); }
  .kpi-foot { font-size: 10px; color: #94a3b8; margin-top: 4px; text-align: right; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11.5px; }
  thead th { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-weight: 800; background: #f8fafc; padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  thead th:first-child { border-top-left-radius: 10px; }
  thead th:last-child { border-top-right-radius: 10px; text-align: right; }
  tbody tr { background: #fff; }
  tbody tr:nth-child(even) { background: #fbfbfd; }
  tbody td { padding: 10px 12px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
  td.staff-name { display:flex; gap: 10px; align-items: center; min-width: 180px; }
  td.staff-name .avatar { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #c026d3); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; }
  td.staff-name .muted { font-size: 10px; color: #94a3b8; }
  td.cell { font-size: 11px; min-width: 130px; }
  td.cell .curlbl { display:inline-block; padding: 1px 7px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-weight: 800; font-size: 9.5px; letter-spacing: .1em; margin-bottom: 4px; }
  td.cell .line { display: flex; justify-content: space-between; padding: 1px 0; }
  td.cell .line span { color: #64748b; }
  .green { color: #059669; }
  .red { color: #dc2626; }
  .muted { color: #94a3b8; font-weight: 500; font-size: 10.5px; }

  /* Ödenmemiş dosya detayı */
  .unpaid-section { margin-top: 28px; }
  .unpaid-block { margin-top: 14px; border: 1px solid #fecaca; border-radius: 14px; overflow: hidden; background: linear-gradient(180deg, #fff8f8, #fff); page-break-inside: avoid; }
  .unpaid-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #fee2e2; background: linear-gradient(90deg, #fef2f2, #fff7ed); flex-wrap: wrap; gap: 8px; }
  .unpaid-title { display: flex; gap: 10px; align-items: center; }
  .avatar { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #c026d3); color: #fff; display:flex; align-items:center; justify-content:center; font-weight: 800; font-size: 12px; }
  .avatar.sm { width: 24px; height: 24px; font-size: 11px; background: linear-gradient(135deg, #ef4444, #dc2626); }
  .unpaid-totals { display: flex; gap: 4px; flex-wrap: wrap; }
  .pill { padding: 3px 10px; border-radius: 999px; background: #fee2e2; color: #b91c1c; font-weight: 800; font-size: 10.5px; letter-spacing: .03em; }
  .sub-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .sub-table th { background: #fff7ed; color: #92400e; font-weight: 800; font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; padding: 8px 12px; text-align: left; border-bottom: 1px solid #fee2e2; }
  .sub-table th.num, .sub-table td.num { text-align: right; }
  .sub-table td { padding: 7px 12px; border-bottom: 1px solid #fef2f2; vertical-align: top; }
  .sub-table tr:last-child td { border-bottom: none; }
  .sub-table tbody tr:nth-child(even) { background: #fffbf7; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display:flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  @page { size: A4 portrait; margin: 14mm; }
  @media print {
    .noprint { display: none !important; }
    .page { padding: 0; }
  }
  .actions { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }
  .btn { padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; cursor: pointer; }
  .btn.primary { background: linear-gradient(135deg, #4f46e5, #c026d3); color: #fff; border-color: transparent; }
</style>
</head>
<body>
  <div class="page">
    <div class="actions noprint">
      <button class="btn" onclick="window.close()">Kapat</button>
      <button class="btn primary" onclick="window.print()">PDF Olarak Kaydet / Yazdır</button>
    </div>
    <div class="header">
      <div class="brand">
        <div class="logo">V</div>
        <div>
          <div class="sub">Visora · Cari Hesap Raporu</div>
          <h1>Personel Cari Hesap Özeti</h1>
        </div>
      </div>
      <div class="meta">
        <div>Rapor Tarihi</div>
        <strong>${today}</strong>
        <div style="margin-top:3px">${time}</div>
      </div>
    </div>

    ${Object.keys(generalTotals).length > 0 ? `
      <h2>Genel Toplam</h2>
      <div class="kpi-grid">${generalRows}</div>
    ` : ""}

    <h2>Personel Detayı</h2>
    <table>
      <thead>
        <tr>
          <th>Personel</th>
          ${["TL", "EUR", "USD"].filter((c) => Object.keys(generalTotals).includes(c)).map((c) => `<th>${c}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${staffRows || `<tr><td colspan="4" class="muted" style="text-align:center; padding:20px;">Carisi olan personel bulunamadı.</td></tr>`}
      </tbody>
    </table>

    ${unpaidSections ? `
      <div class="unpaid-section">
        <h2 style="color:#dc2626;">Ödenmemiş Dosyalar (Detaylı)</h2>
        ${unpaidSections}
      </div>
    ` : ""}

    <div class="footer">
      <span>Bu rapor Visora panelinden otomatik oluşturulmuştur.</span>
      <span>visora · ${today}</span>
    </div>
  </div>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 350); });
  </script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=1100,height=820");
    if (!w) {
      alert("Açılır pencere engellendi. Lütfen tarayıcı izinlerini kontrol edin.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-amber-500 via-orange-500 to-rose-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Finans</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Cari Hesap Yönetimi</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Tüm personelin borç-alacak durumu; cari bakiye takibi ve firma hesapları.
            </p>
          </div>
        </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/admin/cari-hesap/firmalar")}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-fuchsia-50 ring-1 ring-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100 text-sm font-bold transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
              </svg>
              Firma Cari Hesapları
            </button>
            <button
              onClick={() => exportToPDF()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-bold shadow-lg shadow-rose-500/25 hover:shadow-xl transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF Olarak İndir
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
