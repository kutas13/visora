/**
 * iDATA email parser
 * noreply@idata.com.tr adresinden gelen randevu atama emaillerini parse eder
 */

export interface ParsedIdataEmail {
  musteriAd: string;
  pnr: string;
  ulkeAmac: string;
  ofis: string;
  randevuBaslangic: string | null; // YYYY-MM-DD
  randevuBitis: string | null; // YYYY-MM-DD
  sonKayitTarihi: string | null; // ISO timestamp
}

/**
 * DD-MM-YYYY formatindaki tarihi YYYY-MM-DD'ye cevirir
 */
function parseTurkishDate(dateStr: string): string | null {
  // 10-02-2026 -> 2026-02-10
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * DD-MM-YYYY HH:mm formatindaki tarihi ISO timestamp'e cevirir
 */
function parseTurkishDateTime(dateStr: string): string | null {
  // 11-02-2026 23:59 -> 2026-02-11T23:59:00
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00`;
}

/**
 * HTML etiketlerini temizler
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|td|th|table|thead|tbody)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * iDATA email body'sini parse eder
 * 
 * Ornek email:
 * Subject: SDP9JY7WFTE - iDATA Almanya Schengen Randevu Tarihi
 * Body: ... 10-02-2026 ile 27-02-2026 arasindaki ...
 *       ... 11-02-2026 23:59'a kadar ...
 *       AD SOYAD    PNR    GIDIS AMACI    OFIS ADI
 *       FARUK GUR   SDP9JY7WFTE   Almanya - Ticari   Istanbul Ofis - Altunizade
 */
export function parseIdataEmail(
  body: string,
  subject?: string
): ParsedIdataEmail | null {
  try {
    const text = stripHtml(body);

    // Tarih araligini bul: "10-02-2026 ile 27-02-2026"
    let randevuBaslangic: string | null = null;
    let randevuBitis: string | null = null;
    const dateRangeMatch = text.match(
      /(\d{2}-\d{2}-\d{4})\s+ile\s+(\d{2}-\d{2}-\d{4})/
    );
    if (dateRangeMatch) {
      randevuBaslangic = parseTurkishDate(dateRangeMatch[1]);
      randevuBitis = parseTurkishDate(dateRangeMatch[2]);
    }

    // Son kayit tarihini bul: "11-02-2026 23:59'a kadar"
    let sonKayitTarihi: string | null = null;
    const deadlineMatch = text.match(
      /(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})[''`]?[aA]?\s*kadar/
    );
    if (deadlineMatch) {
      sonKayitTarihi = parseTurkishDateTime(deadlineMatch[1]);
    }

    // Tablo verilerini parse et
    // AD SOYAD, PNR, GIDIS AMACI, OFIS ADI
    // Satir satir arayalim
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    let musteriAd = "";
    let pnr = "";
    let ulkeAmac = "";
    let ofis = "";

    // Tablo basligini bul
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      if (
        (line.includes("AD SOYAD") || line.includes("AD\tSOYAD")) &&
        (line.includes("PNR") || line.includes("GİDİŞ") || line.includes("GIDIS"))
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx >= 0 && headerIdx + 1 < lines.length) {
      // Sonraki satir veri satirimiz
      const dataLine = lines[headerIdx + 1];

      // Tab veya coklu boslukla ayrilmis olabilir
      const parts = dataLine.split(/\t+/).map((s) => s.trim()).filter(Boolean);

      if (parts.length >= 2) {
        musteriAd = parts[0] || "";
        pnr = parts[1] || "";
        ulkeAmac = parts[2] || "";
        ofis = parts[3] || "";
      } else {
        // Tab yoksa, coklu boslukla deneyelim
        const spaceParts = dataLine.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
        if (spaceParts.length >= 2) {
          musteriAd = spaceParts[0] || "";
          pnr = spaceParts[1] || "";
          ulkeAmac = spaceParts[2] || "";
          ofis = spaceParts[3] || "";
        }
      }
    }

    // PNR subject'ten de alinabilir (yedek)
    if (!pnr && subject) {
      const pnrMatch = subject.match(/^([A-Z0-9]+)\s*-\s*iDATA/i);
      if (pnrMatch) {
        pnr = pnrMatch[1];
      }
    }

    // Ulke amac subject'ten de cikarilabilir (yedek)
    if (!ulkeAmac && subject) {
      const countryMatch = subject.match(
        /iDATA\s+(.+?)\s+(?:Schengen|Vize|Randevu)/i
      );
      if (countryMatch) {
        ulkeAmac = countryMatch[1];
      }
    }

    // En az PNR olmali
    if (!pnr) return null;

    return {
      musteriAd: musteriAd || "Bilinmiyor",
      pnr,
      ulkeAmac: ulkeAmac || "",
      ofis: ofis || "",
      randevuBaslangic,
      randevuBitis,
      sonKayitTarihi,
    };
  } catch (err) {
    console.error("iDATA email parse hatasi:", err);
    return null;
  }
}

/**
 * Emailin iDATA randevu atamasi olup olmadigini kontrol eder
 */
export function isIdataAssignmentEmail(
  from: string,
  subject: string
): boolean {
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  // noreply@idata.com.tr'den gelen
  if (!fromLower.includes("idata.com.tr")) return false;

  // Subject'te randevu tarihi gecen
  if (
    subjectLower.includes("randevu tarihi") ||
    subjectLower.includes("termindatum") ||
    subjectLower.includes("appointment date")
  ) {
    return true;
  }

  return false;
}
