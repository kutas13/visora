// ----------------------------------------------------------------------
// VISORA — SaaS modeli
// ----------------------------------------------------------------------
// Eski Fox Turizm hardcoded kullanici listesi kaldirildi. Artik tum
// kullanici/personel bilgileri tenant bazli olarak `profiles` tablosundan
// gelir. Bu sabitler geriye donuk uyumluluk icin BOS dizilerle birakildi
// ki eski importlar build'i kirmasin.
// ----------------------------------------------------------------------

export type LegacyUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  hitap: string;
};

export const STAFF_USERS: readonly LegacyUser[] = [];
export const ADMIN_USER: LegacyUser | null = null;
export const MUHASEBE_USER: LegacyUser | null = null;
export const FEHMI_USER: LegacyUser | null = null;
export const ZAFER_USER: LegacyUser | null = null;

export const ALL_USERS: readonly LegacyUser[] = [];

// Email'den kullanıcı bul — eski Fox listesi kaldirildi, her zaman undefined.
// Yeni kod profiles tablosundan email -> profile cozer.
export function getUserByEmail(_email: string): LegacyUser | undefined {
  return undefined;
}

// İşlem tipleri
export const ISLEM_TIPLERI = [
  { value: "randevulu", label: "Randevusu Var" },
  { value: "randevusuz", label: "Randevusuz İşlem" },
] as const;

// Evrak durumları
export const EVRAK_DURUMLARI = [
  { value: "gelmedi", label: "Gelmedi" },
  { value: "geldi", label: "Geldi" },
] as const;

// Vize sonuçları
export const VIZE_SONUCLARI = [
  { value: "vize_onay", label: "Vize Onaylandı" },
  { value: "red", label: "Reddedildi" },
] as const;

// Ödeme yöntemleri (tahsilat için)
export const ODEME_YONTEMLERI = [
  { value: "nakit", label: "Nakit (Cariden Düşüş)" },
  { value: "hesaba", label: "Hesaba" },
  { value: "pos", label: "POS (hesaba TL)" },
] as const;

// Ödeme durumları
export const ODEME_DURUMLARI = [
  { value: "odendi", label: "Ödendi" },
  { value: "odenmedi", label: "Ödenmedi" },
] as const;

// Para birimleri
export const PARA_BIRIMLERI = [
  { value: "TL", label: "TL", symbol: "₺" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "USD", label: "USD", symbol: "$" },
] as const;

// Ödeme planları  
export const ODEME_PLANLARI = [
  { value: "pesin", label: "Peşin" },
  { value: "cari", label: "Cari" },
] as const;

// Genişletilmiş ödeme planları (UI için)
export const ODEME_PLANLARI_EXTENDED = [
  { value: "pesin", label: "Peşin" },
  { value: "cari", label: "Cari" },
  { value: "firma_cari", label: "Firma Cari" },
] as const;

// Vize durumları (filtre için)
export const VISA_STATUSES = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Beklemede" },
  { value: "processing", label: "İşlemde" },
  { value: "approved", label: "Onaylandı" },
  { value: "rejected", label: "Reddedildi" },
] as const;

// Hedef ülkeler (öncelik sırasına göre)
export const TARGET_COUNTRIES = [
  { value: "all", label: "Tüm Ülkeler" },
  { value: "Yunanistan", label: "Yunanistan" },
  { value: "Almanya", label: "Almanya" },
  { value: "Çin", label: "Çin" },
  { value: "Fransa", label: "Fransa" },
  { value: "Hollanda", label: "Hollanda" },
  { value: "İtalya", label: "İtalya" },
  { value: "İspanya", label: "İspanya" },
  { value: "Belçika", label: "Belçika" },
  { value: "Avusturya", label: "Avusturya" },
  { value: "Portekiz", label: "Portekiz" },
  { value: "İsviçre", label: "İsviçre" },
  { value: "Polonya", label: "Polonya" },
  { value: "Çekya", label: "Çekya" },
  { value: "Macaristan", label: "Macaristan" },
  { value: "Danimarka", label: "Danimarka" },
  { value: "İsveç", label: "İsveç" },
  { value: "Norveç", label: "Norveç" },
  { value: "Finlandiya", label: "Finlandiya" },
  { value: "Estonya", label: "Estonya" },
  { value: "Letonya", label: "Letonya" },
  { value: "Litvanya", label: "Litvanya" },
  { value: "Slovenya", label: "Slovenya" },
  { value: "Slovakya", label: "Slovakya" },
  { value: "Hırvatistan", label: "Hırvatistan" },
  { value: "Malta", label: "Malta" },
  { value: "Lüksemburg", label: "Lüksemburg" },
  { value: "İzlanda", label: "İzlanda" },
  { value: "Liechtenstein", label: "Liechtenstein" },
  { value: "ABD", label: "ABD" },
  { value: "İngiltere", label: "İngiltere" },
  { value: "Kanada", label: "Kanada" },
  { value: "Suudi Arabistan", label: "Suudi Arabistan" },
  { value: "Güney Kore", label: "Güney Kore" },
] as const;

// Dosya durum badge'leri
export const FILE_STATUS_BADGES = {
  evrak_gelmedi: { label: "Evrak Gelmedi", color: "bg-yellow-100 text-yellow-700" },
  evrak_eksik: { label: "Evrak Eksik", color: "bg-orange-100 text-orange-700" },
  dosya_hazir: { label: "Dosya Hazır", color: "bg-blue-100 text-blue-700" },
  basvuru_yapildi: { label: "Başvuru Yapıldı", color: "bg-purple-100 text-purple-700" },
  islemden_cikti: { label: "İşlemden Çıktı", color: "bg-indigo-100 text-indigo-700" },
  vize_onay: { label: "Vize Onay", color: "bg-green-100 text-green-700" },
  red: { label: "Reddedildi", color: "bg-red-100 text-red-700" },
} as const;

// Hesap sahipleri
export const HESAP_SAHIPLERI = [
  { value: "DAVUT_TURGUT", label: "Davut Turgut" },
  { value: "SIRRI_TURGUT", label: "Sırrı Turgut" },
] as const;

// Cari tipleri
export const CARI_TIPLERI = [
  { value: "kullanici_cari", label: "Kullanıcı Cari" },
  { value: "firma_cari", label: "Firma Cari" },
] as const;

// Fatura tipleri
export const FATURA_TIPLERI = [
  { value: "isimli", label: "İsimli Fatura" },
  { value: "isimsiz", label: "İsimsiz Fatura" },
] as const;
