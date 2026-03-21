/**
 * iDATA email parser
 * noreply@idata.com.tr adresinden gelen randevu atama emaillerini parse eder
 */

export interface ParsedIdataEmail {
  musteriAd: string;
  pnr: string;
  ulkeAmac: string;
  ofis: string;
  randevuBaslangic: string | null;
  randevuBitis: string | null;
  sonKayitTarihi: string | null;
}

function parseTurkishDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseTurkishDateTime(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00`;
}

/**
 * HTML'den tablo satırlarını çıkarır - birden fazla yöntem dener
 */
function extractTableData(html: string): { headers: string[]; data: string[] } | null {
  // Yöntem 1: <tr> <td> parsing
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[][] = [];
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;

    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const cellText = tdMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&ouml;/g, "ö")
        .replace(/&uuml;/g, "ü")
        .replace(/&ccedil;/g, "ç")
        .replace(/&#[0-9]+;/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cellText) cells.push(cellText);
    }

    if (cells.length >= 2) {
      rows.push(cells);
    }
  }

  // Header ve data satırını bul
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].join("|").toUpperCase();
    if ((rowText.includes("AD") && rowText.includes("PNR")) || 
        rowText.includes("AD SOYAD")) {
      if (i + 1 < rows.length) {
        return { headers: rows[i], data: rows[i + 1] };
      }
    }
  }

  return null;
}

/**
 * iDATA email body'sini parse eder
 */
export function parseIdataEmail(
  body: string,
  subject?: string
): ParsedIdataEmail | null {
  try {
    let musteriAd = "";
    let pnr = "";
    let ulkeAmac = "";
    let ofis = "";
    let randevuBaslangic: string | null = null;
    let randevuBitis: string | null = null;
    let sonKayitTarihi: string | null = null;

    // HTML'i düz metne çevir (tarih araması için)
    const fullText = body
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|tr|td|th|table|thead|tbody)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");

    // Tarih aralığını bul
    const dateRangeMatch = fullText.match(/(\d{2}-\d{2}-\d{4})\s+ile\s+(\d{2}-\d{2}-\d{4})/);
    if (dateRangeMatch) {
      randevuBaslangic = parseTurkishDate(dateRangeMatch[1]);
      randevuBitis = parseTurkishDate(dateRangeMatch[2]);
    }

    // Son kayıt tarihi
    const deadlineMatch = fullText.match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})[''`]?[aA]?\s*kadar/);
    if (deadlineMatch) {
      sonKayitTarihi = parseTurkishDateTime(deadlineMatch[1]);
    }

    // ===== YÖNTEM 1: HTML tablo parsing =====
    if (body.includes("<t") && body.includes("PNR")) {
      const tableData = extractTableData(body);
      
      if (tableData) {
        const { headers, data } = tableData;
        
        // Header'lara göre sütun eşleştir
        for (let col = 0; col < headers.length && col < data.length; col++) {
          const h = headers[col].toUpperCase().trim();
          const v = data[col]?.trim() || "";

          if (h.includes("AD") && (h.includes("SOYAD") || h.includes("AD SOYAD"))) {
            musteriAd = v;
          } else if (h === "PNR" || h.includes("PNR")) {
            pnr = v;
          } else if (h.includes("GİDİŞ") || h.includes("GIDIS") || h.includes("AMAC")) {
            ulkeAmac = v;
          } else if (h.includes("OFİS") || h.includes("OFIS")) {
            ofis = v;
          }
        }
      }
    }

    // ===== YÖNTEM 2: Plain text satır parsing =====
    if (!musteriAd || !pnr) {
      const lines = fullText.split(/\n/).map(l => l.trim()).filter(Boolean);
      
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].toUpperCase();
        if (line.includes("AD") && line.includes("SOYAD") && line.includes("PNR")) {
          const dataLine = lines[i + 1];
          let parts = dataLine.split(/\t+/).map(s => s.trim()).filter(Boolean);
          if (parts.length < 2) parts = dataLine.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
          
          if (parts.length >= 2) {
            if (!musteriAd) musteriAd = parts[0];
            if (!pnr) pnr = parts[1];
            if (!ulkeAmac && parts[2]) ulkeAmac = parts[2];
            if (!ofis && parts[3]) ofis = parts[3];
          }
          break;
        }
      }
    }

    // ===== YÖNTEM 3: Regex fallback - direkt email içeriğinden =====
    if (!pnr && subject) {
      const pnrMatch = subject.match(/^([A-Z0-9]{8,15})\s*-\s*iDATA/i);
      if (pnrMatch) pnr = pnrMatch[1];
    }

    if (!ulkeAmac && subject) {
      const countryMatch = subject.match(/iDATA\s+(.+?)\s+(?:Schengen|Vize|Randevu)/i);
      if (countryMatch) ulkeAmac = countryMatch[1];
    }

    // ===== YÖNTEM 4: Ofis için özel regex (Altunizade, Gayrettepe vb.) =====
    if (!ofis) {
      const ofisMatch = fullText.match(/(İstanbul\s+Ofis\s*-\s*(?:Altunizade|Gayrettepe|Levent|Ataşehir|Bakırköy|Kadıköy|Beşiktaş)[a-zıöüçşğ]*)/i) 
        || fullText.match(/(Ankara\s+Ofis[^,\n<]*)/i)
        || fullText.match(/(İzmir\s+Ofis[^,\n<]*)/i)
        || fullText.match(/(Antalya\s+Ofis[^,\n<]*)/i)
        || fullText.match(/(Bursa\s+Ofis[^,\n<]*)/i);
      if (ofisMatch) {
        ofis = ofisMatch[1].trim();
      }
    }

    // ===== YÖNTEM 5: Müşteri adı için özel regex =====
    if (!musteriAd && pnr) {
      // PNR'dan önceki büyük harfli kelimeyi müşteri adı olarak al
      const beforePnr = fullText.split(pnr)[0];
      if (beforePnr) {
        // Son büyük harfli isim-soyisim çiftini bul
        const nameMatches = beforePnr.match(/([A-ZÇĞIİÖŞÜ][A-ZÇĞIİÖŞÜa-zçğıöşü]+\s+[A-ZÇĞIİÖŞÜ][A-ZÇĞIİÖŞÜa-zçğıöşü]+)/g);
        if (nameMatches) {
          // En sonuncuyu al (tabloya en yakın olan)
          musteriAd = nameMatches[nameMatches.length - 1];
        }
      }
    }

    // PNR zorunlu
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
    console.error("iDATA email parse hatası:", err);
    return null;
  }
}

/**
 * Emailin iDATA randevu ataması olup olmadığını kontrol eder
 */
export function isIdataAssignmentEmail(from: string, subject: string): boolean {
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  if (!fromLower.includes("idata.com.tr")) return false;

  if (
    subjectLower.includes("randevu tarihi") ||
    subjectLower.includes("randevu talebi") ||
    subjectLower.includes("termindatum") ||
    subjectLower.includes("terminfrage") ||
    subjectLower.includes("appointment date") ||
    subjectLower.includes("appointment request")
  ) {
    return true;
  }

  return false;
}

/**
 * iDATA email tipini belirler: "atama" veya "randevu"
 */
export function getIdataEmailType(subject: string, body: string): "atama" | "randevu" | null {
  const subjectLower = subject.toLowerCase();
  const bodyLower = body.toLowerCase();

  if (
    subjectLower.includes("randevu tarihi") ||
    bodyLower.includes("randevu tarihiniz") ||
    bodyLower.includes("randevu tarih ve saatinizi") ||
    bodyLower.includes("appointment has been") ||
    bodyLower.includes("termin wurde")
  ) {
    return "randevu";
  }

  if (
    subjectLower.includes("randevu talebi") ||
    subjectLower.includes("terminfrage") ||
    bodyLower.includes("randevu talebiniz") ||
    bodyLower.includes("başvuru talebiniz") ||
    bodyLower.includes("atama")
  ) {
    return "atama";
  }

  return null;
}
