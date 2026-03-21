# 🇨🇳 Vize Form Doldur - Chrome Eklentisi

**Çin Konsolosluğu vize başvuru formlarını otomatik dolduran akıllı Chrome eklentisi**

## 🚀 Özellikler

- ✅ **Çoklu Profil Desteği** - Birden fazla kişinin bilgilerini kaydedin
- ✅ **Kalıcı Veri Saklama** - Bilgileriniz güvenle saklanır
- ✅ **Akıllı Form Doldurma** - Tek tıkla tüm alanları doldurun
- ✅ **Modern Arayüz** - Kullanıcı dostu ve şık tasarım
- ✅ **Otomatik Seçimler** - Türkiye, Ordinary, No seçenekleri otomatik
- ✅ **Hata Yönetimi** - Akıllı hata kontrolü ve bildirimler

## 📋 Doldurduğu Alanlar

### 1. Temel Bilgiler
- **Ülke**: Türkiye (otomatik)
- **Ad**: Profilinizden
- **Soyad**: Profilinizden
- **Cinsiyet**: Seçtiğiniz cinsiyet
- **TC Kimlik No**: 11 haneli TC numaranız

### 2. Uyruk Soruları
- **Başka uyruğunuz var mı?** → Hayır (otomatik)
- **Başka ülkede ikamet hakkınız var mı?** → Hayır (otomatik)
- **Daha önce başka uyruğunuz oldu mu?** → Hayır (otomatik)

### 3. Pasaport Bilgileri
- **Pasaport Türü**: Ordinary (otomatik)
- **Pasaport Numarası**: Profilinizden

## 🛠️ Kurulum

### 1. İkonları Ekleyin
`icons/` klasörüne aşağıdaki boyutlarda PNG dosyaları ekleyin:
- `icon16.png` (16x16 piksel)
- `icon32.png` (32x32 piksel)
- `icon48.png` (48x48 piksel)
- `icon128.png` (128x128 piksel)

### 2. Chrome'a Yükleyin
1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üst köşeden "Geliştirici modu"nu açın
3. "Paketlenmemiş uzantı yükle" butonuna tıklayın
4. Bu klasörü seçin (`FOXS`)

### 3. İzinleri Onaylayın
Eklenti şu izinleri iseyecek:
- **Storage**: Profil verilerinizi kaydetmek için
- **ActiveTab**: Aktif sekmeye erişim için
- **consular.mfa.gov.cn**: Vize sitesinde çalışmak için

## 🎯 Kullanım

### 1. Profil Oluşturma
1. Eklenti simgesine tıklayın
2. "Yeni Profil" butonuna basın
3. Bilgilerinizi doldurun:
   - Profil adı (örn: "Ali Veli Profili")
   - Ad ve soyad
   - TC Kimlik numarası (11 hane)
   - Pasaport numarası
   - Cinsiyet
4. "Profili Kaydet" butonuna basın

### 2. Form Doldurma
1. https://consular.mfa.gov.cn/VISA/visa/visaform adresine gidin
2. Eklenti simgesine tıklayın
3. Kullanmak istediğiniz profili seçin
4. "Formu Doldur" butonuna basın
5. Form otomatik olarak doldurulacak! 🚀

### 3. Profil Yönetimi
- **Profil Düzenleme**: Profil seçip bilgileri değiştirin ve kaydedin
- **Profil Silme**: Profil seçip 🗑️ butonuna basın
- **Çoklu Profil**: Aile için birden fazla profil oluşturun

## 🔧 Teknik Detaylar

### Dosya Yapısı
```
FOXS/
├── manifest.json          # Eklenti konfigürasyonu
├── popup.html            # Ana arayüz
├── popup.js              # Arayüz mantığı
├── styles.css            # Stil dosyaları
├── content.js            # Form doldurma scripti
├── background.js         # Arka plan işlemleri
├── icons/                # İkon dosyaları (eklemeniz gerek)
└── README.md            # Bu dosya
```

### Güvenlik
- Tüm veriler Chrome'un güvenli storage sisteminde saklanır
- Veriler sadece kendi bilgisayarınızda tutulur
- Hiçbir veri dış sunuculara gönderilmez

## 🐛 Sorun Giderme

### "Form doldurulamadı" Hatası
1. Sayfayı yenileyin (F5)
2. Eklentiyi devre dışı bırakıp tekrar etkinleştirin
3. Chrome'u yeniden başlatın

### Profil Kaydedemiyorum
1. Tüm zorunlu alanları doldurun
2. TC numarasının 11 haneli olduğundan emin olun
3. Profil adının boş olmadığını kontrol edin

### İkonlar Görünmüyor
1. `icons/` klasörüne PNG dosyaları ekleyin
2. Dosya boyutlarının doğru olduğundan emin olun
3. Eklentiyi yeniden yükleyin

## 💡 İpuçları

- **Hızlı Erişim**: Chrome araç çubuğuna sabitleyin
- **Yedekleme**: Profilleri kaydetmek için Chrome'un senkronizasyonunu açın
- **Test Edin**: İlk kullanımda test profili oluşturup deneyin
- **Güncelleme**: Vize sitesi değişirse eklentiyi güncelleyin

## 📞 Destek

Sorunlarınız için:
1. Bu README dosyasını tekrar okuyun
2. Chrome konsolunu kontrol edin (F12 → Console)
3. Eklentiyi yeniden yüklemeyi deneyin

## 🏆 Başarılı Kullanım

✅ **Profil oluşturuldu**  
✅ **Form başarıyla dolduruldu**  
✅ **Zaman tasarrufu sağlandı**  
✅ **Hatasız başvuru hazır**  

---

**🎉 Hayırlı olsun! Vize başvurunuz artık çok daha kolay!**