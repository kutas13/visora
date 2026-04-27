/**
 * Visora — Özellik Bayrakları (Feature Flags)
 *
 * WhatsApp ile dış mesaj gönderimi PLATFORM ÇAPINDA KAPALIDIR.
 * Tüm WhatsApp send endpointleri ve cron tetiklemeleri bu bayrağa
 * bakar; etkin değilse hemen no-op cevap döner.
 *
 * Sebep: Müşteri bilgilerini (telefon vb.) hiçbir dış kanala iletmek
 * istemiyoruz. Yeniden açmak için ortam değişkeni:
 *   NEXT_PUBLIC_ENABLE_WHATSAPP=true   (UI tarafı için)
 *   ENABLE_WHATSAPP=true               (server tarafı için)
 */

export const WHATSAPP_DISABLED_MESSAGE =
  "WhatsApp mesajlaşması Visora platformunda devre dışıdır. Lütfen müşterinizle e-posta veya doğrudan iletişim kurun.";

export function isWhatsappEnabled(): boolean {
  // Server tarafı: ENABLE_WHATSAPP varsa ve "true" ise aç
  if (typeof process !== "undefined") {
    const v = process.env.ENABLE_WHATSAPP || process.env.NEXT_PUBLIC_ENABLE_WHATSAPP;
    if (v && v.toLowerCase() === "true") return true;
  }
  return false;
}

/**
 * Legacy SMTP'ye bagli email endpoint'leri (gunluk-rapor / tahsilat /
 * randevu mail) eski monolitik kurulumda tek SMTP hesabi uzerinden
 * mail gonderiyordu. Yeni modelde her sirketin kendi SMTP yapilandirmasi
 * olmali. Henuz multi-tenant SMTP yokken bu endpoint'ler default olarak
 * KAPALIDIR, boylece eski hesaplardan disariya mail gitmez.
 *
 * Acmak icin: ENABLE_LEGACY_EMAIL=true
 */
export const LEGACY_EMAIL_DISABLED_MESSAGE =
  "E-posta gönderimi Visora platformunda devre dışıdır. Şirket SMTP yapılandırması tamamlanana kadar dış e-posta atılmaz.";

export function isLegacyEmailEnabled(): boolean {
  if (typeof process !== "undefined") {
    const v = process.env.ENABLE_LEGACY_EMAIL;
    if (v && v.toLowerCase() === "true") return true;
  }
  return false;
}
