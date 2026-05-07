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
  admin_initial_password: string | null;
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

function GmPasswordSection({ password, orgId, adminId, onUpdated }: { password: string | null; orgId: string; adminId: string | null; onUpdated: () => void }) {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSetPassword = async () => {
    if (newPwd.length < 8) { setMsg("En az 8 karakter."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/visora/reset-gm-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, adminId: adminId || "", newPassword: newPwd }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg((json as any).error || "Hata oluştu."); return; }
      setEditing(false);
      setNewPwd("");
      setMsg(null);
      onUpdated();
    } catch (e: any) {
      setMsg(e?.message || "Hata.");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-indigo-50 ring-1 ring-indigo-200 space-y-2">
        <p className="text-[11px] font-bold text-indigo-800">GM Şifresi Belirle / Sıfırla</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Yeni şifre (min 8)"
            className="flex-1 h-8 px-2 rounded-md text-sm ring-1 ring-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={handleSetPassword}
            disabled={busy}
            className="h-8 px-3 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "..." : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setMsg(null); setNewPwd(""); }}
            className="h-8 px-2 rounded-md text-xs text-slate-500 hover:bg-slate-100"
          >
            İptal
          </button>
        </div>
        {msg && <p className="text-xs text-red-600">{msg}</p>}
      </div>
    );
  }

  if (!password) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          GM Şifresi Belirle
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 px-2 py-2 rounded-lg bg-amber-50 ring-1 ring-amber-200">
      <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">GM Geçici Şifresi</p>
        <p className="text-sm font-mono font-semibold text-slate-800 truncate">
          {visible ? password : "••••••••"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="p-1.5 rounded-md hover:bg-amber-100 text-amber-600 transition-colors"
        title={visible ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        {visible ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1.5 rounded-md hover:bg-amber-100 text-amber-600 transition-colors"
        title="Şifreyi sıfırla"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
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

  // Sirket verilerini sifirlama (kullanicilar haric) modali
  const [resetDataRow, setResetDataRow] = useState<CompanyRow | null>(null);
  const [resetDataText, setResetDataText] = useState("");
  const [resetDataBusy, setResetDataBusy] = useState(false);
  const [resetDataMsg, setResetDataMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const { data: orgs, error: oErr } = await supabase
      .from("organizations")
      .select("id, name, status, billing_email, phone, notes, created_at, admin_initial_password")
      .order("created_at", { ascending: true });

    if (oErr) {
      setErr(oErr.message);
      setLoading(false);
      return;
    }

    const orgIds = (orgs || []).map((o) => o.id);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const [membersRes, subsRes] = await Promise.all([
      fetch(`/api/visora/company-members?orgIds=${orgIds.join(",")}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => ({ members: [] })),
      supabase
        .from("platform_subscriptions")
        .select("*")
        .in("organization_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const profs: ProfileLite[] = (membersRes.members as ProfileLite[]) || [];
    const subs = subsRes.data;

    const grouped: CompanyRow[] = (orgs as Org[] | null || []).map((o) => ({
      org: o,
      members: profs.filter((p) => p.organization_id === o.id),
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

  function openResetData(row: CompanyRow) {
    setResetDataRow(row);
    setResetDataText("");
    setResetDataMsg(null);
  }

  async function handleResetData(e: React.FormEvent) {
    e.preventDefault();
    if (!resetDataRow) return;
    setResetDataBusy(true);
    setResetDataMsg(null);
    try {
      const res = await fetch("/api/visora/reset-organization-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: resetDataRow.org.id,
          confirmName: resetDataText.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetDataMsg(json.error || "Sıfırlama başarısız.");
        return;
      }
      const counts: Record<string, number> = json.counts || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setResetDataMsg(json.message || `Sıfırlandı. Silinen kayıt: ${total}`);
      await load();
      setTimeout(() => {
        setResetDataRow(null);
        setResetDataMsg(null);
      }, 1800);
    } catch (e: unknown) {
      setResetDataMsg(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setResetDataBusy(false);
    }
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
                      onClick={() => openResetData(row)}
                      className="text-xs px-3 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 ring-1 ring-amber-200 flex items-center gap-1 justify-center"
                      title="Şirketin tüm operasyonel verilerini sil (kullanıcılar ve abonelik korunur)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Verileri Sıfırla
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

                <GmPasswordSection
                  password={row.org.admin_initial_password}
                  orgId={row.org.id}
                  adminId={admin?.id || null}
                  onUpdated={load}
                />
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

      {/* SIRKET VERILERINI SIFIRLA — onay metni: sirket adi */}
      <Modal
        isOpen={!!resetDataRow}
        onClose={() => {
          if (!resetDataBusy) {
            setResetDataRow(null);
            setResetDataText("");
            setResetDataMsg(null);
          }
        }}
        title={resetDataRow ? `Verileri Sıfırla: ${resetDataRow.org.name}` : "Verileri Sıfırla"}
        size="md"
      >
        {resetDataRow && (
          <form onSubmit={handleResetData} className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Bu işlem geri alınamaz.
              </p>
              <p>
                <b>{resetDataRow.org.name}</b> şirketinin tüm operasyonel verileri silinir; ancak{" "}
                <b>kullanıcılar (GM/personel)</b> ve <b>abonelik bilgileri</b> korunur.
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs pt-1">
                <p className="font-bold uppercase tracking-wider text-rose-700">Silinecek</p>
                <p className="font-bold uppercase tracking-wider text-emerald-700">Korunacak</p>
                <ul className="list-disc pl-4 text-rose-700/90 space-y-0.5">
                  <li>Vize dosyaları + giderler</li>
                  <li>Tahsilat / ödemeler</li>
                  <li>Cariler (firmalar)</li>
                  <li>Vize grupları</li>
                  <li>Randevu talepleri</li>
                  <li>Banka hesapları</li>
                  <li>Kasa hareketleri</li>
                  <li>Komisyon oranları</li>
                  <li>Referans logoları</li>
                  <li>Günlük raporlar / aktivite logları</li>
                </ul>
                <ul className="list-disc pl-4 text-emerald-700/90 space-y-0.5">
                  <li>Şirket kaydı</li>
                  <li>Genel müdür hesabı</li>
                  <li>Personel hesapları</li>
                  <li>Şifreler</li>
                  <li>Abonelik (plan, ücret, deneme)</li>
                  <li>Platform faturaları</li>
                  <li>Yeni boş TL/EUR/USD nakit kasaları kurulur</li>
                </ul>
              </div>
            </div>
            <div className="text-sm text-slate-700">
              Onaylamak için şirket adını <b>aynen</b> yazın:{" "}
              <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-xs">
                {resetDataRow.org.name}
              </code>
            </div>
            <input
              value={resetDataText}
              onChange={(e) => setResetDataText(e.target.value)}
              placeholder={resetDataRow.org.name}
              className="w-full px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              disabled={resetDataBusy}
              autoFocus
            />
            {resetDataMsg && (
              <p
                className={`text-sm ${
                  resetDataMsg.includes("sıfırlandı") || resetDataMsg.includes("Silinen")
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {resetDataMsg}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setResetDataRow(null);
                  setResetDataText("");
                  setResetDataMsg(null);
                }}
                disabled={resetDataBusy}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={resetDataBusy || resetDataText.trim() !== resetDataRow.org.name}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {resetDataBusy ? "Sıfırlanıyor…" : "Verileri Sıfırla"}
              </Button>
            </div>
          </form>
        )}
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
