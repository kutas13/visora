/** Ay bazlı vize özeti: sonuç tarihi seçilen ay içinde olan (onay/red) dosyalar */

export type CurrencyBucket = { TL: number; EUR: number; USD: number };

export type SummaryBucket = {
  total: number;
  approved: number;
  rejected: number;
  approvalRatePct: number;
  avgDaysToResult: number | null;
  revenue: CurrencyBucket;
};

export type MonthlySummary = {
  year: number;
  month: number;
  monthLabelTr: string;
  generatedAt: string;
  overall: SummaryBucket;
  byCountry: Array<{ key: string; label: string } & SummaryBucket>;
  byStaff: Array<{ staffId: string; staffName: string } & SummaryBucket>;
};

export type RawFileRow = {
  id: string;
  created_at: string;
  sonuc_tarihi: string | null;
  sonuc: "vize_onay" | "red" | null;
  hedef_ulke: string | null;
  ucret: number | null;
  ucret_currency: string | null;
  assigned_user_id: string;
  profiles: { name: string } | null;
};

function addRevenue(bucket: CurrencyBucket, amount: number, cur: string | null) {
  const c = (cur || "TL").toUpperCase();
  if (c === "EUR") bucket.EUR += amount;
  else if (c === "USD") bucket.USD += amount;
  else bucket.TL += amount;
}

function emptyBucket(): SummaryBucket {
  return {
    total: 0,
    approved: 0,
    rejected: 0,
    approvalRatePct: 0,
    avgDaysToResult: null,
    revenue: { TL: 0, EUR: 0, USD: 0 },
  };
}

function aggregateRows(rows: RawFileRow[]): SummaryBucket {
  const b = emptyBucket();
  const dayDiffs: number[] = [];

  for (const f of rows) {
    if (f.sonuc === "vize_onay") b.approved += 1;
    else if (f.sonuc === "red") b.rejected += 1;
    else continue;

    const created = f.created_at?.slice(0, 10);
    const sonuc = f.sonuc_tarihi?.slice(0, 10);
    if (created && sonuc) {
      const t0 = new Date(created).getTime();
      const t1 = new Date(sonuc).getTime();
      if (!Number.isNaN(t0) && !Number.isNaN(t1)) {
        const days = Math.max(0, Math.round((t1 - t0) / 86_400_000));
        dayDiffs.push(days);
      }
    }
    addRevenue(b.revenue, Number(f.ucret || 0), f.ucret_currency);
  }

  b.total = b.approved + b.rejected;
  b.approvalRatePct = b.total > 0 ? (b.approved / b.total) * 100 : 0;
  b.avgDaysToResult =
    dayDiffs.length > 0 ? Math.round((dayDiffs.reduce((a, x) => a + x, 0) / dayDiffs.length) * 10) / 10 : null;

  return b;
}

function monthLabelTr(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

/** Personel tablosu altindaki toplam satiri (Genel Mudur tam raporu) */
export function sumStaffBuckets(
  byStaff: Array<{ total: number; approved: number; rejected: number; avgDaysToResult: number | null; revenue: CurrencyBucket }>
): SummaryBucket {
  const rev: CurrencyBucket = { TL: 0, EUR: 0, USD: 0 };
  let approved = 0;
  let rejected = 0;
  let weightedDays = 0;
  let weightForAvg = 0;
  for (const r of byStaff) {
    approved += r.approved;
    rejected += r.rejected;
    rev.TL += r.revenue.TL;
    rev.EUR += r.revenue.EUR;
    rev.USD += r.revenue.USD;
    if (r.avgDaysToResult != null && r.total > 0) {
      weightedDays += r.avgDaysToResult * r.total;
      weightForAvg += r.total;
    }
  }
  const total = approved + rejected;
  return {
    total,
    approved,
    rejected,
    approvalRatePct: total > 0 ? (approved / total) * 100 : 0,
    avgDaysToResult:
      weightForAvg > 0 ? Math.round((weightedDays / weightForAvg) * 10) / 10 : null,
    revenue: rev,
  };
}

export function buildMonthlySummary(
  year: number,
  month: number,
  files: RawFileRow[],
  options?: { assignedUserId?: string | null }
): MonthlySummary {
  let decided = files.filter((f) => f.sonuc === "vize_onay" || f.sonuc === "red");
  if (options?.assignedUserId) {
    decided = decided.filter((f) => f.assigned_user_id === options.assignedUserId);
  }

  const byCountryMap = new Map<string, RawFileRow[]>();
  const byStaffMap = new Map<string, { name: string; rows: RawFileRow[] }>();

  for (const f of decided) {
    const cKey = (f.hedef_ulke || "").trim() || "—";
    if (!byCountryMap.has(cKey)) byCountryMap.set(cKey, []);
    byCountryMap.get(cKey)!.push(f);

    const sid = f.assigned_user_id;
    const sname = f.profiles?.name || "Atanmamış";
    if (!byStaffMap.has(sid)) byStaffMap.set(sid, { name: sname, rows: [] });
    byStaffMap.get(sid)!.rows.push(f);
  }

  const byCountry = Array.from(byCountryMap.entries())
    .map(([label, rows]) => ({
      key: label,
      label,
      ...aggregateRows(rows),
    }))
    .sort((a, b) => b.total - a.total);

  const byStaff = Array.from(byStaffMap.entries())
    .map(([staffId, { name, rows }]) => ({
      staffId,
      staffName: name,
      ...aggregateRows(rows),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    year,
    month,
    monthLabelTr: monthLabelTr(year, month),
    generatedAt: new Date().toISOString(),
    overall: aggregateRows(decided),
    byCountry,
    byStaff,
  };
}

export function monthBoundsISO(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const endExclusive = `${next.y}-${String(next.m).padStart(2, "0")}-01`;
  return { start, endExclusive };
}
