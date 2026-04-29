import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import React from "react";

/**
 * Aylik Rapor PDF
 *
 * Visora kurumsal tasarim — ust kismi gradient (mavi/mor) banner
 * (gradient'i Image ile ekliyoruz cunku react-pdf gradient destegi sinirli).
 *
 * Kullanim:
 *   import { renderToBuffer } from "@react-pdf/renderer";
 *   const buf = await renderToBuffer(<AylikRaporPdf data={...} />);
 */

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 0,
    color: "#0f172a",
  },
  banner: {
    width: "100%",
    height: 110,
    objectFit: "cover",
  },
  body: {
    paddingHorizontal: 36,
    paddingTop: 20,
  },
  titleBlock: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  badge: {
    backgroundColor: "#eef2ff",
    color: "#4338ca",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    alignSelf: "flex-start",
    marginBottom: 8,
    letterSpacing: 1,
  },
  // Stats grid
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4f46e5",
  },
  statLabel: {
    fontSize: 8,
    color: "#64748b",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  // Section
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  th: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  td: {
    fontSize: 9.5,
    color: "#0f172a",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 8.5,
    color: "#94a3b8",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});

export interface AylikRaporRow {
  personelAd: string;
  dosyaSayisi: number;
  tlGelir: number;
  eurGelir: number;
  usdGelir: number;
}

export interface AylikRaporUlke {
  ulke: string;
  dosyaSayisi: number;
}

export interface AylikRaporPdfData {
  organizationName: string;
  ay: string; // "Nisan 2026"
  generatedAt: string;
  ozet: {
    dosyaSayisi: number;
    tlGelir: number;
    eurGelir: number;
    usdGelir: number;
    aktivePersonel: number;
  };
  personeller: AylikRaporRow[];
  ulkeler?: AylikRaporUlke[];
  bannerUrl?: string;
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR");

export function AylikRaporPdf({ data }: { data: AylikRaporPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.bannerUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={data.bannerUrl} style={styles.banner} />
        ) : (
          <View
            style={{
              height: 16,
              backgroundColor: "#4f46e5",
              width: "100%",
            }}
          />
        )}

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <Text style={styles.badge}>AYLIK RAPOR</Text>
            <Text style={styles.title}>
              {data.organizationName} — {data.ay}
            </Text>
            <Text style={styles.subtitle}>
              Hazırlanma: {data.generatedAt}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TOPLAM DOSYA</Text>
              <Text style={styles.statValue}>
                {data.ozet.dosyaSayisi.toLocaleString("tr-TR")}
              </Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#10b981" }]}>
              <Text style={styles.statLabel}>TL CIRO</Text>
              <Text style={styles.statValue}>{fmt(data.ozet.tlGelir)} TL</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#0ea5e9" }]}>
              <Text style={styles.statLabel}>EUR CIRO</Text>
              <Text style={styles.statValue}>{fmt(data.ozet.eurGelir)} EUR</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Text style={styles.statLabel}>USD CIRO</Text>
              <Text style={styles.statValue}>{fmt(data.ozet.usdGelir)} USD</Text>
            </View>
          </View>

          {/* Personnel breakdown */}
          <Text style={styles.sectionTitle}>Personel Performansı</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2.5 }]}>Personel</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                Dosya
              </Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: "right" }]}>
                TL
              </Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: "right" }]}>
                EUR
              </Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: "right" }]}>
                USD
              </Text>
            </View>
            {data.personeller.length === 0 ? (
              <View style={styles.tableRow}>
                <Text
                  style={[
                    styles.td,
                    { flex: 1, textAlign: "center", color: "#94a3b8" },
                  ]}
                >
                  Bu ay personel hareketi yok
                </Text>
              </View>
            ) : (
              data.personeller.map((p, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 2.5 }]}>{p.personelAd}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>
                    {p.dosyaSayisi.toLocaleString("tr-TR")}
                  </Text>
                  <Text
                    style={[styles.td, { flex: 1.4, textAlign: "right" }]}
                  >
                    {fmt(p.tlGelir)}
                  </Text>
                  <Text
                    style={[styles.td, { flex: 1.4, textAlign: "right" }]}
                  >
                    {fmt(p.eurGelir)}
                  </Text>
                  <Text
                    style={[styles.td, { flex: 1.4, textAlign: "right" }]}
                  >
                    {fmt(p.usdGelir)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Country breakdown (optional) */}
          {data.ulkeler && data.ulkeler.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Ülke Dağılımı</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 3 }]}>Ülke</Text>
                  <Text
                    style={[styles.th, { flex: 1, textAlign: "right" }]}
                  >
                    Dosya
                  </Text>
                </View>
                {data.ulkeler.slice(0, 12).map((u, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.td, { flex: 3 }]}>{u.ulke}</Text>
                    <Text
                      style={[styles.td, { flex: 1, textAlign: "right" }]}
                    >
                      {u.dosyaSayisi.toLocaleString("tr-TR")}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>Visora · {data.organizationName}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
