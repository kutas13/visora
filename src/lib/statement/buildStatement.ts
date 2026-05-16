import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParaBirimi } from "@/lib/supabase/types";
import type { StatementData, StatementMovement } from "./StatementPdfDocument";

type BankAccountRow = {
  id: string;
  organization_id: string;
  name: string;
  bank_name: string | null;
  iban: string | null;
  currency: ParaBirimi;
};

type OrgRow = {
  name: string;
};

type CashAccountRow = {
  id: string;
  organization_id: string;
  bank_account_id: string | null;
  currency: ParaBirimi;
};

type CashTxRow = {
  id: string;
  created_at: string;
  direction: "in" | "out";
  source: "manual" | "payment" | "file_expense" | "transfer";
  amount: number;
  description: string | null;
  account_id: string;
};

/**
 * Belirli bir banka hesabi icin ekstre verisi olusturur.
 *  - opening_balance: range.from'dan ONCEKI tum hareketlerin neti
 *  - movements: range icindeki hareketler + running_balance
 */
export async function buildStatement(
  admin: SupabaseClient,
  bankAccountId: string,
  months: number,
  qrDataUrl: string
): Promise<StatementData> {
  // Banka hesabi
  const { data: bank, error: bankErr } = await admin
    .from("bank_accounts")
    .select("id, organization_id, name, bank_name, iban, currency")
    .eq("id", bankAccountId)
    .single<BankAccountRow>();
  if (bankErr || !bank) {
    throw new Error("Banka hesabı bulunamadı.");
  }

  // Bagli cash_account
  const { data: cashAcc } = await admin
    .from("cash_accounts")
    .select("id, organization_id, bank_account_id, currency")
    .eq("bank_account_id", bankAccountId)
    .maybeSingle<CashAccountRow>();
  if (!cashAcc) {
    // Bu hesabin henuz cash_account'i yoksa (trigger calismadiysa) — bos ekstre dondur
  }

  // Org bilgisi
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", bank.organization_id)
    .maybeSingle<OrgRow>();

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - months);

  let openingBalance = 0;
  let movements: StatementMovement[] = [];
  let totalIn = 0;
  let totalOut = 0;

  if (cashAcc) {
    // OPENING BALANCE — range'dan onceki tum hareketler
    const { data: priorTxs } = await admin
      .from("cash_transactions")
      .select("amount, direction")
      .eq("account_id", cashAcc.id)
      .lt("created_at", fromDate.toISOString());

    for (const t of priorTxs || []) {
      const a = Number(t.amount) || 0;
      openingBalance += t.direction === "in" ? a : -a;
    }

    // RANGE icindeki hareketler
    const { data: rangeTxs } = await admin
      .from("cash_transactions")
      .select("id, created_at, direction, source, amount, description, account_id")
      .eq("account_id", cashAcc.id)
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", now.toISOString())
      .order("created_at", { ascending: true });

    let running = openingBalance;
    for (const t of (rangeTxs || []) as CashTxRow[]) {
      const a = Number(t.amount) || 0;
      running += t.direction === "in" ? a : -a;
      if (t.direction === "in") totalIn += a;
      else totalOut += a;
      movements.push({
        id: t.id,
        created_at: t.created_at,
        direction: t.direction,
        source: t.source,
        amount: a,
        description: t.description,
        running_balance: Math.round(running * 100) / 100,
      });
    }
  }

  const closingBalance = openingBalance + totalIn - totalOut;

  // Belge no (rastgele kisa) — her seferinde farkli olmasin diye account_id + ay birlesimi
  const docNo = `EKS-${bank.id.slice(0, 8).toUpperCase()}-${months}M-${Math.floor(now.getTime() / 1000).toString(36).toUpperCase()}`;

  const issuedAt = now.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    organization: {
      name: org?.name || "Visora",
      address: null,
      phone: null,
    },
    account: {
      name: bank.name,
      bank_name: bank.bank_name,
      iban: bank.iban,
      currency: bank.currency,
    },
    range: {
      from: fromDate.toISOString(),
      to: now.toISOString(),
      months,
    },
    opening_balance: Math.round(openingBalance * 100) / 100,
    closing_balance: Math.round(closingBalance * 100) / 100,
    total_in: Math.round(totalIn * 100) / 100,
    total_out: Math.round(totalOut * 100) / 100,
    movements,
    qr_data_url: qrDataUrl,
    doc_no: docNo,
    issued_at: issuedAt,
  };
}
