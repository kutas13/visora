/**
 * Client-side helper: bildirim mailini /api/notifications/dispatch
 * uzerinden tetikler. Sessizce hata yutar; mail gonderimi hicbir
 * client akisini bloklamaz.
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
    });
  } catch {
    /* sessiz */
  }
}
