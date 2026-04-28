"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type AuthLog = {
  id: string;
  type: "login" | "logout";
  message: string;
  actor_id: string;
  organization_id: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  name: string;
  role: string;
  organization_id: string | null;
};

type Org = { id: string; name: string };

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const fmtRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
};

const roleLabel = (r: string) =>
  r === "admin" ? "Genel müdür" : r === "staff" ? "Personel" : r === "muhasebe" ? "Muhasebe" : r;

const roleStyle = (r: string) => {
  switch (r) {
    case "admin":
      return "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200";
    case "staff":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    case "muhasebe":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
};

export default function VisoraLogsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [orgs, setOrgs] = useState<Record<string, Org>>({});

  // filters
  const [typeFilter, setTypeFilter] = useState<"all" | "login" | "logout">("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff" | "muhasebe">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const { data: logsData, error: logsErr } = await supabase
      .from("activity_logs")
      .select("id, type, message, actor_id, organization_id, created_at")
      .in("type", ["login", "logout"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (logsErr) {
      setErr(logsErr.message);
      setLoading(false);
      return;
    }

    const rows = (logsData as AuthLog[] | null) || [];
    setLogs(rows);

    const actorIds = Array.from(new Set(rows.map((l) => l.actor_id))).filter(Boolean);
    const orgIds = Array.from(new Set(rows.map((l) => l.organization_id).filter(Boolean) as string[]));

    const [{ data: profs }, { data: orgList }] = await Promise.all([
      actorIds.length
        ? supabase.from("profiles").select("id, name, role, organization_id").in("id", actorIds)
        : Promise.resolve({ data: [] as Profile[] }),
      orgIds.length
        ? supabase.from("organizations").select("id, name").in("id", orgIds)
        : Promise.resolve({ data: [] as Org[] }),
    ]);

    const profMap: Record<string, Profile> = {};
    ((profs as Profile[] | null) || []).forEach((p) => {
      profMap[p.id] = p;
    });
    setProfiles(profMap);

    const orgMap: Record<string, Org> = {};
    ((orgList as Org[] | null) || []).forEach((o) => {
      orgMap[o.id] = o;
    });
    setOrgs(orgMap);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = logs;
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    if (orgFilter !== "all") {
      rows = rows.filter((r) =>
        orgFilter === "__none__" ? !r.organization_id : r.organization_id === orgFilter
      );
    }
    if (roleFilter !== "all") {
      rows = rows.filter((r) => profiles[r.actor_id]?.role === roleFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const p = profiles[r.actor_id];
        const o = r.organization_id ? orgs[r.organization_id] : null;
        return (
          (p?.name || "").toLowerCase().includes(q) ||
          (o?.name || "").toLowerCase().includes(q) ||
          (r.message || "").toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }, [logs, profiles, orgs, typeFilter, orgFilter, roleFilter, search]);

  const stats = useMemo(() => {
    const today = new Date();
    const isToday = (iso: string) => new Date(iso).toDateString() === today.toDateString();
    const todayLogs = logs.filter((l) => isToday(l.created_at));
    return {
      total: logs.length,
      todayTotal: todayLogs.length,
      logins: logs.filter((l) => l.type === "login").length,
      logouts: logs.filter((l) => l.type === "logout").length,
      todayLogins: todayLogs.filter((l) => l.type === "login").length,
      uniqueActorsToday: new Set(todayLogs.map((l) => l.actor_id)).size,
    };
  }, [logs]);

  const orgOptions = useMemo(() => {
    const list = Object.values(orgs).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    return list;
  }, [orgs]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/20 text-[11px] font-bold uppercase tracking-[0.18em] mb-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0-1.105-.895-2-2-2s-2 .895-2 2 .895 2 2 2 2-.895 2-2zM18 8a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              Platform · Audit
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Giriş / Çıkış Logları</h1>
            <p className="text-slate-200/80 text-sm mt-2 max-w-xl">
              Sistemdeki tüm <b className="text-white">Genel Müdür</b> ve <b className="text-white">Personel</b> kullanıcılarının oturum açma ve kapatma kayıtları.
              <span className="block text-slate-300/70 text-xs mt-1">Platform sahibi (owner) hareketleri bu listede gösterilmez.</span>
            </p>
          </div>
          <button
            onClick={() => load()}
            className="self-start md:self-auto inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/15 text-sm font-bold transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.582m0 0a8.001 8.001 0 01-15.356-2m15.356 2H15" />
            </svg>
            Yenile
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Toplam log", value: stats.total, gradient: "from-indigo-500 to-violet-500", sub: `${stats.logins} giriş · ${stats.logouts} çıkış` },
          { label: "Bugün", value: stats.todayTotal, gradient: "from-emerald-500 to-teal-500", sub: `${stats.todayLogins} giriş` },
          { label: "Bugün aktif kullanıcı", value: stats.uniqueActorsToday, gradient: "from-amber-500 to-orange-500", sub: "tekil oturum" },
          { label: "Toplam giriş", value: stats.logins, gradient: "from-cyan-500 to-blue-500", sub: "başarılı oturum" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 p-4">
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-10`} />
            <p className="relative text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="relative text-2xl font-black text-slate-900 mt-1 tracking-tight tabular-nums">{s.value}</p>
            <p className="relative text-[11px] text-slate-400 font-medium mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tip</label>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "login", "logout"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    typeFilter === t
                      ? t === "login"
                        ? "bg-emerald-500 text-white shadow shadow-emerald-500/30"
                        : t === "logout"
                          ? "bg-rose-500 text-white shadow shadow-rose-500/30"
                          : "bg-indigo-500 text-white shadow shadow-indigo-500/30"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t === "all" ? "Tümü" : t === "login" ? "Giriş" : "Çıkış"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Rol</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="w-full h-9 px-3 rounded-lg bg-white ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="all">Tüm roller</option>
              <option value="admin">Genel müdür</option>
              <option value="staff">Personel</option>
              <option value="muhasebe">Muhasebe</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Şirket</label>
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="all">Tüm şirketler</option>
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
              <option value="__none__">Şirketsiz</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ara</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kullanıcı, şirket veya mesaj…"
              className="w-full h-9 px-3 rounded-lg bg-white ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>
      </div>

      {err && (
        <Card className="p-4 text-red-600 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {err}
        </Card>
      )}

      {/* LIST */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-slate-800 font-bold text-sm">Aktivite akışı</h3>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-semibold">{filtered.length}</span>
          </div>
          <p className="text-[11px] text-slate-400">Son 500 kayıt</p>
        </div>
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Yükleniyor…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Filtrelerinize uygun log bulunamadı.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((log) => {
              const profile = profiles[log.actor_id];
              const org = log.organization_id ? orgs[log.organization_id] : null;
              const isLogin = log.type === "login";
              const userName = profile?.name || "Bilinmeyen kullanıcı";
              const initial = (userName.charAt(0) || "?").toUpperCase();
              return (
                <li key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md ${
                      isLogin
                        ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30"
                        : "bg-gradient-to-br from-rose-500 to-red-500 shadow-rose-500/30"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isLogin ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      )}
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isLogin
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                        }`}
                      >
                        {isLogin ? "Giriş" : "Çıkış"}
                      </span>
                      {profile?.role && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${roleStyle(profile.role)}`}>
                          {roleLabel(profile.role)}
                        </span>
                      )}
                      {org && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                          {org.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 font-semibold mt-1.5 truncate">
                      <span className="inline-flex items-center justify-center w-5 h-5 mr-1.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black align-[-3px]">
                        {initial}
                      </span>
                      {userName}
                      <span className="text-slate-400 font-medium"> · {log.message}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span className="tabular-nums">{fmtDateTime(log.created_at)}</span>
                      <span>·</span>
                      <span>{fmtRelative(log.created_at)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
