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

type LeadIntent = "trial" | "callback";

const benefits = [
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
            <a href="#nasil" className="hover:text-indigo-600 transition-colors">Nasıl Çalışır</a>
            <a href="#fiyatlandirma" className="hover:text-indigo-600 transition-colors">Fiyatlandırma</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Giriş
            </Link>
            <button
              onClick={() => openLead("trial")}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all"
            >
              <span className="hidden sm:inline">15 gün ücretsiz</span>
              <span className="sm:hidden">Ücretsiz</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-12 sm:pt-20 pb-20 sm:pb-28">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-indigo-700 text-xs font-semibold shadow-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              Vize ofisleri için modern operasyon platformu
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black text-slate-900 leading-[1.05] tracking-tight">
              Excel ve WhatsApp ile{" "}
              <span className="bg-gradient-to-r from-rose-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent">
                para kaybetmeyi bırakın.
              </span>
              <br />
              <span className="text-slate-900">Vize ofisinizi tek panelden büyütün.</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
              Visora; dosya, randevu, tahsilat ve ekip operasyonunu tek panelde toplar. Unutulan randevu, kaybolan dosya, takip edilemeyen tahsilat — hepsi son bulur.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => openLead("trial")}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/60 hover:scale-[1.02] transition-all"
              >
                15 gün ücretsiz kullan
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <button
                onClick={() => openLead("callback")}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold text-slate-800 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Sizi arayalım
              </button>
            </div>

            <ul className="mt-8 grid sm:grid-cols-3 gap-3">
              {[
                "Randevu kaçırma derdi biter",
                "Tüm dosyalar tek panelde",
                "Tahsilatını anlık takip et",
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
                <strong className="text-slate-700">Türkiye'nin dört bir yanından</strong> vize ofisleri tarafından kullanılıyor
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
                className="group relative rounded-2xl bg-white border border-slate-200/80 p-6 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all"
              >
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
      <section id="fiyatlandirma" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">Fiyatlandırma</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Sade ve şeffaf <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">tek paket</span>
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Tüm modüller, sınırsız müşteri ve sınırsız dosya — gizli ücret yok. <strong className="text-slate-900">1 ekstra müşteri kazandırsa bile kendini amorti eder.</strong>
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

                {/* Risk reversal / guarantees */}
                <div className="mt-6 grid sm:grid-cols-3 gap-3">
                  {[
                    { label: "15 gün ücretsiz", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                    { label: "İstediğin zaman iptal", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
                    { label: "Kurulum desteği dahil", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.075 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" },
                  ].map((g) => (
                    <div
                      key={g.label}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[12.5px] font-bold text-emerald-700"
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={g.icon} />
                      </svg>
                      {g.label}
                    </div>
                  ))}
                </div>

                <div className="mt-7 grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
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
                  onClick={() => openLead("trial")}
                  className="mt-10 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.01] transition-all"
                >
                  Hemen ücretsiz başla
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <p className="text-[11.5px] text-slate-500 text-center mt-3">
                  Kredi kartı gerekmez. 15 gün boyunca tüm modülleri ücretsiz kullan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-fuchsia-600 to-pink-600 p-8 sm:p-12 lg:p-16 shadow-2xl shadow-indigo-500/30">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 w-96 h-96 rounded-full bg-fuchsia-400/30 blur-3xl" />
            <div className="relative text-center max-w-3xl mx-auto">
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Her gün kaybettiğiniz zamanı geri kazanın.
              </h3>
              <p className="mt-5 text-base sm:text-lg text-white/90 leading-relaxed">
                Kaçırılan bir randevu — kaybolan bir müşteri. Takip edemediğin tahsilat — kaybolan ciro. Excel ve WhatsApp kaosunda her gün ofisinin kontrolünü biraz daha kaybediyorsun. <strong className="text-white">Visora bunu bitirir.</strong>
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openLead("trial")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold text-indigo-700 bg-white hover:bg-slate-50 hover:scale-[1.02] transition-all shadow-lg"
                >
                  15 gün ücretsiz kullan
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <button
                  onClick={() => openLead("callback")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 transition-all"
                >
                  Sizi arayalım
                </button>
              </div>

              <p className="mt-5 text-xs text-white/70">
                Kredi kartı gerekmez · 15 gün boyunca tüm modüller açık · Kurulum desteği dahil
              </p>
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
