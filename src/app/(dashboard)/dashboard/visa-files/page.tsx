"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TARGET_COUNTRIES } from "@/lib/constants";

interface VisaFile {
  id: string; country: string; visa_type: string; status: string;
  dosya_hazir: boolean; basvuru_yapildi: boolean; islemden_cikti: boolean;
  visa_result: string | null; visa_expiry_date: string | null;
  ucret: number | null; ucret_currency: string | null;
  created_at: string;
  clients?: { full_name: string; passport_no: string | null; phone: string | null } | null;
}
interface ClientRow { id: string; full_name: string; passport_no: string | null; phone: string | null; }
interface StaffRow { id: string; full_name: string; }

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

export default function VisaFilesPage() {
  const supabase = createClient();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [files, setFiles] = useState<VisaFile[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stepFilter, setStepFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: "", country: "", visa_type: "", islem_tipi: "randevulu", randevu_tarihi: "", evrak_durumu: "gelmedi", evrak_eksik_mi: false, ucret: "", ucret_currency: "TL", odeme_plani: "pesin", assigned_user_id: "" });
  const [clientSearch, setClientSearch] = useState("");
  const [clientDrop, setClientDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultModal, setResultModal] = useState(false);
  const [resultFileId, setResultFileId] = useState("");
  const [resultType, setResultType] = useState<"vize_onay"|"red">("vize_onay");
  const [resultForm, setResultForm] = useState({ visa_expiry_date: "", musteri_telefon: "" });
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgencyId(localStorage.getItem("agency_id"));
    setUserId(localStorage.getItem("user_id"));
    setUserRole(localStorage.getItem("user_role"));
  }, []);

  const fetchData = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    let q = supabase.from("applications").select("*, clients(full_name, passport_no, phone)").eq("agency_id", agencyId).order("created_at", { ascending: false });
    if (userRole === "staff" && userId) q = q.eq("assigned_user_id", userId);
    const [fr, cr, sr] = await Promise.all([q, supabase.from("clients").select("id, full_name, passport_no, phone").eq("agency_id", agencyId).order("full_name"), supabase.from("users").select("id, full_name").eq("agency_id", agencyId)]);
    setFiles(fr.data || []); setClients(cr.data || []); setStaff(sr.data || []);
    setLoading(false);
  }, [agencyId, supabase, userRole, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setClientDrop(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);

  const filteredClients = clients.filter((c) => c.full_name.toLowerCase().includes(clientSearch.toLowerCase()));

  const handleAdd = async () => {
    if (!agencyId || !form.client_id || !form.country || !form.visa_type) return;
    setSaving(true);
    const status = form.evrak_durumu === "geldi" && form.evrak_eksik_mi ? "Evrak Eksik" : "Yeni";
    const { data, error } = await supabase.from("applications").insert({
      agency_id: agencyId, client_id: form.client_id, country: form.country, visa_type: form.visa_type, status,
      assigned_user_id: form.assigned_user_id || userId,
      ucret: form.ucret ? Number(form.ucret) : null, ucret_currency: form.ucret_currency, odeme_plani: form.odeme_plani,
      randevu_tarihi: form.randevu_tarihi || null,
    }).select("id").single();

    if (!error && data && form.islem_tipi === "randevulu" && form.randevu_tarihi) {
      const dt = new Date(form.randevu_tarihi);
      await supabase.from("appointments").insert({ agency_id: agencyId, client_id: form.client_id, application_id: data.id, date: dt.toISOString().split("T")[0], time: dt.toTimeString().slice(0,5), location: "Belirtilmedi" });
    }

    setSaving(false); setShowForm(false); setClientSearch("");
    setForm({ client_id: "", country: "", visa_type: "", islem_tipi: "randevulu", randevu_tarihi: "", evrak_durumu: "gelmedi", evrak_eksik_mi: false, ucret: "", ucret_currency: "TL", odeme_plani: "pesin", assigned_user_id: "" });
    fetchData();
  };

  const advance = async (f: VisaFile) => {
    const now = new Date().toISOString();
    let u: Record<string,unknown> = {};
    if (!f.dosya_hazir) u = { dosya_hazir: true, dosya_hazir_at: now, status: "Dosya Hazır" };
    else if (!f.basvuru_yapildi) u = { basvuru_yapildi: true, basvuru_yapildi_at: now, status: "İşlemde" };
    else if (!f.islemden_cikti) u = { islemden_cikti: true, islemden_cikti_at: now, status: "İşlemden Çıktı" };
    else return;
    await supabase.from("applications").update(u).eq("id", f.id);
    fetchData();
  };

  const openResult = (f: VisaFile) => { setResultFileId(f.id); setResultType("vize_onay"); setResultForm({ visa_expiry_date: "", musteri_telefon: f.clients?.phone || "" }); setResultModal(true); };

  const submitResult = async () => {
    await supabase.from("applications").update({
      visa_result: resultType, visa_result_date: new Date().toISOString().split("T")[0],
      visa_expiry_date: resultType === "vize_onay" && resultForm.visa_expiry_date ? resultForm.visa_expiry_date : null,
      musteri_telefon: resultForm.musteri_telefon || null,
      status: resultType === "vize_onay" ? "Tamamlandı" : "Red",
    }).eq("id", resultFileId);
    setResultModal(false); fetchData();
  };

  const filtered = files.filter((f) => {
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

  const counts = { total: files.length, active: files.filter(f => !f.visa_result).length, approved: files.filter(f => f.visa_result === "vize_onay").length, rejected: files.filter(f => f.visa_result === "red").length };
  const countryOptions = TARGET_COUNTRIES.map((c: { value: string; label: string }) => c.label);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 shadow-lg shadow-orange-500/20"><svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg></div>
          <div><h1 className="text-xl font-bold text-navy-900">Vize Dosyaları</h1><p className="text-xs text-navy-400">{counts.total} dosya</p></div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-all ${showForm ? "bg-navy-700 text-white" : "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary-500/20"}`}>
          {showForm ? "✕ Kapat" : "+ Yeni Dosya"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        {[{ l:"Toplam",v:counts.total,c:"from-primary-500 to-primary-600" },{ l:"Aktif",v:counts.active,c:"from-orange-400 to-orange-500" },{ l:"Onay",v:counts.approved,c:"from-green-400 to-green-500" },{ l:"Red",v:counts.rejected,c:"from-red-400 to-red-500" }].map(c=>(
          <div key={c.l} className="rounded-2xl border border-navy-200/60 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">{c.l}</p>
            <p className="mt-1 text-3xl font-bold text-navy-900">{c.v}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="animate-fade-in-up overflow-hidden rounded-2xl border-0 bg-white shadow-xl">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4"><h3 className="font-semibold text-white">Yeni Vize Dosyası</h3></div>
          <div className="space-y-6 p-6">
            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">1. Müşteri</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative" ref={dropRef}>
                  <input placeholder="Müşteri adı yazın..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientDrop(true); setForm({...form, client_id:""}); }} onFocus={() => setClientDrop(true)} className="h-10 w-full rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  {clientDrop && filteredClients.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white shadow-xl">
                      {filteredClients.map(c => <button key={c.id} onClick={() => { setForm({...form, client_id:c.id}); setClientSearch(c.full_name); setClientDrop(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 hover:text-primary-600"><span className="font-medium">{c.full_name}</span>{c.passport_no && <span className="ml-2 text-xs text-navy-400">{c.passport_no}</span>}</button>)}
                    </div>
                  )}
                </div>
                {userRole === "agency_admin" && staff.length > 1 && (
                  <select value={form.assigned_user_id} onChange={e => setForm({...form, assigned_user_id:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-3 text-sm focus:border-primary-400 focus:outline-none">
                    <option value="">Kendime ata</option>
                    {staff.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">2. Başvuru</p>
              <div className="grid gap-4 md:grid-cols-3">
                <select value={form.country} onChange={e => setForm({...form, country:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-3 text-sm focus:border-primary-400 focus:outline-none">
                  <option value="">Ülke seçin</option>
                  {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input placeholder="Vize türü (Turistik, İş...)" value={form.visa_type} onChange={e => setForm({...form, visa_type:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  {["randevulu","randevusuz"].map(t => <button key={t} type="button" onClick={() => setForm({...form, islem_tipi:t})} className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold ${form.islem_tipi === t ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>{t === "randevulu" ? "Randevulu" : "Randevusuz"}</button>)}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-navy-800">3. Ücret</p>
              <div className="grid gap-4 md:grid-cols-3">
                <input type="number" placeholder="Ücret" value={form.ucret} onChange={e => setForm({...form, ucret:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" />
                <select value={form.ucret_currency} onChange={e => setForm({...form, ucret_currency:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-3 text-sm"><option>TL</option><option>EUR</option><option>USD</option></select>
                <div className="grid grid-cols-3 gap-2">
                  {[{v:"pesin",l:"Peşin"},{v:"cari",l:"Cari"},{v:"firma_cari",l:"Firma Cari"}].map(o => <button key={o.v} type="button" onClick={() => setForm({...form, odeme_plani:o.v})} className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold ${form.odeme_plani === o.v ? "border-primary-500 bg-primary-50 text-primary-600" : "border-navy-200 text-navy-500"}`}>{o.l}</button>)}
                </div>
              </div>
            </div>

            {form.islem_tipi === "randevulu" && (
              <div><p className="mb-3 text-sm font-semibold text-navy-800">4. Randevu</p><input type="datetime-local" value={form.randevu_tarihi} onChange={e => setForm({...form, randevu_tarihi:e.target.value})} className="h-10 rounded-xl border border-navy-200 px-4 text-sm focus:border-primary-400 focus:outline-none" /></div>
            )}

            <div className="flex justify-end gap-3 border-t border-navy-100 pt-4">
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-navy-200 px-6 py-2.5 text-sm font-medium">İptal</button>
              <button onClick={handleAdd} disabled={saving} className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 disabled:opacity-50">{saving ? "Oluşturuluyor..." : "Dosya Oluştur"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map(s => <button key={s} onClick={() => setStepFilter(s)} className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${stepFilter === s ? "bg-navy-800 text-white" : "bg-white text-navy-500 border border-navy-200"}`}>{STEP_LABELS[s]}</button>)}
      </div>

      {/* Search + Table */}
      <div className="overflow-hidden rounded-2xl border border-navy-200/60 bg-white shadow-sm">
        <div className="border-b border-navy-50 bg-navy-50/50 px-6 py-3">
          <input placeholder="Müşteri veya ülke ara..." className="h-9 w-full rounded-lg border-0 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-primary-500" /></div>
        : filtered.length === 0 ? <div className="py-16 text-center text-sm text-navy-400">Dosya bulunamadı.</div>
        : <table className="w-full"><thead><tr className="border-b border-navy-100 bg-navy-50/30">
          <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Müşteri</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ülke</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Ücret</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Durum</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">Adım</th>
          <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-navy-400">İşlem</th>
        </tr></thead><tbody className="divide-y divide-navy-50">
          {filtered.map(f => { const l = getLabel(f); return (
            <tr key={f.id} className="hover:bg-primary-50/20">
              <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-accent-50 text-xs font-bold text-primary-600">{(f.clients?.full_name||"?")[0]}</div><div><p className="font-semibold text-navy-900">{f.clients?.full_name||"—"}</p><p className="text-[11px] text-navy-400">{f.clients?.passport_no||""}</p></div></div></td>
              <td className="px-4 py-4 font-medium text-navy-700">{f.country}</td>
              <td className="px-4 py-4 text-sm text-navy-600">{f.ucret ? `${f.ucret} ${f.ucret_currency}` : "—"}</td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${badgeColor(l)}`}>{l}</span></td>
              <td className="px-4 py-4"><div className="flex items-center gap-1">{[f.dosya_hazir,f.basvuru_yapildi,f.islemden_cikti].map((d,i) => <div key={i} className="flex items-center gap-0.5"><div className={`h-4 w-4 rounded-full border-2 ${d ? "border-green-500 bg-green-500" : "border-navy-200"}`} />{i<2 && <div className={`h-0.5 w-3 ${d ? "bg-green-300" : "bg-navy-200"}`} />}</div>)}</div></td>
              <td className="px-6 py-4 text-right">
                {!f.visa_result && !f.islemden_cikti && <button onClick={() => advance(f)} className="rounded-lg bg-primary-500 px-3 py-1 text-[11px] font-semibold text-white">İlerlet</button>}
                {f.islemden_cikti && !f.visa_result && <button onClick={() => openResult(f)} className="rounded-lg bg-green-500 px-3 py-1 text-[11px] font-semibold text-white">Sonuç Gir</button>}
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
            {resultType === "vize_onay" && (
              <div className="space-y-3">
                <div><label className="text-sm font-medium text-navy-700">Vize Bitiş Tarihi</label><input type="date" value={resultForm.visa_expiry_date} onChange={e => setResultForm({...resultForm, visa_expiry_date:e.target.value})} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm" /></div>
                <div><label className="text-sm font-medium text-navy-700">Müşteri Telefonu</label><input value={resultForm.musteri_telefon} onChange={e => setResultForm({...resultForm, musteri_telefon:e.target.value})} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-4 text-sm" /></div>
              </div>
            )}
            <div className="mt-4 rounded-xl bg-green-50 p-3 text-xs text-green-700">WhatsApp Otomatik Mesaj modülü ile müşterilerinize bildirim gönderin. Aktif etmek için: <strong>0545 603 65 47</strong></div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setResultModal(false)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-sm">İptal</button>
              <button onClick={submitResult} className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
