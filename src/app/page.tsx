import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visora — Vize ofisleri için modern yönetim platformu",
  description:
    "Visora, vize ofisleri için dosya, müşteri, randevu, tahsilat ve raporlama süreçlerini tek panelde yönetir.",
};

const WHATSAPP_NUMBER = "905538344513";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Merhaba, Visora platformuna firma hesabı açmak istiyorum. Bilgi alabilir miyim?"
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

const features = [
  {
    title: "Vize Dosya Takibi",
    desc: "Müşteri kaydından vize sonucuna kadar tüm dosya akışını şeffaf ve denetlenebilir şekilde yönet.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Randevu Yönetimi",
    desc: "iDATA / VFS / konsolosluk randevularını listele, otomatik hatırlatmalarla ekibinin yükünü hafiflet.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Tahsilat & Cari Hesap",
    desc: "Peşin, cari, firma cari ödemelerini takip et; aylık prim ve gelir raporlarını saniyeler içinde al.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Ekip & Roller",
    desc: "Genel müdür ve personel rolleriyle dosya atama, yetkilendirme ve günlük rapor takibi tek panelde.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "WhatsApp Entegrasyonu",
    desc: "Müşterilere otomatik bilgilendirme, randevu hatırlatma ve yorum talebi mesajları gönder.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    title: "Akıllı Raporlama",
    desc: "Aylık özet, prim takibi, vize bitişi ve müşteri analizi raporlarıyla işini veriyle yönet.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] text-navy-900 overflow-x-hidden">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/75 border-b border-navy-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
              <Image
                src="/visora-logo.png"
                alt="Visora"
                fill
                priority
                className="object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <p className="font-extrabold text-navy-900 leading-none text-lg tracking-tight">visora</p>
              <p className="text-[10px] text-navy-500 mt-0.5">Vize Yönetim Platformu</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-navy-700">
            <a href="#ozellikler" className="hover:text-primary-600 transition-colors">Özellikler</a>
            <a href="#nasil" className="hover:text-primary-600 transition-colors">Nasıl Çalışır</a>
            <a href="#iletisim" className="hover:text-primary-600 transition-colors">İletişim</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
            >
              Giriş Yap
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-600 shadow-visora hover:shadow-visora-lg transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span className="hidden sm:inline">Kayıt Ol</span>
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-32 w-[420px] h-[420px] rounded-full bg-primary-300/30 blur-3xl" />
          <div className="absolute top-40 -right-32 w-[520px] h-[520px] rounded-full bg-accent-300/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-[360px] h-[360px] rounded-full bg-lilac-300/30 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-primary-200 text-primary-700 text-xs font-semibold shadow-sm mb-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
              </span>
              SaaS · Türkiye
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-900 leading-[1.05] tracking-tight">
              Vize ofisinizi
              <br />
              <span className="bg-gradient-to-r from-primary-500 via-primary-600 to-accent-600 bg-clip-text text-transparent">
                tek panelden yönetin.
              </span>
            </h1>
            <p className="mt-6 text-lg text-navy-600 max-w-xl leading-relaxed">
              Visora; vize dosyaları, randevular, tahsilatlar, müşteri ilişkileri ve ekip operasyonları için
              hazırlanmış uçtan uca bir SaaS platformudur. Genel müdür ve personel rolleriyle her şey kontrolünüz altında.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-600 shadow-visora hover:shadow-visora-lg transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp ile Kayıt Ol
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-navy-800 bg-white border border-navy-200 hover:border-primary-400 hover:text-primary-700 transition-all"
              >
                Hesabıma Giriş Yap
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              <div>
                <p className="text-2xl font-bold text-navy-900">3+</p>
                <p className="text-xs text-navy-500 mt-0.5">Personel rolü</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-navy-900">7/24</p>
                <p className="text-xs text-navy-500 mt-0.5">Bulut tabanlı erişim</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-navy-900">∞</p>
                <p className="text-xs text-navy-500 mt-0.5">Sınırsız müşteri</p>
              </div>
            </div>
          </div>

          {/* Hero görsel */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-primary-200/40 via-accent-200/40 to-lilac-200/40 rounded-[2.5rem] blur-2xl" />
            <div className="relative bg-white rounded-3xl border border-navy-200 shadow-2xl shadow-primary-500/10 p-6 sm:p-8">
              <Image
                src="/visora-banner.png"
                alt="Visora — Vize süreçlerinizi ekibinizle birlikte yönetin"
                width={900}
                height={420}
                priority
                className="w-full h-auto rounded-2xl"
              />
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-[10px] text-primary-600 font-semibold uppercase tracking-wide">Bugün</p>
                  <p className="text-base font-bold text-primary-700 mt-0.5">12 dosya</p>
                </div>
                <div className="rounded-xl bg-accent-50 p-3">
                  <p className="text-[10px] text-accent-600 font-semibold uppercase tracking-wide">Bekleyen</p>
                  <p className="text-base font-bold text-accent-700 mt-0.5">4 randevu</p>
                </div>
                <div className="rounded-xl bg-lilac-50 p-3">
                  <p className="text-[10px] text-lilac-600 font-semibold uppercase tracking-wide">Tahsilat</p>
                  <p className="text-base font-bold text-lilac-700 mt-0.5">₺ 28.4K</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OZELLIKLER */}
      <section id="ozellikler" className="py-20 sm:py-24 bg-white border-y border-navy-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Modüller</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
              Operasyonun her parçası
              <span className="bg-gradient-to-r from-primary-500 to-accent-600 bg-clip-text text-transparent"> tek bir platformda.</span>
            </h2>
            <p className="mt-4 text-navy-600 leading-relaxed">
              Vize ofisleri için yıllar içinde gerçek operasyonlardan damıtılmış yetenekleri Visora ile günlük işinize taşıyın.
            </p>
          </div>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl bg-gradient-to-br from-white via-white to-navy-50 border border-navy-200/80 p-6 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/10 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 text-white flex items-center justify-center shadow-md shadow-primary-500/30">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-sm text-navy-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NASIL CALISIR */}
      <section id="nasil" className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Süreç</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
              3 adımda Visora’ya geçin
            </h2>
            <p className="mt-4 text-navy-600">
              Demo ve kurulum süreci sade — birkaç günde firmanız operasyon panelini kullanmaya başlar.
            </p>
          </div>

          <ol className="mt-12 grid md:grid-cols-3 gap-5">
            {[
              {
                step: "01",
                title: "WhatsApp ile bize yazın",
                desc: "Firma bilgilerinizi paylaşın, ekibimiz sizi en uygun planla yönlendirsin.",
              },
              {
                step: "02",
                title: "Hesabınız aktive edilir",
                desc: "Şirketinize özel panel açılır, genel müdür hesabı ve personel kotanız tanımlanır.",
              },
              {
                step: "03",
                title: "Ekibinizle kullanmaya başlayın",
                desc: "Dosya, müşteri, randevu ve tahsilat akışlarını ilk günden itibaren tek panelden yönetin.",
              },
            ].map((s) => (
              <li key={s.step} className="relative rounded-2xl bg-white border border-navy-200/80 p-6">
                <div className="absolute -top-4 left-6 inline-flex items-center justify-center w-12 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-600 text-white text-xs font-bold shadow-md shadow-primary-500/30">
                  {s.step}
                </div>
                <h3 className="mt-3 text-lg font-bold text-navy-900">{s.title}</h3>
                <p className="mt-2 text-sm text-navy-600 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA / ILETISIM */}
      <section id="iletisim" className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-accent-600 p-8 sm:p-12 shadow-2xl shadow-primary-500/30">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-accent-400/30 blur-3xl" />
            <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Visora’yı firmanızda kullanmak ister misiniz?
                </h3>
                <p className="mt-3 text-white/90 max-w-xl">
                  Aşağıdaki butona tıklayarak WhatsApp üzerinden bize ulaşın. Hesabınızı aynı gün aktif edebiliriz.
                </p>
                <p className="mt-3 text-white/80 text-sm">
                  Telefon: <span className="font-semibold tracking-wide">+90 553 834 45 13</span>
                </p>
              </div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-primary-700 bg-white hover:bg-navy-50 transition-colors shadow-lg"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp ile Mesaj Gönder
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-navy-900 text-navy-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9">
              <Image src="/visora-logo.png" alt="Visora" fill className="object-contain" />
            </div>
            <div>
              <p className="font-extrabold text-white text-base leading-none">visora</p>
              <p className="text-[11px] text-navy-400 mt-0.5">Vize Yönetim Platformu</p>
            </div>
          </div>
          <p className="text-xs text-navy-400">
            &copy; {new Date().getFullYear()} Visora. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
