import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { base, C, Footer, safe } from "./shared";
import type { ImageBytes } from "./ChecklistReport";
import type { SheetModel, SheetSection } from "@/lib/report/inspection-sheet";
import type { ObservationRow } from "@/lib/observations";
// The header and sign-off follow each form's own layout (naColumn, remarks
// label, header fields, signatories): see checklist_template in db/schema.ts.
import { formatUploadedAt } from "@/lib/format";

/**
 * One reviewed inspection, as the site team lays out their form: numbered
 * items under the control-measure headings with the reviewer's answers in the
 * Yes / No / Remarks columns (N/A goes in Remarks, as on their form), the
 * confirmation statement with a reviewed-by line and a blank signature line,
 * and a Description | Photos table. Only saved answers print; which ones the
 * AI suggested is kept in the database, not on the sheet.
 */

const s = {
  ...base,
  ...StyleSheet.create({
    kicker: { fontSize: 9, textTransform: "uppercase", color: C.brand, fontFamily: "Helvetica-Bold", marginBottom: 6 },
    title: { fontSize: 18, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: C.ink },
    subtitle: { fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 10 },
    fillRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginBottom: 6 },
    // flexGrow/Shrink/Basis set one by one: `flex: 0` would zero the basis and ignore the width.
    fillHalf: { flexGrow: 0, flexShrink: 0, flexBasis: "47%", width: "47%", marginBottom: 8 },
    fill: { flex: 1, flexDirection: "row", alignItems: "flex-end", marginRight: 18, marginBottom: 6 },
    fillLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink, marginRight: 6 },
    fillValue: { flex: 1, fontSize: 10, color: C.ink, borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 1, minHeight: 13 },
    // table
    table: { borderWidth: 1, borderColor: C.line },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
    trHead: { backgroundColor: "#cbd5e1" },
    trSection: { backgroundColor: "#e2e8f0" },
    th: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink, padding: 4, textAlign: "center" },
    td: { fontSize: 8.5, color: C.body, padding: 4 },
    tdNo: { width: 30, backgroundColor: "#64748b", color: "#ffffff", fontFamily: "Helvetica-Bold", textAlign: "center" },
    tdDesc: { flex: 1 },
    tdYes: { width: 44, borderLeftWidth: 1, borderLeftColor: C.line, textAlign: "center", fontFamily: "Helvetica-Bold", color: C.ink },
    tdNoCol: { width: 44, borderLeftWidth: 1, borderLeftColor: C.line, textAlign: "center", fontFamily: "Helvetica-Bold", color: C.ink },
    tdRemarks: { width: 150, borderLeftWidth: 1, borderLeftColor: C.line },
    tdRemarksWide: { width: 170 },
    sectionHeading: { fontFamily: "Helvetica-Bold", color: C.ink },
    na: { fontFamily: "Helvetica-Bold", color: C.ink },
    // confirmation
    confirm: { marginTop: 10, padding: 8, backgroundColor: "#64748b", color: "#ffffff", fontSize: 9, lineHeight: 1.35 },
    reviewed: { marginTop: 6, fontSize: 8.5, color: C.muted },
    signRow: { flexDirection: "row", marginTop: 22, alignItems: "flex-end" },
    signLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: C.ink, height: 13 },
    signBlocks: { flexDirection: "row", marginTop: 14, borderWidth: 1, borderColor: C.line, padding: 10 },
    signBlock: { flex: 1, marginRight: 24 },
    // photos
    h2: { fontSize: 12, lineHeight: 1.3, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: C.ink },
    ph: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink, padding: 6, textAlign: "center", textTransform: "uppercase" },
    pDesc: { flex: 1, padding: 6 },
    pPhoto: { width: 230, padding: 6, borderLeftWidth: 1, borderLeftColor: C.line, alignItems: "center" },
    pImg: { width: 218, maxHeight: 170, objectFit: "contain" },
    pName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink },
    pMeta: { fontSize: 8, color: C.muted, marginTop: 3 },
    note: { fontSize: 8, color: C.faint },
    // corrective-action log (landscape), in the client's colours
    oTable: { borderWidth: 1, borderColor: "#1f2a1a" },
    oHead: { backgroundColor: "#3d5229" },
    oTh: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#ffffff", padding: 5, textAlign: "center", borderRightWidth: 1, borderRightColor: "#1f2a1a" },
    oBand: { backgroundColor: "#cfe2bf", justifyContent: "center" },
    oBandText: { flex: 1, fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, textAlign: "center", padding: 6 },
    oTd: { fontSize: 8, color: C.body, padding: 5, borderRightWidth: 1, borderRightColor: C.line },
    oImg: { width: "100%", maxHeight: 80, objectFit: "contain" },
    oOpen: { backgroundColor: "#fde68a", justifyContent: "center" },
    oClosed: { backgroundColor: "#4ade80", justifyContent: "center" },
    oStatusText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.ink, textAlign: "center" },
  }),
};

function SectionRows({ section, naColumn }: { section: SheetSection; naColumn: boolean }) {
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
          <Text style={[s.td, s.tdYes]}>{it.answer === "yes" ? "YES" : ""}</Text>
          <Text style={[s.td, s.tdNoCol]}>{it.answer === "no" ? "NO" : ""}</Text>
          {naColumn ? <Text style={[s.td, s.tdNoCol]}>{it.answer === "na" ? "N/A" : ""}</Text> : null}
          <Text style={naColumn ? [s.td, s.tdRemarks, s.tdRemarksWide] : [s.td, s.tdRemarks]}>
            {!naColumn && it.answer === "na" ? <Text style={s.na}>N/A</Text> : null}
            {!naColumn && it.answer === "na" && it.remark ? " · " : ""}
            {it.remark ? safe(it.remark) : ""}
          </Text>
        </View>
      ))}
    </>
  );
}

/**
 * One filled header field. Three fit on a line (IAQ); with more (ESC: Ref No,
 * date, time, inspector) values would wrap mid-word, so they go two per line.
 */
/** "2026-05-30" → "30 May 2026". */
function d(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m
    ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : iso;
}

/**
 * The corrective-action log on its own landscape page, in the client's
 * columns: Sr#, Observation, Recommendation, Photo, Corrective Action Taken,
 * Photo, Obs. Date / Closing Date, Status. The header row repeats on each page.
 */
function ObservationLogPage({ title, rows, images, footer }: { title: string; rows: ObservationRow[]; images: ImageBytes; footer: string }) {
  const col = { sr: 34, obs: 150, rec: 140, photo: 118, act: 140, date: 72, status: 56 };
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.oTable}>
        <View style={[s.tr, s.oHead]} fixed>
          <Text style={[s.oTh, { width: col.sr }]}>Sr.#</Text>
          <Text style={[s.oTh, { width: col.obs }]}>Observation</Text>
          <Text style={[s.oTh, { width: col.rec }]}>Recommendation</Text>
          <Text style={[s.oTh, { width: col.photo }]}>Photo</Text>
          <Text style={[s.oTh, { width: col.act }]}>Corrective Action Taken</Text>
          <Text style={[s.oTh, { width: col.photo }]}>Photo</Text>
          <Text style={[s.oTh, { width: col.date }]}>Obs. Date / Closing Date</Text>
          <Text style={[s.oTh, { width: col.status }]}>Status</Text>
        </View>
        <View style={[s.tr, s.oBand]}>
          <Text style={s.oBandText}>{safe(title)}</Text>
        </View>
        {rows.length === 0 ? (
          <View style={s.tr}>
            <Text style={[s.td, { flex: 1, color: C.faint }]}>No observations recorded.</Text>
          </View>
        ) : (
          rows.map((o, i) => {
            const before = o.beforePhoto ? images.get(o.beforePhoto.id) : undefined;
            const after = o.afterPhoto ? images.get(o.afterPhoto.id) : undefined;
            return (
              <View key={o.id} style={s.tr} wrap={false}>
                <Text style={[s.oTd, { width: col.sr, textAlign: "center" }]}>{i + 1}</Text>
                <Text style={[s.oTd, { width: col.obs }]}>{safe(o.observation)}</Text>
                <Text style={[s.oTd, { width: col.rec }]}>{safe(o.recommendation ?? "")}</Text>
                <View style={[s.oTd, { width: col.photo }]}>
                  {before ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image style={s.oImg} src={before} />
                  ) : o.beforePhoto ? (
                    <Text style={s.note}>[image could not be read]</Text>
                  ) : null}
                </View>
                <Text style={[s.oTd, { width: col.act }]}>{safe(o.correctiveAction ?? "")}</Text>
                <View style={[s.oTd, { width: col.photo }]}>
                  {after ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image style={s.oImg} src={after} />
                  ) : o.afterPhoto ? (
                    <Text style={s.note}>[image could not be read]</Text>
                  ) : null}
                </View>
                <Text style={[s.oTd, { width: col.date }]}>
                  {d(o.observedOn)}
                  {o.closedOn ? `\n${d(o.closedOn)}` : ""}
                </Text>
                <View style={[s.oTd, { width: col.status }, o.status === "closed" ? s.oClosed : s.oOpen]}>
                  <Text style={s.oStatusText}>{o.status === "closed" ? "Closed" : "Open"}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
      {/* A4 landscape: 841.89 − 2×44 ≈ 754 of content width. */}
      <Footer left={footer} contentWidth={754} />
    </Page>
  );
}

function Fill({ label, value, last, half }: { label: string; value: string | null; last?: boolean; half?: boolean }) {
  const style = half ? [s.fill, s.fillHalf, last ? { marginRight: 0 } : {}] : last ? [s.fill, { marginRight: 0 }] : s.fill;
  return (
    <View style={style}>
      <Text style={s.fillLabel}>{label}</Text>
      <Text style={s.fillValue}>{value ? safe(value) : " "}</Text>
    </View>
  );
}

export interface InspectionSheetProps {
  model: SheetModel;
  images: ImageBytes;
}

export function InspectionSheet({ model, images }: InspectionSheetProps) {
  const { project, credit, inspection, reviewed } = model;
  const footer = safe(`${project.name} · ${credit.code} ${model.title} · ${inspection.date ?? "undated"}`);

  return (
    <Document title={`${credit.code} — ${model.title} — ${project.name} — ${inspection.date ?? ""}`} author="NetZero">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>Inspection sheet · {safe(credit.code)} {safe(credit.title)}</Text>
        <Text style={s.title}>{safe(model.title)}</Text>
        <Text style={s.subtitle}>
          {safe(project.name)} · {safe(project.ratingSystem)} · {project.stageLabel} stage
          {credit.pageSpan ? ` · manual ${credit.pageSpan}` : ""}
        </Text>

        <View style={s.fillRow}>
          {model.layout.header.map((h, i) => (
            <Fill
              key={h.label}
              label={h.label}
              value={h.value}
              half={model.layout.header.length > 3}
              last={model.layout.header.length > 3 ? i % 2 === 1 : i === model.layout.header.length - 1}
            />
          ))}
        </View>

        <View style={s.table}>
          <View style={[s.tr, s.trHead]} fixed>
            <Text style={[s.th, { width: 30 }]}>No</Text>
            <Text style={[s.th, s.tdDesc, { textAlign: "left" }]}>Description</Text>
            <Text style={[s.th, s.tdYes]}>Yes</Text>
            <Text style={[s.th, s.tdNoCol]}>No</Text>
            {model.layout.naColumn ? <Text style={[s.th, s.tdNoCol]}>NA</Text> : null}
            <Text style={model.layout.naColumn ? [s.th, s.tdRemarks, s.tdRemarksWide] : [s.th, s.tdRemarks]}>
              {safe(model.layout.remarksLabel)}
            </Text>
          </View>
          {model.sections.map((sec) => (
            <SectionRows key={sec.no} section={sec} naColumn={model.layout.naColumn} />
          ))}
        </View>

        <View wrap={false}>
          {model.confirmation ? <Text style={s.confirm}>{safe(model.confirmation)}</Text> : null}
          <Text style={s.reviewed}>
            {reviewed.by ? `Responses reviewed by ${safe(reviewed.by)}${reviewed.on ? ` on ${reviewed.on}` : ""}.` : "Not reviewed."}
          </Text>
          {model.layout.signatories.length ? (
            // One "Checked & verified by" block per position, as the team's form has.
            <View style={s.signBlocks}>
              {model.layout.signatories.map((pos, i) => (
                <View key={pos} style={i === model.layout.signatories.length - 1 ? [s.signBlock, { marginRight: 0 }] : s.signBlock}>
                  <View style={s.fill}>
                    <Text style={s.fillLabel}>Checked &amp; verified by</Text>
                    <View style={s.signLine} />
                  </View>
                  <Text style={[s.fillLabel, { marginTop: 6 }]}>Position: {safe(pos)}</Text>
                  <View style={[s.fill, { marginTop: 16 }]}>
                    <Text style={s.fillLabel}>Signature</Text>
                    <View style={s.signLine} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.signRow}>
              <View style={[s.fill, { flex: 3 }]}>
                <Text style={s.fillLabel}>Signature</Text>
                <View style={s.signLine} />
              </View>
              <View style={[s.fill, { flex: 2, marginRight: 0 }]}>
                <Text style={s.fillLabel}>Date</Text>
                <View style={s.signLine} />
              </View>
            </View>
          )}
        </View>

        {model.observations ? null : (
        <View break={model.photos.length > 0} style={model.photos.length ? {} : { marginTop: 24 }}>
          <Text style={s.h2}>Photographs</Text>
          {model.photos.length === 0 ? (
            <Text style={s.note}>
              No PNG or JPEG files are attached to this credit yet. Photographs uploaded against its
              required documents will appear here, with their upload date.
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
                        <Text style={[s.pMeta, s.note]}>[image could not be read]</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        )}

        <Footer left={footer} />
      </Page>
      {model.observations ? (
        <ObservationLogPage title={model.observations.title} rows={model.observations.rows} images={images} footer={footer} />
      ) : null}
    </Document>
  );
}
