"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "staff" | "unknown";

interface GuideSection {
  icon: string;
  title: string;
  description: string;
  steps: string[];
}

const GM_GUIDE: GuideSection[] = [
  {
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
    title: "İlk Giriş",
    description: "Hesabınıza giriş yapın ve panele anında erişin.",
    steps: [
      "Platform sahibinden aldığınız e-posta ve şifre ile giriş yapın.",
      "Giriş yaptığınızda doğrudan Genel Müdür panelinize yönlendirilirsiniz.",
      "Şifrenizi değiştirmek isterseniz sağ üstteki profil menünüzden \"Profili Düzenle\" sayfasına girip yeni şifrenizi belirleyebilirsiniz.",
      "Şifrenizi unutursanız giriş ekranındaki \"Şifremi unuttum\" bağlantısı ile e-postanıza sıfırlama linki alabilirsiniz.",
    ],
  },
  {
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    title: "Profilim — Foto ve Şifre Yönetimi",
    description: "Sağ üstteki profil menüsünden \"Profili Düzenle\" diyerek hesap ayarlarınıza ulaşın.",
    steps: [
      "Sağ üstteki avatar / isim alanına tıklayın, açılan menüden \"Profili Düzenle\" seçeneğine girin.",
      "Profil fotoğrafı ekleyin (PNG/JPG/WEBP, max 5MB) — eklediğiniz foto sağ üst köşede ve tüm panel boyunca görünür.",
      "Aynı sayfadan istediğiniz zaman şifrenizi değiştirebilirsiniz.",
      "İstemezseniz profil fotoğrafını \"Kaldır\" butonu ile silebilirsiniz, sistem otomatik olarak isim baş harflerinize döner.",
    ],
  },
  {
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    title: "Ana Sayfa — Genel Bakış",
    description: "Giriş yaptığınızda karşınıza gelen kontrol paneli ile şirketinizin nabzını tutun.",
    steps: [
      "Aktif dosya sayısı, günün randevuları, ödenmemiş dosyalar ve toplam gelirinizi tek bakışta görün.",
      "Her personelin kaç dosyası olduğunu, yaklaşan randevularını ve tahsilat durumlarını takip edin.",
      "\"Son Aktiviteler\" bölümünden şirketinizdeki tüm giriş-çıkış ve dosya işlemlerini izleyin.",
    ],
  },
  {
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
    title: "Personel Ekleme",
    description: "Ekibinize yeni personel ekleyin ve onlara hemen çalışmaya başlamaları için hesap açın.",
    steps: [
      "Üst menüden Yönetim bölümüne girin ve Personel sayfasını açın.",
      "\"Yeni Personel Ekle\" butonuna tıklayın.",
      "Personelin adını, e-posta adresini ve geçici bir şifre belirleyin.",
      "Personel oluşturulduğunda kendisine otomatik hoş geldin e-postası gönderilir.",
      "Personel de ilk girişinde kendi şifresini belirlemek zorundadır.",
      "Her şirkette en fazla 3 personel hesabı oluşturabilirsiniz.",
    ],
  },
  {
    icon: "M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Yeni Vize Dosyası Oluşturma",
    description: "Müşterileriniz için hızlıca yeni vize dosyası açın.",
    steps: [
      "Üst menüden Operasyon bölümünü açın ve \"Yeni Dosya\" seçeneğine tıklayın.",
      "Müşterinin ad-soyad, pasaport numarası, hedef ülke ve vize tipini girin.",
      "Ücret bilgisi ve ödeme planını (peşin veya cari) seçin.",
      "Peşin ödeme seçerseniz tahsilat bilgilerini hemen girebilirsiniz.",
      "Dosya oluşturulduğunda size otomatik e-posta bildirimi gelir.",
    ],
  },
  {
    icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    title: "Dosya Yönetimi ve Takip",
    description: "Tüm vize dosyalarınızı tek ekrandan yönetin ve durumlarını takip edin.",
    steps: [
      "Operasyon bölümünden \"Vize Dosyaları\" sayfasını açın.",
      "Dosyaların durumlarını görün: evrak bekleniyor, işlemde, randevu alındı veya sonuçlandı.",
      "Herhangi bir dosyaya tıklayarak detaylarına ulaşın, güncelleme yapın.",
      "Dosya üzerinden tahsilat ekleyin, randevu tarihi girin veya sonuç kaydedin.",
    ],
  },
  {
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    title: "Müşteri Yönetimi",
    description: "Müşteri kartlarını görüntüleyin, geçmiş dosyalarını ve ödeme durumlarını inceleyin.",
    steps: [
      "Operasyon bölümünden \"Müşteriler\" sayfasını açın.",
      "Her müşterinin pasaport numarasına göre kartı otomatik oluşur.",
      "Müşteri kartına tıklayarak tüm geçmiş dosyaları, ödemeler ve detayları görün.",
    ],
  },
  {
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Vize Sonuç ve Görsel Takibi",
    description: "İşlemdeki dosyaların sonuçlarını girin ve pasaport/vize görsellerini arşivleyin.",
    steps: [
      "\"Vize Sonuç Takip\" sayfasından işlemdeki dosyaların onay veya red sonuçlarını girin.",
      "Sonuç girdiğinizde dosya otomatik olarak kapanır.",
      "\"Vize Görselleri\" sayfasından pasaport fotoğrafları ve vize görsellerini yükleyin.",
    ],
  },
  {
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    title: "Randevu İşlemleri",
    description: "Randevu taleplerini yönetin, takvimde takip edin ve vize bitiş tarihlerini kontrol edin.",
    steps: [
      "\"Randevu Alınacak\" sayfasından bekleyen randevu taleplerini görün ve işleme alın.",
      "\"Takvim\" sayfasında tüm randevuları günlük, haftalık veya aylık görünümde takip edin.",
      "\"Vize Bitiş Takibi\" sayfasından süresi dolacak vizeleri önceden görün ve müşterilerinizi bilgilendirin.",
    ],
  },
  {
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Finans ve Tahsilat",
    description: "Tüm finansal hareketlerinizi takip edin, tahsilat yapın ve cari hesapları yönetin.",
    steps: [
      "\"Kasa\" sayfasından nakit, EFT ve havale gibi tüm tahsilat hareketlerini takip edin.",
      "\"Banka Hesapları\" sayfasından hesaplarınızı ekleyin ve hareketleri görüntüleyin.",
      "\"Ödemeler\" sayfasında tüm tahsilat ve ödeme kayıtlarını listeleyin.",
      "\"Cari Hesap\" sayfasından müşteri bazlı borç ve alacak durumunu kontrol edin.",
    ],
  },
  {
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    title: "Raporlar",
    description: "Performans ve operasyon raporlarıyla işinizi analiz edin.",
    steps: [
      "\"Raporlar\" sayfasından personel performansını, dosya istatistiklerini ve operasyon verilerini inceleyin.",
      "\"Aylık Özet\" sayfasından aylık raporu PDF olarak indirin veya e-posta ile gönderin.",
      "\"Randevu Raporları\" sayfasından randevu analizlerinizi görüntüleyin.",
    ],
  },
  {
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    title: "Yönetim ve Loglar",
    description: "Personeli yönetin, müşteri grupları oluşturun ve tüm sistem kayıtlarını inceleyin.",
    steps: [
      "\"Personel\" sayfasından ekibinizi yönetin, yeni personel ekleyin veya düzenleyin.",
      "\"Gruplar\" sayfasından müşterilerinizi gruplandırın ve toplu işlem yapın.",
      "\"Sistem Logları\" sayfasından tüm giriş-çıkış, dosya ve ödeme işlemlerinin kaydını görün.",
    ],
  },
  {
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    title: "Bildirimler ve AI Asistan",
    description: "Bildirimleri takip edin ve Visora AI ile sorularınıza anında cevap alın.",
    steps: [
      "Sağ üstteki zil simgesine tıklayarak randevu hatırlatmaları, tahsilat bildirimleri ve uyarıları görün.",
      "Sağ üstteki AI simgesine tıklayarak Visora AI asistanını açın.",
      "Dosyalarınız, müşterileriniz ve işlemleriniz hakkında sorular sorun — anlık cevap alın.",
      "Visora AI'ya \"dilekçe yaz\" gibi bir komut verdiğinizde sizi otomatik olarak Dilekçe AI sayfasına yönlendirir.",
    ],
  },
  {
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Dilekçe AI — Otomatik Vize Dilekçesi",
    description: "Schengen vize başvuruları için saniyeler içinde profesyonel Türkçe ve İngilizce dilekçe oluşturun.",
    steps: [
      "Üst menüdeki \"Dilekçe AI\" linkine tıklayarak sayfaya girin.",
      "Müşteri adını yazmaya başlayın — aktif vize dosyalarınızdaki müşteriler anında listelenir, seçtiğinizde ad-soyad, pasaport no ve ülke otomatik dolar.",
      "Dilekçe Türü seçin: Bireysel (başvuru sahibi ağzından) veya Şirket (şirket ağzından).",
      "Başvuru Şehri yazın — Ankara için \"Büyükelçiliği\", diğer şehirler için \"Başkonsolosluğu\" otomatik kullanılır.",
      "Kategori (Ticari / Turistik / Aile / Arkadaş / Eğitim) ve seyahat tarihlerini girin.",
      "Çalışma durumuna göre açılan ek alanları (şirket, davet eden, sponsor, akraba yakınlığı vb.) doldurun.",
      "İsterseniz en alttaki \"Ekstra Bilgi\" kutusuna AI'nın dikkate almasını istediğiniz özel detayları yazın.",
      "\"Dilekçe Oluştur\" butonuna basın — AI yazarken Türkçe sekmesinde gerçek zamanlı görürsünüz.",
      "İngilizce dilekçe Türkçe bittikten sonra ikinci sekmede otomatik açılır. Kopyala butonu ile o anki dili kopyalayabilirsiniz.",
    ],
  },
];

const STAFF_GUIDE: GuideSection[] = [
  {
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
    title: "İlk Giriş",
    description: "Genel müdürünüzden aldığınız bilgilerle giriş yapın.",
    steps: [
      "Genel müdürünüzden aldığınız e-posta ve şifre ile giriş yapın.",
      "Giriş yaptığınızda doğrudan kişisel personel panelinize yönlendirilirsiniz.",
      "Şifrenizi değiştirmek isterseniz sağ üstteki profil menünüzden \"Profili Düzenle\" sayfasına girip kolayca güncelleyebilirsiniz.",
      "Şifrenizi unutursanız giriş ekranındaki \"Şifremi unuttum\" bağlantısı ile e-posta üzerinden sıfırlayabilirsiniz.",
    ],
  },
  {
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    title: "Profilim — Foto ve Şifre",
    description: "Sağ üstteki profil menüsünden \"Profili Düzenle\" diyerek profil ayarlarınıza erişin.",
    steps: [
      "Sağ üstteki avatar / isim alanına tıklayın, \"Profili Düzenle\" seçeneğine girin.",
      "Profil fotoğrafı yükleyin (PNG/JPG/WEBP, max 5MB).",
      "Yüklediğiniz foto sağ üst köşede ve sistem genelinde sizi temsil eder.",
      "Aynı sayfadan istediğiniz an şifrenizi de değiştirebilirsiniz.",
    ],
  },
  {
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    title: "Ana Sayfa — Kişisel Panelim",
    description: "Size atanan dosyaların özetini ve kişisel performansınızı tek bakışta görün.",
    steps: [
      "Aktif dosya sayınız, yaklaşan randevularınız ve ödenmemiş dosyalarınız burada görünür.",
      "Haftalık istatistiklerinizi takip edin: bu hafta oluşturduğunuz dosyalar ve tahsilatlar.",
      "\"Son Aktiviteler\" bölümünden yalnızca kendi yaptığınız işlemleri görürsünüz.",
    ],
  },
  {
    icon: "M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Vize Dosyası Oluşturma ve Yönetme",
    description: "Müşteriler için dosya açın, mevcut dosyalarınızı takip edin ve güncelleyin.",
    steps: [
      "Operasyon menüsünden \"Yeni Dosya\" seçeneğiyle yeni vize dosyası oluşturun.",
      "Müşterinin bilgilerini, hedef ülkeyi, vize tipini ve ücret bilgilerini girin.",
      "\"Vize Dosyaları\" sayfasından size atanmış tüm dosyaları görün.",
      "Dosyalara tıklayarak detaylarını görüntüleyin, tahsilat ekleyin veya durumu güncelleyin.",
    ],
  },
  {
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    title: "Müşterilerim",
    description: "Size bağlı müşterilerin kartlarını görüntüleyin ve geçmişlerini inceleyin.",
    steps: [
      "Operasyon menüsünden \"Müşteriler\" sayfasını açın.",
      "Size bağlı olan müşterilerin listesini görürsünüz.",
      "Müşteri kartına tıklayarak geçmiş dosyalarını ve tüm detaylarını inceleyin.",
    ],
  },
  {
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Vize Sonuç ve Görsel Takibi",
    description: "Dosyalarınızın sonuçlarını takip edin ve görselleri yönetin.",
    steps: [
      "\"Vize Sonuç Takip\" sayfasından kendi dosyalarınızın onay veya red sonuçlarını izleyin.",
      "\"Vize Görselleri\" sayfasından pasaport ve vize görsellerini yükleyin veya görüntüleyin.",
    ],
  },
  {
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    title: "Randevu İşlemleri",
    description: "Size atanan randevuları takip edin ve takvimde görüntüleyin.",
    steps: [
      "\"Randevu Alınacak\" sayfasından size atanan bekleyen randevu taleplerini görün.",
      "\"Takvim\" sayfasında randevularınızı günlük veya haftalık olarak görüntüleyin.",
      "\"Vize Bitiş Takibi\" sayfasından süresi dolacak vizeleri kontrol edin.",
    ],
  },
  {
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Finans",
    description: "Tahsilatlarınızı ve cari hesabınızı takip edin.",
    steps: [
      "\"Ödemeler\" sayfasından oluşturduğunuz tahsilat ve ödeme kayıtlarını görün.",
      "\"Cari Hesabım\" sayfasından kendi dosyalarınızdaki borç ve alacak durumunu takip edin.",
    ],
  },
  {
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    title: "Raporlar",
    description: "Kişisel performansınızı analiz edin ve raporlarınızı inceleyin.",
    steps: [
      "\"Raporlarım\" sayfasından kişisel dosya ve performans istatistiklerinizi görün.",
      "\"Aylık Özet\" sayfasından aylık raporunuzu görüntüleyin.",
      "\"Randevu Raporları\" sayfasından randevu analizlerinizi inceleyin.",
    ],
  },
  {
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    title: "Bildirimler ve AI Asistan",
    description: "Bildirimleri takip edin ve Visora AI ile sorularınıza anında cevap alın.",
    steps: [
      "Sağ üstteki zil simgesine tıklayarak randevu hatırlatmaları ve uyarılarınızı görün.",
      "Sağ üstteki AI simgesine tıklayarak Visora AI asistanını açın.",
      "Dosyalarınız ve müşterileriniz hakkında sorular sorun — anlık cevap alın.",
      "Visora AI'ya \"dilekçe yaz\" gibi bir komut verdiğinizde sizi otomatik olarak Dilekçe AI sayfasına yönlendirir.",
    ],
  },
  {
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Dilekçe AI — Otomatik Vize Dilekçesi",
    description: "Schengen vize başvuruları için Türkçe ve İngilizce profesyonel dilekçeyi saniyeler içinde oluşturun.",
    steps: [
      "Üst menüdeki \"Dilekçe AI\" linkine tıklayın.",
      "Müşteri arama kutusuna isim yazmaya başlayın — sizin oluşturduğunuz aktif vize dosyalarındaki müşteriler listelenir.",
      "Müşteriyi seçtiğinizde ad-soyad, pasaport no ve ülke otomatik dolar.",
      "Dilekçe Türü (Bireysel / Şirket), Başvuru Şehri (Ankara → Büyükelçiliği, diğer şehirler → Başkonsolosluğu), kategori ve seyahat tarihlerini girin.",
      "Çalışma durumuna göre açılan ek alanları doldurun.",
      "İsterseniz \"Ekstra Bilgi\" kutusuna AI'nın dikkate almasını istediğiniz özel detayları yazın.",
      "\"Dilekçe Oluştur\" butonuna basın — dilekçe yazılırken canlı görürsünüz.",
      "Türkçe ve İngilizce dilekçeler ayrı sekmelerde gösterilir, tek tıkla kopyalayabilirsiniz.",
    ],
  },
];

export default function NasilKullanilirPage() {
  const [role, setRole] = useState<Role>("unknown");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function detect() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", user.id)
            .single();
          if (profile) {
            setRole(profile.role === "admin" ? "admin" : "staff");
            setUserName(profile.name || "");
          }
        }
      } catch { /* giriş yapılmamışsa unknown kalır */ }
      setLoading(false);
    }
    detect();
  }, []);

  const guide = role === "admin" ? GM_GUIDE : STAFF_GUIDE;
  const roleLabel = role === "admin" ? "Genel Müdür" : "Personel";
  const gradientFrom = role === "admin" ? "from-indigo-600" : "from-violet-600";
  const gradientTo = role === "admin" ? "to-violet-600" : "to-fuchsia-600";
  const accentBg = role === "admin" ? "bg-indigo-50" : "bg-violet-50";
  const accentText = role === "admin" ? "text-indigo-700" : "text-violet-700";
  const accentRing = role === "admin" ? "ring-indigo-200" : "ring-violet-200";
  const iconBg = role === "admin" ? "from-indigo-500 to-violet-500" : "from-violet-500 to-fuchsia-500";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (role === "unknown") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <Image src="/visora-logo.png" alt="Visora" fill className="object-contain" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Nasıl Kullanılır?</h1>
          <p className="text-slate-500 text-sm">
            Kullanım rehberini görmek için lütfen önce giriş yapın. Rolünüze göre otomatik olarak size özel rehber gösterilecektir.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg hover:shadow-xl transition-all"
          >
            Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${gradientFrom} ${gradientTo}`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2ek0yNCA0OGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMC0xMmMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <Link
            href={role === "admin" ? "/admin/dashboard" : "/app"}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Panelime dön
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
              <Image src="/visora-logo.png" alt="Visora" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Nasıl Kullanılır?
              </h1>
              <p className="text-white/70 text-sm mt-0.5">
                {userName ? `${userName}, ` : ""}adım adım {roleLabel.toLowerCase()} rehberiniz
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 text-white text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {role === "admin" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              )}
            </svg>
            {roleLabel} Rehberi — {guide.length} bölüm
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="space-y-5">
          {guide.map((section, idx) => (
            <div
              key={idx}
              className="group rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <div className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${accentText}`}>
                      Adım {idx + 1}
                    </span>
                  </div>
                  <h2 className="text-[17px] font-extrabold text-slate-900 leading-snug">
                    {section.title}
                  </h2>
                  <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                    {section.description}
                  </p>
                </div>
              </div>

              <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                <div className={`rounded-xl ${accentBg} ring-1 ${accentRing} p-4`}>
                  <ul className="space-y-3">
                    {section.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-[13.5px] text-slate-700 leading-relaxed">
                        <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${iconBg} text-white flex items-center justify-center text-[10px] font-bold shadow-sm`}>
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-14 text-center space-y-4">
          <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl ${accentBg} ring-1 ${accentRing}`}>
            <svg className={`w-5 h-5 ${accentText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className={`text-sm font-medium ${accentText}`}>
              Herhangi bir sorunuz varsa paneldeki <strong>Visora AI</strong> asistanını kullanabilirsiniz.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Visora &copy; {new Date().getFullYear()} &middot; Vize ofisleri için modern yönetim platformu
          </p>
        </div>
      </main>
    </div>
  );
}
