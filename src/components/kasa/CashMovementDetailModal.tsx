"use client";

import { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export interface CashMovement {
  id: string;
  type: "gelir" | "gider";
  description: string;
  amount: number;
  currency: string;
  tl_karsilik: number | null;
  exchange_rate: number | null;
  created_by: string | null;
  created_at: string;
  profiles?: { name: string | null } | null;
}

interface CashMovementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: CashMovement | null;
  canDelete?: boolean;
  onDeleted?: () => void;
}

const SYM: Record<string, string> = { TL: "₺", EUR: "€", USD: "$" };

function fmtFullDate(d: string) {
  return new Date(d).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CashMovementDetailModal({
  isOpen,
  onClose,
  movement,
  canDelete = true,
  onDeleted,
}: CashMovementDetailModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!movement) return null;

  const isGelir = movement.type === "gelir";

  const handleDelete = async () => {
    if (!movement) return;
    setDeleting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: delErr } = await supabase.from("cash_movements").delete().eq("id", movement.id);
      if (delErr) {
        setError(delErr.message);
        setDeleting(false);
        return;
      }
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="İşlem Detayı" size="md">
      <div className="space-y-4">
        {/* Hero */}
        <div className={`relative overflow-hidden rounded-2xl p-5 text-center ring-2 ${
          isGelir
            ? "bg-gradient-to-br from-emerald-50 via-green-50 to-white ring-emerald-300"
            : "bg-gradient-to-br from-rose-50 via-red-50 to-white ring-rose-300"
        }`}>
          <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${isGelir ? "bg-emerald-300" : "bg-rose-300"} opacity-20`} />
          <div className="relative">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
              isGelir ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}>
              {isGelir ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              )}
              {isGelir ? "GELİR" : "GİDER"}
            </span>
            <p className={`mt-2 text-3xl sm:text-4xl font-black tracking-tight ${isGelir ? "text-emerald-700" : "text-rose-700"}`}>
              {isGelir ? "+" : "−"} {Math.round(movement.amount).toLocaleString("tr-TR")} {SYM[movement.currency] || movement.currency}
            </p>
            {movement.currency !== "TL" && typeof movement.tl_karsilik === "number" && movement.tl_karsilik > 0 && (
              <p className={`mt-1 text-sm font-bold ${isGelir ? "text-emerald-600" : "text-rose-600"}`}>
                ≈ {Math.round(movement.tl_karsilik).toLocaleString("tr-TR")} ₺
              </p>
            )}
          </div>
        </div>

        {/* Açıklama */}
        <div className="p-3.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Açıklama</p>
          <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">
            {movement.description}
          </p>
        </div>

        {/* Detay Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Para Birimi</p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900">
              {movement.currency} ({SYM[movement.currency] || movement.currency})
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tutar</p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900 tabular-nums">
              {Math.round(movement.amount).toLocaleString("tr-TR")} {SYM[movement.currency] || movement.currency}
            </p>
          </div>
          {movement.exchange_rate && movement.currency !== "TL" && (
            <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Döviz Kuru</p>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900 tabular-nums">
                1 {SYM[movement.currency]} = {Number(movement.exchange_rate).toFixed(2)} ₺
              </p>
            </div>
          )}
          {typeof movement.tl_karsilik === "number" && movement.tl_karsilik > 0 && (
            <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">TL Karşılığı</p>
              <p className={`mt-0.5 text-sm font-extrabold tabular-nums ${isGelir ? "text-emerald-700" : "text-rose-700"}`}>
                {Math.round(movement.tl_karsilik).toLocaleString("tr-TR")} ₺
              </p>
            </div>
          )}
          <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ekleyen</p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900">
              {movement.profiles?.name || "—"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white ring-1 ring-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tarih</p>
            <p className="mt-0.5 text-[12.5px] font-bold text-slate-900">
              {fmtFullDate(movement.created_at)}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Aksiyon */}
        <div className="flex gap-2 pt-1">
          {canDelete && !confirmDel && (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 transition-colors"
              disabled={deleting}
            >
              Sil
            </button>
          )}
          {canDelete && confirmDel && (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md hover:brightness-110 disabled:opacity-50"
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Vazgeç
              </button>
            </>
          )}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </Modal>
  );
}
