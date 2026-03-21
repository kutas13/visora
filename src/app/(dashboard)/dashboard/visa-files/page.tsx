"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TARGET_COUNTRIES } from "@/lib/constants";

interface VisaFile {
  id: string; country: string; visa_type: string; status: string;
  dosya_hazir: boolean; basvuru_yapildi: boolean; islemden_cikti: boolean;
  visa_result: string | null; visa_expiry_date: string | null;
  ucret: number | null; ucret_currency: string | null; odeme_plani: string | null;
  evrak_durumu: string | null; evrak_eksik_mi: boolean | null; evrak_not: string | null;
  randevu_tarihi: string | null; musteri_telefon: string | null;
  assigned_user_id: string | null; client_id: string | null;
  cari_tipi: string | null; cari_sahibi: string | null; company_id: string | null;
  sonuc_tarihi: string | null;
  created_at: string;
  clients?: any;
}
interface ClientRow { id: string; full_name: string; passport_no: string | null; phone: string | null; }
interface StaffRow { id: string; full_name: string; avatar_url: string | null; }
interface CompanyRow { id: string; firma_adi: string; }

const STEPS = ["all","Yeni","Evrak Eksik","dosya_hazir","basvuru_yapildi","islemden_cikti"];
const STEP_LABELS: Record<string,string> = { all:"Hepsi", Yeni:"Yeni", "Evrak Eksik":"Evrak Eksik", dosya_hazir:"Dosya Hazır", basvuru_yapildi:"İşlemde", islemden_cikti:"Sonuçlanan" };

function getLabel(f: VisaFile) {
  if (f.visa_result === "vize_onay") return "Vize Onay";
  if (f.visa_result === "red") return "Red";
  if (f.islemden_cikti) return "İşlemden Çıktı";
  if (f.basvuru_yapildi) return "İşlemde";
  if (f.dosya_hazir) return "Dosya Hazır";
  if (f.status === "Evrak Eksik") return "Evrak Eksik";
  return "Yeni";
}

function badgeColor(l: string) {
  const m: Record<string,string> = { "Vize Onay":"bg-green-100 text-green-700","Red":"bg-red-100 text-red-700","İşlemden Çıktı":"bg-purple-100 text-purple-700","İşlemde":"bg-orange-100 text-orange-700","Dosya Hazır":"bg-blue-100 text-blue-700","Evrak Eksik":"bg-amber-100 text-amber-700" };
  return m[l] || "bg-navy-100 text-navy-600";
}

const defaultForm = { client_id: "", country: "", visa_type: "", islem_tipi: "randevulu", randevu_tarihi: "", evrak_durumu: "gelmedi", evrak_eksik_mi: false, evrak_not: "", ucret: "", ucret_currency: "TL", odeme_plani: "pesin", assigned_user_id: "", cari_tipi: "", cari_sahibi: "", company_search: "", company_id: "" };

export default function VisaFilesPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stepFilter, setStepFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingFile, setEditingFile] = useState<VisaFile | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDrop, setClientDrop] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDrop, setCountryDrop] = useState(false);
  const [companyDrop, setCompanyDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultModal, setResultModal] = useState(false);
  const [resultFileId, setResultFileId] = useState("");
  const [resultType, setResultType] = useState<"vize_onay"|"red">("vize_onay");
  const [resultForm, setResultForm] = useState({ sonuc_tarihi: "", visa_expiry_date: "", musteri_telefon: "" });
  const clientRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
    setUserId(localStorage.getItem("user_id"));
    setUserRole(localStorage.getItem("user_role"));
    setUserName(localStorage.getItem("user_name") || "");
  }, []);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    let q = supabase.from("applications").select("*, clients(full_name, passport_no, phone)").eq("agency_id", agencyId).order("created_at", { ascending: false });
    if (userRole === "staff" && userId) q = q.eq("assigned_user_id", userId);
    const [fr, cr, sr, cmpR] = await Promise.all([
      q,
      supabase.from("clients").select("id, full_name, passport_no, phone").eq("agency_id", agencyId).order("full_name"),
      supabase.from("users").select("id, full_name, avatar_url").eq("agency_id", agencyId),
      supabase.from("companies").select("id, firma_adi").eq("agency_id", agencyId).order("firma_adi"),
    ]);
    setFiles(fr.data || []); setClients(cr.data || []); setStaff(sr.data || []); setCompanies(cmpR.data || []);
    setLoading(false);
  }, [agencyId, supabase, userRole, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setClientDrop(false);
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryDrop(false);
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanyDrop(false);
    };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredClients = clients.filter(c => c.full_name.toLowerCase().includes(clientSearch.toLowerCase()));
  const countryOptions = TARGET_COUNTRIES.map((c: any) => typeof c === "string" ? c : c.label);
  const filteredCountries = countryOptions.filter((c: string) => c.toLowerCase().includes(countrySearch.toLowerCase()));
  const filteredCompanies = companies.filter(c => c.firma_adi.toLowerCase().includes((form.company_search || "").toLowerCase()));

  const openNew = () => { setEditingFile(null); setForm(defaultForm); setClientSearch(""); setCountrySearch(""); setShowForm(true); };
  const openEdit = (f: VisaFile) => {
    setEditingFile(f);
    setForm({ client_id: f.client_id || "", country: f.country, visa_type: f.visa_type, islem_tipi: f.randevu_tarihi ? "randevulu" : "randevusuz", randevu_tarihi: f.randevu_tarihi ? new Date(f.randevu_tarihi).toISOString().slice(0, 16) : "", evrak_durumu: f.evrak_durumu || "gelmedi", evrak_eksik_mi: f.evrak_eksik_mi || false, evrak_not: f.evrak_not || "", ucret: f.ucret ? String(f.ucret) : "", ucret_currency: f.ucret_currency || "TL", odeme_plani: f.odeme_plani || "pesin", assigned_user_id: f.assigned_user_id || "", cari_tipi: f.cari_tipi || "", cari_sahibi: f.cari_sahibi || "", company_search: "", company_id: f.company_id || "" });
    setClientSearch(f.clients?.full_name || ""); setCountrySearch(f.country); setShowForm(true);
  };

  const handleSave = async () => {
    if (!agencyId) { alert("Oturum hatası. Çıkış yapıp tekrar giriş yapın."); return; }
    if (!form.client_id) { alert("Müşteri seçmediniz."); return; }
    if (!form.country) { alert("Ülke seçmediniz."); return; }
    if (!form.visa_type) { alert("Vize türü girmediniz."); return; }
    setSaving(true);

    let status: string;
    if (form.evrak_durumu === "geldi" && form.evrak_eksik_mi) {
      status = "Evrak Eksik";
    } else if (form.evrak_durumu === "geldi" && !form.evrak_eksik_mi) {
      status = editingFile ? "Yeni" : "Yeni";
    } else {
      status = editingFile ? editingFile.status : "Yeni";
    }
    if (editingFile && form.evrak_durumu === "geldi" && !form.evrak_eksik_mi && editingFile.status === "Evrak Eksik") {
      status = "Yeni";
    }

    let companyId = form.company_id || null;
    if (form.odeme_plani === "firma_cari" && form.company_search && !companyId) {
      const { data: newCmp } = await supabase.from("companies").insert({ agency_id: agencyId, firma_adi: form.company_search }).select("id").single();
      if (newCmp) companyId = newCmp.id;
    }

    const payload: any = {
      agency_id: agencyId, client_id: form.client_id, country: form.country, visa_type: form.visa_type, status,
      assigned_user_id: form.assigned_user_id || userId,
      ucret: form.ucret ? Number(form.ucret) : null, ucret_currency: form.ucret_currency, odeme_plani: form.odeme_plani,
      randevu_tarihi: form.randevu_tarihi || null,
      evrak_durumu: form.evrak_durumu, evrak_eksik_mi: form.evrak_eksik_mi, evrak_not: form.evrak_not || null,
      cari_tipi: form.odeme_plani === "firma_cari" ? "firma_cari" : form.odeme_plani === "cari" ? "kullanici_cari" : null,
      cari_sahibi: form.cari_sahibi || null, company_id: companyId,
    };

    if (editingFile) {
      const { error } = await supabase.from("applications").update(payload).eq("id", editingFile.id);
      if (error) { alert("Güncelleme hatası: " + error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("applications").insert(payload).select("id").single();
      if (error) { alert("Oluşturma hatası: " + error.message); setSaving(false); return; }
      if (data && form.islem_tipi === "randevulu" && form.randevu_tarihi) {
        const dt = new Date(form.randevu_tarihi);
        await supabase.from("appointments").insert({ agency_id: agencyId, client_id: form.client_id, application_id: data.id, date: dt.toISOString().split("T")[0], time: dt.toTimeString().slice(0, 5), location: "Belirtilmedi" });
      }
    }
    setSaving(false); setShowForm(false); setEditingFile(null); fetchData();
  };

  const advance = async (f: VisaFile) => {
    const now = new Date().toISOString();
    let u: Record<string,unknown> = {};
    if (!f.dosya_hazir) u = { dosya_hazir: true, dosya_hazir_at: now, status: "Dosya Hazır" };
    else if (!f.basvuru_yapildi) u = { basvuru_yapildi: true, basvuru_yapildi_at: now, status: "İşlemde" };
    else if (!f.islemden_cikti) u = { islemden_cikti: true, islemden_cikti_at: now, status: "İşlemden Çıktı" };
    else return;
    await supabase.from("applications").update(u).eq("id", f.id); fetchData();
  };

  const [deleteTarget, setDeleteTarget] = useState<VisaFile | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("applications").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null); fetchData();
  };

  const openResult = (f: VisaFile) => {
    setResultFileId(f.id); setResultType("vize_onay");
    setResultForm({ sonuc_tarihi: new Date().toISOString().split("T")[0], visa_expiry_date: "", musteri_telefon: f.clients?.phone || f.musteri_telefon || "" });
    setResultModal(true);
  };

  const submitResult = async () => {
    await supabase.from("applications").update({
      visa_result: resultType,
      sonuc_tarihi: resultForm.sonuc_tarihi || new Date().toISOString().split("T")[0],
      visa_result_date: resultForm.sonuc_tarihi || new Date().toISOString().split("T")[0],
      visa_expiry_date: resultType === "vize_onay" && resultForm.visa_expiry_date ? resultForm.visa_expiry_date : null,
      musteri_telefon: resultForm.musteri_telefon || null,
      status: resultType === "vize_onay" ? "Tamamlandı" : "Red",
    }).eq("id", resultFileId);
    setResultModal(false); fetchData();
  };

  const getStaffById = (id: string | null) => staff.find(s => s.id === id);

  let filtered = files.filter(f => {
    const l = getLabel(f);
    if (stepFilter !== "all") {
      if (stepFilter === "dosya_hazir" && l !== "Dosya Hazır") return false;
      if (stepFilter === "basvuru_yapildi" && l !== "İşlemde") return false;
      if (stepFilter === "islemden_cikti" && !["İşlemden Çıktı","Vize Onay","Red"].includes(l)) return false;
      if (stepFilter === "Yeni" && l !== "Yeni") return false;
      if (stepFilter === "Evrak Eksik" && l !== "Evrak Eksik") return false;
    }
    if (search) { const s = search.toLowerCase(); return (f.clients?.full_name||"").toLowerCase().includes(s) || f.country.toLowerCase().includes(s); }
    return true;
  });

  if (staffFilter && userRole === "agency_admin") {
    filtered = filtered.filter(f => f.assigned_user_id === staffFilter);
  }

  const counts = { total: files.length, active: files.filter(f => !f.visa_result).length, approved: files.filter(f => f.visa_result === "vize_onay").length, rejected: files.filter(f => f.visa_result === "red").length };

  const adminName = userName || "Yönetici";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 shadow-lg shadow-orange-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
          </div>
          <div><h1 className="text-xl font-bold text-navy-900">Vize Dosyaları</h1><p className="text-xs text-navy-400">{counts.total} dosya</p></div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20">+ Yeni Dosya</button>
      </div>

      {/* Admin: Staff filter avatars */}
      {userRole === "agency_admin" && staff.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <button onClick={() => setStaffFilter(null)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${!staffFilter ? "bg-navy-800 text-white" : "bg-white text-navy-500 border border-navy-200"}`}>
            Tümü
          </button>
          {staff.map(s => (
            <button key={s.id} onClick={() => setStaffFilter(staffFilter === s.id ? null : s.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${staffFilter === s.id ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "bg-white text-navy-600 border border-navy-200 hover:border-primary-300"}`}>
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary-200 to-primary-100 text-[10px] font-bold text-primary-700">{s.full_name[0]}</div>
              )}
              {s.full_name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        {[{ l:"Toplam",v:counts.total },{ l:"Aktif",v:counts.active },{ l:"Onay",v:counts.approved },{ l:"Red",v:counts.rejected }].map(c=>(
          <div key={c.l} className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">{c.l}</p><p className="mt-1 text-3xl font-bold text-navy-900">{c.v}</p></div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="animate-fade-in-up overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4"><h3 className="font-semibold text-white">{editingFile ? "Dosya Düzenle" : "Yeni Vize Dosyası"}</h3></div>
          <div className="space-y-6 p-6">
            {/* 1. Müşteri */}
            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">1. Müşteri</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative" ref={clientRef}>
                  <input placeholder="Müşteri adı yazın..." value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientDrop(true); setForm({...form, client_id:""}); }} onFocus={() => setClientDrop(true)} className="h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  {clientDrop && filteredClients.length > 0 && <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-xl">{filteredClients.map(c => <button key={c.id} onClick={() => { setForm({...form, client_id:c.id}); setClientSearch(c.full_name); setClientDrop(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 hover:text-primary-600"><span className="font-medium">{c.full_name}</span>{c.passport_no && <span className="ml-2 text-xs text-navy-400">{c.passport_no}</span>}</button>)}</div>}
                </div>
                {userRole === "agency_admin" && staff.length > 1 && <select value={form.assigned_user_id} onChange={e => setForm({...form, assigned_user_id:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-3 text-sm"><option value="">Kendime ata</option>{staff.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select>}
              </div>
            </div>

            {/* 2. Başvuru */}
            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">2. Başvuru</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="relative" ref={countryRef}>
                  <input placeholder="Ülke yazın..." value={countrySearch} onChange={e => { setCountrySearch(e.target.value); setForm({...form, country:e.target.value}); setCountryDrop(true); }} onFocus={() => setCountryDrop(true)} className="h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  {countryDrop && filteredCountries.length > 0 && <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-xl">{filteredCountries.map((c: string) => <button key={c} onClick={() => { setForm({...form, country:c}); setCountrySearch(c); setCountryDrop(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50">{c}</button>)}</div>}
                </div>
                <input placeholder="Vize türü" value={form.visa_type} onChange={e => setForm({...form, visa_type:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" />
                <div className="grid grid-cols-2 gap-2">{["randevulu","randevusuz"].map(t => <button key={t} type="button" onClick={() => setForm({...form, islem_tipi:t})} className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold ${form.islem_tipi === t ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>{t === "randevulu" ? "Randevulu" : "Randevusuz"}</button>)}</div>
              </div>
            </div>

            {/* 3. Evrak */}
            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">3. Evrak</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid grid-cols-2 gap-2">{["gelmedi","geldi"].map(d => <button key={d} type="button" onClick={() => setForm({...form, evrak_durumu:d, evrak_eksik_mi:false})} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${form.evrak_durumu === d ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>{d === "gelmedi" ? "Gelmedi" : "Geldi"}</button>)}</div>
                {form.evrak_durumu === "geldi" && <div className="grid grid-cols-2 gap-2">{[{v:false,l:"Tam"},{v:true,l:"Eksik"}].map(o => <button key={String(o.v)} type="button" onClick={() => setForm({...form, evrak_eksik_mi:o.v})} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${form.evrak_eksik_mi === o.v ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>{o.l}</button>)}</div>}
              </div>
              {form.evrak_eksik_mi && <textarea placeholder="Eksik evrak notu..." value={form.evrak_not} onChange={e => setForm({...form, evrak_not:e.target.value})} rows={2} className="mt-3 w-full rounded-xl border border-navy-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" />}
            </div>

            {/* 4. Ücret & Cari */}
            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">4. Ücret &amp; Ödeme</p>
              <div className="grid gap-4 md:grid-cols-3">
                <input type="number" placeholder="Ücret" value={form.ucret} onChange={e => setForm({...form, ucret:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" />
                <select value={form.ucret_currency} onChange={e => setForm({...form, ucret_currency:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-3 text-sm"><option>TL</option><option>EUR</option><option>USD</option></select>
                <div className="grid grid-cols-3 gap-2">
                  {[{v:"pesin",l:"Peşin"},{v:"cari",l:"Cari"},{v:"firma_cari",l:"Firma"}].map(o => <button key={o.v} type="button" onClick={() => setForm({...form, odeme_plani:o.v, cari_sahibi:"", company_search:"", company_id:""})} className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold ${form.odeme_plani === o.v ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>{o.l}</button>)}
                </div>
              </div>

              {/* Cari seçimi */}
              {form.odeme_plani === "cari" && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-navy-600">Cari Sahibi</p>
                  <div className="grid grid-cols-2 gap-2">
                    {userRole === "agency_admin" ? (
                      <button type="button" onClick={() => setForm({...form, cari_sahibi: adminName})} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${form.cari_sahibi === adminName ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>Benim Carim</button>
                    ) : (
                      <>
                        <button type="button" onClick={() => setForm({...form, cari_sahibi: userName})} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${form.cari_sahibi === userName ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>Benim Carim</button>
                        <button type="button" onClick={() => setForm({...form, cari_sahibi: "YONETICI"})} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${form.cari_sahibi === "YONETICI" ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>Yönetici Carisi</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Firma cari arama */}
              {form.odeme_plani === "firma_cari" && (
                <div className="relative mt-3" ref={companyRef}>
                  <p className="mb-2 text-xs font-medium text-navy-600">Firma Adı</p>
                  <input placeholder="Firma ismi yazın..." value={form.company_search} onChange={e => { setForm({...form, company_search:e.target.value, company_id:""}); setCompanyDrop(true); }} onFocus={() => setCompanyDrop(true)} className="h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" />
                  {companyDrop && filteredCompanies.length > 0 && <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-xl">{filteredCompanies.map(c => <button key={c.id} onClick={() => { setForm({...form, company_id:c.id, company_search:c.firma_adi}); setCompanyDrop(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50">{c.firma_adi}</button>)}</div>}
                  <p className="mt-1 text-[10px] text-navy-400">Yeni firma adı yazarsanız otomatik oluşturulur.</p>
                </div>
              )}
            </div>

            {/* 5. Randevu */}
            {form.islem_tipi === "randevulu" && <div><p className="mb-3 text-sm font-semibold text-navy-800">5. Randevu</p><input type="datetime-local" value={form.randevu_tarihi} onChange={e => setForm({...form, randevu_tarihi:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" /></div>}

            <div className="flex justify-end gap-3 border-t border-navy-100 pt-4">
              <button onClick={() => { setShowForm(false); setEditingFile(null); }} className="rounded-xl border border-navy-200 px-6 py-2.5 text-sm font-medium">İptal</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{saving ? "Kaydediliyor..." : editingFile ? "Güncelle" : "Oluştur"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map(s => <button key={s} onClick={() => setStepFilter(s)} className={`rounded-full px-4 py-2 text-xs font-semibold ${stepFilter === s ? "bg-navy-800 text-white" : "bg-white text-navy-500 border border-navy-200"}`}>{STEP_LABELS[s]}</button>)}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="border-b border-navy-50 bg-navy-50/50 px-6 py-3">
          <input placeholder="Müşteri veya ülke ara..." className="h-9 w-full rounded-lg bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
        : filtered.length === 0 ? <div className="py-16 text-center text-sm text-navy-400">Dosya bulunamadı.</div>
        : <table className="w-full"><thead><tr className="border-b border-navy-100 bg-navy-50/30">
          <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Müşteri</th>
          <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ülke</th>
          <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ücret</th>
          <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Durum</th>
          <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Adım</th>
          <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-navy-400">Personel</th>
          <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-navy-400">İşlem</th>
        </tr></thead><tbody className="divide-y divide-navy-50">
          {filtered.map(f => { const l = getLabel(f); const assignedStaff = getStaffById(f.assigned_user_id); return (
            <tr key={f.id} className="hover:bg-primary-50/20">
              <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-accent-50 text-xs font-bold text-primary-600">{(f.clients?.full_name||"?")[0]}</div><div><p className="font-semibold text-navy-900">{f.clients?.full_name||"—"}</p><p className="text-[11px] text-navy-400">{f.clients?.passport_no||""}</p></div></div></td>
              <td className="px-3 py-4 text-sm font-medium text-navy-700">{f.country}</td>
              <td className="px-3 py-4 text-sm text-navy-600">{f.ucret ? `${f.ucret} ${f.ucret_currency}` : "—"}</td>
              <td className="px-3 py-4"><span className={`inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${badgeColor(l)}`}>{l}</span></td>
              <td className="px-3 py-4"><div className="flex items-center gap-1">{[f.dosya_hazir,f.basvuru_yapildi,f.islemden_cikti].map((d,i) => <div key={i} className="flex items-center gap-0.5"><div className={`h-3.5 w-3.5 rounded-full border-2 ${d ? "border-green-500 bg-green-500" : "border-navy-200"}`} />{i<2 && <div className={`h-0.5 w-2 ${d ? "bg-green-300" : "bg-navy-200"}`} />}</div>)}</div></td>
              <td className="px-3 py-4 text-center">
                {assignedStaff ? (
                  assignedStaff.avatar_url ? (
                    <img src={assignedStaff.avatar_url} alt="" className="mx-auto h-7 w-7 rounded-full object-cover" title={assignedStaff.full_name} />
                  ) : (
                    <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary-200 to-primary-100 text-[10px] font-bold text-primary-700" title={assignedStaff.full_name}>{assignedStaff.full_name[0]}</div>
                  )
                ) : <span className="text-xs text-navy-300">—</span>}
              </td>
              <td className="px-6 py-4 text-right space-x-1">
                <button onClick={() => openEdit(f)} className="text-[11px] text-navy-400 hover:text-primary-500">Düzenle</button>
                <button onClick={() => setDeleteTarget(f)} className="text-[11px] text-navy-400 hover:text-red-500">Sil</button>
                {!f.visa_result && !f.islemden_cikti && <button onClick={() => advance(f)} className="rounded-lg bg-primary-500 px-2.5 py-1 text-[11px] font-semibold text-white">İlerlet</button>}
                {f.islemden_cikti && !f.visa_result && <button onClick={() => openResult(f)} className="rounded-lg bg-green-500 px-2.5 py-1 text-[11px] font-semibold text-white">Sonuç</button>}
              </td>
            </tr>); })}
        </tbody></table>}
      </div>

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/40" onClick={() => setResultModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-navy-900">Vize Sonucu</h3>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button onClick={() => setResultType("vize_onay")} className={`rounded-xl border-2 py-3 text-sm font-semibold ${resultType === "vize_onay" ? "border-green-500 bg-green-50 text-green-700" : "border-navy-200 text-navy-500"}`}>Vize Onay</button>
              <button onClick={() => setResultType("red")} className={`rounded-xl border-2 py-3 text-sm font-semibold ${resultType === "red" ? "border-red-500 bg-red-50 text-red-700" : "border-navy-200 text-navy-500"}`}>Red</button>
            </div>
            <div className="space-y-3">
              <div><label className="text-sm font-medium text-navy-700">Sonuçlanma Tarihi</label><input type="date" value={resultForm.sonuc_tarihi} onChange={e => setResultForm({...resultForm, sonuc_tarihi:e.target.value})} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm" /></div>
              {resultType === "vize_onay" && (
                <div><label className="text-sm font-medium text-navy-700">Vize Bitiş Tarihi</label><input type="date" value={resultForm.visa_expiry_date} onChange={e => setResultForm({...resultForm, visa_expiry_date:e.target.value})} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm" /></div>
              )}
              <div><label className="text-sm font-medium text-navy-700">Müşteri Telefonu</label><input value={resultForm.musteri_telefon} onChange={e => setResultForm({...resultForm, musteri_telefon:e.target.value})} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm" placeholder="+90 5XX XXX XX XX" /></div>
            </div>
            <div className="mt-4 rounded-xl bg-green-50 p-3 text-xs text-green-700">WhatsApp modülü ile müşterilerinize bildirim gönderin. Aktif etmek için: <strong>0545 603 65 47</strong></div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setResultModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm">İptal</button>
              <button onClick={submitResult} className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="fixed inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"><svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
            <p className="text-sm text-navy-700"><strong>{deleteTarget.clients?.full_name}</strong> - {deleteTarget.country} dosyası silinecek.</p>
            <p className="mt-1 text-xs text-navy-400">Bu işlem geri alınamaz.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm font-medium">İptal</button>
              <button onClick={confirmDelete} className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-red-600">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
