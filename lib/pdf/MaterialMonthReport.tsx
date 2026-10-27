import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { base, C, Footer, safe } from "./shared";
import type { MonthView } from "@/lib/materials/months";
import { formatPct, formatQty } from "@/lib/materials/format";
import { revLabel, STATUS_LABEL, type Status } from "@/lib/materials/products";

/**
 * A month's material checklist as a PDF (Sprint 3, D22): what the Materials
 * page shows for the month — counts by status, warnings, products reviewed,
 * C/D still open, and the material credit parts at the month's end — for the
 * monthly sustainability report. Landscape, for the wide tables.
 */

const W = 754; // A4 landscape content width

const s = {
  ...base,
  ...StyleSheet.create({
    kicker: { fontSize: 9, textTransform: "uppercase", color: C.brand, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    title: { fontSize: 18, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: C.ink },
    subtitle: { fontSize: 10, color: C.muted, marginTop: 2, marginBottom: 12 },
    tiles: { flexDirection: "row", marginBottom: 12 },
    tile: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 8, marginRight: 8 },
    tileLabel: { fontSize: 7.5, textTransform: "uppercase", color: C.faint, fontFamily: "Helvetica-Bold" },
    tileValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 2 },
    h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 10, marginBottom: 4 },
    table: { borderWidth: 1, borderColor: C.line },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
    th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.ink, padding: 4, backgroundColor: "#e2e8f0" },
    td: { fontSize: 8, color: C.body, padding: 4 },
    flag: { fontSize: 8, padding: 4, borderBottomWidth: 1, borderBottomColor: "#fde68a", backgroundColor: C.amberBg },
    empty: { fontSize: 8.5, color: C.muted, padding: 6, borderWidth: 1, borderColor: C.line },
  }),
};

const status = (st: string | null) => (st ? `${st} - ${STATUS_LABEL[st as Status]}` : "Under review");

function Products({ rows }: { rows: MonthView["reviewed"] }) {
  if (!rows.length) return <Text style={s.empty}>None.</Text>;
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        <Text style={[s.th, { flex: 1 }]}>Product</Text>
        <Text style={[s.th, { width: 190 }]}>Submittal</Text>
        <Text style={[s.th, { width: 50 }]}>Rev</Text>
        <Text style={[s.th, { width: 120 }]}>Manufacturer</Text>
        <Text style={[s.th, { width: 70 }]}>Reviewed</Text>
        <Text style={[s.th, { width: 120 }]}>Status</Text>
      </View>
      {rows.map(({ product: p, submittal: sub }) => (
        <View key={p.id} style={s.tr} wrap={false}>
          <Text style={[s.td, { flex: 1 }]}>{safe(p.name)}</Text>
          <Text style={[s.td, { width: 190 }]}>{safe(sub.ref)}</Text>
          <Text style={[s.td, { width: 50 }]}>{revLabel(p.revision)}</Text>
          <Text style={[s.td, { width: 120 }]}>{safe(p.manufacturer ?? "")}</Text>
          <Text style={[s.td, { width: 70 }]}>{p.reviewedOn ?? ""}</Text>
          <Text style={[s.td, { width: 120 }]}>{status(p.status)}</Text>
        </View>
      ))}
    </View>
  );
}

export function MaterialMonthReport({
  view,
  projectName,
  monthName,
  generatedAt,
}: {
  view: MonthView;
  projectName: string;
  monthName: string;
  generatedAt: string;
}) {
  const before = new Map(view.previous.map((r) => [r.part.key, r]));
  return (
    <Document title={safe(`${projectName} material checklist ${monthName}`)} author="NetZero">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.kicker}>Material Review · SMQ</Text>
        <Text style={s.title}>Material checklist · {monthName}</Text>
        <Text style={s.subtitle}>
          {safe(projectName)} · products reviewed in {monthName} by their review date, and the material credits at the end of the month.
        </Text>

        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Reviewed</Text>
            <Text style={s.tileValue}>{view.reviewed.length}</Text>
          </View>
          {(["A", "B", "C", "D"] as const).map((k) => (
            <View key={k} style={s.tile}>
              <Text style={s.tileLabel}>
                {k} - {STATUS_LABEL[k]}
              </Text>
              <Text style={s.tileValue}>{view.counts[k]}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Material credits at the end of {monthName}</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { flex: 1 }]}>Credit part</Text>
            <Text style={[s.th, { width: 130 }]}>Target</Text>
            <Text style={[s.th, { width: 90, textAlign: "right" }]}>Forecast (BOQ)</Text>
            <Text style={[s.th, { width: 90, textAlign: "right" }]}>Actual (delivered)</Text>
            <Text style={[s.th, { width: 60, textAlign: "right" }]}>Pending</Text>
            <Text style={[s.th, { width: 80, textAlign: "right" }]}>Change</Text>
            <Text style={[s.th, { width: 80 }]}>Products</Text>
          </View>
          {view.parts.map((r) => {
            const b = before.get(r.part.key)?.forecast.pct;
            const d = r.forecast.pct != null && b != null ? r.forecast.pct - b : null;
            return (
              <View key={r.part.key} style={s.tr} wrap={false}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>
                    {r.part.creditCode} {safe(r.part.label)}
                  </Text>
                  {r.coverage ? (
                    <Text style={{ fontSize: 7, color: C.muted }}>
                      {r.coverage.boqTotal
                        ? `Products cover ${formatPct(r.coverage.productsBoqPct)} of the BOQ material cost (${formatQty(r.coverage.boqTotal)} SAR)`
                        : "BOQ material cost not entered: shares are of the products in the app"}
                    </Text>
                  ) : null}
                </View>
                <Text style={[s.td, { width: 130 }]}>{r.part.thresholds.map((t) => `>= ${t}%`).join(" / ")}</Text>
                <Text style={[s.td, { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold", color: r.met.some(Boolean) ? C.green : C.ink }]}>
                  {formatPct(r.forecast.pct)}
                </Text>
                <Text style={[s.td, { width: 90, textAlign: "right" }]}>{r.actual ? formatPct(r.actual.pct) : "-"}</Text>
                <Text style={[s.td, { width: 60, textAlign: "right", color: C.amber }]}>{formatPct(r.pendingPct)}</Text>
                <Text style={[s.td, { width: 80, textAlign: "right" }]}>{d == null ? "-" : Math.abs(d) < 0.05 ? "no change" : `${d > 0 ? "+" : ""}${d.toFixed(1)} pts`}</Text>
                <Text style={[s.td, { width: 80 }]}>
                  {r.products.filter((p) => p.state === "compliant").length} of {r.products.length} count
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={s.h2}>Warnings</Text>
        {view.flags.length ? (
          <View>
            {view.flags.map((f, i) => (
              <Text key={i} style={s.flag} wrap={false}>
                {safe(
                  `${f.kind === "resubmission_overdue" ? "Resubmission overdue" : f.kind === "certificate_expired" ? "Certificate expired" : "Certificate expiring"}: ${f.productName} (${f.submittalRef}) - ${f.detail}`,
                )}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={s.empty}>None.</Text>
        )}

        <Text style={s.h2}>Reviewed in {monthName}</Text>
        <Products rows={view.reviewed} />

        <Text style={s.h2}>Still open from earlier months (C or D, waiting for a resubmission)</Text>
        <Products rows={view.carried} />

        <Footer left={safe(`${projectName} · material checklist ${monthName} · generated ${generatedAt}`)} contentWidth={W} />
      </Page>
    </Document>
  );
}
