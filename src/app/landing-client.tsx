"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const MONTHLY_PRICE = 1999;
const ANNUAL_DISCOUNTED_PER_MONTH = Math.round(MONTHLY_PRICE * 0.8);
const ANNUAL_TOTAL = ANNUAL_DISCOUNTED_PER_MONTH * 12;
const ANNUAL_FULL = MONTHLY_PRICE * 12;
const ANNUAL_SAVINGS = ANNUAL_FULL - ANNUAL_TOTAL;

const formatTL = (n: number) => n.toLocaleString("tr-TR");

const features = [
  {
    title: "Vize Dosya Akışı",
    desc: "Müşteri kaydından sonuca kadar her dosya adımını saniyesinde takip edin; eksik evrakları, randevuları ve onayları otomatik hatırlatın.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    accent: "from-indigo-500 to-blue-500",
  },
  {
    title: "Akıllı Randevu",
    desc: "iDATA, VFS ve konsolosluk randevularınızı tek ekranda toplayın; çift girişleri engelleyin, hatırlatmaları otomatize edin.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    accent: "from-fuchsia-500 to-pink-500",
  },
  {
    title: "Tahsilat & Cari",
    desc: "Peşin, cari, firma cari ödeme akışlarını ayrı ayrı yönetin. Çok dövizli ödeme kalemleri, dekont yükleme ve muhasebe e-postası tek tıkta.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    title: "Ekip & Yetkilendirme",
    desc: "Genel müdür ve personel rolleriyle dosya atama, izin yönetimi ve günlük rapor takibi tek panelde.",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z",
    accent: "from-amber-500 to-orange-500",
  },
  {
    title: "Veri & Raporlama",
    desc: "Aylık özet, vize bitişi, müşteri analizi ve kasa hareketleri — kararlarınızı veriyle alın, ekibe paylaşın.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    accent: "from-cyan-500 to-sky-500",
  },
  {
    title: "Bulut & Güvenlik",
    desc: "Tüm veriler şifreli ve yedeklenir. Bulut tabanlı erişim sayesinde ofis dışından da güvenle çalışırsınız.",
    icon: "M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4",
    accent: "from-violet-500 to-purple-500",
  },
];

export default function LandingClient() {
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [form, setForm] = useState({ ad: "", soyad: "", iletisim_no: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ad.trim() || !form.soyad.trim() || !form.iletisim_no.trim()) {
      setError("Ad, soyad ve iletişim numarası zorunludur.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Form gönderilemedi.");
      } else {
        setSuccess(true);
        setForm({ ad: "", soyad: "", iletisim_no: "", note: "" });
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowLeadModal(false);
    setTimeout(() => {
      setSuccess(false);
      setError(null);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-indigo-200">
      {/* DECORATIVE BG */}
      <div aria-hidden className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute -top-32 -left-40 w-[520px] h-[520px] rounded-full bg-indigo-300/30 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[620px] h-[620px] rounded-full bg-fuchsia-300/25 blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-emerald-300/20 blur-[140px]" />
      </div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
              <Image src="/visora-logo.png" alt="Visora" fill priority className="object-contain" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">Visora</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#ozellikler" className="hover:text-indigo-600 transition-colors">Özellikler</a>
            <a href="#nasil" className="hover:text-indigo-600 transition-colors">Nasıl Çalışır</a>
            <a href="#fiyatlandirma" className="hover:text-indigo-600 transition-colors">Fiyatlandırma</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Giriş
            </Link>
            <button
              onClick={() => setShowLeadModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all"
            >
              Kayıt Bırak
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-32">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-indigo-700 text-xs font-semibold shadow-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              Yeni Nesil Vize Yönetimi
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight">
              Vize ofisinizin
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                tüm operasyonu tek panelde.
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
              Visora; dosya, müşteri, randevu, tahsilat ve ekip operasyonunu uçtan uca yöneten modern bir vize ofisi platformudur. Genel müdür ve personel rolleriyle her şey kontrolünüz altında.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowLeadModal(true)}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/60 hover:scale-[1.02] transition-all"
              >
                Kayıt Bırakın — Sizi Arayalım
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold text-slate-800 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 transition-all"
              >
                Hesabıma Giriş Yap
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <p className="text-3xl font-extrabold text-slate-900">7/24</p>
                <p className="text-xs text-slate-500 mt-1">Bulut erişim</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">∞</p>
                <p className="text-xs text-slate-500 mt-1">Sınırsız müşteri</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">3+</p>
                <p className="text-xs text-slate-500 mt-1">Personel rolü</p>
              </div>
            </div>
          </div>

          {/* HERO CARD */}
          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-indigo-200/50 via-fuchsia-200/40 to-pink-200/30 rounded-[3rem] blur-3xl" />
            <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-indigo-500/10 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[11px] text-slate-400 font-mono">visora.app/admin/dashboard</span>
              </div>
              <Image
                src="/visora-banner.png"
                alt="Visora — Vize süreçlerinizi ekibinizle birlikte yönetin"
                width={900}
                height={420}
                priority
                className="w-full h-auto rounded-2xl"
              />
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">Bugün</p>
                  <p className="text-base font-extrabold text-indigo-700 mt-0.5">12 dosya</p>
                </div>
                <div className="rounded-xl bg-fuchsia-50 border border-fuchsia-100 p-3">
                  <p className="text-[10px] text-fuchsia-600 font-semibold uppercase tracking-wide">Bekleyen</p>
                  <p className="text-base font-extrabold text-fuchsia-700 mt-0.5">4 randevu</p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Tahsilat</p>
                  <p className="text-base font-extrabold text-emerald-700 mt-0.5">₺ 28.4K</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OZELLIKLER */}
      <section id="ozellikler" className="py-20 sm:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Modüller</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Operasyonun her parçası
              <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent"> tek bir platformda.</span>
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Vize ofisleri için yıllar içinde gerçek operasyonlardan damıtılmış yetenekleri Visora ile günlük işinize taşıyın.
            </p>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl bg-white border border-slate-200/80 p-6 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.accent} text-white flex items-center justify-center shadow-lg`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NASIL CALISIR */}
      <section id="nasil" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Süreç</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              3 adımda Visora’ya geçin
            </h2>
            <p className="mt-4 text-slate-600">
              Demo ve kurulum süreci sade — birkaç günde firmanız operasyon panelini kullanmaya başlar.
            </p>
          </div>

          <ol className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Kayıt bırakın",
                desc: "Adınızı ve telefon numaranızı bırakın; ekibimiz size kısa sürede dönüş yapsın.",
              },
              {
                step: "02",
                title: "Hesabınız aktive edilir",
                desc: "Şirketinize özel panel açılır, genel müdür hesabı ve personel kotanız tanımlanır.",
              },
              {
                step: "03",
                title: "Ekibinizle başlayın",
                desc: "Dosya, müşteri, randevu ve tahsilat akışlarını ilk günden itibaren tek panelden yönetin.",
              },
            ].map((s) => (
              <li key={s.step} className="relative rounded-2xl bg-white border border-slate-200 p-7 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                <div className="absolute -top-4 left-7 inline-flex items-center justify-center w-14 h-9 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-xs font-extrabold shadow-md shadow-indigo-500/40">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FIYATLANDIRMA */}
      <section id="fiyatlandirma" className="py-20 sm:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Fiyatlandırma</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Sade ve şeffaf <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">tek paket</span>
            </h2>
            <p className="mt-4 text-slate-600">
              Tüm modüller, sınırsız müşteri ve sınırsız dosya — gizli ücret yok.
            </p>

            <div className="mt-8 inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  billing === "monthly" ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Aylık
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`relative px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  billing === "annual" ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Yıllık
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[9px] font-extrabold tracking-wider shadow-md">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="mt-12 max-w-3xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-2xl shadow-indigo-500/10">
              <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-indigo-200/40 blur-3xl" />
              <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-fuchsia-200/30 blur-3xl" />

              <div className="relative p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                  <div>
                    <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      Visora Pro
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-slate-900">Tüm modüller dahil</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {billing === "monthly" ? "Aylık ödeme" : "Yıllık ödeme · %20 indirimli"}
                    </p>
                  </div>

                  <div className="text-right">
                    {billing === "monthly" ? (
                      <>
                        <p className="text-5xl font-black text-slate-900 tabular-nums">
                          ₺{formatTL(MONTHLY_PRICE)}
                          <span className="text-base font-medium text-slate-400 ml-1">/ay</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">KDV hariç</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-end gap-2">
                          <span className="text-base font-medium text-slate-400 line-through tabular-nums">
                            ₺{formatTL(MONTHLY_PRICE)}
                          </span>
                          <p className="text-5xl font-black text-slate-900 tabular-nums">
                            ₺{formatTL(ANNUAL_DISCOUNTED_PER_MONTH)}
                            <span className="text-base font-medium text-slate-400 ml-1">/ay</span>
                          </p>
                        </div>
                        <p className="text-xs text-emerald-600 font-semibold mt-1">
                          Yıllık ₺{formatTL(ANNUAL_TOTAL)} · ₺{formatTL(ANNUAL_SAVINGS)} tasarruf
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
                  {[
                    "Sınırsız vize dosyası ve müşteri kaydı",
                    "Vize sonuç takibi & otomatik bildirimler",
                    "Tahsilat, peşin/cari/firma cari yönetimi",
                    "Çok kullanıcılı genel müdür + personel rolleri",
                    "Aylık özet, kasa ve raporlama modülleri",
                    "iDATA / VFS randevu takibi",
                    "Bulut yedekleme ve güvenli erişim",
                    "Hızlı kurulum & uçtan uca destek",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowLeadModal(true)}
                  className="mt-10 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.01] transition-all"
                >
                  Kayıt Bırakın — Sizi Arayalım
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-fuchsia-600 to-pink-600 p-8 sm:p-12 shadow-2xl shadow-indigo-500/30">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-fuchsia-400/30 blur-3xl" />
            <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Visora’yı firmanızda kullanmak ister misiniz?
                </h3>
                <p className="mt-3 text-white/90 max-w-xl">
                  Adınızı ve telefon numaranızı bırakın; ekibimiz sizi arasın, hesabınız aynı gün aktif edilsin.
                </p>
              </div>
              <button
                onClick={() => setShowLeadModal(true)}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold text-indigo-700 bg-white hover:bg-slate-50 hover:scale-[1.02] transition-all shadow-lg"
              >
                Kayıt Bırakın
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9">
              <Image src="/visora-logo.png" alt="Visora" fill className="object-contain" />
            </div>
            <span className="font-extrabold text-white text-base">Visora</span>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Visora. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>

      {/* LEAD MODAL */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-200/40 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={closeModal}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors z-10"
              aria-label="Kapat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative p-7">
              {success ? (
                <div className="text-center py-6">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">Teşekkürler!</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Kaydınız iletildi. Ekibimiz en kısa sürede sizi arayacak.
                  </p>
                  <button
                    onClick={closeModal}
                    className="mt-6 w-full px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                  >
                    Kapat
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/30 mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">Kayıt Bırakın</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Bilgilerinizi alalım, biz sizi arayalım.
                    </p>
                  </div>

                  <form onSubmit={submitForm} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Ad</label>
                        <input
                          type="text"
                          value={form.ad}
                          onChange={(e) => setForm({ ...form, ad: e.target.value })}
                          required
                          maxLength={80}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                          placeholder="Adınız"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Soyad</label>
                        <input
                          type="text"
                          value={form.soyad}
                          onChange={(e) => setForm({ ...form, soyad: e.target.value })}
                          required
                          maxLength={80}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                          placeholder="Soyadınız"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-1.5 block">İletişim Numarası</label>
                      <input
                        type="tel"
                        value={form.iletisim_no}
                        onChange={(e) => setForm({ ...form, iletisim_no: e.target.value })}
                        required
                        maxLength={20}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                        placeholder="0555 555 55 55"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                        Mesaj <span className="text-slate-400 font-normal">(opsiyonel)</span>
                      </label>
                      <textarea
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        maxLength={500}
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none"
                        placeholder="Eklemek istediğiniz bir not..."
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 transition-all"
                    >
                      {submitting ? "Gönderiliyor..." : "Kaydı Gönder"}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">
                      Bilgileriniz yalnızca size dönüş yapmak için kullanılır.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
