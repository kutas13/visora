import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MonthlySummary, SummaryBucket } from "./buildMonthlySummary";
import { sumStaffBuckets } from "./buildMonthlySummary";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "NotoSans",
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4, color: "#102a43" },
  subtitle: { fontSize: 10, color: "#486581", marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#102a43", marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#bcccdc", paddingVertical: 4 },
  th: {
    flexDirection: "row",
    paddingVertical: 5,
    backgroundColor: "#f0f4f8",
    borderBottomWidth: 1,
    borderBottomColor: "#627d98",
  },
  thText: { fontSize: 8, fontWeight: "bold", color: "#334e68" },
  cell: { fontSize: 8, color: "#243b53" },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1.5,
    borderTopColor: "#334e68",
    paddingVertical: 5,
    backgroundColor: "#e8eef4",
  },
  totalCell: { fontSize: 8, fontWeight: "bold", color: "#102a43" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#829ab1",
    textAlign: "center",
  },
});

function fmtMoney(b: SummaryBucket["revenue"]) {
  const parts: string[] = [];
  if (b.TL) parts.push(`${b.TL.toLocaleString("tr-TR")} TL`);
  if (b.EUR) parts.push(`${b.EUR.toLocaleString("tr-TR")} EUR`);
  if (b.USD) parts.push(`${b.USD.toLocaleString("tr-TR")} USD`);
  return parts.length ? parts.join(" · ") : "0";
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "25%", paddingRight: 6 }}>
      <Text style={{ fontSize: 7, color: "#627d98", marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontWeight: "bold", color: "#102a43" }}>{value}</Text>
    </View>
  );
}

export type MonthlySummaryPdfDocumentProps = {
  data: MonthlySummary;
  /** Davut: personel tablosunun altında toplam satırı */
  showPersonelTotals?: boolean;
};

export function MonthlySummaryPdfDocument({ data, showPersonelTotals }: MonthlySummaryPdfDocumentProps) {
  const o = data.overall;
  const avg = o.avgDaysToResult != null ? `${o.avgDaysToResult} gün` : "—";
  const staffTotals = showPersonelTotals ? sumStaffBuckets(data.byStaff) : null;

  return (
    <Document title={`Fox Turizm — Aylık özet ${data.monthLabelTr}`} author="Fox Turizm">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Aylık vize özeti</Text>
        <Text style={styles.subtitle}>
          {data.monthLabelTr} · Sonuç tarihi bu ayda olan dosyalar (onay + red)
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          <Kpi label="Toplam sonuçlanan" value={String(o.total)} />
          <Kpi label="Onay oranı" value={`${o.approvalRatePct.toFixed(1)}%`} />
          <Kpi label="Ort. süre (oluşturma → sonuç)" value={avg} />
          <Kpi label="Ciro (ücret toplamı)" value="Aşağıda döviz kırılımı" />
        </View>
        <Text style={{ fontSize: 9, marginBottom: 12, color: "#334e68" }}>Ciro: {fmtMoney(o.revenue)}</Text>

        <Text style={styles.sectionTitle}>Ülke bazlı</Text>
        <View style={styles.th}>
          <Text style={[styles.thText, { width: "28%" }]}>Ülke</Text>
          <Text style={[styles.thText, { width: "12%", textAlign: "right" }]}>Dosya</Text>
          <Text style={[styles.thText, { width: "12%", textAlign: "right" }]}>Onay</Text>
          <Text style={[styles.thText, { width: "12%", textAlign: "right" }]}>Red</Text>
          <Text style={[styles.thText, { width: "18%", textAlign: "right" }]}>Onay %</Text>
          <Text style={[styles.thText, { width: "18%", textAlign: "right" }]}>Ort. gün</Text>
        </View>
        {data.byCountry.slice(0, 22).map((r) => (
          <View key={r.key} style={styles.row} wrap={false}>
            <Text style={[styles.cell, { width: "28%" }]}>{r.label}</Text>
            <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>{r.total}</Text>
            <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>{r.approved}</Text>
            <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>{r.rejected}</Text>
            <Text style={[styles.cell, { width: "18%", textAlign: "right" }]}>
              {r.total ? `${r.approvalRatePct.toFixed(0)}%` : "—"}
            </Text>
            <Text style={[styles.cell, { width: "18%", textAlign: "right" }]}>
              {r.avgDaysToResult != null ? String(r.avgDaysToResult) : "—"}
            </Text>
          </View>
        ))}
        {data.byCountry.length > 22 && (
          <Text style={{ marginTop: 4, fontSize: 7, color: "#829ab1" }}>
            … ve {data.byCountry.length - 22} ülke daha (tam liste için uygulama ekranına bakın)
          </Text>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Personel bazlı</Text>
        <View style={styles.th}>
          <Text style={[styles.thText, { width: "32%" }]}>Personel</Text>
          <Text style={[styles.thText, { width: "12%", textAlign: "right" }]}>Dosya</Text>
          <Text style={[styles.thText, { width: "12%", textAlign: "right" }]}>Onay</Text>
          <Text style={[styles.thText, { width: "12%", textAlign: "right" }]}>Red</Text>
          <Text style={[styles.thText, { width: "16%", textAlign: "right" }]}>Onay %</Text>
          <Text style={[styles.thText, { width: "16%", textAlign: "right" }]}>Ort. gün</Text>
        </View>
        {data.byStaff.map((r) => (
          <View key={r.staffId} style={styles.row} wrap={false}>
            <Text style={[styles.cell, { width: "32%" }]}>{r.staffName}</Text>
            <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>{r.total}</Text>
            <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>{r.approved}</Text>
            <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>{r.rejected}</Text>
            <Text style={[styles.cell, { width: "16%", textAlign: "right" }]}>
              {r.total ? `${r.approvalRatePct.toFixed(0)}%` : "—"}
            </Text>
            <Text style={[styles.cell, { width: "16%", textAlign: "right" }]}>
              {r.avgDaysToResult != null ? String(r.avgDaysToResult) : "—"}
            </Text>
          </View>
        ))}
        {staffTotals && (
          <View style={styles.totalRow} wrap={false}>
            <Text style={[styles.totalCell, { width: "32%" }]}>TOPLAM</Text>
            <Text style={[styles.totalCell, { width: "12%", textAlign: "right" }]}>{staffTotals.total}</Text>
            <Text style={[styles.totalCell, { width: "12%", textAlign: "right" }]}>{staffTotals.approved}</Text>
            <Text style={[styles.totalCell, { width: "12%", textAlign: "right" }]}>{staffTotals.rejected}</Text>
            <Text style={[styles.totalCell, { width: "16%", textAlign: "right" }]}>
              {staffTotals.total ? `${staffTotals.approvalRatePct.toFixed(0)}%` : "—"}
            </Text>
            <Text style={[styles.totalCell, { width: "16%", textAlign: "right" }]}>
              {staffTotals.avgDaysToResult != null ? String(staffTotals.avgDaysToResult) : "—"}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Ciro — ülke (TL / EUR / USD)</Text>
        {data.byCountry.slice(0, 15).map((r) => (
          <View key={`rev-${r.key}`} style={styles.row}>
            <Text style={[styles.cell, { width: "32%" }]}>{r.label}</Text>
            <Text style={[styles.cell, { width: "68%" }]}>{fmtMoney(r.revenue)}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Fox Turizm · Oluşturulma: {new Date(data.generatedAt).toLocaleString("tr-TR")} · Yalnızca iç kullanım
        </Text>
      </Page>
    </Document>
  );
}
