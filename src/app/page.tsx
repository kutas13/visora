import Link from "next/link";

const features = [
  { title: "Müşteri Yönetimi", desc: "Tüm müşteri bilgilerini tek merkezde toplayın." },
  { title: "Vize Dosya Takibi", desc: "Başvurularınızı adım adım takip edin." },
  { title: "Randevu Takvimi", desc: "Konsolosluk randevularını planlayın." },
  { title: "Vize Bitiş Takibi", desc: "Onaylanan vizelerin bitiş tarihlerini izleyin." },
  { title: "Gelir & Raporlar", desc: "Detaylı grafiklerle performansınızı görün." },
  { title: "Multi-Tenant", desc: "Her acente kendi verisini güvenle yönetir." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-navy-50">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-navy-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
              <span className="text-lg font-black text-white">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-navy-900">Visora</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-navy-500 hover:text-primary-500">Özellikler</a>
            <a href="#pricing" className="text-sm font-medium text-navy-500 hover:text-primary-500">Fiyatlar</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-xl border border-navy-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-700 hover:border-primary-300 hover:text-primary-500">
              Giriş Yap
            </Link>
            <Link href="/register" className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30">
              Hemen Başla
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 lg:pt-40 lg:pb-32">
        <div className="absolute inset-0 -z-10">
          <div className="animate-float absolute -top-20 left-1/4 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="animate-float delay-200 absolute top-40 right-1/4 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="animate-fade-in-up">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-5 py-2 text-sm font-semibold text-primary-600">
                  Yeni nesil vize yönetim platformu
                </span>
              </div>
              <h1 className="animate-fade-in-up delay-100 mt-8 text-5xl font-extrabold leading-[1.1] tracking-tight text-navy-900 md:text-6xl">
                Vize süreçlerinizi
                <span className="bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent"> akıllıca </span>
                yönetin
              </h1>
              <p className="animate-fade-in-up delay-200 mt-6 max-w-lg text-lg text-navy-500">
                Müşteri, evrak, randevu ve başvuru süreçlerinizi tek platformda yönetin. Acentenizi geleceğe taşıyın.
              </p>
              <div className="animate-fade-in-up delay-300 mt-10 flex flex-wrap items-center gap-4">
                <Link href="/register" className="animate-pulse-glow inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-primary-500/25">
                  Ücretsiz Deneyin →
                </Link>
                <a href="#features" className="inline-flex items-center gap-2 rounded-2xl border border-navy-200 bg-white px-6 py-4 text-base font-semibold text-navy-700 shadow-sm hover:shadow-md">
                  Keşfet
                </a>
              </div>
            </div>

            <div className="animate-fade-in-up delay-500 relative">
              <div className="animate-float rounded-3xl border border-navy-200/80 bg-white p-3 shadow-2xl shadow-navy-200/50">
                <div className="rounded-2xl bg-gradient-to-br from-navy-50 via-white to-primary-50/30 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                    <span className="ml-2 text-xs text-navy-400">Visora Dashboard</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { label: "Müşteri", value: "1,247", color: "text-primary-500" },
                      { label: "Aktif Dosya", value: "384", color: "text-accent-500" },
                      { label: "Onay Oranı", value: "%94", color: "text-green-600" },
                      { label: "Bu Ay Gelir", value: "₺248K", color: "text-orange-500" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-navy-400">{s.label}</p>
                        <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-navy-200 bg-white py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {[
            { value: "500+", label: "Aktif Acente" },
            { value: "50K+", label: "Dosya Takibi" },
            { value: "%99.9", label: "Uptime" },
            { value: "7/24", label: "Destek" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-3xl font-bold text-transparent">{s.value}</p>
              <p className="mt-1 text-sm text-navy-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <span className="inline-flex rounded-full border border-accent-200 bg-accent-50 px-4 py-1.5 text-sm font-semibold text-accent-600">Özellikler</span>
            <h2 className="mt-5 text-4xl font-bold text-navy-900">İhtiyacınız olan her şey tek platformda</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-navy-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5">
                <h3 className="text-lg font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-navy-900">Şeffaf fiyatlandırma</h2>
          </div>
          <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-navy-200 bg-white p-8 hover:shadow-lg">
              <h3 className="text-lg font-semibold text-navy-900">Aylık Plan</h3>
              <div className="mt-4"><span className="text-4xl font-bold text-navy-900">₺2.500</span><span className="text-navy-500"> / ay</span></div>
              <Link href="/register" className="mt-8 block rounded-xl border-2 border-primary-500 py-3.5 text-center text-sm font-semibold text-primary-500 hover:bg-primary-500 hover:text-white">Hemen Başla</Link>
            </div>
            <div className="relative rounded-2xl border-2 border-primary-500 bg-white p-8 shadow-xl shadow-primary-500/10">
              <span className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 px-5 py-1 text-xs font-semibold text-white shadow-lg">Popüler</span>
              <h3 className="text-lg font-semibold text-navy-900">Yıllık Plan</h3>
              <div className="mt-4"><span className="text-4xl font-bold text-navy-900">₺45.000</span><span className="text-navy-500"> / yıl</span></div>
              <p className="mt-1 text-sm font-medium text-accent-500">%25 tasarruf</p>
              <Link href="/register" className="mt-8 block rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-primary-500/25">Hemen Başla</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-500 via-primary-600 to-navy-800 p-14 text-center shadow-2xl shadow-primary-500/20 md:p-20">
            <h2 className="text-4xl font-bold text-white">Acentenizi dijitalleştirmeye hazır mısınız?</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">Hemen kayıt olun, dakikalar içinde başlayın.</p>
            <Link href="/register" className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-white px-10 py-4 text-base font-semibold text-primary-500 shadow-xl hover:shadow-2xl">
              Ücretsiz Kayıt Ol →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-200 bg-white py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500"><span className="text-sm font-black text-white">V</span></div>
            <span className="text-lg font-bold text-navy-900">Visora</span>
          </div>
          <p className="text-sm text-navy-400">&copy; 2026 Visora. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
