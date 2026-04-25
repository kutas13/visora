/** Örnek: NİSAN 2026 (Türkçe büyük harf) */
export function monthYearUpperTr(year: number, month: number) {
  return new Date(year, month - 1, 1)
    .toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    .toLocaleUpperCase("tr-TR");
}

/**
 * Genel ozet (admin/muhasebe/owner) -> VISORA NİSAN 2026.pdf
 * Personel kendi raporu              -> {Personel Adi} NİSAN 2026 AYLIK ÖZET.pdf
 */
export function buildMonthlyPdfFilename(
  profileName: string,
  year: number,
  month: number,
  mode: "org" | "staff" = "staff"
) {
  const my = monthYearUpperTr(year, month);
  if (mode === "org") {
    return `VISORA ${my}.pdf`;
  }
  const safeName = (profileName || "PERSONEL").trim() || "PERSONEL";
  return `${safeName} ${my} AYLIK ÖZET.pdf`;
}

/** Eski tarayıcılar için ASCII yedek dosya adı */
export function asciiFilenameFallback(name: string) {
  return name
    .replace(/[^\u0000-\u007f]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "rapor.pdf";
}
