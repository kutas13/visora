# Fox Turizm - Vize Yönetim Sistemi

Fox Turizm için geliştirilmiş vize dosyası takip ve yönetim sistemi.

## Teknolojiler

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Auth + Database + RLS)

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Supabase Projesi Oluştur

1. [Supabase](https://supabase.com) üzerinde yeni bir proje oluşturun
2. Project Settings > API'den URL ve anon key'i kopyalayın

### 3. Ortam Değişkenlerini Ayarla

`.env.local` dosyası oluşturun:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Veritabanı Şemasını Oluştur

Supabase SQL Editor'da `supabase/migrations/001_initial_schema.sql` dosyasını çalıştırın.

### 5. Kullanıcıları Oluştur

Supabase Dashboard > Authentication > Users'dan kullanıcıları oluşturun:

| Kullanıcı | Email | Rol | Şifre |
|-----------|-------|-----|-------|
| DAVUT | info@foxturizm.com | admin | (belirlediğiniz şifre) |
| BAHAR | vize@foxturizm.com | staff | (belirlediğiniz şifre) |
| ERCAN | ercan@foxturizm.com | staff | (belirlediğiniz şifre) |
| YUSUF | yusuf@foxturizm.com | staff | (belirlediğiniz şifre) |

Ardından `supabase/seed_users.sql` dosyasındaki talimatları izleyerek profiles tablosuna kayıtları ekleyin.

### 6. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Sayfalar

### Personel (/app)
- `/login` - Personel girişi
- `/app` - Ana sayfa (özet kartlar + son işlemler)
- `/app/files` - Vize dosyaları (oluştur, düzenle, durum güncelle)
- `/app/calendar` - Randevu takvimi
- `/app/vize-bitisi` - Vize bitiş takibi
- `/app/groups` - Gruplar
- `/app/payments` - Ödemeler
- `/app/bildirimler` - Bildirimler

### Yönetici (/admin)
- `/admin` - Yönetici girişi
- `/admin/dashboard` - Dashboard (istatistikler + performans)
- `/admin/files` - Tüm vize dosyaları
- `/admin/vize-bitisi` - Tüm vize bitiş takibi
- `/admin/groups` - Gruplar
- `/admin/payments` - Ödemeler
- `/admin/logs` - Sistem logları

## Kullanıcılar

| İsim | Rol | Email |
|------|-----|-------|
| DAVUT | Admin | info@foxturizm.com |
| BAHAR | Staff | vize@foxturizm.com |
| ERCAN | Staff | ercan@foxturizm.com |
| YUSUF | Staff | yusuf@foxturizm.com |

## Veritabanı Tabloları

### profiles
Kullanıcı profilleri (auth.users ile eşleşir)

### visa_files
Ana vize dosyası tablosu:
- Müşteri bilgileri (ad, pasaport no)
- İşlem tipi (randevulu/randevusuz)
- Evrak durumu ve eksik takibi
- Dosya durumu aşamaları (hazır, başvuru, işlemden çıktı, sonuç)
- Vize sonucu ve bitiş tarihi

### payments
Ödeme kayıtları

### activity_logs
Sistem aktivite logları

### notifications
Bildirim merkezi (cron'a hazır altyapı)

## RLS (Row Level Security)

- **Admin**: Tüm verilere erişim
- **Staff**: Sadece kendi dosyalarına erişim

## Proje Yapısı

```
src/
├── app/
│   ├── (admin)/          # Admin layout grubu
│   ├── (staff)/          # Personel layout grubu
│   ├── admin/            # Admin giriş sayfası
│   └── login/            # Personel giriş sayfası
├── components/
│   ├── files/            # Dosya bileşenleri
│   ├── layout/           # Layout bileşenleri
│   └── ui/               # UI bileşenleri
├── hooks/
│   └── useAuth.ts        # Auth hook
├── lib/
│   ├── supabase/         # Supabase client ve tipler
│   ├── auth.ts           # Auth helper'lar
│   └── constants.ts      # Sabitler
└── middleware.ts         # Route koruması
```

## Gelecek Geliştirmeler

- [ ] Bildirim cron job'ları
- [ ] E-posta entegrasyonu
- [ ] Dosya yükleme (evraklar)
- [ ] Raporlama modülü
