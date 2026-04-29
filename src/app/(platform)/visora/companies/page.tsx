"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Input, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Org = {
  id: string;
  name: string;
  status: string;
  billing_email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

type ProfileLite = {
  id: string;
  name: string;
  role: string;
  organization_id: string | null;
};

type Subscription = {
  id: string;
  organization_id: string;
  monthly_fee: number;
  currency: string;
  plan_name: string;
  started_at: string;
  trial_ends_at: string | null;
  status: string;
  notes: string | null;
};

type CompanyRow = {
  org: Org;
  members: ProfileLite[];
  subscription: Subscription | null;
};

const fmtTRY = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);

const roleLabel = (r: string) =>
  r === "admin" ? "Genel müdür" : r === "staff" ? "Personel" : r === "muhasebe" ? "Muhasebe" : r;

/**
 * Bir aboneliğin deneme süresi durumu.
 * - none: deneme tanımlı değil (eski abonelik)
 * - active: bugün < trial_ends_at  → henüz ücretli aboneliğe geçmedi
 * - expired: bugün >= trial_ends_at → ücretli abonelik aktif
 */
type TrialState = { kind: "none" } | { kind: "active"; daysLeft: number; endsAt: Date } | { kind: "expired"; endedAt: Date };

function getTrialState(sub: Subscription | null): TrialState {
  if (!sub || !sub.trial_ends_at) return { kind: "none" };
  const endsAt = new Date(sub.trial_ends_at + "T23:59:59");
  const now = new Date();
  const diffMs = endsAt.getTime() - now.getTime();
  if (diffMs > 0) {
    const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    return { kind: "active", daysLeft, endsAt };
  }
  return { kind: "expired", endedAt: endsAt };
}

export default function VisoraCompaniesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // create-org modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cAdminName, setCAdminName] = useState("");
  const [cAdminEmail, setCAdminEmail] = useState("");
  const [cAdminPwd, setCAdminPwd] = useState("");
  const [cFee, setCFee] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState<string | null>(null);

  // edit subscription modal
  const [editOrg, setEditOrg] = useState<CompanyRow | null>(null);
  const [eFee, setEFee] = useState("");
  const [ePlan, setEPlan] = useState("standart");
  const [eStatus, setEStatus] = useState("active");
  const [eOrgStatus, setEOrgStatus] = useState("active");
  const [eBusy, setEBusy] = useState(false);
  const [eMsg, setEMsg] = useState<string | null>(null);

  // reset (tum sirketleri sil) modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Sirket silme onay modali
  const [deleteRow, setDeleteRow] = useState<CompanyRow | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const { data: orgs, error: oErr } = await supabase
      .from("organizations")
      .select("id, name, status, billing_email, phone, notes, created_at")
      .order("created_at", { ascending: true });

    if (oErr) {
      setErr(oErr.message);
      setLoading(false);
      return;
    }

    const orgIds = (orgs || []).map((o) => o.id);

    const [{ data: profs }, { data: subs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, role, organization_id")
        .in("organization_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("platform_subscriptions")
        .select("*")
        .in("organization_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const grouped: CompanyRow[] = (orgs as Org[] | null || []).map((o) => ({
      org: o,
      members: (profs as ProfileLite[] | null || []).filter((p) => p.organization_id === o.id),
      subscription: (subs as Subscription[] | null || []).find((s) => s.organization_id === o.id) || null,
    }));

    setRows(grouped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const doReset = useCallback(async () => {
    if (resetText !== "TUMUNU SIL") {
      setResetMsg("Onay metni hatali: 'TUMUNU SIL' yazmalisin.");
      return;
    }
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/visora/reset-organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "VISORA_RESET" }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        setResetMsg((data as { error?: string }).error || `Hata: HTTP ${res.status}`);
        return;
      }
      const d = data as {
        deletedProfiles?: number;
        deletedAuthUsers?: number;
        failedAuthUsers?: string[];
      };
      setResetMsg(
        `Tamam. ${d.deletedProfiles ?? 0} profil silindi, ${d.deletedAuthUsers ?? 0} auth kullanici silindi.${
          (d.failedAuthUsers?.length ?? 0) > 0 ? ` ${d.failedAuthUsers!.length} auth silinemedi.` : ""
        }`
      );
      setResetText("");
      await load();
      setTimeout(() => {
        setResetOpen(false);
        setResetMsg(null);
      }, 1800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      setResetMsg(msg);
    } finally {
      setResetBusy(false);
    }
  }, [resetText, load]);

  const filtered = rows.filter((r) =>
    !search.trim()
      ? true
      : r.org.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (r.org.billing_email || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const totalCompanies = rows.length;
  const totalActiveCompanies = rows.filter((r) => r.org.status === "active").length;
  const totalUsers = rows.reduce((s, r) => s + r.members.length, 0);
  const monthlyMRR = rows.reduce(
    (s, r) =>
      s + (r.subscription && r.subscription.status === "active" && r.org.status === "active" ? Number(r.subscription.monthly_fee) : 0),
    0
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCBusy(true);
    setCMsg(null);
    try {
      const res = await fetch("/api/visora/create-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: cName.trim(),
          adminName: cAdminName.trim(),
          adminEmail: cAdminEmail.trim().toLowerCase(),
          adminPassword: cAdminPwd,
          monthlyFee: Number(cFee || 0),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCMsg(json.error || "İşlem başarısız.");
        return;
      }
      setCreateOpen(false);
      setCName("");
      setCAdminName("");
      setCAdminEmail("");
      setCAdminPwd("");
      setCFee("");
      await load();
    } finally {
      setCBusy(false);
    }
  }

  function openDelete(row: CompanyRow) {
    setDeleteRow(row);
    setDeleteText("");
    setDeleteMsg(null);
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteRow) return;
    setDeleteBusy(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/visora/delete-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: deleteRow.org.id,
          confirmName: deleteText.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteMsg(json.error || "Silme başarısız.");
        return;
      }
      setDeleteMsg(json.message || "Şirket silindi.");
      await load();
      setTimeout(() => {
        setDeleteRow(null);
        setDeleteMsg(null);
      }, 1400);
    } catch (e: unknown) {
      setDeleteMsg(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setDeleteBusy(false);
    }
  }

  function openEdit(row: CompanyRow) {
    setEditOrg(row);
    setEFee(row.subscription ? String(row.subscription.monthly_fee) : "0");
    setEPlan(row.subscription?.plan_name || "standart");
    setEStatus(row.subscription?.status || "active");
    setEOrgStatus(row.org.status);
    setEMsg(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editOrg) return;
    setEBusy(true);
    setEMsg(null);
    try {
      const res = await fetch("/api/visora/update-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: editOrg.org.id,
          monthlyFee: Number(eFee || 0),
          planName: ePlan,
          subscriptionStatus: eStatus,
          orgStatus: eOrgStatus,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEMsg(json.error || "Güncelleme başarısız.");
        return;
      }
      setEditOrg(null);
      await load();
    } finally {
      setEBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-1.5 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Platform</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">Şirketler</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">Visora platformuna kayıtlı tüm şirketleri yönet, planları düzenle.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setResetOpen(true);
              setResetText("");
              setResetMsg(null);
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 hover:bg-rose-100 text-sm font-semibold transition"
          >
            Tümünü Sıfırla
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:shadow-xl transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Şirket
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Toplam şirket", value: totalCompanies, gradient: "from-indigo-500 to-violet-500" },
          { label: "Aktif şirket", value: totalActiveCompanies, gradient: "from-emerald-500 to-teal-500" },
          { label: "Toplam kullanıcı", value: totalUsers, gradient: "from-violet-500 to-fuchsia-500" },
          { label: "Aylık MRR (Aktif)", value: fmtTRY(monthlyMRR), gradient: "from-amber-500 to-orange-500" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 p-4">
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-10`} />
            <p className="relative text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="relative text-2xl font-black text-slate-900 mt-1 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 max-w-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Şirket veya e-posta ara…"
          className="w-full h-10 px-3 rounded-xl bg-white ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
        />
      </div>

      {err && <Card className="p-4 text-red-600 text-sm">{err}</Card>}

      {loading ? (
        <Card className="p-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">Henüz şirket kaydı yok.</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((row) => {
            const admin = row.members.find((m) => m.role === "admin");
            const staffCount = row.members.filter((m) => m.role === "staff").length;
            const isActive = row.org.status === "active";
            const trial = getTrialState(row.subscription);
            return (
              <Card key={row.org.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base truncate">{row.org.name}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                          isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : row.org.status === "suspended"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.org.status}
                      </span>
                      {trial.kind === "active" && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-gradient-to-r from-indigo-500 to-violet-500 text-white"
                          title={`Deneme bitiş: ${trial.endsAt.toLocaleDateString("tr-TR")}`}
                        >
                          Deneme · {trial.daysLeft} gün
                        </span>
                      )}
                      {trial.kind === "expired" && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          title={`Ücretli abonelik · deneme bitti: ${trial.endedAt.toLocaleDateString("tr-TR")}`}
                        >
                          Ücretli
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {row.org.billing_email || admin?.name || "—"} · oluşturulma{" "}
                      {new Date(row.org.created_at).toLocaleDateString("tr-TR")}
                      {trial.kind === "active" && (
                        <span className="ml-1 text-indigo-600 font-medium">
                          · ücretli {trial.endsAt.toLocaleDateString("tr-TR")} sonrası başlar
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(row)}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => openDelete(row)}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 ring-1 ring-red-200"
                    >
                      Şirketi Sil
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Plan</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {row.subscription?.plan_name || "—"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Aylık ücret</p>
                    <p className="text-sm font-semibold text-primary-600">
                      {row.subscription ? fmtTRY(Number(row.subscription.monthly_fee)) : "—"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Personel</p>
                    <p className="text-sm font-semibold text-slate-800">{staffCount} / 3</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Kullanıcılar ({row.members.length})
                  </p>
                  {row.members.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Bu şirkete bağlı kullanıcı yok.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {row.members.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-slate-50"
                        >
                          <span className="text-slate-800 font-medium truncate">{m.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              m.role === "admin"
                                ? "bg-primary-100 text-primary-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {roleLabel(m.role)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Şirket Oluştur" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 text-sm text-indigo-900 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>
              Yeni açılan her şirkete <b>15 gün ücretsiz deneme süresi</b> tanımlanır. Ücretli aylık tahakkuklar, deneme süresi bittikten sonraki ilk aydan itibaren başlar.
            </p>
          </div>
          <Input label="Şirket adı" value={cName} onChange={(e) => setCName(e.target.value)} required />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Genel müdür adı"
              value={cAdminName}
              onChange={(e) => setCAdminName(e.target.value)}
              required
            />
            <Input
              label="Genel müdür e-posta"
              type="email"
              value={cAdminEmail}
              onChange={(e) => setCAdminEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Geçici şifre (min 8)"
              type="text"
              value={cAdminPwd}
              onChange={(e) => setCAdminPwd(e.target.value)}
              required
              minLength={8}
            />
            <Input
              label="Aylık ücret (TRY)"
              type="number"
              min={0}
              value={cFee}
              onChange={(e) => setCFee(e.target.value)}
              required
            />
          </div>
          {cMsg && <p className="text-sm text-red-600">{cMsg}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={cBusy} className="bg-primary-500 hover:bg-primary-600">
              {cBusy ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editOrg} onClose={() => setEditOrg(null)} title={`Düzenle · ${editOrg?.org.name || ""}`} size="md">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Aylık ücret (TRY)"
            type="number"
            min={0}
            value={eFee}
            onChange={(e) => setEFee(e.target.value)}
            required
          />
          <Input label="Plan adı" value={ePlan} onChange={(e) => setEPlan(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Abonelik durumu</label>
            <select
              className="w-full px-3 py-2 border border-navy-300 rounded-lg"
              value={eStatus}
              onChange={(e) => setEStatus(e.target.value)}
            >
              <option value="active">Aktif</option>
              <option value="paused">Durdurulmuş</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Şirket durumu</label>
            <select
              className="w-full px-3 py-2 border border-navy-300 rounded-lg"
              value={eOrgStatus}
              onChange={(e) => setEOrgStatus(e.target.value)}
            >
              <option value="active">Aktif</option>
              <option value="suspended">Askıya alındı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          {eMsg && <p className="text-sm text-red-600">{eMsg}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setEditOrg(null)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={eBusy} className="bg-primary-500 hover:bg-primary-600">
              {eBusy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* TUMUNU SIFIRLA — TEHLIKELI */}
      <Modal
        isOpen={resetOpen}
        onClose={() => {
          if (!resetBusy) {
            setResetOpen(false);
            setResetText("");
            setResetMsg(null);
          }
        }}
        title="Tüm Şirketleri Sıfırla"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Bu işlem <b>geri alınamaz</b>. Tüm şirketler, genel müdür ve personel
            hesapları, dosyalar, ödemeler, raporlar, cari kayıtları ve aktivite
            günlükleri silinecek. Senin Platform Owner hesabın korunur.
          </div>
          <div className="text-sm text-slate-700">
            Onaylamak için aşağıya <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-xs">TUMUNU SIL</code> yaz:
          </div>
          <input
            value={resetText}
            onChange={(e) => setResetText(e.target.value)}
            placeholder="TUMUNU SIL"
            className="w-full px-3 py-2 rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono"
            disabled={resetBusy}
          />
          {resetMsg && (
            <p
              className={`text-sm ${
                resetMsg.startsWith("Tamam") ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {resetMsg}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setResetOpen(false);
                setResetText("");
                setResetMsg(null);
              }}
              disabled={resetBusy}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={doReset}
              disabled={resetBusy || resetText !== "TUMUNU SIL"}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {resetBusy ? "Siliniyor…" : "Tümünü Sil"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* TEK SIRKET SILME — onay metni: sirket adi */}
      <Modal
        isOpen={!!deleteRow}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteRow(null);
            setDeleteText("");
            setDeleteMsg(null);
          }
        }}
        title={deleteRow ? `Şirketi Sil: ${deleteRow.org.name}` : "Şirketi Sil"}
        size="md"
      >
        {deleteRow && (
          <form onSubmit={handleDelete} className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1">
              <p className="font-bold">Bu işlem geri alınamaz.</p>
              <p>
                <b>{deleteRow.org.name}</b> şirketi ve bağlı her şey silinecek:
              </p>
              <ul className="list-disc pl-5 text-xs">
                <li>Genel müdür + personel hesapları ({deleteRow.members.length})</li>
                <li>Tüm vize dosyaları, ödemeler, raporlar</li>
                <li>Cari kayıtları, randevu talepleri, aktivite günlükleri</li>
                <li>Banka hesapları, abonelik geçmişi</li>
              </ul>
            </div>
            <div className="text-sm text-slate-700">
              Onaylamak için şirket adını <b>aynen</b> yazın:{" "}
              <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-xs">
                {deleteRow.org.name}
              </code>
            </div>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={deleteRow.org.name}
              className="w-full px-3 py-2 rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              disabled={deleteBusy}
              autoFocus
            />
            {deleteMsg && (
              <p
                className={`text-sm ${
                  deleteMsg.includes("silindi") || deleteMsg.includes("başarılı")
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {deleteMsg}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeleteRow(null);
                  setDeleteText("");
                  setDeleteMsg(null);
                }}
                disabled={deleteBusy}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={deleteBusy || deleteText.trim() !== deleteRow.org.name}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteBusy ? "Siliniyor…" : "Şirketi Sil"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
