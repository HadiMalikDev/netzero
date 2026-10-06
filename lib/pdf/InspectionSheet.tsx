import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { base, C, Footer, safe } from "./shared";
import type { ImageBytes } from "./ChecklistReport";
import type { SheetModel, SheetSection } from "@/lib/report/inspection-sheet";
import { formatUploadedAt } from "@/lib/format";

/**
 * The site team's inspection sheet, as they already lay it out: numbered
 * items under the control-measure headings with Yes / No / Remarks to fill
 * by hand, a confirmation and signature block, and a Description | Photos
 * table. The app adds the header, the photographs already uploaded, and one
 * advisory column saying whether the uploaded plan addresses each item.
 * Nothing in the Yes / No / Remarks cells is ever printed by the app.
 */

const s = {
  ...base,
  ...StyleSheet.create({
    kicker: { fontSize: 9, textTransform: "uppercase", color: C.brand, fontFamily: "Helvetica-Bold", marginBottom: 6 },
    title: { fontSize: 18, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: C.ink },
    subtitle: { fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 10 },
    fillRow: { flexDirection: "row", marginTop: 10, marginBottom: 12 },
    fill: { flex: 1, flexDirection: "row", alignItems: "flex-end", marginRight: 18 },
    fillLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink, marginRight: 6 },
    fillLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: C.ink, height: 12 },
    note: { fontSize: 8, color: C.muted, marginBottom: 6 },
    // table
    table: { borderWidth: 1, borderColor: C.line },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
    trHead: { backgroundColor: "#cbd5e1" },
    trSection: { backgroundColor: "#e2e8f0" },
    th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink, padding: 4, textAlign: "center" },
    td: { fontSize: 8.5, color: C.body, padding: 4 },
    tdNo: { width: 30, backgroundColor: "#64748b", color: "#ffffff", fontFamily: "Helvetica-Bold", textAlign: "center" },
    tdDesc: { flex: 1 },
    tdYes: { width: 34, borderLeftWidth: 1, borderLeftColor: C.line },
    tdNoCol: { width: 34, borderLeftWidth: 1, borderLeftColor: C.line },
    tdRemarks: { width: 84, borderLeftWidth: 1, borderLeftColor: C.line },
    tdPlan: { width: 132, borderLeftWidth: 1, borderLeftColor: C.line, backgroundColor: C.brandBg },
    sectionHeading: { fontFamily: "Helvetica-Bold", color: C.ink },
    planTick: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.green },
    planMiss: { fontSize: 8, color: C.faint },
    planQuote: { fontSize: 7, color: C.body, marginTop: 1 },
    // confirmation
    confirm: { marginTop: 10, padding: 8, backgroundColor: "#64748b", color: "#ffffff", fontSize: 9, lineHeight: 1.35 },
    signRow: { flexDirection: "row", marginTop: 26, alignItems: "flex-end" },
    // photos
    h2: { fontSize: 12, lineHeight: 1.3, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: C.ink },
    ph: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink, padding: 6, textAlign: "center", textTransform: "uppercase" },
    pDesc: { flex: 1, padding: 6 },
    pPhoto: { width: 230, padding: 6, borderLeftWidth: 1, borderLeftColor: C.line, alignItems: "center" },
    pImg: { width: 218, maxHeight: 170, objectFit: "contain" },
    pName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink },
    pMeta: { fontSize: 8, color: C.muted, marginTop: 3 },
    dim: { color: C.faint },
  }),
};

function Cell({ style, children }: { style: object | object[]; children?: React.ReactNode }) {
  return <View style={Array.isArray(style) ? [s.td, ...style] : [s.td, style]}>{children}</View>;
}

function SectionRows({ section }: { section: SheetSection }) {
  return (
    <>
      <View style={[s.tr, s.trSection]} wrap={false} minPresenceAhead={40}>
        <Text style={[s.td, s.tdNo]}>{section.no}</Text>
        <Text style={[s.td, s.tdDesc, s.sectionHeading]}>{safe(section.heading)}</Text>
      </View>
      {section.items.map((it) => (
        <View key={it.no} style={s.tr} wrap={false}>
          <Text style={[s.td, s.tdNo]}>{it.no}</Text>
          <Text style={[s.td, s.tdDesc]}>{safe(it.text)}</Text>
          <Cell style={s.tdYes} />
          <Cell style={s.tdNoCol} />
          <Cell style={s.tdRemarks} />
          <Cell style={s.tdPlan}>
            {it.coverage ? (
              it.coverage.status === "covered" ? (
                <>
                  <Text style={s.planTick}>x  in plan</Text>
                  {it.coverage.quote ? <Text style={s.planQuote}>“{safe(it.coverage.quote)}”</Text> : null}
                </>
              ) : (
                <Text style={s.planMiss}>not found</Text>
              )
            ) : (
              <Text style={s.planMiss}>—</Text>
            )}
          </Cell>
        </View>
      ))}
    </>
  );
}

export interface InspectionSheetProps {
  model: SheetModel;
  images: ImageBytes;
}

export function InspectionSheet({ model, images }: InspectionSheetProps) {
  const { project, credit, coverage } = model;
  const footer = safe(`${project.name} · ${credit.code} ${model.template.title} · ${model.generatedAt}`);
  const planHeader = coverage.ran
    ? `In uploaded plan (AI) · ${coverage.covered}/${coverage.total}`
    : "In uploaded plan (AI) · not run";

  return (
    <Document title={`${credit.code} — ${model.template.title} — ${project.name}`} author="NetZero">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>Inspection sheet · {safe(credit.code)} {safe(credit.title)}</Text>
        <Text style={s.title}>{safe(model.template.title)}</Text>
        <Text style={s.subtitle}>
          {safe(project.name)} · {safe(project.ratingSystem)} · {project.stageLabel} stage
          {credit.pageSpan ? ` · manual ${credit.pageSpan}` : ""}
        </Text>

        <View style={s.fillRow}>
          <View style={s.fill}>
            <Text style={s.fillLabel}>Inspection date</Text>
            <View style={s.fillLine} />
          </View>
          <View style={s.fill}>
            <Text style={s.fillLabel}>Inspector</Text>
            <View style={s.fillLine} />
          </View>
          <View style={[s.fill, { marginRight: 0 }]}>
            <Text style={s.fillLabel}>Area / level</Text>
            <View style={s.fillLine} />
          </View>
        </View>

        <Text style={s.note}>
          Yes / No / Remarks are for the inspector to complete on site. The last column is the
          app&apos;s advisory read of the uploaded plan
          {coverage.ran
            ? ` (${safe(coverage.sources.join(", "))}): a tick means the plan states the measure, with the sentence that shows it; “not found” means it does not.`
            : `: not run — ${safe(coverage.reason)}.`}{" "}
          It says nothing about the site. Generated {model.generatedAt}.
        </Text>

        <View style={s.table}>
          <View style={[s.tr, s.trHead]} fixed>
            <Text style={[s.th, { width: 30 }]}>No</Text>
            <Text style={[s.th, s.tdDesc, { textAlign: "left" }]}>Description</Text>
            <Text style={[s.th, s.tdYes]}>Yes</Text>
            <Text style={[s.th, s.tdNoCol]}>No</Text>
            <Text style={[s.th, s.tdRemarks]}>Remarks</Text>
            <Text style={[s.th, s.tdPlan, { backgroundColor: "#cbd5e1" }]}>{planHeader}</Text>
          </View>
          {model.sections.map((sec) => (
            <SectionRows key={sec.no} section={sec} />
          ))}
        </View>

        <View wrap={false}>
          <Text style={s.confirm}>{safe(model.template.confirmation)}</Text>
          <View style={s.signRow}>
            <View style={[s.fill, { flex: 3 }]}>
              <Text style={s.fillLabel}>Signature</Text>
              <View style={s.fillLine} />
            </View>
            <View style={[s.fill, { flex: 2, marginRight: 0 }]}>
              <Text style={s.fillLabel}>Date</Text>
              <View style={s.fillLine} />
            </View>
          </View>
        </View>

        {/* The photo table gets its own page; an empty note does not. */}
        <View break={model.photos.length > 0} style={model.photos.length ? {} : { marginTop: 24 }}>
          <Text style={s.h2}>Photographs</Text>
          {model.photos.length === 0 ? (
            <Text style={[s.note, s.dim]}>
              No PNG or JPEG files are attached to this credit yet. Photographs uploaded against
              its required documents will appear here, with their upload date.
            </Text>
          ) : (
            <View style={s.table}>
              <View style={[s.tr, s.trHead]} fixed>
                <Text style={[s.ph, { flex: 1 }]}>Description</Text>
                <Text style={[s.ph, { width: 230, borderLeftWidth: 1, borderLeftColor: C.line }]}>Photos</Text>
              </View>
              {model.photos.map((p) => {
                const img = images.get(p.fileId);
                return (
                  <View key={p.fileId} style={s.tr} wrap={false}>
                    <View style={s.pDesc}>
                      <Text style={s.pName}>{safe(p.fileName)}</Text>
                      <Text style={s.pMeta}>{safe(p.attachedTo)}</Text>
                      <Text style={s.pMeta}>Uploaded {formatUploadedAt(p.createdAt)}</Text>
                    </View>
                    <View style={s.pPhoto}>
                      {img ? (
                        // @react-pdf's Image has no alt prop; the description cell is the text.
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image style={s.pImg} src={img} />
                      ) : (
                        <Text style={[s.pMeta, s.dim]}>[image could not be read]</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Footer left={footer} />
      </Page>
    </Document>
  );
}
