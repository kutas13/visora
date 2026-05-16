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

const C = {
  navy: "#0b1c3a",
  navyDeep: "#06122a",
  indigo: "#4338ca",
  indigoSoft: "#eef2ff",
  slate: "#475569",
  slate2: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  borderSoft: "#f1f5f9",
  stripe: "#f8fafc",
  white: "#ffffff",
  card: "#f8fafc",
  green: "#047857",
  greenSoft: "#ecfdf5",
  red: "#b91c1c",
  redSoft: "#fef2f2",
  amber: "#b45309",
  amberSoft: "#fffbeb",
  brandGrad1: "#4f46e5",
  brandGrad2: "#7c3aed",
  brandGrad3: "#ec4899",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manuel",
  payment: "Tahsilat",
  file_expense: "Dosya Gideri",
  transfer: "Transfer",
};

const SOURCE_COLOR: Record<string, { bg: string; fg: string; bd: string }> = {
  manual: { bg: "#f1f5f9", fg: "#334155", bd: "#cbd5e1" },
  payment: { bg: C.greenSoft, fg: C.green, bd: "#a7f3d0" },
  file_expense: { bg: C.redSoft, fg: C.red, bd: "#fecaca" },
  transfer: { bg: C.indigoSoft, fg: C.indigo, bd: "#c7d2fe" },
};

export type StatementMovement = {
  id: string;
  created_at: string;
  direction: "in" | "out";
  source: "manual" | "payment" | "file_expense" | "transfer";
  amount: number;
  description: string | null;
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
  qr_data_url: string;
  doc_no: string;
  issued_at: string;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 9,
    paddingTop: 0,
    paddingBottom: 120,
    paddingHorizontal: 0,
    color: C.navy,
  },

  // ---- BRAND SIDE BAR ----
  brandBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: C.indigo,
  },
  brandBar2: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 6,
    height: "33%",
    backgroundColor: C.brandGrad3,
  },

  // ---- HEADER ----
  headerWrap: {
    backgroundColor: C.navyDeep,
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 42,
  },
  headerAccent: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 220,
    backgroundColor: C.indigo,
    opacity: 0.18,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandLine: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brandGrad3, marginRight: 6 },
  brandTag: { color: "#a5b4fc", fontSize: 8, letterSpacing: 1.6, fontWeight: "bold" },
  headerTitle: { color: "#ffffff", fontSize: 20, fontWeight: "bold", letterSpacing: 0.3 },
  headerSub: { color: "#cbd5e1", fontSize: 10, marginTop: 5 },
  headerKv: { flexDirection: "row", marginTop: 8 },
  headerKvLabel: { color: "#94a3b8", fontSize: 7.5, letterSpacing: 1.1, marginRight: 6, width: 80 },
  headerKvValue: { color: "#e2e8f0", fontSize: 9, fontWeight: "bold" },

  docBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 4,
    minWidth: 130,
  },
  docLabel: { color: "#94a3b8", fontSize: 7, letterSpacing: 1.1, marginBottom: 1 },
  docValue: { color: "#ffffff", fontSize: 10.5, fontWeight: "bold" },

  body: { paddingHorizontal: 42, paddingTop: 18 },

  // ---- ACCOUNT + BALANCE STRIP ----
  acctStrip: { flexDirection: "row", gap: 10, marginBottom: 14 },
  acctCol: {
    flex: 1.4,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 5,
    padding: 12,
    backgroundColor: C.white,
  },
  balanceCol: {
    flex: 1,
    borderRadius: 5,
    padding: 14,
    backgroundColor: C.navy,
    position: "relative",
    overflow: "hidden",
  },
  balanceCorner: {
    position: "absolute",
    right: -20,
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.indigo,
    opacity: 0.35,
  },
  acctLabel: { fontSize: 7.5, color: C.muted, letterSpacing: 0.7, marginBottom: 3, textTransform: "uppercase", fontWeight: "bold" },
  acctValue: { fontSize: 13, color: C.navy, fontWeight: "bold" },
  acctRowMini: { marginTop: 8 },
  acctBank: { fontSize: 9.5, color: C.slate2, fontWeight: "bold" },
  acctIbanBox: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: C.borderSoft,
    borderRadius: 4,
  },
  acctIbanLbl: { fontSize: 7, color: C.muted, marginBottom: 1, letterSpacing: 0.7 },
  acctIban: { fontSize: 10, color: C.navy, fontWeight: "bold" },

  balanceLbl: { fontSize: 8, color: "#cbd5e1", letterSpacing: 1, marginBottom: 6, fontWeight: "bold" },
  balanceVal: { fontSize: 22, color: "#ffffff", fontWeight: "bold", letterSpacing: 0.3 },
  balanceCcy: { fontSize: 9, color: "#94a3b8", marginTop: 6 },
  balanceFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 8, borderTopWidth: 0.6, borderTopColor: "rgba(255,255,255,0.15)" },
  balanceFkv: {},
  balanceFkvLbl: { fontSize: 7, color: "#94a3b8", letterSpacing: 0.7 },
  balanceFkvVal: { fontSize: 9.5, color: "#ffffff", fontWeight: "bold", marginTop: 1 },

  // ---- KPI STRIP (3 colors) ----
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    padding: 9,
    paddingLeft: 11,
  },
  kpiAccent: { width: 3, position: "absolute", left: 0, top: 8, bottom: 8, borderRadius: 2 },
  kpiLbl: { fontSize: 7, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "bold", marginBottom: 3 },
  kpiVal: { fontSize: 13, fontWeight: "bold" },
  kpiSub: { fontSize: 7.5, marginTop: 2 },

  // ---- TABLE ----
  tableTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: C.navy,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tableSub: { fontSize: 7.5, color: C.muted, marginBottom: 7, marginTop: -3 },
  table: {
    borderWidth: 0.8,
    borderColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  thead: {
    flexDirection: "row",
    backgroundColor: C.navy,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  th: { color: "#ffffff", fontSize: 7.5, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.4, borderTopColor: C.border, alignItems: "center" },
  trStripe: { backgroundColor: C.stripe },
  td: { fontSize: 8.5, color: C.navy },
  tdIdx: { width: 24, color: C.muted },
  tdDate: { width: 72 },
  tdType: { width: 70 },
  tdTypeBadge: {
    borderWidth: 0.6,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    fontSize: 7,
    fontWeight: "bold",
    alignSelf: "flex-start",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tdDesc: { flex: 1, paddingRight: 6, color: C.slate2 },
  tdIn: { width: 70, textAlign: "right", color: C.green, fontWeight: "bold" },
  tdOut: { width: 70, textAlign: "right", color: C.red, fontWeight: "bold" },
  tdBal: { width: 76, textAlign: "right", color: C.navy, fontWeight: "bold" },

  emptyBox: { padding: 18, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 9.5, color: C.muted, fontStyle: "italic" },

  // ---- FOOTER ----
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 42,
    borderTopWidth: 0.6,
    borderTopColor: C.border,
    backgroundColor: "#ffffff",
  },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qrBlock: { flexDirection: "row", alignItems: "center", gap: 11 },
  qrImage: { width: 64, height: 64 },
  qrInfo: { maxWidth: 320 },
  qrTitle: { fontSize: 9, fontWeight: "bold", color: C.navy, marginBottom: 3 },
  qrText: { fontSize: 7.5, color: C.muted, lineHeight: 1.45 },
  qrLink: { fontSize: 7, color: C.indigo, marginTop: 2 },

  footerMeta: { alignItems: "flex-end" },
  pageNum: { fontSize: 8, color: C.slate, fontWeight: "bold" },
  footerOrg: { fontSize: 7.5, color: C.muted, marginTop: 3 },
  footerStamp: { fontSize: 7, color: C.muted, marginTop: 1 },
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
  const net = data.total_in - data.total_out;

  return (
    <Document
      title={`Ekstre - ${account.name}`}
      author={organization.name}
      subject="Banka Hesabı Ekstresi"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Sol marka cubugu — her sayfa */}
        <View style={styles.brandBar} fixed />
        <View style={styles.brandBar2} fixed />

        {/* HEADER */}
        <View style={styles.headerWrap} fixed>
          <View style={styles.headerAccent} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.brandLine}>
                <View style={styles.brandDot} />
                <Text style={styles.brandTag}>HESAP EKSTRESİ</Text>
              </View>
              <Text style={styles.headerTitle}>{organization.name}</Text>
              <Text style={styles.headerSub}>
                {fmtDateRange(range.from)} → {fmtDateRange(range.to)}  ·  Son {range.months} ay
              </Text>

              <View style={styles.headerKv}>
                <Text style={styles.headerKvLabel}>HESAP</Text>
                <Text style={styles.headerKvValue}>{account.name}{account.bank_name ? `  ·  ${account.bank_name}` : ""}</Text>
              </View>
              <View style={styles.headerKv}>
                <Text style={styles.headerKvLabel}>PARA BİRİMİ</Text>
                <Text style={styles.headerKvValue}>{account.currency}</Text>
              </View>
            </View>

            <View style={styles.docBox}>
              <Text style={styles.docLabel}>BELGE NO</Text>
              <Text style={styles.docValue}>{data.doc_no}</Text>
              <Text style={[styles.docLabel, { marginTop: 6 }]}>DÜZENLENME</Text>
              <Text style={styles.docValue}>{data.issued_at}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* HESAP + BAKIYE */}
          <View style={styles.acctStrip}>
            <View style={styles.acctCol}>
              <Text style={styles.acctLabel}>Hesap Sahibi</Text>
              <Text style={styles.acctValue}>{account.name}</Text>

              {account.bank_name && (
                <View style={styles.acctRowMini}>
                  <Text style={styles.acctLabel}>Banka</Text>
                  <Text style={styles.acctBank}>{account.bank_name}</Text>
                </View>
              )}

              {account.iban && (
                <View style={styles.acctIbanBox}>
                  <Text style={styles.acctIbanLbl}>IBAN</Text>
                  <Text style={styles.acctIban}>{account.iban}</Text>
                </View>
              )}
            </View>

            <View style={styles.balanceCol}>
              <View style={styles.balanceCorner} />
              <Text style={styles.balanceLbl}>KAPANIŞ BAKİYESİ</Text>
              <Text
                style={
                  data.closing_balance < 0
                    ? [styles.balanceVal, { color: "#fda4af" }]
                    : styles.balanceVal
                }
              >
                {fmtMoney(data.closing_balance, account.currency)}
              </Text>
              <Text style={styles.balanceCcy}>{account.currency}</Text>

              <View style={styles.balanceFooter}>
                <View style={styles.balanceFkv}>
                  <Text style={styles.balanceFkvLbl}>AÇILIŞ</Text>
                  <Text style={styles.balanceFkvVal}>{fmtMoney(data.opening_balance, account.currency)}</Text>
                </View>
                <View style={styles.balanceFkv}>
                  <Text style={styles.balanceFkvLbl}>NET HAREKET</Text>
                  <Text style={[styles.balanceFkvVal, net < 0 && { color: "#fda4af" }]}>
                    {fmtMoney(net, account.currency)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* KPI ROW */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: C.greenSoft, borderColor: "#a7f3d0" }]}>
              <View style={[styles.kpiAccent, { backgroundColor: C.green }]} />
              <Text style={[styles.kpiLbl, { color: C.green }]}>Toplam Giriş</Text>
              <Text style={[styles.kpiVal, { color: C.green }]}>+ {fmtMoney(data.total_in, account.currency)}</Text>
              <Text style={[styles.kpiSub, { color: C.green }]}>
                {movements.filter((m) => m.direction === "in").length} hareket
              </Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: C.redSoft, borderColor: "#fecaca" }]}>
              <View style={[styles.kpiAccent, { backgroundColor: C.red }]} />
              <Text style={[styles.kpiLbl, { color: C.red }]}>Toplam Çıkış</Text>
              <Text style={[styles.kpiVal, { color: C.red }]}>− {fmtMoney(data.total_out, account.currency)}</Text>
              <Text style={[styles.kpiSub, { color: C.red }]}>
                {movements.filter((m) => m.direction === "out").length} hareket
              </Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: C.indigoSoft, borderColor: "#c7d2fe" }]}>
              <View style={[styles.kpiAccent, { backgroundColor: C.indigo }]} />
              <Text style={[styles.kpiLbl, { color: C.indigo }]}>Hareket Adedi</Text>
              <Text style={[styles.kpiVal, { color: C.indigo }]}>{movements.length}</Text>
              <Text style={[styles.kpiSub, { color: C.indigo }]}>{range.months} aylık dönem</Text>
            </View>
          </View>

          {/* TABLE */}
          <Text style={styles.tableTitle}>Hesap Hareketleri</Text>
          <Text style={styles.tableSub}>
            En eski hareketten en yenisine doğru sıralı. Bakiye sütunu her hareketten sonraki kalan tutarı gösterir.
          </Text>
          <View style={styles.table}>
            <View style={styles.thead} fixed>
              <Text style={[styles.th, styles.tdIdx]}>#</Text>
              <Text style={[styles.th, styles.tdDate]}>Tarih</Text>
              <Text style={[styles.th, styles.tdType]}>Tip</Text>
              <Text style={[styles.th, styles.tdDesc]}>Açıklama</Text>
              <Text style={[styles.th, styles.tdIn]}>Giriş</Text>
              <Text style={[styles.th, styles.tdOut]}>Çıkış</Text>
              <Text style={[styles.th, styles.tdBal]}>Bakiye</Text>
            </View>

            {movements.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Bu dönemde hesap hareketi bulunmamaktadır.</Text>
              </View>
            ) : (
              movements.map((m, i) => {
                const c = SOURCE_COLOR[m.source] || SOURCE_COLOR.manual;
                return (
                  <View
                    key={m.id}
                    style={i % 2 === 1 ? [styles.tr, styles.trStripe] : styles.tr}
                    wrap={false}
                  >
                    <Text style={[styles.td, styles.tdIdx]}>{String(i + 1).padStart(3, "0")}</Text>
                    <Text style={[styles.td, styles.tdDate]}>{fmtDateShort(m.created_at)}</Text>
                    <View style={styles.tdType}>
                      <Text
                        style={{
                          ...styles.tdTypeBadge,
                          color: c.fg,
                          backgroundColor: c.bg,
                          borderColor: c.bd,
                        }}
                      >
                        {SOURCE_LABEL[m.source] || m.source}
                      </Text>
                    </View>
                    <Text style={[styles.td, styles.tdDesc]}>{m.description || "—"}</Text>
                    <Text style={[styles.td, styles.tdIn]}>
                      {m.direction === "in" ? fmtMoney(m.amount, account.currency) : ""}
                    </Text>
                    <Text style={[styles.td, styles.tdOut]}>
                      {m.direction === "out" ? fmtMoney(m.amount, account.currency) : ""}
                    </Text>
                    <Text
                      style={
                        m.running_balance < 0
                          ? [styles.td, styles.tdBal, { color: C.red }]
                          : [styles.td, styles.tdBal]
                      }
                    >
                      {fmtMoney(m.running_balance, account.currency)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* FOOTER her sayfada */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <View style={styles.qrBlock}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={qr_data_url} style={styles.qrImage} />
              <View style={styles.qrInfo}>
                <Text style={styles.qrTitle}>Bu ekstre dijital olarak doğrulanabilir.</Text>
                <Text style={styles.qrText}>
                  Mobil cihazınızla yandaki QR kodu tarayarak bu ekstrenin orijinal halini
                  görüntüleyebilirsiniz. Bağlantı imzalı ve süresizdir; içerik değişirse
                  kod geçersiz olur.
                </Text>
                <Text style={styles.qrLink}>visora.app · {data.doc_no}</Text>
              </View>
            </View>
            <View style={styles.footerMeta}>
              <Text
                style={styles.pageNum}
                render={({ pageNumber, totalPages }) => `Sayfa ${pageNumber} / ${totalPages}`}
              />
              <Text style={styles.footerOrg}>{organization.name}</Text>
              <Text style={styles.footerStamp}>Düzenlenme: {data.issued_at}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
