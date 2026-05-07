"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  musteri_adi: string;
  pasaport_no: string;
  ulke: string;
  musteri_telefon?: string;
};

const KATEGORILER = ["Ticari", "Turistik", "Aile Ziyareti", "Arkadaş Ziyareti", "Eğitim"] as const;
const CALISMA_DURUMLARI = ["Şirket Sahibi", "Çalışan", "Sponsor"] as const;

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export default function DilekceAIPage() {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [dilekceTuru, setDilekceTuru] = useState<"Bireysel" | "Şirket">("Bireysel");
  const [musteriAdi, setMusteriAdi] = useState("");
  const [pasaportNo, setPasaportNo] = useState("");
  const [ulke, setUlke] = useState("");
  const [basvuruSehri, setBasvuruSehri] = useState("");
  const [kategori, setKategori] = useState<string>("");
  const [seyahatBaslangic, setSeyahatBaslangic] = useState("");
  const [seyahatBitis, setSeyahatBitis] = useState("");
  const [calismaDurumu, setCalismaDurumu] = useState<string>("");

  const [turkSirketAdi, setTurkSirketAdi] = useState("");
  const [sirketSahibiIsmi, setSirketSahibiIsmi] = useState("");
  const [iseGirisTarihi, setIseGirisTarihi] = useState("");
  const [davetEdenSirketAdi, setDavetEdenSirketAdi] = useState("");
  const [davetEdenSirketSehir, setDavetEdenSirketSehir] = useState("");
  const [sponsorIsmi, setSponsorIsmi] = useState("");
  const [gidilecekSehir, setGidilecekSehir] = useState("");
  const [davetEdenKisi, setDavetEdenKisi] = useState("");
  const [akrabaYakinligi, setAkrabaYakinligi] = useState("");
  const [davetEdenKisiSehir, setDavetEdenKisiSehir] = useState("");
  const [davetEdenOkul, setDavetEdenOkul] = useState("");
  const [okulSehir, setOkulSehir] = useState("");
  const [ekstraBilgi, setEkstraBilgi] = useState("");

  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<"tr" | "en">("tr");

  const outputRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());

  // Sayfa yüklendiğinde tüm aktif müşterileri tek seferde çek
  useEffect(() => {
    (async () => {
      setSearching(true);
      try {
        const supabase = supabaseRef.current;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";

        const res = await fetch(`/api/dilekce-ai/search-customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.error("Müşteri yükleme hatası:", await res.text());
          return;
        }

        const json = await res.json();
        setAllCustomers(json.customers || []);
      } catch (err) {
        console.error("Müşteri yükleme exception:", err);
      } finally {
        setSearching(false);
      }
    })();
  }, []);

  // Anlık client-side filter
  const filteredCustomers = searchQuery.trim().length > 0
    ? allCustomers
        .filter((c) => {
          const q = searchQuery.toLowerCase().trim();
          return (
            c.musteri_adi.toLowerCase().includes(q) ||
            (c.pasaport_no || "").toLowerCase().includes(q) ||
            (c.ulke || "").toLowerCase().includes(q)
          );
        })
        .slice(0, 20)
    : [];

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    setMusteriAdi(val);
    setShowDropdown(val.trim().length > 0);
  };

  const selectCustomer = (c: Customer) => {
    setMusteriAdi(c.musteri_adi);
    setPasaportNo(c.pasaport_no || "");
    setUlke(c.ulke || "");
    setSearchQuery(c.musteri_adi);
    setShowDropdown(false);
  };

  const validate = (): string | null => {
    if (!musteriAdi.trim()) return "Müşteri adı gerekli.";
    if (!pasaportNo.trim()) return "Pasaport no gerekli.";
    if (!ulke.trim()) return "Ülke gerekli.";
    if (!basvuruSehri.trim()) return "Başvuru şehri gerekli.";
    if (!kategori) return "Kategori seçiniz.";
    if (!seyahatBaslangic || !seyahatBitis) return "Seyahat tarihleri gerekli.";
    if (!calismaDurumu) return "Çalışma durumu seçiniz.";

    const parseDate = (s: string) => {
      const [d, m, y] = s.split(".");
      return new Date(`${y}-${m}-${d}`);
    };
    const start = parseDate(seyahatBaslangic);
    const end = parseDate(seyahatBitis);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Tarih formatı hatalı (GG.AA.YYYY).";
    if (end < start) return "Dönüş tarihi gidiş tarihinden önce olamaz.";

    return null;
  };

  const handleGenerate = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setOutput("");
    setGenerating(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/dilekce-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          dilekceTuru, basvuruSehri,
          musteriAdi, pasaportNo, ulke, kategori,
          seyahatBaslangic, seyahatBitis, calismaDurumu,
          turkSirketAdi, sirketSahibiIsmi, iseGirisTarihi,
          davetEdenSirketAdi, davetEdenSirketSehir, sponsorIsmi,
          gidilecekSehir, davetEdenKisi, akrabaYakinligi,
          davetEdenKisiSehir, davetEdenOkul, okulSehir, ekstraBilgi,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Dilekçe oluşturulamadı.");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        text += chunk;
        setOutput(text);
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }
    } catch (err: any) {
      setError(err?.message || "Bir hata oluştu.");
    } finally {
      setGenerating(false);
    }
  };

  const splitOutput = (text: string): { tr: string; en: string } => {
    const enMarkers = [
      "===ENGLISH===",
      "📄 ENGLISH",
      "ENGLISH PETITION",
      "ENGLISH LETTER",
      "ENGLISH VERSION",
    ];
    let enIdx = -1;
    let matchedMarker = "";
    for (const marker of enMarkers) {
      const idx = text.indexOf(marker);
      if (idx !== -1 && (enIdx === -1 || idx < enIdx)) {
        enIdx = idx;
        matchedMarker = marker;
      }
    }
    if (enIdx === -1) {
      return { tr: text.replace(/===TURKCE===|📄 TÜRKÇE DİLEKÇE/g, "").trim(), en: "" };
    }
    const tr = text.slice(0, enIdx).replace(/===TURKCE===|📄 TÜRKÇE DİLEKÇE/g, "").trim();
    const en = text.slice(enIdx + matchedMarker.length).replace(/^[\s\S]*?\n/, "").trim();
    return { tr, en };
  };

  const split = splitOutput(output);
  const currentText = activeLang === "tr" ? split.tr : split.en;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentText || output);
  };

  useEffect(() => {
    if (outputRef.current && generating) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, generating]);

  const showDavetSirket = kategori === "Ticari";
  const showGidilecekSehir = kategori === "Turistik";
  const showDavetKisi = kategori === "Aile Ziyareti" || kategori === "Arkadaş Ziyareti";
  const showAkraba = kategori === "Aile Ziyareti";
  const showOkul = kategori === "Eğitim";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Dilekçe AI</h1>
              <p className="text-slate-500 text-sm mt-0.5">Schengen vize başvuruları için otomatik dilekçe oluşturucu</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Geri Dön
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-5">
            {/* Müşteri Arama */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">1</span>
                Müşteri Bilgileri
              </h2>

              <div className="space-y-3">
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Müşteri Ara</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => searchQuery.trim().length > 0 && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="İsim yazarak müşteri arayın..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {searching && (
                    <div className="absolute right-3 top-8">
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                  )}
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl max-h-64 overflow-y-auto">
                      {filteredCustomers.map((c, i) => (
                        <button
                          key={i}
                          onMouseDown={() => selectCustomer(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm flex justify-between items-center border-b border-slate-100 last:border-0"
                        >
                          <span className="font-medium text-slate-800">{c.musteri_adi}</span>
                          <span className="text-xs text-slate-400">{c.pasaport_no} · {c.ulke}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ad Soyad</label>
                    <input
                      type="text" value={musteriAdi}
                      onChange={(e) => setMusteriAdi(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pasaport No</label>
                    <input
                      type="text" value={pasaportNo}
                      onChange={(e) => setPasaportNo(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Başvurulan Ülke</label>
                  <input
                    type="text" value={ulke}
                    onChange={(e) => setUlke(e.target.value)}
                    placeholder="Almanya, Fransa, İtalya..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Kategori + Tarih */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-black">2</span>
                Başvuru Detayları
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dilekçe Türü</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Bireysel", "Şirket"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDilekceTuru(t)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          dilekceTuru === t
                            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {t === "Bireysel" ? "👤 Bireysel Dilekçe" : "🏢 Şirket Dilekçesi"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1.5">
                    {dilekceTuru === "Bireysel"
                      ? "Başvuru sahibinin ağzından yazılır."
                      : "Çalıştığı şirketin ağzından yazılır (şirket bilgileri gerekli)."}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Başvuru Şehri</label>
                  <input
                    type="text"
                    value={basvuruSehri}
                    onChange={(e) => setBasvuruSehri(e.target.value)}
                    placeholder="Ankara, İstanbul, İzmir, Antalya..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    Ankara → Büyükelçiliği · Diğer şehirler → Başkonsolosluğu
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kategori</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {KATEGORILER.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKategori(k)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          kategori === k
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Gidiş Tarihi</label>
                    <input
                      type="text"
                      value={seyahatBaslangic}
                      onChange={(e) => setSeyahatBaslangic(formatDateInput(e.target.value))}
                      placeholder="GG.AA.YYYY"
                      maxLength={10}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Dönüş Tarihi</label>
                    <input
                      type="text"
                      value={seyahatBitis}
                      onChange={(e) => setSeyahatBitis(formatDateInput(e.target.value))}
                      placeholder="GG.AA.YYYY"
                      maxLength={10}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Çalışma Durumu</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CALISMA_DURUMLARI.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCalismaDurumu(c)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          calismaDurumu === c
                            ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20"
                            : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Koşullu Alanlar */}
            {kategori && calismaDurumu && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center text-xs font-black">3</span>
                  Ek Bilgiler
                </h2>

                <div className="space-y-3">
                  {/* Şirket sahibi veya çalışan → Türk şirket adı */}
                  {(calismaDurumu === "Şirket Sahibi" || calismaDurumu === "Çalışan") && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Türk Şirket Adı</label>
                      <input type="text" value={turkSirketAdi} onChange={(e) => setTurkSirketAdi(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  )}

                  {/* Çalışan → ek alanlar */}
                  {calismaDurumu === "Çalışan" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">İşe Giriş Tarihi</label>
                          <input type="text" value={iseGirisTarihi}
                            onChange={(e) => setIseGirisTarihi(formatDateInput(e.target.value))}
                            placeholder="GG.AA.YYYY" maxLength={10}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Şirket Sahibinin İsmi</label>
                          <input type="text" value={sirketSahibiIsmi} onChange={(e) => setSirketSahibiIsmi(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Sponsor */}
                  {calismaDurumu === "Sponsor" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Sponsorun Ad Soyad</label>
                      <input type="text" value={sponsorIsmi} onChange={(e) => setSponsorIsmi(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  )}

                  {/* Ticari → davet eden şirket */}
                  {showDavetSirket && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Davet Eden Şirket Adı</label>
                        <input type="text" value={davetEdenSirketAdi} onChange={(e) => setDavetEdenSirketAdi(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Davet Eden Şirketin Şehri</label>
                        <input type="text" value={davetEdenSirketSehir} onChange={(e) => setDavetEdenSirketSehir(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                    </div>
                  )}

                  {/* Turistik → gidilecek şehir */}
                  {showGidilecekSehir && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Gidilecek Şehir</label>
                      <input type="text" value={gidilecekSehir} onChange={(e) => setGidilecekSehir(e.target.value)}
                        placeholder="Berlin, Paris, Roma..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  )}

                  {/* Aile/Arkadaş → davet eden kişi */}
                  {showDavetKisi && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Davet Eden Kişi</label>
                        <input type="text" value={davetEdenKisi} onChange={(e) => setDavetEdenKisi(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Kişinin Bulunduğu Şehir</label>
                        <input type="text" value={davetEdenKisiSehir} onChange={(e) => setDavetEdenKisiSehir(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                    </div>
                  )}

                  {/* Aile → akraba yakınlığı */}
                  {showAkraba && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Akraba Yakınlığı</label>
                      <input type="text" value={akrabaYakinligi} onChange={(e) => setAkrabaYakinligi(e.target.value)}
                        placeholder="Anne, Baba, Kardeş, Amca, Hala..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  )}

                  {/* Eğitim → okul */}
                  {showOkul && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Davet Eden Okul</label>
                        <input type="text" value={davetEdenOkul} onChange={(e) => setDavetEdenOkul(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Okulun Şehri</label>
                        <input type="text" value={okulSehir} onChange={(e) => setOkulSehir(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ekstra Bilgi */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">+</span>
                Ekstra Bilgi <span className="text-[10px] font-normal text-slate-400 normal-case">(opsiyonel)</span>
              </h2>
              <textarea
                value={ekstraBilgi}
                onChange={(e) => setEkstraBilgi(e.target.value)}
                rows={3}
                placeholder="Örn: Eşi Ayşe Yılmaz (Pasaport: U12345678) ile birlikte seyahat edecektir. Daha önce 2 kez Schengen vizesi almıştır..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Hata */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}

            {/* Buton */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Dilekçe Oluşturuluyor...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Dilekçe Oluştur
                </>
              )}
            </button>
          </div>

          {/* Çıktı */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-semibold text-slate-500">Dilekçe Çıktısı</span>
                </div>
                {output && currentText && (
                  <button onClick={copyToClipboard} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Kopyala
                  </button>
                )}
              </div>

              {/* Dil Sekmeleri */}
              {output && (
                <div className="flex border-b border-slate-100">
                  <button
                    onClick={() => setActiveLang("tr")}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                      activeLang === "tr"
                        ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    🇹🇷 Türkçe
                  </button>
                  <button
                    onClick={() => setActiveLang("en")}
                    disabled={!split.en}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                      activeLang === "en"
                        ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    🇬🇧 English {!split.en && generating && "(yazılıyor...)"}
                  </button>
                </div>
              )}

              <div
                ref={outputRef}
                className="p-5 min-h-[500px] max-h-[75vh] overflow-y-auto"
              >
                {!output && !generating ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-400">Formu doldurup dilekçe oluşturun</p>
                    <p className="text-xs text-slate-300 mt-1">Türkçe ve İngilizce dilekçeler ayrı sekmelerde gösterilir</p>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-800 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {currentText || (activeLang === "en" ? "İngilizce dilekçe yazılıyor, Türkçe sekmesinden takip edebilirsiniz..." : output)}
                    {generating && (currentText || activeLang === "tr") && (
                      <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-0.5" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
