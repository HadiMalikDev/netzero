import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { base, C, Footer, safe } from "./shared";
import type { SmqSheetModel, SmqSheetRow } from "@/lib/report/smq-sheet";

/**
 * A product's filled Sustainability Material Questionnaire, laid out as the
 * client's SMQ Rev03: the product information block, "For All Materials",
 * the Material Requirements of the product's types (Material Type | Credit
 * Reference | Required Documents / Parameters | Yes/No/NA/Value), the
 * manufacturer and contractor statements, and the consultant's remarks.
 */

const s = {
  ...base,
  ...StyleSheet.create({
    title: { fontSize: 14, lineHeight: 1.25, fontFamily: "Helvetica-Bold", color: C.ink, textAlign: "center" },
    project: { fontSize: 9, color: C.muted, textAlign: "center", marginTop: 2, marginBottom: 10 },
    band: { backgroundColor: "#cbd5e1", padding: 4, fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink, textAlign: "center", marginTop: 8 },
    table: { borderWidth: 1, borderColor: C.line },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
    th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink, padding: 4, backgroundColor: "#e2e8f0" },
    td: { fontSize: 8, color: C.body, padding: 4 },
    infoLabel: { width: 130, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink, padding: 4, backgroundColor: C.panel },
    infoValue: { flex: 1, fontSize: 8.5, color: C.ink, padding: 4 },
    cType: { width: 82 },
    cRef: { width: 96, borderLeftWidth: 1, borderLeftColor: C.line },
    cText: { flex: 1, borderLeftWidth: 1, borderLeftColor: C.line },
    cAns: { width: 92, borderLeftWidth: 1, borderLeftColor: C.line },
    ans: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink },
    small: { fontSize: 7, color: C.muted, marginTop: 2 },
    statements: { flexDirection: "row", marginTop: 10, borderWidth: 1, borderColor: C.line },
    statement: { flex: 1, padding: 8 },
    statementTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 4 },
    remarks: { marginTop: 10, borderWidth: 1, borderColor: C.line, padding: 8 },
  }),
};

function Rows({ rows, withType }: { rows: SmqSheetRow[]; withType: boolean }) {
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        {withType ? <Text style={[s.th, s.cType]}>Material Type</Text> : null}
        <Text style={[s.th, s.cRef]}>Credit Reference</Text>
        <Text style={[s.th, s.cText]}>Required Documents / Parameters</Text>
        <Text style={[s.th, s.cAns]}>Select Yes/No/NA/Value</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {withType ? <Text style={[s.td, s.cType]}>{safe(r.materialType)}</Text> : null}
          <Text style={[s.td, s.cRef]}>{safe(r.creditRef)}</Text>
          <View style={[s.td, s.cText]}>
            <Text>{safe(r.text)}</Text>
            {r.target ? <Text style={s.small}>Project target: {safe(r.target)}</Text> : null}
          </View>
          <View style={[s.td, s.cAns]}>
            <Text style={s.ans}>{safe(r.answer)}</Text>
            {r.remark ? <Text style={s.small}>{safe(r.remark)}</Text> : null}
            {r.documents.map((d, j) => (
              <Text key={j} style={s.small}>
                {safe(d)}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function SmqSheet({ model: m }: { model: SmqSheetModel }) {
  return (
    <Document title={safe(`${m.info[2][1]} SMQ`)} author="NetZero">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{safe(m.title)}</Text>
        <Text style={s.project}>{safe(m.projectName)}</Text>

        <Text style={s.band}>Manufacture And Product Information</Text>
        <View style={s.table}>
          {m.info.map(([label, value]) => (
            <View key={label} style={s.tr}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue}>{safe(value)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.band}>For All Materials</Text>
        <Rows rows={m.allMaterials} withType={false} />

        <Text style={s.band}>Material Requirements</Text>
        {m.requirements.length ? (
          <Rows rows={m.requirements} withType />
        ) : (
          <Text style={[s.td, { borderWidth: 1, borderColor: C.line }]}>No material type picked for this product.</Text>
        )}

        <View style={s.statements} wrap={false}>
          <View style={s.statement}>
            <Text style={s.statementTitle}>Manufacturer/Supplier Statement</Text>
            <Text>We hereby confirm that all listed documents are provided and in compliance with the project sustainability requirements.</Text>
            <Text style={{ marginTop: 6 }}>Name: {safe(m.manufacturer.name)}</Text>
            <Text>Signature:</Text>
            <Text>Date: {safe(m.manufacturer.date)}</Text>
          </View>
          <View style={[s.statement, { borderLeftWidth: 1, borderLeftColor: C.line }]}>
            <Text style={s.statementTitle}>Contractor&apos;s Sustainability Manager</Text>
            <Text>We hereby confirm that all listed documents are provided and in compliance with the project sustainability requirements.</Text>
            <Text style={{ marginTop: 6 }}>Name: {safe(m.contractor.name)}</Text>
            <Text>Signature:</Text>
            <Text>Date: {safe(m.contractor.date)}</Text>
          </View>
        </View>

        <View style={s.remarks} wrap={false}>
          <Text style={s.statementTitle}>Contractor Sustainability Consultant Remarks</Text>
          <Text>The proposed material is {safe(m.applicable)} to the project sustainability requirements.</Text>
          <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>Provided Documents:</Text>
          {m.providedDocuments.length ? (
            m.providedDocuments.map((d, i) => <Text key={i}>{`${i + 1}. ${safe(d)}`}</Text>)
          ) : (
            <Text>None</Text>
          )}
          <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>Comments (if any):</Text>
          <Text>{safe(m.remarks) || "-"}</Text>
          <Text style={{ marginTop: 6 }}>Status: {safe(m.status)}</Text>
          <Text>Reviewed by: {safe(m.reviewedBy)}</Text>
          <Text>Date: {safe(m.reviewedOn)}</Text>
          <Text>Signature:</Text>
        </View>
        <Footer left={safe(`${m.footer} · generated ${m.generatedAt}`)} />
      </Page>
    </Document>
  );
}
