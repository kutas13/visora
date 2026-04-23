/** Örnek: NİSAN 2026 (Türkçe büyük harf) */
export function monthYearUpperTr(year: number, month: number) {
  return new Date(year, month - 1, 1)
    .toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    .toLocaleUpperCase("tr-TR");
}

/**
 * Personel: YUSUF NİSAN 2026 AYLIK ÖZET.pdf
 * Davut: FOX TURIZM NİSAN 2026.pdf
 */
export function buildMonthlyPdfFilename(profileName: string, year: number, month: number) {
  const my = monthYearUpperTr(year, month);
  if (profileName === "DAVUT") {
    return `FOX TURIZM ${my}.pdf`;
  }
  return `${profileName} ${my} AYLIK ÖZET.pdf`;
}

/** Eski tarayıcılar için ASCII yedek dosya adı */
export function asciiFilenameFallback(name: string) {
  return name
    .replace(/[^\u0000-\u007f]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "rapor.pdf";
}
