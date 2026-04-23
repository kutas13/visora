import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MonthlySummary, SummaryBucket } from "./buildMonthlySummary";
import { sumStaffBuckets } from "./buildMonthlySummary";

const COLORS = {
  navy: "#0c1d33",
  navyMid: "#1e3a5f",
  slate: "#475569",
  muted: "#64748b",
  border: "#cbd5e1",
  stripe: "#f1f5f9",
  white: "#ffffff",
  card: "#f8fafc",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 9,
    paddingTop: 0,
    paddingBottom: 56,
    paddingHorizontal: 0,
    color: COLORS.navy,
  },
  headerBand: {
    backgroundColor: COLORS.navy,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 18,
  },
  headerBrand: { color: "#94a3b8", fontSize: 8, letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: "#cbd5e1", fontSize: 10, marginTop: 4 },
  body: { paddingHorizontal: 40 },
  scopeBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 10,
    marginBottom: 14,
    borderRadius: 2,
  },
  scopeTitle: { fontSize: 8, fontWeight: "bold", color: COLORS.slate, marginBottom: 4 },
  scopeText: { fontSize: 8, color: COLORS.muted, lineHeight: 1.45 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  kpiCard: {
    width: "48%",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    padding: 9,
    backgroundColor: COLORS.white,
  },
  kpiLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontWeight: "bold", color: COLORS.navy },
  kpiHint: { fontSize: 7, color: COLORS.muted, marginTop: 2 },
  ciroBox: {
    borderWidth: 1,
    borderColor: COLORS.navyMid,
    backgroundColor: "#f0f4f8",
    padding: 11,
    marginBottom: 16,
    borderRadius: 2,
  },
  ciroTitle: { fontSize: 9, fontWeight: "bold", color: COLORS.navyMid, marginBottom: 5 },
  ciroAmount: { fontSize: 10.5, color: COLORS.navy, lineHeight: 1.45 },
  sectionBlock: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyMid,
  },
  sectionNum: {
    width: 20,
    height: 20,
    backgroundColor: COLORS.navyMid,
    borderRadius: 2,
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 3,
    marginRight: 7,
  },
  sectionTitle: { fontSize: 10.5, fontWeight: "bold", color: COLORS.navy },
  sectionHint: { fontSize: 7, color: COLORS.muted, marginTop: 2 },
  sectionDivider: {
    marginTop: 14,
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: COLORS.navyMid,
  },
  sectionDividerTitle: { fontSize: 10.5, fontWeight: "bold", color: COLORS.navy },
  sectionDividerSub: { fontSize: 7.5, color: COLORS.muted, marginTop: 2 },
  tableFrame: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  th: {
    flexDirection: "row",
    backgroundColor: COLORS.navyMid,
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  thText: { fontSize: 7.5, fontWeight: "bold", color: "#e2e8f0" },
  row: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 5, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  rowAlt: { backgroundColor: COLORS.stripe },
  cell: { fontSize: 7.5, color: COLORS.navy },
  cellNum: { fontSize: 7.5, color: COLORS.navy, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 5,
    backgroundColor: "#e2e8f0",
    borderTopWidth: 1.5,
    borderTopColor: COLORS.navyMid,
  },
  totalCell: { fontSize: 8, fontWeight: "bold", color: COLORS.navy },
  legend: {
    marginTop: 10,
    marginBottom: 4,
    padding: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
    borderRadius: 2,
  },
  legendTitle: { fontSize: 7.5, fontWeight: "bold", color: COLORS.slate, marginBottom: 3 },
  legendLine: { fontSize: 6.5, color: COLORS.muted, marginBottom: 2, lineHeight: 1.35 },
  truncateNote: { fontSize: 6.5, color: COLORS.muted, marginTop: 5 },
  footerFixed: {
    position: "absolute",
    bottom: 14,
    left: 40,
    right: 40,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
});

function fmtMoney(b: SummaryBucket["revenue"]) {
  const parts: string[] = [];
  if (b.TL) parts.push(`${b.TL.toLocaleString("tr-TR")} TL`);
  if (b.EUR) parts.push(`${b.EUR.toLocaleString("tr-TR")} EUR`);
  if (b.USD) parts.push(`${b.USD.toLocaleString("tr-TR")} USD`);
  return parts.length ? parts.join("  ·  ") : "—";
}

type CountryRow = MonthlySummary["byCountry"][number];

function CountryTableRows({ rows, startIndex }: { rows: CountryRow[]; startIndex: number }) {
  return (
    <View style={styles.tableFrame}>
      <View style={styles.th}>
        <Text style={[styles.thText, { width: "30%" }]}>Hedef ülke</Text>
        <Text style={[styles.thText, { width: "11%", textAlign: "right" }]}>Dosya</Text>
        <Text style={[styles.thText, { width: "11%", textAlign: "right" }]}>Onay</Text>
        <Text style={[styles.thText, { width: "11%", textAlign: "right" }]}>Red</Text>
        <Text style={[styles.thText, { width: "14%", textAlign: "right" }]}>Onay oranı</Text>
        <Text style={[styles.thText, { width: "23%", textAlign: "right" }]}>Ort. süre (gün)</Text>
      </View>
      {rows.map((r, i) => {
        const globalI = startIndex + i;
        return (
          <View key={r.key} style={[styles.row, globalI % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={[styles.cell, { width: "30%" }]}>{r.label}</Text>
            <Text style={[styles.cellNum, { width: "11%" }]}>{r.total}</Text>
            <Text style={[styles.cellNum, { width: "11%" }]}>{r.approved}</Text>
            <Text style={[styles.cellNum, { width: "11%" }]}>{r.rejected}</Text>
            <Text style={[styles.cellNum, { width: "14%" }]}>{r.total ? `${r.approvalRatePct.toFixed(1)}%` : "—"}</Text>
            <Text style={[styles.cellNum, { width: "23%" }]}>
              {r.avgDaysToResult != null ? String(r.avgDaysToResult) : "—"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type MonthlySummaryPdfDocumentProps = {
  data: MonthlySummary;
  showPersonelTotals?: boolean;
};

/**
 * Tek `<Page>`: react-pdf içinde birden fazla `<Page>` kullanılırsa ilki taşınca araya boş devam
 * sayfası girebiliyor. Tüm içerik tek sayfa bileşeninde akar; gerektiğinde PDF otomatik böler.
 */
export function MonthlySummaryPdfDocument({ data, showPersonelTotals }: MonthlySummaryPdfDocumentProps) {
  const o = data.overall;
  const avg = o.avgDaysToResult != null ? `${o.avgDaysToResult} gün` : "—";
  const staffTotals = showPersonelTotals ? sumStaffBuckets(data.byStaff) : null;
  const generated = new Date(data.generatedAt).toLocaleString("tr-TR");
  const countryRows = data.byCountry.slice(0, 28);

  return (
    <Document title={`Fox Turizm — Aylık vize özeti ${data.monthLabelTr}`} author="Fox Turizm">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand} wrap={false}>
          <Text style={styles.headerBrand}>FOX TURİZM · VİZE OPERASYON</Text>
          <Text style={styles.headerTitle}>Aylık vize özeti</Text>
          <Text style={styles.headerSub}>{data.monthLabelTr}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.scopeBox}>
            <Text style={styles.scopeTitle}>Bu raporda neler var?</Text>
            <Text style={styles.scopeText}>
              Seçilen ay içinde sonuç tarihi kaydı bulunan dosyalar (vize onayı veya red) listelenir. Onay oranı, onaylı
              dosya sayısının (onay + red) toplamına oranıdır. Ortalama süre: dosyanın oluşturulma tarihi ile sonuç
              tarihi arasındaki gün sayısının ortalamasıdır. Ciro: dosyaya kayıtlı ücret alanlarının para birimine göre
              toplamıdır (kur çevrimi yapılmaz).
            </Text>
          </View>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Sonuçlanan dosya</Text>
              <Text style={styles.kpiValue}>{o.total}</Text>
              <Text style={styles.kpiHint}>Bu ay sonucu kesinleşen başvuru</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Onay oranı</Text>
              <Text style={styles.kpiValue}>{o.approvalRatePct.toFixed(1)}%</Text>
              <Text style={styles.kpiHint}>Onay ÷ (onay + red)</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ortalama işlem süresi</Text>
              <Text style={styles.kpiValue}>{avg}</Text>
              <Text style={styles.kpiHint}>Oluşturma → sonuç tarihi</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ülke sayısı</Text>
              <Text style={styles.kpiValue}>{data.byCountry.length}</Text>
              <Text style={styles.kpiHint}>Farklı hedef ülke</Text>
            </View>
          </View>

          <View style={styles.ciroBox}>
            <Text style={styles.ciroTitle}>Genel ciro (ücret toplamları)</Text>
            <Text style={styles.ciroAmount}>{fmtMoney(o.revenue)}</Text>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNum}>1</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Ülke bazlı performans</Text>
                <Text style={styles.sectionHint}>Her satır bir hedef ülke; sayılar o ülkedeki sonuçlanan dosyalara göredir.</Text>
              </View>
            </View>
            <CountryTableRows rows={countryRows} startIndex={0} />
            {data.byCountry.length > 28 && (
              <Text style={styles.truncateNote}>
                Tablo toplam {data.byCountry.length} ülkeyi kapsar; PDF’de ilk 28 satır gösterilir. Tam liste için
                uygulamadaki aylık özet ekranına bakın.
              </Text>
            )}
          </View>

          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Kısaltmalar</Text>
            <Text style={styles.legendLine}>• Dosya: Sonuçlanan başvuru adedi · Onay / Red: Sonuç dağılımı</Text>
            <Text style={styles.legendLine}>• Onay oranı: Onaylı dosya ÷ tüm sonuçlanan dosya</Text>
            <Text style={styles.legendLine}>• Ort. süre: İlgili dosyalar için gün cinsinden ortalama bekleme süresi</Text>
          </View>

          <View style={styles.sectionDivider}>
            <Text style={styles.sectionDividerTitle}>Personel ve ciro</Text>
            <Text style={styles.sectionDividerSub}>{data.monthLabelTr} — bölüm 2</Text>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNum}>2</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Personel bazlı özet</Text>
                <Text style={styles.sectionHint}>Atanan personele göre sonuçlanan dosya ve performans.</Text>
              </View>
            </View>
            <View style={styles.tableFrame}>
              <View style={styles.th}>
                <Text style={[styles.thText, { width: "34%" }]}>Personel</Text>
                <Text style={[styles.thText, { width: "11%", textAlign: "right" }]}>Dosya</Text>
                <Text style={[styles.thText, { width: "11%", textAlign: "right" }]}>Onay</Text>
                <Text style={[styles.thText, { width: "11%", textAlign: "right" }]}>Red</Text>
                <Text style={[styles.thText, { width: "15%", textAlign: "right" }]}>Onay oranı</Text>
                <Text style={[styles.thText, { width: "18%", textAlign: "right" }]}>Ort. süre</Text>
              </View>
              {data.byStaff.map((r, i) => (
                <View key={r.staffId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
                  <Text style={[styles.cell, { width: "34%" }]}>{r.staffName}</Text>
                  <Text style={[styles.cellNum, { width: "11%" }]}>{r.total}</Text>
                  <Text style={[styles.cellNum, { width: "11%" }]}>{r.approved}</Text>
                  <Text style={[styles.cellNum, { width: "11%" }]}>{r.rejected}</Text>
                  <Text style={[styles.cellNum, { width: "15%" }]}>{r.total ? `${r.approvalRatePct.toFixed(1)}%` : "—"}</Text>
                  <Text style={[styles.cellNum, { width: "18%" }]}>
                    {r.avgDaysToResult != null ? `${r.avgDaysToResult} gün` : "—"}
                  </Text>
                </View>
              ))}
              {staffTotals && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalCell, { width: "34%" }]}>TOPLAM (tüm personel)</Text>
                  <Text style={[styles.totalCell, { width: "11%", textAlign: "right" }]}>{staffTotals.total}</Text>
                  <Text style={[styles.totalCell, { width: "11%", textAlign: "right" }]}>{staffTotals.approved}</Text>
                  <Text style={[styles.totalCell, { width: "11%", textAlign: "right" }]}>{staffTotals.rejected}</Text>
                  <Text style={[styles.totalCell, { width: "15%", textAlign: "right" }]}>
                    {staffTotals.total ? `${staffTotals.approvalRatePct.toFixed(1)}%` : "—"}
                  </Text>
                  <Text style={[styles.totalCell, { width: "18%", textAlign: "right" }]}>
                    {staffTotals.avgDaysToResult != null ? `${staffTotals.avgDaysToResult} gün` : "—"}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.sectionBlock, { marginTop: 8 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNum}>3</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Ülke bazlı ciro</Text>
                <Text style={styles.sectionHint}>Kayıtlı ücret tutarları; TL / EUR / USD ayrı gösterilir.</Text>
              </View>
            </View>
            <View style={styles.tableFrame}>
              <View style={styles.th}>
                <Text style={[styles.thText, { width: "32%" }]}>Ülke</Text>
                <Text style={[styles.thText, { width: "68%" }]}>Tahsilat özeti</Text>
              </View>
              {data.byCountry.slice(0, 22).map((r, i) => (
                <View key={`rev-${r.key}`} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
                  <Text style={[styles.cell, { width: "32%" }]}>{r.label}</Text>
                  <Text style={[styles.cell, { width: "68%", fontSize: 7 }]}>{fmtMoney(r.revenue)}</Text>
                </View>
              ))}
            </View>
            {data.byCountry.length > 22 && (
              <Text style={styles.truncateNote}>
                Ciro tablosunda ilk 22 ülke listelenir; kalan ülkeler için uygulama ekranına bakın.
              </Text>
            )}
          </View>
        </View>

        <Text
          style={styles.footerFixed}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Fox Turizm · Gizli / iç kullanım · Oluşturulma: ${generated} · Sayfa ${pageNumber} / ${totalPages ?? "—"}`
          }
        />
      </Page>
    </Document>
  );
}
