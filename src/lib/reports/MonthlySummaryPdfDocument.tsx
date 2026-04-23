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
    paddingBottom: 48,
    paddingHorizontal: 0,
    color: COLORS.navy,
  },
  headerBand: {
    backgroundColor: COLORS.navy,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 20,
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
    marginBottom: 16,
    borderRadius: 2,
  },
  scopeTitle: { fontSize: 8, fontWeight: "bold", color: COLORS.slate, marginBottom: 4 },
  scopeText: { fontSize: 8, color: COLORS.muted, lineHeight: 1.45 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 14 },
  kpiCard: {
    width: "48%",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    padding: 10,
    backgroundColor: COLORS.white,
  },
  kpiLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  kpiValue: { fontSize: 15, fontWeight: "bold", color: COLORS.navy },
  kpiHint: { fontSize: 7, color: COLORS.muted, marginTop: 3 },
  ciroBox: {
    borderWidth: 1,
    borderColor: COLORS.navyMid,
    backgroundColor: "#f0f4f8",
    padding: 12,
    marginBottom: 18,
    borderRadius: 2,
  },
  ciroTitle: { fontSize: 9, fontWeight: "bold", color: COLORS.navyMid, marginBottom: 6 },
  ciroAmount: { fontSize: 11, color: COLORS.navy, lineHeight: 1.5 },
  sectionBlock: { marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyMid,
  },
  sectionNum: {
    width: 22,
    height: 22,
    backgroundColor: COLORS.navyMid,
    borderRadius: 2,
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: COLORS.navy },
  sectionHint: { fontSize: 7, color: COLORS.muted, marginTop: 2 },
  tableFrame: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  th: {
    flexDirection: "row",
    backgroundColor: COLORS.navyMid,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  thText: { fontSize: 7.5, fontWeight: "bold", color: "#e2e8f0" },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  rowAlt: { backgroundColor: COLORS.stripe },
  cell: { fontSize: 8, color: COLORS.navy },
  cellNum: { fontSize: 8, color: COLORS.navy, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: "#e2e8f0",
    borderTopWidth: 1.5,
    borderTopColor: COLORS.navyMid,
  },
  totalCell: { fontSize: 8.5, fontWeight: "bold", color: COLORS.navy },
  legend: {
    marginTop: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
    borderRadius: 2,
  },
  legendTitle: { fontSize: 7.5, fontWeight: "bold", color: COLORS.slate, marginBottom: 4 },
  legendLine: { fontSize: 7, color: COLORS.muted, marginBottom: 2, lineHeight: 1.35 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: COLORS.muted, textAlign: "center" },
  pageNum: { fontSize: 7, color: COLORS.muted, textAlign: "right", marginTop: 4 },
  truncateNote: { fontSize: 7, color: COLORS.muted, marginTop: 6 },
});

function fmtMoney(b: SummaryBucket["revenue"]) {
  const parts: string[] = [];
  if (b.TL) parts.push(`${b.TL.toLocaleString("tr-TR")} TL`);
  if (b.EUR) parts.push(`${b.EUR.toLocaleString("tr-TR")} EUR`);
  if (b.USD) parts.push(`${b.USD.toLocaleString("tr-TR")} USD`);
  return parts.length ? parts.join("  ·  ") : "—";
}

type CountryRow = MonthlySummary["byCountry"][number];

function CountryTableFixed({ rows, startIndex }: { rows: CountryRow[]; startIndex: number }) {
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
          <View key={r.key} style={[styles.row, globalI % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
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

export function MonthlySummaryPdfDocument({ data, showPersonelTotals }: MonthlySummaryPdfDocumentProps) {
  const o = data.overall;
  const avg = o.avgDaysToResult != null ? `${o.avgDaysToResult} gün` : "—";
  const staffTotals = showPersonelTotals ? sumStaffBuckets(data.byStaff) : null;
  const generated = new Date(data.generatedAt).toLocaleString("tr-TR");

  const countriesP1 = data.byCountry.slice(0, 14);
  const countriesP2 = data.byCountry.slice(14, 28);

  return (
    <Document title={`Fox Turizm — Aylık vize özeti ${data.monthLabelTr}`} author="Fox Turizm">
      {/* Sayfa 1 — özet + ülke (üst dilim) */}
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
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
            <CountryTableFixed rows={countriesP1} startIndex={0} />
            {countriesP2.length > 0 && (
              <>
                <View style={{ height: 10 }} />
                <CountryTableFixed rows={countriesP2} startIndex={14} />
              </>
            )}
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
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Fox Turizm · Gizli / iç kullanım · Oluşturulma: {generated}</Text>
          <Text style={styles.pageNum}>Sayfa 1 / 2</Text>
        </View>
      </Page>

      {/* Sayfa 2 — personel + ciro */}
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerBand, { marginBottom: 16 }]}>
          <Text style={styles.headerBrand}>FOX TURİZM · DEVAM</Text>
          <Text style={styles.headerTitle}>{data.monthLabelTr}</Text>
          <Text style={styles.headerSub}>Personel ve ciro detayı</Text>
        </View>

        <View style={styles.body}>
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
                <View key={r.staffId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
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
                <View style={styles.totalRow} wrap={false}>
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

          <View style={[styles.sectionBlock, { marginTop: 6 }]}>
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
                  <Text style={[styles.cell, { width: "68%", fontSize: 7.5 }]}>{fmtMoney(r.revenue)}</Text>
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

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Fox Turizm · Gizli / iç kullanım · Oluşturulma: {generated}</Text>
          <Text style={styles.pageNum}>Sayfa 2 / 2</Text>
        </View>
      </Page>
    </Document>
  );
}
