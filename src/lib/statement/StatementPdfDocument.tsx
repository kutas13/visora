/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { ParaBirimi } from "@/lib/supabase/types";

const COLORS = {
  navy: "#0c1d33",
  navyMid: "#1e3a5f",
  slate: "#475569",
  muted: "#64748b",
  border: "#cbd5e1",
  stripe: "#f1f5f9",
  white: "#ffffff",
  card: "#f8fafc",
  green: "#047857",
  red: "#b91c1c",
  amber: "#a16207",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manuel",
  payment: "Tahsilat",
  file_expense: "Dosya Gideri",
  transfer: "Transfer",
};

export type StatementMovement = {
  id: string;
  created_at: string;
  direction: "in" | "out";
  source: "manual" | "payment" | "file_expense" | "transfer";
  amount: number;
  description: string | null;
  /** Hareket sonrasi kalan bakiye (running balance) */
  running_balance: number;
};

export type StatementData = {
  organization: { name: string; address?: string | null; phone?: string | null };
  account: {
    name: string;
    bank_name: string | null;
    iban: string | null;
    currency: ParaBirimi;
  };
  range: { from: string; to: string; months: number };
  opening_balance: number;
  closing_balance: number;
  total_in: number;
  total_out: number;
  movements: StatementMovement[];
  /** PNG / data:image base64; her sayfanin alt kismina basilir */
  qr_data_url: string;
  /** Document numarasi */
  doc_no: string;
  /** Olusturulma tarihi (Istanbul TR) */
  issued_at: string;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 9,
    paddingTop: 0,
    paddingBottom: 110,
    paddingHorizontal: 0,
    color: COLORS.navy,
  },
  // ---- HEADER ----
  headerBand: {
    backgroundColor: COLORS.navy,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandTag: { color: "#94a3b8", fontSize: 7.5, letterSpacing: 1.4, marginBottom: 3 },
  headerTitle: { color: "#ffffff", fontSize: 17, fontWeight: "bold" },
  headerSub: { color: "#cbd5e1", fontSize: 9.5, marginTop: 4 },
  docMetaBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 3,
  },
  docMetaTitle: { color: "#94a3b8", fontSize: 7, letterSpacing: 1.2 },
  docMetaValue: { color: "#ffffff", fontSize: 10.5, fontWeight: "bold", marginTop: 1 },

  body: { paddingHorizontal: 40, paddingTop: 18 },

  // ---- ACCOUNT BOX ----
  acctBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  acctLeft: { flex: 1, padding: 11, backgroundColor: COLORS.card },
  acctRight: { width: 200, padding: 11, backgroundColor: COLORS.navy },
  acctLabel: { fontSize: 7, color: COLORS.muted, letterSpacing: 0.6, marginBottom: 2, textTransform: "uppercase" },
  acctValue: { fontSize: 11, color: COLORS.navy, fontWeight: "bold", marginBottom: 6 },
  acctSub: { fontSize: 8.5, color: COLORS.slate, marginBottom: 1 },
  acctIban: { fontSize: 9, color: COLORS.navyMid, marginTop: 3 },
  acctRightLabel: { fontSize: 7, color: "#94a3b8", letterSpacing: 0.7, marginBottom: 3 },
  acctRightValue: { fontSize: 18, color: "#ffffff", fontWeight: "bold" },
  acctRightSub: { fontSize: 8, color: "#cbd5e1", marginTop: 4 },

  // ---- SUMMARY ----
  summaryRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  sumCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    padding: 8,
    backgroundColor: COLORS.white,
  },
  sumLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  sumValue: { fontSize: 11, fontWeight: "bold" },
  sumInValue: { color: COLORS.green },
  sumOutValue: { color: COLORS.red },
  sumNetValue: { color: COLORS.navy },

  // ---- TABLE ----
  tableTitle: { fontSize: 9, fontWeight: "bold", color: COLORS.navyMid, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 3, overflow: "hidden" },
  thead: {
    flexDirection: "row",
    backgroundColor: COLORS.navy,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: { color: "#ffffff", fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0" },
  trStripe: { backgroundColor: COLORS.stripe },
  td: { fontSize: 8.5, color: COLORS.navy },
  tdDate: { width: 70 },
  tdType: { width: 60 },
  tdDesc: { flex: 1, paddingRight: 6 },
  tdIn: { width: 70, textAlign: "right", color: COLORS.green, fontWeight: "bold" },
  tdOut: { width: 70, textAlign: "right", color: COLORS.red, fontWeight: "bold" },
  tdBal: { width: 70, textAlign: "right", color: COLORS.navy, fontWeight: "bold" },

  emptyBox: { padding: 16, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 9, color: COLORS.muted },

  // ---- FOOTER (every page) ----
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTopWidth: 0.6,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  qrImage: { width: 60, height: 60 },
  footerTextBox: { maxWidth: 340 },
  footerTitle: { fontSize: 8.5, fontWeight: "bold", color: COLORS.navy, marginBottom: 2 },
  footerText: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.35 },
  pageNum: { fontSize: 8, color: COLORS.muted, fontWeight: "bold" },
});

function fmtDateShort(s: string): string {
  return new Date(s).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateRange(s: string): string {
  return new Date(s).toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMoney(n: number, currency: ParaBirimi): string {
  const sym = currency === "TL" ? "₺" : currency === "EUR" ? "€" : "$";
  const v = Number.isFinite(n) ? n : 0;
  return `${sym}${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StatementPdfDocument({ data }: { data: StatementData }) {
  const { account, organization, range, movements, qr_data_url } = data;
  return (
    <Document
      title={`Ekstre - ${account.name}`}
      author={organization.name}
      subject="Banka Hesabı Ekstresi"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* HEADER */}
        <View style={styles.headerBand} fixed>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brandTag}>HESAP EKSTRESİ</Text>
              <Text style={styles.headerTitle}>{organization.name}</Text>
              <Text style={styles.headerSub}>
                {fmtDateRange(range.from)} → {fmtDateRange(range.to)} ({range.months} aylık dönem)
              </Text>
            </View>
            <View style={styles.docMetaBox}>
              <Text style={styles.docMetaTitle}>BELGE NO</Text>
              <Text style={styles.docMetaValue}>{data.doc_no}</Text>
              <Text style={{ color: "#94a3b8", fontSize: 7, marginTop: 4 }}>DÜZENLENME</Text>
              <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "bold" }}>{data.issued_at}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* HESAP DETAY + KAPANIS BAKIYESI */}
          <View style={styles.acctBox}>
            <View style={styles.acctLeft}>
              <Text style={styles.acctLabel}>Hesap Sahibi</Text>
              <Text style={styles.acctValue}>{account.name}</Text>
              {account.bank_name && (
                <>
                  <Text style={styles.acctLabel}>Banka</Text>
                  <Text style={styles.acctSub}>{account.bank_name}</Text>
                </>
              )}
              {account.iban && (
                <Text style={styles.acctIban}>IBAN: {account.iban}</Text>
              )}
              <Text style={[styles.acctLabel, { marginTop: 6 }]}>Para Birimi</Text>
              <Text style={styles.acctSub}>{account.currency}</Text>
            </View>
            <View style={styles.acctRight}>
              <Text style={styles.acctRightLabel}>KAPANIŞ BAKİYESİ</Text>
              <Text style={[styles.acctRightValue, data.closing_balance < 0 && { color: "#fda4af" }]}>
                {fmtMoney(data.closing_balance, account.currency)}
              </Text>
              <Text style={styles.acctRightSub}>
                Açılış: {fmtMoney(data.opening_balance, account.currency)}
              </Text>
            </View>
          </View>

          {/* OZET */}
          <View style={styles.summaryRow}>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>Toplam Giriş</Text>
              <Text style={[styles.sumValue, styles.sumInValue]}>+ {fmtMoney(data.total_in, account.currency)}</Text>
            </View>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>Toplam Çıkış</Text>
              <Text style={[styles.sumValue, styles.sumOutValue]}>− {fmtMoney(data.total_out, account.currency)}</Text>
            </View>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>Net Hareket</Text>
              <Text style={[styles.sumValue, styles.sumNetValue]}>
                {fmtMoney(data.total_in - data.total_out, account.currency)}
              </Text>
            </View>
            <View style={styles.sumCard}>
              <Text style={styles.sumLabel}>Hareket Adedi</Text>
              <Text style={[styles.sumValue, styles.sumNetValue]}>{movements.length}</Text>
            </View>
          </View>

          {/* TABLE */}
          <Text style={styles.tableTitle}>Hesap Hareketleri</Text>
          <View style={styles.table}>
            <View style={styles.thead} fixed>
              <Text style={[styles.th, styles.tdDate]}>Tarih</Text>
              <Text style={[styles.th, styles.tdType]}>Tip</Text>
              <Text style={[styles.th, styles.tdDesc]}>Açıklama</Text>
              <Text style={[styles.th, styles.tdIn]}>Giriş</Text>
              <Text style={[styles.th, styles.tdOut]}>Çıkış</Text>
              <Text style={[styles.th, styles.tdBal]}>Bakiye</Text>
            </View>

            {movements.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Bu dönemde hesap hareketi yok.</Text>
              </View>
            ) : (
              movements.map((m, i) => (
                <View
                  key={m.id}
                  style={[styles.tr, i % 2 === 1 && styles.trStripe]}
                  wrap={false}
                >
                  <Text style={[styles.td, styles.tdDate]}>{fmtDateShort(m.created_at)}</Text>
                  <Text style={[styles.td, styles.tdType]}>{SOURCE_LABEL[m.source] || m.source}</Text>
                  <Text style={[styles.td, styles.tdDesc]}>{m.description || "—"}</Text>
                  <Text style={[styles.td, styles.tdIn]}>
                    {m.direction === "in" ? fmtMoney(m.amount, account.currency) : ""}
                  </Text>
                  <Text style={[styles.td, styles.tdOut]}>
                    {m.direction === "out" ? fmtMoney(m.amount, account.currency) : ""}
                  </Text>
                  <Text style={[styles.td, styles.tdBal]}>
                    {fmtMoney(m.running_balance, account.currency)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* FOOTER her sayfada */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qr_data_url} style={styles.qrImage} />
            <View style={styles.footerTextBox}>
              <Text style={styles.footerTitle}>Bu ekstre QR kod ile doğrulanabilir.</Text>
              <Text style={styles.footerText}>
                Mobil cihazınızla yukarıdaki QR kodu tarayarak ekstrenin orijinal halini görüntüleyebilirsiniz.
                Belge bilgileri Visora platformu üzerinden imzalı bir bağlantıya yönlendirir.
              </Text>
              <Text style={[styles.footerText, { marginTop: 2 }]}>
                {organization.name} · Düzenlenme: {data.issued_at}
              </Text>
            </View>
          </View>
          <Text
            style={styles.pageNum}
            render={({ pageNumber, totalPages }) => `Sayfa ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
