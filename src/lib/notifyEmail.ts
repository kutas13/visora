/**
 * Client-side helper: bildirim mailini /api/notifications/dispatch
 * uzerinden tetikler.
 *
 * Onemli: Form genelde insert sonrasi modali kapatip parent'i re-fetch
 * eder; bu sirada fetch henuz tamamlanmadan navigation/unmount olabilir.
 * `keepalive: true` ile request, sayfa kapansa bile arkaplanda gider.
 *
 * Hatalar sessizce yutulur; mail gonderimi hicbir client akisini
 * bloklamaz.
 */

type Kind = "tahsilat" | "dosya" | "randevu_talebi" | "randevu_alindi";

export async function notifyEmail<T extends Record<string, any>>(
  kind: Kind,
  payload: T
): Promise<void> {
  try {
    await fetch("/api/notifications/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
      keepalive: true,
    });
  } catch {
    /* sessiz */
  }
}
