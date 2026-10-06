import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { base, C, Footer, Pill, safe } from "./shared";
import {
  DOC_STATE_LABEL,
  type ChecklistFile,
  type ChecklistModel,
  type DocRow,
  type DocState,
  type RequirementBlock,
} from "@/lib/report/checklist";
import type { GuidanceItem, GuidanceList } from "@/lib/report/guidance-items";
import { formatFileSize, formatUploadedAt } from "@/lib/format";

/**
 * The compliance checklist of one credit, as a PDF. Everything on it comes
 * from the ChecklistModel (lib/report/checklist.ts): nothing is typed in, and
 * the header says so. Image files are passed in as decoded buffers by the
 * route, so this component stays pure and renderable in a test.
 *
 * Wording rules carried from the model: a document is Provided only when a
 * file is attached against it; the AI read is printed as advisory, next to the
 * state, never as the state.
 */

/** The decoded bytes of each photograph, by file id. Missing → listed, not shown. */
export type ImageBytes = Map<string, { data: Buffer; format: "png" | "jpg" }>;

const s = {
  ...base,
  ...StyleSheet.create({
    kicker: {
      fontSize: 9,
      textTransform: "uppercase",
      color: C.brand,
      fontFamily: "Helvetica-Bold",
      marginBottom: 6,
    },
    title: { fontSize: 20, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: C.ink },
    subtitle: { fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 14 },
    titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 4 },
    origin: {
      marginTop: 10,
      marginBottom: 14,
      padding: 8,
      backgroundColor: C.panel,
      borderLeftWidth: 3,
      borderLeftColor: C.brand,
      fontSize: 8.5,
      color: C.body,
    },
    h2: {
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      color: C.ink,
      marginTop: 14,
      marginBottom: 6,
      paddingBottom: 3,
      borderBottomWidth: 1.5,
      borderBottomColor: C.ink,
    },
    h2Meta: { fontSize: 8.5, color: C.muted, fontFamily: "Helvetica", marginLeft: 6 },
    aim: { fontSize: 9, color: C.body },
    // summary tiles
    tiles: { flexDirection: "row", marginTop: 4 },
    tile: {
      flex: 1,
      padding: 7,
      marginRight: 6,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 4,
    },
    tileLast: { marginRight: 0 },
    tileValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.ink },
    tileLabel: { fontSize: 7.5, textTransform: "uppercase", color: C.faint, fontFamily: "Helvetica-Bold" },
    // requirement
    req: {
      marginBottom: 10,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 4,
      padding: 9,
    },
    reqTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    reqTitleWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", flexShrink: 1, paddingRight: 8 },
    seq: {
      fontSize: 7.5,
      fontFamily: "Helvetica-Bold",
      color: C.muted,
      backgroundColor: C.panel,
      borderRadius: 3,
      paddingHorizontal: 4,
      paddingVertical: 1.5,
      marginRight: 4,
    },
    reqTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink },
    reqText: { fontSize: 8.5, color: C.body, marginTop: 3 },
    kv: { flexDirection: "row", marginTop: 3 },
    k: { fontSize: 8, color: C.muted, width: 78, fontFamily: "Helvetica-Bold" },
    v: { fontSize: 8.5, color: C.ink, flex: 1 },
    // status chip
    chip: {
      fontSize: 7.5,
      fontFamily: "Helvetica-Bold",
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderWidth: 1,
    },
    // document rows
    docTable: { marginTop: 6, borderWidth: 1, borderColor: C.line, borderRadius: 3 },
    docHead: { flexDirection: "row", backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.line },
    docRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
    docRowLast: { borderBottomWidth: 0 },
    th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.muted, padding: 4 },
    td: { fontSize: 8.5, color: C.body, padding: 4 },
    colBox: { width: 16 },
    colDoc: { flex: 1 },
    colStage: { width: 68 },
    colState: { width: 118 },
    box: {
      width: 9,
      height: 9,
      borderWidth: 1,
      borderColor: C.muted,
      borderRadius: 1.5,
      marginTop: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    boxTick: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.green, lineHeight: 1 },
    stage: { fontSize: 7, textTransform: "uppercase", color: C.muted, fontFamily: "Helvetica-Bold" },
    dim: { color: C.faint },
    // files under a document row
    files: { paddingLeft: 24, paddingRight: 4, paddingBottom: 4 },
    file: { fontSize: 8, color: C.body },
    fileMeta: { color: C.faint },
    review: {
      marginTop: 2,
      marginBottom: 3,
      padding: 5,
      backgroundColor: C.panel,
      borderRadius: 3,
    },
    reviewLabel: { fontSize: 7, textTransform: "uppercase", color: C.muted, fontFamily: "Helvetica-Bold" },
    reviewText: { fontSize: 8, color: C.body, marginTop: 1 },
    gap: { fontSize: 8, color: C.amber, marginLeft: 6 },
    // choose / set aside
    choose: {
      marginBottom: 10,
      padding: 9,
      borderWidth: 1,
      borderColor: "#c4b5fd",
      backgroundColor: "#f5f3ff",
      borderRadius: 4,
    },
    chooseTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#5b21b6" },
    // photos
    photoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
    photo: { width: "50%", paddingRight: 8, marginBottom: 10 },
    photoImg: { width: "100%", maxHeight: 220, objectFit: "contain", borderWidth: 1, borderColor: C.line },
    photoCap: { fontSize: 8, color: C.body, marginTop: 3 },
    photoMeta: { fontSize: 7.5, color: C.faint },
    // guidance
    gList: { marginBottom: 8 },
    gHeading: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 2 },
    gIntro: { fontSize: 8.5, color: C.muted, marginBottom: 3 },
    gRow: { flexDirection: "row", marginBottom: 2 },
    gText: { fontSize: 8.5, color: C.body, flex: 1 },
    gNote: { fontSize: 8, color: C.muted, marginTop: 4 },
  }),
};

const STATE_STYLE: Record<DocState, { color: string; bg: string; border: string }> = {
  provided: { color: C.green, bg: C.greenBg, border: "#86efac" },
  provided_with_gaps: { color: C.amber, bg: C.amberBg, border: "#fcd34d" },
  missing: { color: C.red, bg: C.redBg, border: "#fca5a5" },
  not_due: { color: C.muted, bg: C.panel, border: C.line },
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  completed: STATE_STYLE.provided,
  in_progress: { color: C.brand, bg: C.brandBg, border: "#99f6e4" },
  not_started: STATE_STYLE.not_due,
};

function Chip({ label, tone }: { label: string; tone: { color: string; bg: string; border: string } }) {
  return (
    <Text style={[s.chip, { color: tone.color, backgroundColor: tone.bg, borderColor: tone.border }]}>
      {label}
    </Text>
  );
}

function StateBox({ state }: { state: DocState }) {
  const ticked = state === "provided" || state === "provided_with_gaps";
  return (
    <View style={s.box}>
      {ticked ? <Text style={s.boxTick}>x</Text> : null}
    </View>
  );
}

function FileLine({ file }: { file: ChecklistFile }) {
  const meta = [formatFileSize(file.fileSize), formatUploadedAt(file.createdAt)].filter(Boolean).join(" · ");
  return (
    <View>
      <Text style={s.file}>
        {safe(file.fileName)}
        {meta ? <Text style={s.fileMeta}>{`   ${meta}`}</Text> : null}
        {file.isImage ? <Text style={s.fileMeta}>   (photograph, see below)</Text> : null}
      </Text>
      {file.review ? (
        <View style={s.review}>
          <Text style={s.reviewLabel}>AI read · advisory only · {safe(file.review.verdictLabel)}</Text>
          {file.review.summary ? <Text style={s.reviewText}>{safe(file.review.summary)}</Text> : null}
          {file.review.gaps.map((g, i) => (
            <Text key={i} style={s.gap}>
              – {safe(g)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DocRows({ docs }: { docs: DocRow[] }) {
  return (
    <View style={s.docTable}>
      <View style={s.docHead}>
        <Text style={[s.th, s.colBox]}> </Text>
        <Text style={[s.th, s.colDoc]}>Required document</Text>
        <Text style={[s.th, s.colStage]}>Stage</Text>
        <Text style={[s.th, s.colState]}>State</Text>
      </View>
      {docs.map((d, i) => {
        const tone = STATE_STYLE[d.state];
        const last = i === docs.length - 1;
        return (
          <View key={d.index} style={last ? [s.docRow, s.docRowLast] : s.docRow} wrap={false}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row" }}>
                <View style={[s.td, s.colBox]}>
                  <StateBox state={d.state} />
                </View>
                <Text style={[s.td, s.colDoc, d.state === "not_due" ? s.dim : {}]}>{safe(d.text)}</Text>
                <View style={[s.td, s.colStage]}>
                  <Text style={s.stage}>{d.stage ? safe(d.stage) : "any"}</Text>
                  {!d.due ? <Text style={[s.stage, s.dim]}>not due yet</Text> : null}
                </View>
                <View style={[s.td, s.colState]}>
                  <Chip label={DOC_STATE_LABEL[d.state]} tone={tone} />
                </View>
              </View>
              {d.files.length ? (
                <View style={s.files}>
                  {d.files.map((f) => (
                    <FileLine key={f.id} file={f} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Requirement({ block }: { block: RequirementBlock }) {
  return (
    <View style={s.req} wrap>
      <View style={s.reqTop}>
        <View style={s.reqTitleWrap}>
          <Text style={s.seq}>#{block.seq}</Text>
          {block.title ? <Text style={s.reqTitle}>{safe(block.title)}</Text> : null}
          {block.tag === "pursuing" ? <Pill variant="points">Pursuing this path</Pill> : null}
          {block.tag === "optional" ? (
            <Pill>{block.counted ? "Optional · pursuing" : "Optional · only if pursued"}</Pill>
          ) : null}
        </View>
        <Chip label={block.statusLabel} tone={STATUS_STYLE[block.status] ?? STATE_STYLE.not_due} />
      </View>
      <Text style={s.reqText}>{safe(block.text)}</Text>
      <View style={s.kv}>
        <Text style={s.k}>Recorded value</Text>
        <Text style={s.v}>{block.value ? safe(block.value) : "—"}</Text>
      </View>
      {block.note ? (
        <View style={s.kv}>
          <Text style={s.k}>Note</Text>
          <Text style={s.v}>{safe(block.note)}</Text>
        </View>
      ) : null}
      {block.docs.length ? (
        <DocRows docs={block.docs} />
      ) : (
        <Text style={[s.reqText, s.dim]}>
          The manual lists no specific documents for this requirement; at least one file is required.
        </Text>
      )}
      {block.otherFiles.length ? (
        <View style={{ marginTop: 5 }}>
          <Text style={s.panelLabel}>Other files on this requirement (not claiming a listed document)</Text>
          {block.otherFiles.map((f) => (
            <FileLine key={f.id} file={f} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function GuidanceRows({ items, depth }: { items: GuidanceItem[]; depth: number }) {
  return (
    <>
      {items.map((it, i) => (
        <View key={i}>
          <View style={[s.gRow, { paddingLeft: depth * 14 }]}>
            <View style={[s.box, { marginRight: 6 }]} />
            <Text style={s.gText}>{safe(it.text)}</Text>
          </View>
          {it.children.length ? <GuidanceRows items={it.children} depth={depth + 1} /> : null}
        </View>
      ))}
    </>
  );
}

function Guidance({ lists }: { lists: GuidanceList[] }) {
  return (
    <View>
      {lists.map((l, i) => (
        <View key={i} style={s.gList}>
          {l.heading ? <Text style={s.gHeading}>{safe(l.heading)}</Text> : null}
          {l.intro ? <Text style={s.gIntro}>{safe(l.intro)}</Text> : null}
          <GuidanceRows items={l.items} depth={0} />
        </View>
      ))}
      <Text style={s.gNote}>
        These boxes are left blank on purpose. They list what the manual requires the plan to
        contain; whether the uploaded plan covers each one is for the reviewer to judge against
        the document itself.
      </Text>
    </View>
  );
}

export interface ChecklistReportProps {
  model: ChecklistModel;
  images: ImageBytes;
}

export function ChecklistReport({ model, images }: ChecklistReportProps) {
  const { project, credit, summary } = model;
  const footer = safe(`${project.name} · ${credit.code} ${credit.title} · compliance checklist · ${model.generatedAt}`);
  const tiles: [string, string | number][] = [
    ["Documents listed", summary.listed],
    ["Due at this stage", summary.due],
    ["Provided", summary.provided],
    ["With gaps (AI)", summary.withGaps],
    ["Missing", summary.missing],
  ];

  return (
    <Document title={`${credit.code} ${credit.title} — Compliance checklist — ${project.name}`} author="NetZero">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>Compliance checklist</Text>
        <Text style={s.title}>
          {credit.code} — {safe(credit.title)}
        </Text>
        <Text style={s.subtitle}>{safe(project.name)}</Text>
        <View style={s.titleRow}>
          <Chip label={credit.statusLabel} tone={STATUS_STYLE[credit.status] ?? STATE_STYLE.not_due} />
          <Pill variant="points">
            {credit.pointsEarned} / {safe(credit.pointsAvailable)} pts
          </Pill>
          {credit.isKeystone ? <Pill variant="keystone">Keystone</Pill> : null}
          {!credit.targeted ? <Pill>Not targeted</Pill> : null}
          <Pill>
            {credit.categoryCode} · {safe(credit.categoryName)}
          </Pill>
          {credit.pageSpan ? <Pill>Manual {credit.pageSpan}</Pill> : null}
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Rating system</Text>
            <Text style={s.metaValue}>{safe(project.ratingSystem)}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Project stage</Text>
            <Text style={s.metaValue}>{project.stageLabel}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Target level</Text>
            <Text style={s.metaValue}>{project.targetTier ? safe(project.targetTier) : "Not set"}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Generated</Text>
            <Text style={s.metaValue}>{model.generatedAt}</Text>
          </View>
        </View>

        <Text style={s.origin}>
          Generated from the project&apos;s records in NetZero at the date and time above: the
          values recorded against each requirement, the files attached against each required
          document, and the AI&apos;s advisory read of those files. Nothing on this document was
          typed in by hand. A document reads Provided only when a file is attached against it.
          This is not a log of dated site inspections; where the manual asks for one, it is among
          the required documents below and the contractor&apos;s own sheets are what is attached
          there.
        </Text>

        {credit.aim ? (
          <View>
            <Text style={s.sectionLabel}>Aim</Text>
            <Text style={s.aim}>{safe(credit.aim)}</Text>
          </View>
        ) : null}

        <Text style={s.sectionLabel}>Required documents at a glance</Text>
        <View style={s.tiles}>
          {tiles.map(([label, value], i) => (
            <View key={label} style={i === tiles.length - 1 ? [s.tile, s.tileLast] : s.tile}>
              <Text style={s.tileValue}>{value}</Text>
              <Text style={s.tileLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>
          Requirements and required documents
          <Text style={s.h2Meta}>  Project at {project.stageLabel} stage</Text>
        </Text>
        {model.sections.map((sec, i) =>
          sec.kind === "requirement" ? (
            <Requirement key={i} block={sec.block} />
          ) : (
            <View key={i} style={s.choose} wrap={false}>
              <Text style={s.chooseTitle}>Either/or: no path chosen yet</Text>
              <Text style={s.reqText}>
                The project has not yet picked which of these options it will pursue, so their
                documents are not listed:
              </Text>
              {sec.choose.options.map((o) => (
                <Text key={o.seq} style={s.li}>
                  • #{o.seq} {safe(o.title ?? o.text)}
                </Text>
              ))}
            </View>
          ),
        )}
        {model.setAside.length ? (
          <View>
            <Text style={s.panelLabel}>Not listed — either/or options the project set aside</Text>
            {model.setAside.map((o) => (
              <Text key={o.seq} style={s.li}>
                • #{o.seq} {safe(o.title ?? o.text)}
              </Text>
            ))}
          </View>
        ) : null}

        {model.additionalFiles.length ? (
          <View>
            <Text style={s.h2}>Additional attachments (credit level)</Text>
            <Text style={[s.reqText, { marginBottom: 4 }]}>
              Files supporting the credit as a whole. They do not stand in for a listed document.
            </Text>
            {model.additionalFiles.map((f) => (
              <FileLine key={f.id} file={f} />
            ))}
          </View>
        ) : null}

        {model.photos.length ? (
          <View break>
            <Text style={s.h2}>
              Photographs
              <Text style={s.h2Meta}>  {model.photos.length} image file{model.photos.length === 1 ? "" : "s"} attached</Text>
            </Text>
            <Text style={[s.reqText, { marginBottom: 4 }]}>
              Every PNG or JPEG attached to this credit, with its upload date and what it was
              attached against. Other file types are listed above, not shown.
            </Text>
            <View style={s.photoGrid}>
              {model.photos.map((p) => {
                const img = images.get(p.fileId);
                return (
                  <View key={p.fileId} style={s.photo} wrap={false}>
                    {img ? (
                      // @react-pdf's Image has no alt prop; the caption below is the description.
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image style={s.photoImg} src={img} />
                    ) : (
                      <Text style={[s.photoCap, s.dim]}>[image could not be read]</Text>
                    )}
                    <Text style={s.photoCap}>{safe(p.fileName)}</Text>
                    <Text style={s.photoMeta}>
                      Uploaded {formatUploadedAt(p.createdAt)} · {safe(p.attachedTo)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {model.guidance.length ? (
          <View break>
            <Text style={s.h2}>What the manual requires the plan to contain</Text>
            <Text style={[s.reqText, { marginBottom: 6 }]}>
              From the credit&apos;s supporting guidance
              {credit.pageSpan ? ` (manual ${credit.pageSpan})` : ""}.
            </Text>
            <Guidance lists={model.guidance} />
          </View>
        ) : null}

        <Footer left={footer} />
      </Page>
    </Document>
  );
}
