// Kullanıcı listesi (email + telefon + hitap mapping ile)
export const STAFF_USERS = [
  { id: "bahar", name: "BAHAR", email: "vize@foxturizm.com", phone: "0505 562 32 79", hitap: "Bahar Hanım" },
  { id: "ercan", name: "ERCAN", email: "ercan@foxturizm.com", phone: "0505 562 33 01", hitap: "Ercan Bey" },
  { id: "yusuf", name: "YUSUF", email: "yusuf@foxturizm.com", phone: "0505 893 70 71", hitap: "Yusuf Bey" },
] as const;

export const ADMIN_USER = { 
  id: "davut", 
  name: "DAVUT", 
  email: "info@foxturizm.com",
  phone: "0543 568 08 74",
  hitap: "Davut Bey"
};

export const MUHASEBE_USER = { 
  id: "sirri", 
  name: "SIRRI", 
  email: "muhasebe@foxturizm.com",
  phone: "0507 801 50 33",
  hitap: "Sırrı Bey"
};

export const FEHMI_USER = {
  id: "fehmi",
  name: "FEHMİ",
  email: "",
  phone: "0505 562 31 70",
  hitap: "Fehmi Bey"
};

// Tüm kullanıcılar
export const ALL_USERS = [...STAFF_USERS, ADMIN_USER, MUHASEBE_USER, FEHMI_USER];

// Email'den kullanıcı bul
export function getUserByEmail(email: string) {
  return ALL_USERS.find(u => u.email === email);
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
