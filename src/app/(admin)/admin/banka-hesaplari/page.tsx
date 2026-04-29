"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Input, Select, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PARA_BIRIMLERI } from "@/lib/constants";
import type { BankAccount, ParaBirimi } from "@/lib/supabase/types";

/**
 * Genel Mudur Banka Hesaplari sayfasi.
 *
 *   - Hesap olusturur (POST /api/bank-accounts)
 *   - Hesap pasiflestirir (DELETE /api/bank-accounts/:id)
 *   - Her hesap karti acilinca o hesaba yapilmis tum tahsilatlari gosterir:
 *     payments.hesap_sahibi = bank_account.name esleserek visa_files ile
 *     join'lenir; tarih, musteri, vize ulkesi, tutar listesi cikar.
 */

type Movement = {
  id: string;
  created_at: string;
  tutar: number;
  currency: ParaBirimi;
  yontem: string;
  payment_type: string | null;
  dekont_url: string | null;
  tl_karsilik: number | null;
  visa_files: { musteri_ad: string | null; hedef_ulke: string | null } | null;
};

type AccountWithStats = BankAccount & {
  total_TL: number;
  total_EUR: number;
  total_USD: number;
  count: number;
  last_at: string | null;
};

const SYM: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };
function fmtMoney(n: number, c: string) {
  return `${Math.round(n).toLocaleString("tr-TR")} ${SYM[c] || c}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminBankAccountsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [movementsByAccount, setMovementsByAccount] = useState<Record<string, Movement[]>>({});
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [currency, setCurrency] = useState<ParaBirimi>("TL");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 1) Hesaplari yukle
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bank-accounts?active=false");
      if (!res.ok) throw new Error("Banka hesaplari alinamadi");
      const json = await res.json();
      setAccounts((json.data || []) as BankAccount[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2) Tum hesaplar icin hareketleri toplu cek (RLS: payments same org policy)
  const loadMovements = useCallback(async () => {
    if (accounts.length === 0) return;
    const names = accounts.map((a) => a.name);

    // Personelin/admin'in icinde oldugu sirketin tum dosya odemeleri.
    // payments tablosu RLS'i zaten organizasyon kapsamini koruyor —
    // burada hesap_sahibi adlarina filtreliyoruz.
    const { data, error } = await supabase
      .from("payments")
      .select(`
        id, created_at, tutar, currency, yontem, payment_type,
        hesap_sahibi, dekont_url, tl_karsilik,
        visa_files ( musteri_ad, hedef_ulke )
      `)
      .in("hesap_sahibi", names)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Hareketler alinamadi", error);
      return;
    }

    const grouped: Record<string, Movement[]> = {};
    for (const row of (data as any[]) || []) {
      const acc = accounts.find((a) => a.name === row.hesap_sahibi);
      if (!acc) continue;
      if (!grouped[acc.id]) grouped[acc.id] = [];
      grouped[acc.id].push({
        id: row.id,
        created_at: row.created_at,
        tutar: Number(row.tutar) || 0,
        currency: row.currency as ParaBirimi,
        yontem: row.yontem,
        payment_type: row.payment_type,
        dekont_url: row.dekont_url || null,
        tl_karsilik: typeof row.tl_karsilik === "number" ? row.tl_karsilik : null,
        visa_files: row.visa_files
          ? { musteri_ad: row.visa_files.musteri_ad, hedef_ulke: row.visa_files.hedef_ulke }
          : null,
      });
    }
    setMovementsByAccount(grouped);
  }, [accounts, supabase]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => { void loadMovements(); }, [loadMovements]);

  const accountsWithStats: AccountWithStats[] = useMemo(() => {
    return accounts.map((a) => {
      const moves = movementsByAccount[a.id] || [];
      const tots: Record<ParaBirimi, number> = { TL: 0, EUR: 0, USD: 0 };
      for (const m of moves) {
        tots[m.currency] = (tots[m.currency] || 0) + m.tutar;
      }
      return {
        ...a,
        total_TL: tots.TL,
        total_EUR: tots.EUR,
        total_USD: tots.USD,
        count: moves.length,
        last_at: moves[0]?.created_at || null,
      };
    });
  }, [accounts, movementsByAccount]);

  const handleCreate = async () => {
    setMsg(null);
    if (!name.trim()) {
      setMsg({ type: "err", text: "Hesap sahibi adı zorunlu." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bank_name: bankName.trim() || null,
          iban: iban.trim() || null,
          currency,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Banka hesabı oluşturulamadı");
      setMsg({ type: "ok", text: "Hesap oluşturuldu." });
      setName(""); setBankName(""); setIban(""); setCurrency("TL"); setNotes("");
      setShowCreate(false);
      await loadAccounts();
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "Hata oluştu" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (acc: BankAccount) => {
    const next = !acc.is_active;
    const verb = next ? "aktif edilsin mi" : "pasif edilsin mi";
    if (!confirm(`'${acc.name}' hesabı ${verb}? (Geçmiş hareketler korunur.)`)) return;
    try {
      const res = await fetch(`/api/bank-accounts/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Hesap güncellenemedi");
      }
      await loadAccounts();
    } catch (err: any) {
      alert(err?.message || "Hata");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Banka Hesapları</h1>
          <p className="text-sm text-navy-500 mt-1">
            Tahsilat ve dosya formunda görünecek banka hesaplarınızı buradan yönetin.
            Personeller ve siz bu hesapları seçebilirsiniz.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary">
          + Yeni Banka Hesabı
        </Button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-navy-500">Yükleniyor…</Card>
      ) : accountsWithStats.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
          </div>
          <p className="font-semibold text-navy-800">Henüz banka hesabınız yok.</p>
          <p className="text-sm text-navy-500 mt-1">İlk hesabı oluşturun, dosya formlarında görünmeye başlasın.</p>
          <div className="mt-4">
            <Button onClick={() => setShowCreate(true)}>Banka Hesabı Oluştur</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accountsWithStats.map((acc) => {
            const isOpen = openAccountId === acc.id;
            const moves = movementsByAccount[acc.id] || [];
            return (
              <Card
                key={acc.id}
                className={`p-5 transition-all ${acc.is_active ? "" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-navy-900 truncate">{acc.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${acc.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                        {acc.is_active ? "Aktif" : "Pasif"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {acc.currency}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-navy-500 space-y-0.5">
                      {acc.bank_name && <p>{acc.bank_name}</p>}
                      {acc.iban && <p className="font-mono text-[11px] break-all">{acc.iban}</p>}
                      {acc.notes && <p className="italic">{acc.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(acc)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${acc.is_active ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                    >
                      {acc.is_active ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  {(["TL","EUR","USD"] as const).map((c) => {
                    const v = c === "TL" ? acc.total_TL : c === "EUR" ? acc.total_EUR : acc.total_USD;
                    return (
                      <div key={c} className="px-3 py-2 rounded-lg bg-navy-50 border border-navy-100 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-navy-400 font-semibold">{c}</p>
                        <p className="text-sm font-black text-navy-800 mt-0.5">{fmtMoney(v, c)}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-navy-100">
                  <div className="text-[11px] text-navy-500">
                    <span className="font-semibold">{acc.count}</span> hareket
                    {acc.last_at && <> · son: {fmtDate(acc.last_at)}</>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenAccountId(isOpen ? null : acc.id)}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    {isOpen ? "Hesap geçmişini kapat" : "Hesap geçmişini aç →"}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-navy-100 bg-white">
                    {moves.length === 0 ? (
                      <div className="p-4 text-xs text-navy-400 text-center">Bu hesaba ait hareket yok.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-navy-50 sticky top-0">
                          <tr className="text-left text-navy-500">
                            <th className="px-2.5 py-2 font-semibold">Tarih</th>
                            <th className="px-2.5 py-2 font-semibold">Müşteri</th>
                            <th className="px-2.5 py-2 font-semibold">Vize</th>
                            <th className="px-2.5 py-2 font-semibold text-right">Tutar</th>
                            <th className="px-2.5 py-2 font-semibold text-center">Dekont</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moves.map((m) => (
                            <tr key={m.id} className="border-t border-navy-50 hover:bg-navy-50/50">
                              <td className="px-2.5 py-1.5 whitespace-nowrap text-navy-500">{fmtDate(m.created_at)}</td>
                              <td className="px-2.5 py-1.5 truncate max-w-[140px] font-medium text-navy-800">{m.visa_files?.musteri_ad || "—"}</td>
                              <td className="px-2.5 py-1.5 truncate max-w-[100px] text-navy-600">{m.visa_files?.hedef_ulke || "—"}</td>
                              <td className="px-2.5 py-1.5 text-right font-bold text-emerald-700">
                                <div>{fmtMoney(m.tutar, m.currency)}</div>
                                {typeof m.tl_karsilik === "number" && m.tl_karsilik > 0 && m.currency !== "TL" && (
                                  <div className="text-[10px] font-semibold text-amber-600">
                                    TL karşılığı: {Math.round(m.tl_karsilik).toLocaleString("tr-TR")} ₺
                                  </div>
                                )}
                              </td>
                              <td className="px-2.5 py-1.5 text-center">
                                {m.dekont_url ? (
                                  <a
                                    href={m.dekont_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold transition-colors"
                                    title="Dekontu yeni sekmede aç"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6v6M21 3l-7 7M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-4" />
                                    </svg>
                                    Dekont gör
                                  </a>
                                ) : (
                                  <span className="text-navy-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Yeni Hesap Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setMsg(null); }}
        title="Yeni Banka Hesabı"
        size="md"
      >
        <div className="space-y-3">
          <Input
            label="Hesap Sahibi (zorunlu)"
            placeholder="Örn: Ahmet Yılmaz veya Genel Ofis Hesabı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Banka (opsiyonel)"
            placeholder="Örn: Garanti, İş Bankası…"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <Input
            label="IBAN (opsiyonel)"
            placeholder="TR.."
            value={iban}
            onChange={(e) => setIban(e.target.value)}
          />
          <Select
            label="Para Birimi"
            options={PARA_BIRIMLERI}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as ParaBirimi)}
          />
          <div>
            <label className="text-xs font-medium text-navy-600">Not (opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Hesap için kısa açıklama"
            />
          </div>

          {msg && msg.type === "err" && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              {msg.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1" disabled={submitting}>
              İptal
            </Button>
            <Button onClick={handleCreate} className="flex-1" disabled={submitting}>
              {submitting ? "Kaydediliyor…" : "Hesabı Oluştur"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
