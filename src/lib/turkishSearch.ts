/**
 * Pasaport / müşteri adı aramasında Türkçe klavye ile ASCII kayıt uyumu (ör. İBRAHİM ↔ IBRAHIM).
 */

/** Türkçe harfleri Latin ASCII karşılıklarına indirger (I/i ayrımı: İ,I→I, ı,i→i). */
export function turkishFoldAscii(s: string): string {
  return s
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

/** Katlanmış büyük harfli ASCII’deki her I → İ (kayıtta Türkçe büyük harf varken). */
export function asciiCapsIToTurkishİ(s: string): string {
  return s.replace(/I/g, "İ");
}

/**
 * PostgREST `.or()` içinde güvenli ILIKE kalıbı: virgül / parantez / LIKE jokerleri kırılmasın.
 */
export function sanitizeSearchToken(s: string): string {
  return s
    .replace(/[,()[\]%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sorgu metninden Supabase OR filtresi için benzersiz alt dizeler (kısa tutulur).
 */
export function turkishSearchVariants(raw: string): string[] {
  const t = sanitizeSearchToken(raw);
  if (t.length < 2) return [];

  const set = new Set<string>();
  const add = (v: string) => {
    const x = sanitizeSearchToken(v);
    if (x.length >= 2) set.add(x);
  };

  add(t);
  add(turkishFoldAscii(t));

  let trUpper = t;
  let trLower = t;
  try {
    trUpper = t.toLocaleUpperCase("tr-TR");
    trLower = t.toLocaleLowerCase("tr-TR");
  } catch {
    trUpper = t.toUpperCase();
    trLower = t.toLowerCase();
  }

  add(trUpper);
  add(trLower);
  add(turkishFoldAscii(trUpper));
  add(turkishFoldAscii(trLower));

  const folded = turkishFoldAscii(t);
  add(folded.toUpperCase());
  add(folded.toLowerCase());
  add(asciiCapsIToTurkishİ(folded.toUpperCase()));

  return Array.from(set);
}
