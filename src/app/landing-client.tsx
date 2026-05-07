"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const MONTHLY_PRICE = 1999;
const ANNUAL_DISCOUNTED_PER_MONTH = Math.round(MONTHLY_PRICE * 0.8);
const ANNUAL_TOTAL = ANNUAL_DISCOUNTED_PER_MONTH * 12;
const ANNUAL_FULL = MONTHLY_PRICE * 12;
const ANNUAL_SAVINGS = ANNUAL_FULL - ANNUAL_TOTAL;

const formatTL = (n: number) => n.toLocaleString("tr-TR");

type LeadIntent = "trial" | "callback";

const benefits = [
  {
    title: "Pasaport OCR — AI ile saniyeler içinde",
    desc: "Pasaport ön yüzünü çek, yapay zeka ad-soyad, pasaport no, doğum ve son kullanma tarihini otomatik okuyup forma yazar. Yazım hatası, eksik veri biter.",
    icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2zM12 14a3 3 0 100-6 3 3 0 000 6z",
    accent: "from-indigo-500 to-violet-500",
    isAI: true,
  },
  {
    title: "Dilekçe AI — Schengen dilekçesini AI yazsın",
    desc: "Müşteriyi seç, kategoriyi gir; AI Türkçe ve İngilizce profesyonel vize dilekçesini saniyeler içinde oluşturur. Ankara için Büyükelçiliği, diğer şehirler için Başkonsolosluğu otomatik düzenlenir.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    accent: "from-fuchsia-500 to-violet-500",
    isAI: true,
  },
  {
    title: "Tüm dosyalar tek panelde",
    desc: "Müşteri, pasaport, ülke, randevu, evrak ve sonuç — hepsi tek ekranda. Hiçbir dosya kaybolmaz, hiçbir adım atlanmaz.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    accent: "from-indigo-500 to-blue-500",
  },
  {
    title: "Randevu kaçırma derdi biter",
    desc: "iDATA, VFS ve konsolosluk randevuları otomatik hatırlatmalarla işliyor. Personel unutsa bile sistem unutmaz.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    accent: "from-fuchsia-500 to-pink-500",
  },
  {
    title: "Tahsilatını anlık takip et",
    desc: "Peşin, cari, firma cari ve döviz bazlı tahsilatlar tek kasa görünümünde. Kim ne aldı, ne kaldı — anında bilirsin.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    title: "Personel performansını gör",
    desc: "Hangi personel kaç dosya yapıyor, kaç tahsilat alıyor, kim geride kalıyor — şeffaf rakamlarla takip et.",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z",
    accent: "from-amber-500 to-orange-500",
  },
  {
    title: "Müşteri geri dönüşlerini kaybetme",
    desc: "Eski pasaport, geçmiş başvuru, vize bitiş tarihi — eski müşteriyi yeni satışa çevirmen için her şey hatırlatılır.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    accent: "from-cyan-500 to-sky-500",
  },
  {
    title: "Ofis dışından da yönet",
    desc: "Bulutta tutulur, şifrelenir, yedeklenir. Telefondan, tabletten, evden — her yerden aynı güvenli panel.",
    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z",
    accent: "from-violet-500 to-purple-500",
  },
];

const problems = [
  {
    title: "Excel'de kaybolan dosyalar",
    desc: "Sayfa sayfa müşteri listesi, formülü bozulan tablolar, paylaşamadığın dosyalar — versiyon karmaşası.",
    icon: "M4 4h16v16H4z M4 9h16 M9 4v16",
  },
  {
    title: "WhatsApp grubunda kaybolan bilgi",
    desc: "Müşteri yazıyor, personel okuyor, sonra unutuluyor. Hangi mesaj hangi dosyaya ait — kimse bilmiyor.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    title: "Unutulan randevular",
    desc: "Müşteri randevuya gelmiyor ya da personel hatırlatmayı kaçırıyor. Para ve itibar kaybı.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Takip edilemeyen tahsilatlar",
    desc: "Kim nereden ne tahsil etti, hangi dosya cari, hangisi peşin — ay sonu ortaya hep eksik çıkıyor.",
    icon: "M3 3h18M3 21h18M9 7h6v10H9z M5 11h2 M17 11h2 M5 15h2 M17 15h2",
  },
];

const showcase = [
  {
    title: "Tüm dosyaları tek ekranda görün",
    desc: "Hangi dosya kimde, hangi aşamada, ne kadar bekliyor — anında görürsün. Eksik evrak, geçmiş randevu, yaklaşan sonuç hepsi renklerle ayrılır.",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
    accent: "from-indigo-500 to-blue-500",
  },
  {
    title: "Ödemeleri ve tahsilatları anlık takip edin",
    desc: "Nakit, hesaba, POS, peşin, cari, firma cari — tüm yöntemler kasa sayfasında ay/gün/hafta bazlı toplam halinde gözükür. Döviz farkı dahil.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    title: "Randevuları kaçırmayın",
    desc: "Takvim görünümü, kuyruk listesi, otomatik bildirim. Yarın 4 randevun varsa bugün hatırlanır, müşteriye otomatik mesaj gider.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    accent: "from-fuchsia-500 to-pink-500",
  },
];

const testimonials = [
  {
    name: "Mehmet K.",
    role: "Genel Müdür · Vize Ofisi",
    body: "Önceden 3 personelle Excel ve WhatsApp'ta debelendiğimiz işi şimdi yarım saat erken bitiriyoruz. Tahsilatları takip etmek inanılmaz kolaylaştı.",
    initials: "MK",
  },
  {
    name: "Ayşe T.",
    role: "Operasyon · Vize Acentesi",
    body: "İlk hafta dosya akışını öğrendik, sonraki hafta tahsilat ve kasayı bağladık. Eski sisteme dönmeyi düşünmüyoruz bile.",
    initials: "AT",
  },
  {
    name: "Burak Y.",
    role: "Sahip · Turizm Şirketi",
    body: "Personelin dosya başına ne yaptığını şeffaf görmek paha biçilemez. Prim hesabını da Visora üstünden konuşuyoruz artık.",
    initials: "BY",
  },
];

export default function LandingClient() {
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("trial");
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [form, setForm] = useState({ ad: "", soyad: "", iletisim_no: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLead = (intent: LeadIntent) => {
    setLeadIntent(intent);
    setForm((f) => ({
      ...f,
      note:
        intent === "trial"
          ? "15 gün ücretsiz kullanmak istiyorum."
          : "Aramanızı rica ediyorum.",
    }));
    setShowLeadModal(true);
  };

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
            <a href="#problem" className="hover:text-indigo-600 transition-colors">Problem</a>
            <a href="#cozumler" className="hover:text-indigo-600 transition-colors">Çözümler</a>
            <a
              href="#ai"
              className="inline-flex items-center gap-1.5 hover:text-violet-600 transition-colors"
            >
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-100 to-fuchsia-100 text-violet-700 text-[9px] font-black uppercase tracking-wider">
                AI
              </span>
              Asistanlar
            </a>
            <a href="#nasil" className="hover:text-indigo-600 transition-colors">Nasıl Çalışır</a>
            <a href="#fiyatlandirma" className="hover:text-indigo-600 transition-colors">Fiyatlandırma</a>
            <a href="#ozellikler" className="hover:text-indigo-600 transition-colors">Özellikler</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Giriş
            </Link>
            <button
              onClick={() => openLead("trial")}
              className="relative inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all"
            >
              <span className="hidden sm:inline">Hemen başla — Ücretsiz</span>
              <span className="sm:hidden">Hemen başla</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-12 sm:pt-20 pb-20 sm:pb-28">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-xs font-bold shadow-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Bu hafta 12 vize ofisi Visora'ya geçti
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black text-slate-900 leading-[1.05] tracking-tight">
              Her kaçırılan randevu{" "}
              <span className="bg-gradient-to-r from-rose-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent">
                ofisinize 5.000 ₺ kaybettiriyor.
              </span>
              <br />
              <span className="text-slate-900">Visora bunu bugün durdurur.</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
              Excel-WhatsApp kaosu, kaybolan dosya, takip edilmeyen tahsilat —{" "}
              <span className="font-semibold text-slate-800">
                tek panel, AI destekli pasaport okuma, otomatik dilekçe ve gerçek zamanlı tahsilat takibi
              </span>{" "}
              ile son bulur. Ofis sahipleri ortalama <strong className="text-slate-900">ayda 38 saat</strong> kazanıyor.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => openLead("trial")}
                className="group relative inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/60 hover:scale-[1.02] transition-all"
              >
                Hemen başla — 15 gün ücretsiz
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black tracking-wider shadow-md uppercase">
                  Kart yok
                </span>
              </button>
              <button
                onClick={() => openLead("callback")}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold text-slate-800 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                15 dk ücretsiz demo
              </button>
            </div>

            <p className="mt-3 text-[12px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Kredi kartı gerekmez
              </span>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                30 saniyede aktif
              </span>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Memnun kalmazsan iade
              </span>
            </p>

            <ul className="mt-8 grid sm:grid-cols-3 gap-3">
              {[
                "Randevu kaçırma derdi biter",
                "Tahsilat 3 kat hızlanır",
                "Personel çıkışında veri kaybı yok",
              ].map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/80 border border-slate-200/80 text-[12.5px] font-semibold text-slate-700"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-4 text-xs text-slate-500">
              <div className="flex -space-x-2">
                {["A", "M", "B", "K"].map((c, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full ring-2 ring-slate-50 flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${
                      ["from-indigo-500 to-violet-500", "from-fuchsia-500 to-pink-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500"][i]
                    }`}
                  >
                    {c}
                  </div>
                ))}
              </div>
              <span className="font-medium">
                <strong className="text-slate-700">Türkiye'nin dört bir yanından</strong> vize ofisleri zaten Visora'da · <strong className="text-emerald-700">4.9/5</strong> memnuniyet
              </span>
            </div>
          </div>

          {/* HERO — MULTI-DEVICE MOCKUP */}
          <div className="relative h-[460px] sm:h-[520px] lg:h-[560px]">
            {/* Soft glow */}
            <div className="absolute -inset-10 bg-gradient-to-br from-indigo-300/40 via-fuchsia-300/30 to-pink-200/30 rounded-[3rem] blur-3xl" />

            {/* Reflection floor */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[88%] h-32 bg-gradient-to-b from-indigo-500/15 to-transparent blur-2xl rounded-full" />

            {/* TABLET — left back */}
            <div className="absolute top-6 sm:top-10 left-[2%] sm:left-[4%] w-[42%] sm:w-[44%] -rotate-[8deg] z-10 drop-shadow-2xl">
              <div className="relative rounded-[1.6rem] bg-gradient-to-br from-slate-800 to-slate-950 p-1.5 ring-1 ring-white/10 shadow-2xl shadow-indigo-900/40">
                <div className="rounded-[1.2rem] overflow-hidden bg-slate-900 aspect-[16/11]">
                  <Image
                    src="/visora-dashboard.png"
                    alt="Visora panel — tablet"
                    width={1024}
                    height={484}
                    priority
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-1 w-1 h-6 rounded-full bg-white/20" />
              </div>
            </div>

            {/* LAPTOP — center foreground */}
            <div className="absolute top-2 sm:top-6 left-1/2 -translate-x-1/2 w-[78%] sm:w-[78%] z-20">
              <div className="relative">
                <div className="rounded-t-2xl bg-gradient-to-br from-slate-800 to-slate-950 px-3 pt-3 pb-2 ring-1 ring-white/10 shadow-2xl shadow-indigo-900/30">
                  {/* Camera bar */}
                  <div className="flex items-center justify-center mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-700/80" />
                  </div>
                  <div className="rounded-lg overflow-hidden bg-slate-900 aspect-[16/9] ring-1 ring-white/5">
                    <Image
                      src="/visora-dashboard.png"
                      alt="Visora panel — laptop"
                      width={1024}
                      height={484}
                      priority
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                </div>
                {/* Laptop base */}
                <div className="relative">
                  <div className="h-2 bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-lg" />
                  <div className="h-3 -mx-3 bg-gradient-to-b from-slate-300 to-slate-500 rounded-b-[1.4rem] relative shadow-2xl shadow-slate-900/30">
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-1 bg-slate-600/60 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* PHONE — right foreground */}
            <div className="absolute bottom-2 sm:bottom-4 right-[2%] sm:right-[6%] w-[24%] sm:w-[24%] rotate-[6deg] z-30 drop-shadow-2xl">
              <div className="relative rounded-[1.4rem] bg-gradient-to-br from-slate-900 to-slate-950 p-1.5 ring-1 ring-white/10 shadow-2xl shadow-fuchsia-900/40">
                <div className="rounded-[1.1rem] overflow-hidden bg-slate-900 aspect-[9/19]">
                  {/* Notch */}
                  <div className="relative h-5 bg-slate-950 flex items-center justify-center">
                    <span className="w-12 h-3 bg-black rounded-full" />
                  </div>
                  {/* Phone screen content — mini-dashboard */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-2.5 space-y-2 h-full">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
                      <span className="text-[8px] font-bold text-white">Visora</span>
                    </div>
                    <div className="rounded-md bg-white/10 ring-1 ring-white/10 p-1.5 backdrop-blur">
                      <p className="text-[7px] text-white/60 font-semibold uppercase tracking-wider">Bugün</p>
                      <p className="text-[10px] font-black text-white mt-0.5">12 dosya</p>
                    </div>
                    <div className="rounded-md bg-white/10 ring-1 ring-white/10 p-1.5 backdrop-blur">
                      <p className="text-[7px] text-white/60 font-semibold uppercase tracking-wider">Tahsilat</p>
                      <p className="text-[10px] font-black text-emerald-300 mt-0.5">₺ 28.4K</p>
                    </div>
                    <div className="rounded-md bg-white/10 ring-1 ring-white/10 p-1.5 backdrop-blur">
                      <p className="text-[7px] text-white/60 font-semibold uppercase tracking-wider">Randevu</p>
                      <p className="text-[10px] font-black text-fuchsia-300 mt-0.5">4 bekleyen</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-1.5 text-center">
                      <span className="text-[8px] font-bold text-white">+ Yeni Dosya</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating mini-stats badges */}
            <div className="hidden lg:block absolute top-2 -right-2 z-40 px-3 py-2 rounded-2xl bg-white shadow-xl shadow-indigo-500/20 ring-1 ring-slate-200 animate-float">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tahsilat</p>
                  <p className="text-xs font-black text-slate-900 -mt-0.5">+ ₺ 4.200</p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block absolute bottom-12 -left-2 z-40 px-3 py-2 rounded-2xl bg-white shadow-xl shadow-fuchsia-500/20 ring-1 ring-slate-200 animate-float" style={{ animationDelay: "1.5s" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Yarın</p>
                  <p className="text-xs font-black text-slate-900 -mt-0.5">3 randevu</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HERO METRIKLER */}
      <section className="-mt-8 sm:-mt-12 pb-16 sm:pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 sm:p-8 shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10 grid sm:grid-cols-3 gap-6">
            {[
              {
                value: "50+",
                label: "Günde dosya yönetimi",
                hint: "Hem peşin hem cari, hem firma — tek panelden.",
              },
              {
                value: "%90",
                label: "Daha az randevu kaçırma",
                hint: "Otomatik hatırlatmalarla unutmak imkansız.",
              },
              {
                value: "1",
                label: "Tek panel ile tam kontrol",
                hint: "Excel, WhatsApp, ajanda — hepsi yerine bir.",
              },
            ].map((m) => (
              <div key={m.label} className="relative">
                <p className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-white via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">
                  {m.value}
                </p>
                <p className="mt-2 text-sm font-bold text-white">{m.label}</p>
                <p className="mt-1 text-xs text-white/60 leading-relaxed">{m.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="py-20 sm:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-600">Bu tabloyu tanıyor musunuz?</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Hâlâ Excel ve WhatsApp ile mi takip ediyorsunuz?
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Eski sistem hızlı görünür ama gizli maliyeti büyüktür. Kaybolan dosya, unutulan randevu, takip edilemeyen tahsilat — her gün <strong className="text-rose-600">para ve müşteri kaybı</strong> demektir.
            </p>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {problems.map((p) => (
              <div
                key={p.title}
                className="relative rounded-2xl bg-rose-50/40 border border-rose-100 p-6 hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/5 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={p.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-extrabold text-slate-900">{p.title}</h3>
                <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <p className="text-base font-semibold text-slate-700">
              Visora bu kaosu <span className="text-indigo-600">7 gün içinde</span> bitirir.
            </p>
            <button
              onClick={() => openLead("trial")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all"
            >
              Ücretsiz başla
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* COZUMLER / BENEFITS */}
      <section id="cozumler" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Visora ile ne kazanırsınız?</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Özellik değil,{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                somut sonuç.
              </span>
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Vize ofisinizin günlük problemlerine net çözümler. Her özellik, "ne yapar?" değil "size ne kazandırır?" sorusunun cevabıdır.
            </p>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((f) => (
              <div
                key={f.title}
                className={`group relative rounded-2xl bg-white border p-6 hover:shadow-2xl hover:-translate-y-0.5 transition-all ${
                  f.isAI
                    ? "border-violet-200 hover:border-violet-400 hover:shadow-violet-500/15"
                    : "border-slate-200/80 hover:border-indigo-300 hover:shadow-indigo-500/10"
                }`}
              >
                {f.isAI && (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-700">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Yeni · AI
                  </span>
                )}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.accent} text-white flex items-center justify-center shadow-lg`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI ASISTANLAR */}
      <section id="ai" className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-fuchsia-500 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-white/90 text-[11px] font-bold uppercase tracking-[0.18em]">
              <svg className="w-3 h-3 text-fuchsia-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Yeni · Yapay Zeka destekli
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white tracking-tight">
              Operasyonun{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                en sıkıcı işlerini
              </span>{" "}
              AI yapsın.
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed text-base sm:text-lg">
              Pasaport bilgilerini elle girmek, dilekçe yazmak, müşterilere ne yapacağını anlatmak — Visora'da
              hepsi yapay zekayla saniyeler içinde tamamlanır. Sen müşteriye odaklan, gerisini AI yapsın.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {/* OCR Card */}
            <div className="group relative rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 p-6 hover:bg-white/[0.13] hover:border-white/25 hover:-translate-y-1 transition-all">
              <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-500/30">
                Yeni
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} fill="none" />
                </svg>
              </div>
              <h3 className="mt-5 text-xl font-black text-white">Pasaport OCR</h3>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Yeni dosya açarken pasaportun ön yüzünü çek; AI <strong className="text-white">ad, soyad, pasaport no,
                doğum tarihi ve son kullanma tarihini</strong> otomatik okuyup forma yazar. Yazım hatası, kaybolan
                doğum tarihi, eksik veri biter.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {["MRZ tarama", "Türk pasaport", "Saniyeler içinde"].map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-white/80 border border-white/10">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Dilekçe AI Card */}
            <div className="group relative rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 p-6 hover:bg-white/[0.13] hover:border-white/25 hover:-translate-y-1 transition-all">
              <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-fuchsia-500/30">
                Yeni
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-xl shadow-fuchsia-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-5 text-xl font-black text-white">Dilekçe AI</h3>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Schengen vize başvuruları için <strong className="text-white">Türkçe ve İngilizce profesyonel
                dilekçeyi</strong> AI saniyeler içinde yazar. Müşteriyi seç, kategoriyi gir; dilekçe önünüzde
                yazılır — Ankara için Büyükelçiliği, diğer iller için Başkonsolosluğu otomatik düzenlenir.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {["Bireysel/Şirket", "TR + EN", "Canlı yazım"].map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-white/80 border border-white/10">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Visora AI Asistan Card */}
            <div className="group relative rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 p-6 hover:bg-white/[0.13] hover:border-white/25 hover:-translate-y-1 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="mt-5 text-xl font-black text-white">Visora AI Asistan</h3>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Şirketinin tüm dosyalarını, ödemelerini, müşterilerini bilen <strong className="text-white">kişisel
                asistanın</strong>. "Bu ay kaç tahsilat aldık?", "Bu randevu nasıl atılır?" — sor, anında cevap al.
                Personel eğitimi yarıya iner.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {["Veri sorgu", "Nasıl yapılır?", "Anlık cevap"].map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-white/80 border border-white/10">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => openLead("trial")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-fuchsia-500 shadow-xl shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 hover:scale-[1.02] transition-all"
            >
              AI özelliklerini ücretsiz dene
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <span className="text-xs text-white/50">15 gün boyunca kart bilgisi gerektirmez</span>
          </div>
        </div>
      </section>

      {/* SHOWCASE — Product */}
      <section className="py-20 sm:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Panel</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Operasyonun nabzı{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                tek ekranda.
              </span>
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Sabah panele girersin, ne yapman gerektiğini sistem söyler. Ekibin ne yapıyor, hangi dosya bekliyor, kasada ne var — hepsi açık.
            </p>
          </div>

          <div className="mt-12 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-start">
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-indigo-200/40 via-fuchsia-200/30 to-pink-200/20 rounded-[2.5rem] blur-3xl" />
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl ring-1 ring-white/10 p-3 sm:p-5 shadow-2xl shadow-indigo-500/20">
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-[11px] text-white/40 font-mono">visora.app/admin/dashboard</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[16/9] bg-slate-900">
                  <Image
                    src="/visora-dashboard.png"
                    alt="Visora panel görünümü"
                    width={1024}
                    height={484}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Aktif Dosya</p>
                    <p className="text-base font-extrabold text-white mt-0.5">87</p>
                  </div>
                  <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Bu Hafta</p>
                    <p className="text-base font-extrabold text-white mt-0.5">21 yeni</p>
                  </div>
                  <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Tahsilat</p>
                    <p className="text-base font-extrabold text-emerald-300 mt-0.5">₺ 142K</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {showcase.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${s.accent} text-white flex items-center justify-center shadow-lg`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{s.title}</h3>
                      <p className="mt-1.5 text-[13.5px] text-slate-600 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => openLead("trial")}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.01] transition-all"
              >
                Paneli kendi verinle dene
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* NASIL CALISIR */}
      <section id="nasil" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Süreç</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              3 adımda Visora'ya geçin
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Excel'den Visora'ya geçiş düşündüğünüzden çok daha hızlı.
            </p>
          </div>

          <ol className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Kayıt ol — aynı gün kurulum yapılır",
                desc: "Telefon numaranı bırak, ekibimiz bugün senin paneli açsın. Şirket bilgilerin, logon, kullanıcı limitin tanımlansın.",
              },
              {
                step: "02",
                title: "Verilerin sisteme aktarılır",
                desc: "Mevcut Excel, müşteri listesi ve dosyaları biz aktarırız. Sıfırdan başlamak zorunda değilsin — geçiş kayıpsız.",
              },
              {
                step: "03",
                title: "Ekibinle hemen kullanmaya başlarsın",
                desc: "Personel hesapları açılır, eğitim verilir, ilk hafta yanındayız. Ofis kapısından çıkmadan geçiş tamamlanır.",
              },
            ].map((s) => (
              <li key={s.step} className="relative rounded-2xl bg-white border border-slate-200 p-7 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                <div className="absolute -top-4 left-7 inline-flex items-center justify-center w-14 h-9 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-xs font-extrabold shadow-md shadow-indigo-500/40">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 max-w-3xl mx-auto rounded-2xl bg-indigo-50/60 border border-indigo-200 p-5 flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong className="text-slate-900">Teknik bilgi gerekmez.</strong> Kurulum ekibimiz panelini açar, verilerini aktarır, ekibine eğitim verir. Sen sadece müşterine odaklanırsın.
            </p>
          </div>
        </div>
      </section>

      {/* TRUST — Testimonials + metrics */}
      <section className="py-20 sm:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Güven</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Vize ofisleri Visora'yı{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                neden tercih ediyor?
              </span>
            </h2>
          </div>

          <div className="mt-12 grid lg:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="relative rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-6 shadow-lg shadow-slate-200/40"
              >
                <svg className="absolute top-5 right-5 w-8 h-8 text-indigo-200" fill="currentColor" viewBox="0 0 32 32" aria-hidden>
                  <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                </svg>
                <figcaption className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center text-sm font-extrabold shadow-md shadow-indigo-500/30">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{t.name}</p>
                    <p className="text-[11.5px] text-slate-500">{t.role}</p>
                  </div>
                </figcaption>
                <blockquote className="text-[14px] text-slate-700 leading-relaxed">
                  "{t.body}"
                </blockquote>
              </figure>
            ))}
          </div>

          <div className="mt-14 grid sm:grid-cols-3 gap-4">
            {[
              { value: "%99.9", label: "Uptime", hint: "Panel her zaman ayakta. Kesinti senin için para kaybı, biz biliyoruz." },
              { value: "< 2 saat", label: "Destek dönüş süresi", hint: "Sorun yaşadığında hızla cevap alırsın. WhatsApp + email destek." },
              { value: "TR sunucu", label: "Veri güvenliği", hint: "Verilerin Türkiye'de, şifreli ve günlük yedeklenir. KVKK uyumlu." },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 border border-indigo-100 p-5"
              >
                <p className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
                  {m.value}
                </p>
                <p className="mt-1.5 text-sm font-extrabold text-slate-900">{m.label}</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{m.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FIYATLANDIRMA */}
      <section id="fiyatlandirma" className="relative py-20 sm:py-28 bg-gradient-to-b from-white via-indigo-50/30 to-white overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/30 to-fuchsia-200/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>
              30 gün koşulsuz iade garantisi
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Fiyatlandırma</p>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Tek bir kaçırılan randevu{" "}
              <span className="bg-gradient-to-r from-rose-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent">
                yıllık paketten daha pahalı.
              </span>
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed text-base sm:text-lg">
              Sınırsız dosya, sınırsız müşteri, tüm AI modülleri dahil — gizli ücret yok.{" "}
              <strong className="text-slate-900">Ayda 1 ekstra müşteri kazandırırsa kendini 2.5 kat amorti eder.</strong>
            </p>

            <div className="mt-8 inline-flex items-center gap-1 p-1.5 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  billing === "monthly" ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Aylık
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`relative px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  billing === "annual" ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Yıllık
                <span className="absolute -top-2.5 -right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[9px] font-black tracking-wider shadow-md">
                  -20% TASARRUF
                </span>
              </button>
            </div>
          </div>

          <div className="mt-14 max-w-3xl mx-auto">
            <div className="relative rounded-3xl overflow-visible">
              {/* EN POPÜLER badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white text-[11px] font-black tracking-wider uppercase shadow-lg shadow-orange-500/40">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>
                  En çok tercih edilen · Bu ay -20%
                </div>
              </div>

              <div className="relative rounded-3xl overflow-hidden border-2 border-indigo-200 bg-gradient-to-br from-white via-white to-indigo-50/40 shadow-2xl shadow-indigo-500/20 ring-4 ring-indigo-100/50">
                <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-indigo-200/40 blur-3xl" />
                <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-fuchsia-200/30 blur-3xl" />

                <div className="relative p-8 sm:p-10">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                    <div>
                      <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-black uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        Visora Pro · Her şey dahil
                      </p>
                      <h3 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">Tek paket · Tüm modüller</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {billing === "monthly" ? "Aylık ödeme · İstediğin an iptal" : "Yıllık ödeme · %20 indirim · İstediğin an iptal"}
                      </p>
                    </div>

                    <div className="text-right">
                      {billing === "monthly" ? (
                        <>
                          <p className="text-5xl sm:text-6xl font-black text-slate-900 tabular-nums leading-none">
                            ₺{formatTL(MONTHLY_PRICE)}
                            <span className="text-base font-medium text-slate-400 ml-1">/ay</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-2">KDV hariç · Aylık fatura</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-end gap-2">
                            <span className="text-base font-bold text-rose-400 line-through tabular-nums">
                              ₺{formatTL(MONTHLY_PRICE)}
                            </span>
                            <p className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent tabular-nums leading-none">
                              ₺{formatTL(ANNUAL_DISCOUNTED_PER_MONTH)}
                              <span className="text-base font-medium text-slate-400 ml-1">/ay</span>
                            </p>
                          </div>
                          <p className="text-xs text-emerald-600 font-black mt-2">
                            Yıl boyu ₺{formatTL(ANNUAL_SAVINGS)} cebinde kalır
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ROI vurgusu */}
                  <div className="mt-7 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900">Yatırım geri dönüşü</p>
                        <p className="text-[13px] text-slate-700 mt-1 leading-relaxed">
                          Vize ofislerinde ortalama dosya kârı <strong>2.500–5.000 ₺</strong>. Visora ayda{" "}
                          <strong className="text-emerald-700">tek 1 dosya kazandırırsa</strong> kendini 2 katından fazla amorti eder.{" "}
                          <strong className="text-slate-900">Çoğu ofis 1. ayda 8-12 ekstra dosya açıyor.</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Risk reversal / guarantees */}
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: "15 gün ücretsiz", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                      { label: "Kart bilgisi yok", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
                      { label: "İade garantisi", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                      { label: "1-1 kurulum desteği", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                    ].map((g) => (
                      <div
                        key={g.label}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-emerald-200 text-[12px] font-bold text-emerald-700 shadow-sm"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d={g.icon} />
                        </svg>
                        {g.label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Pakete dahil her şey</p>
                    <div className="grid sm:grid-cols-2 gap-2.5 text-sm text-slate-700">
                      {[
                        { txt: "Sınırsız vize dosyası ve müşteri", strong: true },
                        { txt: "Pasaport OCR · Dilekçe AI · Visora AI", strong: true, ai: true },
                        { txt: "iDATA / VFS / konsolosluk randevu takibi" },
                        { txt: "Tahsilat, kasa, peşin/cari/firma cari" },
                        { txt: "Vize sonuç takibi & otomatik bildirimler" },
                        { txt: "Genel müdür + 3 personel hesabı" },
                        { txt: "Aylık özet PDF, raporlama modülleri" },
                        { txt: "Pasaport bitiş tarihi uyarı sistemi" },
                        { txt: "TR sunucu · KVKK uyumlu · Şifreli yedek" },
                        { txt: "Uçtan uca kurulum + WhatsApp destek", strong: true },
                      ].map((f) => (
                        <div key={f.txt} className="flex items-start gap-2">
                          <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            f.ai ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white" : "bg-emerald-100 text-emerald-600"
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <span className={f.strong ? "font-bold text-slate-900" : ""}>
                            {f.txt}
                            {f.ai && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-black uppercase tracking-wider bg-violet-100 text-violet-700">Yeni</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => openLead("trial")}
                    className="group mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-5 rounded-2xl text-base font-black text-white bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600 shadow-xl shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-[1.01] transition-all"
                  >
                    Hesabımı oluştur — 15 gün ücretsiz başla
                    <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Kredi kartı istemez
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      30 saniyede aktif
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      İstediğin an iptal
                    </span>
                  </div>

                  <div className="mt-4 text-center">
                    <button
                      onClick={() => openLead("callback")}
                      className="text-[12.5px] font-bold text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline transition-all"
                    >
                      Önce bana özel demo göstersinler →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Karsilastirma seridi */}
            <div className="mt-10 grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-rose-700">Excel + WhatsApp</p>
                <p className="mt-1.5 text-2xl font-black text-rose-900">~12.000 ₺/ay kayıp</p>
                <p className="mt-1 text-[12px] text-rose-700/80 leading-relaxed">Kaçan randevu, kaybolan dosya, takipsiz tahsilat.</p>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">Klasik CRM</p>
                <p className="mt-1.5 text-2xl font-black text-amber-900">3.500-8.000 ₺/ay</p>
                <p className="mt-1 text-[12px] text-amber-700/80 leading-relaxed">Vize ofisine özgü değil; AI ve modül kilitli.</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Visora Pro</p>
                <p className="mt-1.5 text-2xl font-black text-emerald-700">
                  ₺{formatTL(billing === "monthly" ? MONTHLY_PRICE : ANNUAL_DISCOUNTED_PER_MONTH)}/ay
                </p>
                <p className="mt-1 text-[12px] text-emerald-700/80 leading-relaxed font-semibold">Vize ofisine özel + AI dahil + sınırsız.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OZELLIKLER — Detayli */}
      <FeaturesSection />

      {/* REFERANSLARIMIZ */}
      <ReferencesMarquee />

      {/* CLOSING CTA */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-fuchsia-600 to-pink-600 p-8 sm:p-12 lg:p-16 shadow-2xl shadow-indigo-500/30">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 w-96 h-96 rounded-full bg-fuchsia-400/30 blur-3xl" />

            {/* Bu ay özel teklif şeridi */}
            <div className="absolute top-5 right-5 sm:top-7 sm:right-7">
              <div className="px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-lg">
                Bu ay özel · Ücretsiz kurulum
              </div>
            </div>

            <div className="relative text-center max-w-3xl mx-auto">
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Bugün başlamayan her gün{" "}
                <span className="bg-gradient-to-r from-amber-200 to-amber-100 bg-clip-text text-transparent">
                  ofisinize para kaybettiriyor.
                </span>
              </h3>
              <p className="mt-5 text-base sm:text-lg text-white/95 leading-relaxed">
                Kaçırılan randevu = kaybolan müşteri. Takipsiz tahsilat = kaybolan ciro.{" "}
                <strong className="text-white">Visora bu kaybı 30 saniyede durdurur.</strong>{" "}
                Bu ay başvuranlara <strong className="bg-amber-300/30 text-white px-1.5 py-0.5 rounded">ücretsiz kurulum + ekip eğitimi</strong> dahil.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openLead("trial")}
                  className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-black text-indigo-700 bg-white hover:bg-amber-50 hover:scale-[1.02] transition-all shadow-xl"
                >
                  Hesabımı şimdi oluştur
                  <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <button
                  onClick={() => openLead("callback")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  15 dakikada ücretsiz demo
                </button>
              </div>

              <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-white/95">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Kredi kartı yok
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-white/95">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  15 gün her şey açık
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-white/95">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  30 gün iade garantisi
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9">
                  <Image src="/visora-logo.png" alt="Visora" fill className="object-contain" />
                </div>
                <span className="font-extrabold text-white text-base">Visora</span>
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Vize ofisleri için modern operasyon platformu. Dosya, randevu, tahsilat ve ekibinizi tek panelden yönetin.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Ürün</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#cozumler" className="text-slate-300 hover:text-white transition-colors">Çözümler</a></li>
                <li><a href="#nasil" className="text-slate-300 hover:text-white transition-colors">Nasıl Çalışır</a></li>
                <li><a href="#fiyatlandirma" className="text-slate-300 hover:text-white transition-colors">Fiyatlandırma</a></li>
                <li><Link href="/login" className="text-slate-300 hover:text-white transition-colors">Giriş yap</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Destek</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:destek@destekvisora.com"
                    className="text-slate-300 hover:text-white transition-colors"
                  >
                    destek@destekvisora.com
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => openLead("callback")}
                    className="text-slate-300 hover:text-white transition-colors text-left"
                  >
                    Sizi arayalım
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openLead("trial")}
                    className="text-slate-300 hover:text-white transition-colors text-left"
                  >
                    Ücretsiz dene
                  </button>
                </li>
                <li>
                  <Link href="/login" className="text-slate-300 hover:text-white transition-colors">
                    Hesabıma giriş
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Yasal</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#" className="text-slate-300 hover:text-white transition-colors">KVKK Aydınlatma Metni</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white transition-colors">Gizlilik Politikası</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white transition-colors">Kullanım Koşulları</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white transition-colors">Çerez Politikası</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Visora · Tüm hakları saklıdır.
            </p>
            <p className="text-xs text-slate-500">
              Made in Türkiye · TR sunucu · KVKK uyumlu
            </p>
          </div>
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
                    Kaydınız iletildi. Ekibimiz en kısa sürede sizi arayarak panelinizi açacak.
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
                      {leadIntent === "trial" ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">
                      {leadIntent === "trial" ? "15 gün ücretsiz başla" : "Sizi arayalım"}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {leadIntent === "trial"
                        ? "Bilgilerinizi alalım, panelinizi bugün açalım. Kredi kartı gerekmez."
                        : "İletişim bilgilerinizi bırakın, ekibimiz en kısa sürede sizi arasın."}
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
                      {submitting
                        ? "Gönderiliyor..."
                        : leadIntent === "trial"
                          ? "Ücretsiz başla"
                          : "Aramanızı talep et"}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                      Bilgileriniz yalnızca size dönüş yapmak için kullanılır. KVKK kapsamında saklanır.
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

/* ─── Tüm Özellikler — Kategorize edilmiş detaylı liste ─── */
function FeaturesSection() {
  const categories = [
    {
      label: "AI ile Otomasyon",
      icon: "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z",
      accent: "from-violet-500 to-fuchsia-500",
      ring: "ring-violet-200",
      isAI: true,
      items: [
        {
          title: "Pasaport OCR",
          desc: "Pasaport ön yüzünü çek; AI ad-soyad, pasaport no, doğum/son kullanma tarihini saniyeler içinde forma yazar.",
        },
        {
          title: "Dilekçe AI",
          desc: "Schengen vize başvuruları için Türkçe ve İngilizce profesyonel dilekçeyi AI saniyeler içinde oluşturur.",
        },
        {
          title: "Visora AI Asistan",
          desc: "Şirket verilerini bilen kişisel asistan — dosya/ödeme sorgu, 'nasıl yapılır?' rehberi, anlık cevap.",
        },
      ],
    },
    {
      label: "Dosya & Müşteri Yönetimi",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      accent: "from-indigo-500 to-blue-500",
      ring: "ring-indigo-200",
      items: [
        {
          title: "Vize Dosyası Oluşturma",
          desc: "Müşteri, ülke, randevu, evrak, ücret — tek formdan, 30 saniyede dosya açın.",
        },
        {
          title: "Aşamalı Dosya Akışı",
          desc: "Dosya hazır → başvuru yapıldı → işlemden çıktı → sonuçlandı. Her aşamada otomatik bildirim.",
        },
        {
          title: "Müşteri Kartları",
          desc: "Tüm geçmiş başvurular, başarı oranı, ödenen tutarlar tek müşteri kartında.",
        },
        {
          title: "Pasaport Bitiş Uyarısı",
          desc: "Müşterinin pasaportu 1 yıldan az kaldıysa otomatik uyarı — yeni satış fırsatı.",
        },
        {
          title: "Tekrarlayan Müşteri Tespiti",
          desc: "Aynı pasaport ile yeni dosya açılırken eski geçmiş otomatik gelir, ad/telefon otomatik dolar.",
        },
        {
          title: "Müşteri Grupları",
          desc: "Toplu işlem ve raporlama için müşteri gruplandırması.",
        },
      ],
    },
    {
      label: "Randevu & Takvim",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      accent: "from-fuchsia-500 to-pink-500",
      ring: "ring-fuchsia-200",
      items: [
        {
          title: "Randevu Takvimi",
          desc: "iDATA, VFS ve konsolosluk randevuları tek takvimde — günlük, haftalık görünüm.",
        },
        {
          title: "Otomatik Hatırlatma",
          desc: "Yarın randevusu olan müşterilere otomatik SMS/e-posta. Personel unutsa bile sistem unutmaz.",
        },
        {
          title: "Kuyruk Yönetimi",
          desc: "Açık dosyalar randevu tarihine göre sıralanır; aciliyet rengi ile öne çıkar.",
        },
        {
          title: "Randevu Raporları",
          desc: "Hangi randevu yapıldı, hangisi kaçtı, hangi ülke yoğun — analitik bakış.",
        },
      ],
    },
    {
      label: "Ödeme & Tahsilat",
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z",
      accent: "from-emerald-500 to-teal-500",
      ring: "ring-emerald-200",
      items: [
        {
          title: "Çoklu Ödeme Yöntemi",
          desc: "Nakit, hesaba, POS, peşin, cari, firma cari — TL/USD/EUR para biriminde.",
        },
        {
          title: "Kasa Görünümü",
          desc: "Tüm tahsilatlar tek panelde günlük/haftalık/aylık toplam ile görünür.",
        },
        {
          title: "Banka Hesabı Yönetimi",
          desc: "Birden fazla banka hesabı tanımla, dosyalara hangisinin geldiğini görüntüle.",
        },
        {
          title: "Ön Ödeme + Kalan",
          desc: "Müşteri taksitli ödeyecekse ön ödeme alır, kalan otomatik hesaplanır.",
        },
        {
          title: "Cari Hesap Takibi",
          desc: "Müşteri/firma bazlı borç-alacak — ay sonu cari kapanışı kolaylaşır.",
        },
        {
          title: "Davetiye Ücreti",
          desc: "Schengen davet için ek ücret kalemini ana ücretten ayrı izleyin.",
        },
      ],
    },
    {
      label: "Ekip & Operasyon",
      icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z",
      accent: "from-amber-500 to-orange-500",
      ring: "ring-amber-200",
      items: [
        {
          title: "Personel Yönetimi",
          desc: "Genel müdür her şirkette 3 personele kadar hesap açabilir, görevler atayabilir.",
        },
        {
          title: "Personel Performansı",
          desc: "Hangi personel kaç dosya yapıyor, kaç tahsilat alıyor, başarı oranı ne — şeffaf rakamlar.",
        },
        {
          title: "Dosya Devri",
          desc: "Personel ayrılırsa veya başkasına devredilse, dosyalar tek tıkla başka kullanıcıya atanır.",
        },
        {
          title: "Günlük Rapor",
          desc: "Her sabah genel müdüre dünün özeti — yeni dosya, tahsilat, sonuçlanan dosyalar.",
        },
        {
          title: "Sistem Logları",
          desc: "Kim ne yaptı, ne zaman değiştirdi — tüm işlemler kaydedilir.",
        },
      ],
    },
    {
      label: "Raporlama & Analiz",
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
      accent: "from-cyan-500 to-sky-500",
      ring: "ring-cyan-200",
      items: [
        {
          title: "Dashboard Özeti",
          desc: "Aktif dosya, günün randevuları, ödenmemiş, toplam gelir — tek ekran nabız.",
        },
        {
          title: "Aylık Özet PDF",
          desc: "Aylık raporu PDF indir veya e-posta ile gönder — yatırımcı/şirket sahibi için hazır.",
        },
        {
          title: "Ülke Analizi",
          desc: "En çok başvuru hangi ülkeye, hangi ülke kabul oranı yüksek — stratejik karar.",
        },
        {
          title: "Vize Sonuç Takibi",
          desc: "Onay/red oranı, başvuru süresi ortalaması, takip numarası bazlı durum.",
        },
        {
          title: "Prim/Komisyon",
          desc: "Ülke bazlı prim oranları tanımla, personele otomatik prim hesaplanır.",
        },
      ],
    },
    {
      label: "Bildirim & İletişim",
      icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
      accent: "from-rose-500 to-pink-500",
      ring: "ring-rose-200",
      items: [
        {
          title: "Sistem Bildirimleri",
          desc: "Yaklaşan randevu, eksik evrak, ödenmemiş dosya — sağ üst zilden anında.",
        },
        {
          title: "Otomatik E-postalar",
          desc: "Hoş geldin, tahsilat alındı, randevu hatırlatma, dosya sonuçlandı — hepsi otomatik.",
        },
        {
          title: "İnaktif GM Uyarısı",
          desc: "2 gün giriş yapmayan genel müdüre otomatik hatırlatma.",
        },
      ],
    },
    {
      label: "Güvenlik & Erişim",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      accent: "from-slate-700 to-slate-900",
      ring: "ring-slate-200",
      items: [
        {
          title: "Rol Bazlı Erişim",
          desc: "Genel müdür, personel, muhasebe — her rolün erişebileceği veriler ayrı.",
        },
        {
          title: "Çoklu Cihaz",
          desc: "Bilgisayar, tablet, telefon — her yerden aynı güvenli panel, otomatik senkron.",
        },
        {
          title: "Profil Yönetimi",
          desc: "Foto yükleme, şifre güncelleme, kişisel ayarlar tek profil sayfasında.",
        },
        {
          title: "Şifre Sıfırlama",
          desc: "E-posta üzerinden tek tıkla güvenli şifre sıfırlama akışı.",
        },
        {
          title: "Verilerin Yedeklenmesi",
          desc: "Tüm veriler bulutta şifrelenip yedeklenir; kaybolma riski sıfır.",
        },
      ],
    },
  ];

  return (
    <section id="ozellikler" className="py-20 sm:py-28 bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Tüm Özellikler</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Vize ofisinde ihtiyaç duyduğun{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              her şey burada.
            </span>
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed text-base sm:text-lg">
            AI'dan tahsilata, randevudan personel performansına — Visora paneli operasyonun her noktasını
            kapsar. Aşağıda 8 kategoride 40+ özellik bulabilirsin.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.label}
              className={`relative rounded-3xl bg-white border p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all ${
                cat.isAI ? "border-violet-200 bg-gradient-to-br from-violet-50/30 via-white to-fuchsia-50/30" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cat.accent} flex items-center justify-center shadow-lg`}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={cat.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  {cat.label}
                  {cat.isAI && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-200 text-[9px] font-black uppercase tracking-wider text-violet-700">
                      Yeni
                    </span>
                  )}
                </h3>
              </div>

              <ul className="space-y-3">
                {cat.items.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${cat.accent} flex items-center justify-center mt-0.5 shadow-sm`}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-[13px] text-slate-600 leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-600 mb-4">
            Tüm özellikler her plana dahildir. <strong className="text-slate-900">Modül kilidi yok.</strong>
          </p>
          <a
            href="#fiyatlandirma"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all"
          >
            Fiyatlara dön
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Sürekli dönen referans logoları ─── */
type RefLogo = { id: string; company_name: string; logo_url: string };

function ReferencesMarquee() {
  const [logos, setLogos] = useState<RefLogo[]>([]);

  useEffect(() => {
    fetch("/api/visora/reference-logos")
      .then((r) => r.json())
      .then((d) => {
        if (d.logos?.length) setLogos(d.logos);
      })
      .catch(() => {});
  }, []);

  if (logos.length === 0) return null;

  return (
    <section className="py-16 sm:py-20 bg-white border-y border-slate-200 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600/70 mb-2">Referanslarımız</p>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Bize güvenen firmalar
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
          Türkiye&apos;nin önde gelen vize ofisleri Visora ile çalışıyor.
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 sm:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 sm:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        {/* İki kopya: biri kayarken diğeri arkadan geliyor */}
        <div className="flex" style={{ animation: `visora-marquee ${logos.length * 8}s linear infinite` }}>
          {[0, 1].map((setIdx) => (
            <div key={setIdx} className="flex-shrink-0 flex items-start justify-around" style={{ minWidth: "100vw" }}>
              {logos.map((logo) => (
                <div key={`${logo.id}-${setIdx}`} className="flex flex-col items-center gap-2">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center p-4">
                    <img
                      src={logo.logo_url}
                      alt={logo.company_name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    {logo.company_name}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes visora-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </section>
  );
}
