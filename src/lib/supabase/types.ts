// Temel tipler
export type IslemTipi = "randevulu" | "randevusuz";
export type EvrakDurumu = "gelmedi" | "geldi";
export type VizeSonucu = "vize_onay" | "red";

// Ödeme yöntemi
export type OdemeYontemi = "nakit" | "hesaba" | "pos";

// Ödeme durumu
export type OdemeDurumu = "odendi" | "odenmedi";

// Para birimi
export type ParaBirimi = "TL" | "EUR" | "USD";

// Ödeme planı
export type OdemePlani = "pesin" | "cari";

// Ödeme tipi
export type PaymentType = "pesin_satis" | "tahsilat" | "firma_cari";

// Hesap sahipleri
export type HesapSahibi = "DAVUT_TURGUT" | "SIRRI_TURGUT";

// Cari tipi
export type CariTipi = "kullanici_cari" | "firma_cari";

// Fatura tipi
export type FaturaTipi = "isimli" | "isimsiz";

// Profil
export interface Profile {
  id: string;
  name: string;
  role: "admin" | "staff" | "muhasebe";
  created_at: string;
}

// Şirket
export interface Company {
  id: string;
  firma_adi: string;
  created_at: string;
  created_by: string;
}

// Vize dosyası
export interface VisaFile {
  id: string;
  musteri_ad: string;
  pasaport_no: string;
  hedef_ulke: string;
  ulke_manuel_mi: boolean;
  islem_tipi: IslemTipi;
  randevu_tarihi: string | null;
  evrak_durumu: EvrakDurumu;
  evrak_eksik_mi: boolean | null;
  evrak_not: string | null;
  eksik_kayit_tarihi: string | null;
  dosya_hazir: boolean;
  dosya_hazir_at: string | null;
  basvuru_yapildi: boolean;
  basvuru_yapildi_at: string | null;
  islemden_cikti: boolean;
  islemden_cikti_at: string | null;
  sonuc: VizeSonucu | null;
  sonuc_tarihi: string | null;
  vize_bitis_tarihi: string | null;
  assigned_user_id: string;
  arsiv_mi: boolean;
  ucret: number;
  ucret_currency: ParaBirimi;
  davetiye_ucreti: number | null;
  davetiye_ucreti_currency: ParaBirimi | null;
  gunluk_rapor_gonderildi: boolean;
  odeme_plani: OdemePlani;
  odeme_durumu: OdemeDurumu;
  // Yeni ödeme detayları
  hesap_sahibi: HesapSahibi | null;
  cari_tipi: CariTipi | null;
  cari_sahibi: string | null; // "DAVUT" veya personel adı (kullanici_cari için)
  company_id: string | null;
  fatura_tipi: FaturaTipi | null;
  on_odeme_tutar: number | null;
  on_odeme_currency: ParaBirimi | null;
  kalan_tutar: number | null;
  musteri_telefon: string | null;
  vize_tipleri: string[];
  tahmini_cikis_tarihi: string | null;
  vize_gorseli: string | null;
  created_at: string;
  updated_at: string;
}

// Grup
export interface Group {
  id: string;
  grup_adi: string;
  aciklama: string | null;
  created_by: string | null;
  created_at: string;
}

// Grup üyesi
export interface GroupMember {
  id: string;
  group_id: string;
  visa_file_id: string;
  created_at: string;
}

// Profil ile vize dosyası
export interface VisaFileWithProfile extends VisaFile {
  profiles: Pick<Profile, "name"> | null;
}

// Ödeme
export interface Payment {
  id: string;
  file_id: string;
  tutar: number;
  yontem: OdemeYontemi;
  durum: OdemeDurumu;
  currency: ParaBirimi;
  payment_type: PaymentType;
  /** POS’ta karttan çekilen döviz tutarı (bilgi amaçlı) */
  pos_doviz_tutar?: number | null;
  /** POS’ta karttan çekilen döviz: USD veya EUR */
  pos_doviz_currency?: ParaBirimi | null;
  created_at: string;
  created_by: string;
}

// Aktivite logu
export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  file_id: string | null;
  actor_id: string;
  created_at: string;
}

// iDATA Randevu Ataması
export type IdataAssignmentDurum = "yeni" | "randevu_geldi" | "randevu_alindi" | "iptal" | "suresi_doldu";

export interface IdataAssignment {
  id: string;
  musteri_ad: string;
  pnr: string;
  ulke_amac: string | null;
  ofis: string | null;
  randevu_baslangic: string | null;
  randevu_bitis: string | null;
  son_kayit_tarihi: string | null;
  email_hesabi: string;
  email_uid: string;
  durum: IdataAssignmentDurum;
  whatsapp_bildirim: boolean;
  created_at: string;
}

// Bildirim
export interface Notification {
  id: string;
  user_id: string;
  file_id: string | null;
  kind: string;
  title: string;
  body: string;
  scheduled_for: string | null;
  sent_at: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  unique_key: string | null;
}

// Randevu Talebi
export type RandevuVizeTipi = "turistik" | "ticari" | "ogrenci" | "konferans" | "aile" | "arkadas";
export type RandevuAltKategori = "ilk_vize" | "multi_vize";

export interface RandevuTalebi {
  id: string;
  ulkeler: string[];
  vize_tipi: RandevuVizeTipi;
  alt_kategori: RandevuAltKategori | null;
  dosya_adi: string;
  iletisim: string;
  gorseller: string[];
  randevu_tarihi: string | null;
  randevu_alan_id: string | null;
  arsivlendi: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RandevuTalebiWithProfile extends RandevuTalebi {
  profiles: Pick<Profile, "name"> | null;
  randevu_alan: Pick<Profile, "name"> | null;
}

// Veritabanı tipleri
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Profile>;
      };
      visa_files: {
        Row: VisaFile;
        Insert: {
          id?: string;
          musteri_ad: string;
          pasaport_no: string;
          hedef_ulke: string;
          ulke_manuel_mi?: boolean;
          islem_tipi: IslemTipi;
          randevu_tarihi?: string | null;
          evrak_durumu?: EvrakDurumu;
          evrak_eksik_mi?: boolean | null;
          evrak_not?: string | null;
          eksik_kayit_tarihi?: string | null;
          dosya_hazir?: boolean;
          dosya_hazir_at?: string | null;
          basvuru_yapildi?: boolean;
          basvuru_yapildi_at?: string | null;
          islemden_cikti?: boolean;
          islemden_cikti_at?: string | null;
          sonuc?: VizeSonucu | null;
          sonuc_tarihi?: string | null;
          vize_bitis_tarihi?: string | null;
          assigned_user_id: string;
          arsiv_mi?: boolean;
          ucret?: number;
          ucret_currency?: ParaBirimi;
          davetiye_ucreti?: number | null;
          davetiye_ucreti_currency?: ParaBirimi | null;
          gunluk_rapor_gonderildi?: boolean;
          odeme_plani?: OdemePlani;
          odeme_durumu?: OdemeDurumu;
          hesap_sahibi?: HesapSahibi | null;
          cari_tipi?: CariTipi | null;
          cari_sahibi?: string | null;
          company_id?: string | null;
          fatura_tipi?: FaturaTipi | null;
          on_odeme_tutar?: number | null;
          on_odeme_currency?: ParaBirimi | null;
          kalan_tutar?: number | null;
          musteri_telefon?: string | null;
          vize_tipleri?: string[];
          tahmini_cikis_tarihi?: string | null;
          vize_gorseli?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          musteri_ad?: string;
          pasaport_no?: string;
          hedef_ulke?: string;
          ulke_manuel_mi?: boolean;
          islem_tipi?: IslemTipi;
          randevu_tarihi?: string | null;
          evrak_durumu?: EvrakDurumu;
          evrak_eksik_mi?: boolean | null;
          evrak_not?: string | null;
          eksik_kayit_tarihi?: string | null;
          dosya_hazir?: boolean;
          dosya_hazir_at?: string | null;
          basvuru_yapildi?: boolean;
          basvuru_yapildi_at?: string | null;
          islemden_cikti?: boolean;
          islemden_cikti_at?: string | null;
          sonuc?: VizeSonucu | null;
          sonuc_tarihi?: string | null;
          vize_bitis_tarihi?: string | null;
          assigned_user_id?: string;
          arsiv_mi?: boolean;
          ucret?: number;
          ucret_currency?: ParaBirimi;
          davetiye_ucreti?: number | null;
          davetiye_ucreti_currency?: ParaBirimi | null;
          gunluk_rapor_gonderildi?: boolean;
          odeme_plani?: OdemePlani;
          odeme_durumu?: OdemeDurumu;
          cari_sahibi?: string | null;
          vize_gorseli?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      visa_groups: {
        Row: Group;
        Insert: {
          id?: string;
          grup_adi: string;
          aciklama?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Group>;
      };
      visa_group_members: {
        Row: GroupMember;
        Insert: {
          id?: string;
          group_id: string;
          visa_file_id: string;
          created_at?: string;
        };
        Update: Partial<GroupMember>;
      };
      payments: {
        Row: Payment;
        Insert: {
          id?: string;
          file_id: string;
          tutar: number;
          yontem: OdemeYontemi;
          durum?: OdemeDurumu;
          currency?: ParaBirimi;
          payment_type?: PaymentType;
          pos_doviz_tutar?: number | null;
          pos_doviz_currency?: ParaBirimi | null;
          created_at?: string;
          created_by: string;
        };
        Update: Partial<Payment>;
      };
      activity_logs: {
        Row: ActivityLog;
        Insert: {
          id?: string;
          type: string;
          message: string;
          file_id?: string | null;
          actor_id: string;
          created_at?: string;
        };
        Update: Partial<ActivityLog>;
      };
      idata_assignments: {
        Row: IdataAssignment;
        Insert: {
          id?: string;
          musteri_ad: string;
          pnr: string;
          ulke_amac?: string | null;
          ofis?: string | null;
          randevu_baslangic?: string | null;
          randevu_bitis?: string | null;
          son_kayit_tarihi?: string | null;
          email_hesabi: string;
          email_uid: string;
          durum?: IdataAssignmentDurum;
          whatsapp_bildirim?: boolean;
          created_at?: string;
        };
        Update: Partial<IdataAssignment>;
      };
      notifications: {
        Row: Notification;
        Insert: {
          id?: string;
          user_id: string;
          file_id?: string | null;
          kind: string;
          title: string;
          body: string;
          scheduled_for?: string | null;
          sent_at?: string | null;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
          unique_key?: string | null;
        };
        Update: Partial<Notification>;
      };
      companies: {
        Row: Company;
        Insert: {
          id?: string;
          firma_adi: string;
          created_at?: string;
          created_by: string;
        };
        Update: Partial<Company>;
      };
      randevu_talepleri: {
        Row: RandevuTalebi;
        Insert: {
          id?: string;
          ulkeler: string[];
          vize_tipi: RandevuVizeTipi;
          alt_kategori?: RandevuAltKategori | null;
          dosya_adi: string;
          iletisim: string;
          gorseller?: string[];
          randevu_tarihi?: string | null;
          randevu_alan_id?: string | null;
          arsivlendi?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RandevuTalebi>;
      };
    };
  };
}
