import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { base, C, Footer, Pill, safe } from "./shared";
import type {
  ExportCategory,
  ExportCredit,
  ExportRequirement,
  VersionExport,
} from "@/lib/catalog";
import { formatPageSpan } from "@/lib/ai/review-notes";
import { groupByOption } from "@/lib/option-group";
import type { Applicability, EvidenceItem } from "@/lib/parser/types";

/**
 * The extraction-review PDF: a read-only dump of a catalog version, laid out so
 * a third party can check it against the original manual page-by-page. Built
 * on the shared primitives in ./shared (Helvetica, `safe()`, page frame).
 * Rendered to a Buffer in the /api/catalog/[versionId]/pdf route.
 */

const s = {
  ...base,
  ...StyleSheet.create({
  // cover
  coverWrap: { flexGrow: 1, justifyContent: "center" },
  coverKicker: {
    fontSize: 10,
    textTransform: "uppercase",
    color: C.brand,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 30,
    lineHeight: 1.2,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 12,
  },
  coverSub: { fontSize: 13, color: C.muted, marginTop: 2, marginBottom: 24 },
  howto: {
    marginTop: 18,
    padding: 12,
    backgroundColor: C.panel,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
  },
  howtoTitle: {
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 4,
    fontSize: 10,
  },
  // category
  catHeader: {
    marginTop: 6,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: C.ink,
  },
  catTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.ink },
  catMeta: { fontSize: 9, color: C.muted, marginTop: 1 },
  // credit
  credit: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    padding: 10,
  },
  creditTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  creditTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    flexShrink: 1,
    paddingRight: 8,
  },
  creditSource: { fontSize: 8.5, color: C.muted, marginTop: 2 },
  sourceStrong: { fontFamily: "Helvetica-Bold", color: C.brand },
  aim: { fontSize: 9, color: C.body },
  // reviewer note
  note: {
    marginTop: 8,
    padding: 8,
    backgroundColor: C.brandBg,
    borderRadius: 3,
  },
  noteLabel: {
    fontSize: 7.5,
    textTransform: "uppercase",
    color: C.brand,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  noteText: { fontSize: 9, color: C.ink },
  // requirement
  xor: {
    borderLeftWidth: 2,
    borderLeftColor: "#99f6e4",
    paddingLeft: 6,
    marginBottom: 6,
  },
  xorLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    marginBottom: 3,
  },
  req: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  reqFirst: { borderTopWidth: 0, paddingTop: 0, marginTop: 3 },
  reqTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
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
  reqTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginRight: 4,
  },
  reqText: { fontSize: 9, color: C.body, marginTop: 2 },
  measurable: {
    marginTop: 3,
    fontSize: 8.5,
    color: C.brand,
    fontFamily: "Helvetica-Bold",
  },
  // table (bands / applicability)
  table: { marginTop: 4, borderWidth: 1, borderColor: C.line, borderRadius: 3 },
  tr: { flexDirection: "row" },
  trHead: { backgroundColor: C.panel },
  th: {
    flex: 1,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: C.line,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  td: {
    flex: 1,
    fontSize: 8,
    color: C.body,
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: C.line,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  cellLast: { borderRightWidth: 0 },
  // reconciliation
  recon: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 3,
  },
  reconOk: { backgroundColor: C.greenBg },
  reconBad: { backgroundColor: C.redBg },
  reconText: { fontSize: 8.5 },
  }),
};

function EvidencePanel({ items }: { items: EvidenceItem[] }) {
  if (!items.length) return null;
  const byStage = new Map<string, string[]>();
  for (const it of items) {
    const arr = byStage.get(it.stage) ?? [];
    arr.push(it.text);
    byStage.set(it.stage, arr);
  }
  return (
    <View style={s.panel}>
      {[...byStage.entries()].map(([stage, texts], i) => (
        <View key={i} style={{ marginBottom: i < byStage.size - 1 ? 3 : 0 }}>
          <Text style={s.panelLabel}>
            {stage === "unknown"
              ? "Evidence required"
              : `${safe(stage)} stage evidence`}
          </Text>
          {texts.map((t, j) => (
            <Text key={j} style={s.li}>
              • {safe(t)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function BandsTable({ req }: { req: ExportRequirement }) {
  if (!req.bands.length) return null;
  return (
    <View>
      {req.bands.map((set, i) => (
        <View key={i} style={s.table}>
          <View style={[s.tr, s.trHead]}>
            <Text style={s.th}>
              {set.label
                ? `${safe(set.label)} — % improvement >=`
                : "% improvement >="}
            </Text>
            <Text style={[s.th, s.cellLast]}>Points</Text>
          </View>
          {set.bands.map((b, j) => (
            <View key={j} style={s.tr}>
              <Text style={s.td}>{b.min}</Text>
              <Text style={[s.td, s.cellLast]}>{b.points}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function LimitsPanel({ req }: { req: ExportRequirement }) {
  const spec = req.spec;
  if (!spec) return null;
  return (
    <>
      {spec.limits?.length ? (
        <View style={s.panel}>
          <Text style={s.panelLabel}>Reference values (max concentration)</Text>
          {spec.limits.map((l, i) => (
            <Text key={i} style={s.li}>
              • {safe(l.name)}: &lt;= {l.value} {safe(l.unit)}
            </Text>
          ))}
        </View>
      ) : null}
      {spec.threshold ? (
        <View style={s.panel}>
          <Text style={s.panelLabel}>Reference threshold</Text>
          <Text style={s.li}>
            {safe(spec.threshold.op)} {spec.threshold.value}{" "}
            {safe(spec.threshold.unit ?? "")}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function RequirementRow({
  req,
  first,
}: {
  req: ExportRequirement;
  first: boolean;
}) {
  const span = formatPageSpan(req.sourcePageStart, req.sourcePageEnd);
  return (
    <View style={first ? [s.req, s.reqFirst] : s.req} wrap={false}>
      <View style={s.reqTop}>
        <Text style={s.seq}>#{req.seq}</Text>
        {req.title ? <Text style={s.reqTitle}>{safe(req.title)}</Text> : null}
        <Pill>{req.metricType}</Pill>
        {req.pointsRaw ? (
          <Pill variant="points">{safe(req.pointsRaw)} pts</Pill>
        ) : null}
        {req.optionGroup ? <Pill>Option</Pill> : null}
        {req.keystone ? <Pill variant="keystone">Keystone</Pill> : null}
        {req.unit ? <Pill>unit: {safe(req.unit)}</Pill> : null}
        {span ? <Pill>{span}</Pill> : null}
      </View>
      <Text style={s.reqText}>{safe(req.text)}</Text>
      {req.measurable && !req.bands.length ? (
        <Text style={s.measurable}>Measurable target: {safe(req.measurable)}</Text>
      ) : null}
      <BandsTable req={req} />
      <LimitsPanel req={req} />
      <EvidencePanel items={req.evidence} />
    </View>
  );
}

function ApplicabilityTable({ matrix }: { matrix: Applicability }) {
  const scopes = Object.keys(matrix);
  if (!scopes.length) return null;
  const typologies = Object.keys(matrix[scopes[0]] ?? {});
  if (!typologies.length) return null;
  return (
    <View>
      <Text style={s.sectionLabel}>Applicability (points by scope × typology)</Text>
      <View style={s.table}>
        <View style={[s.tr, s.trHead]}>
          <Text style={s.th}>Scope</Text>
          {typologies.map((t, i) => (
            <Text
              key={t}
              style={i === typologies.length - 1 ? [s.th, s.cellLast] : s.th}
            >
              {safe(t)}
            </Text>
          ))}
        </View>
        {scopes.map((scope) => (
          <View key={scope} style={s.tr}>
            <Text style={s.td}>{safe(scope)}</Text>
            {typologies.map((t, i) => {
              const v = matrix[scope]?.[t];
              return (
                <Text
                  key={t}
                  style={i === typologies.length - 1 ? [s.td, s.cellLast] : s.td}
                >
                  {typeof v === "number" ? String(v) : "—"}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function CreditBlock({ credit }: { credit: ExportCredit }) {
  const span = formatPageSpan(credit.sourcePageStart, credit.sourcePageEnd);
  const blocks = groupByOption(credit.requirements);
  let seenReq = 0;
  return (
    <View style={s.credit} wrap>
      <View style={s.creditTop}>
        <Text style={s.creditTitle}>
          {credit.code} — {safe(credit.title)}
        </Text>
        <View style={{ flexDirection: "row", flexShrink: 0 }}>
          {credit.pointsRaw ? (
            <Pill variant="points">{safe(credit.pointsRaw)} pts</Pill>
          ) : null}
          {credit.isKeystone ? <Pill variant="keystone">Keystone</Pill> : null}
        </View>
      </View>
      <Text style={s.creditSource}>
        {credit.categoryCode} · {safe(credit.categoryName)}
        {span ? (
          <>
            {"   "}
            <Text style={s.sourceStrong}>Source: manual {span}</Text>
          </>
        ) : null}
        {credit.toolRef ? `   Tool: ${safe(credit.toolRef)}` : ""}
      </Text>

      {credit.reviewNote ? (
        <View style={s.note}>
          <Text style={s.noteLabel}>
            Reviewer note · AI-generated — verify against manual
          </Text>
          <Text style={s.noteText}>{safe(credit.reviewNote)}</Text>
        </View>
      ) : null}

      {credit.aim ? (
        <View>
          <Text style={s.sectionLabel}>Aim</Text>
          <Text style={s.aim}>{safe(credit.aim)}</Text>
        </View>
      ) : null}

      <Text style={s.sectionLabel}>
        Requirements ({credit.requirements.length})
      </Text>
      {credit.requirements.length === 0 ? (
        <Text style={s.aim}>No requirements extracted.</Text>
      ) : (
        blocks.map((block, i) => {
          if (block.kind === "xor") {
            return (
              <View key={`xor-${i}`} style={s.xor}>
                <Text style={s.xorLabel}>
                  Choose one of {block.items.length} options ({safe(block.group)})
                </Text>
                {block.items.map((r) => {
                  const isFirst = seenReq++ === 0;
                  return <RequirementRow key={r.seq} req={r} first={isFirst} />;
                })}
              </View>
            );
          }
          const isFirst = seenReq++ === 0;
          return <RequirementRow key={block.item.seq} req={block.item} first={isFirst} />;
        })
      )}

      {credit.applicability ? (
        <ApplicabilityTable matrix={credit.applicability} />
      ) : null}

      {credit.references.length ? (
        <View>
          <Text style={s.sectionLabel}>Reference documents</Text>
          {credit.references.map((ref, i) => (
            <Text key={i} style={s.li}>
              • {safe(ref)}
            </Text>
          ))}
        </View>
      ) : null}

      {credit.reconciliation ? (
        <View
          style={[
            s.recon,
            credit.reconciliation.ok ? s.reconOk : s.reconBad,
          ]}
        >
          <Text
            style={[
              s.reconText,
              { fontFamily: "Helvetica-Bold", color: credit.reconciliation.ok ? C.green : C.red },
            ]}
          >
            {credit.reconciliation.ok
              ? "Points reconcile"
              : "Points mismatch"}
          </Text>
          <Text style={[s.reconText, { color: C.muted, marginLeft: 6 }]}>
            expected {credit.reconciliation.expected ?? "—"} · got{" "}
            {credit.reconciliation.got ?? "—"}
            {credit.reconciliation.note
              ? ` · ${safe(credit.reconciliation.note)}`
              : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CategorySection({ category }: { category: ExportCategory }) {
  const reqTotal = category.credits.reduce(
    (n, c) => n + c.requirements.length,
    0,
  );
  return (
    <View>
      <View style={s.catHeader} wrap={false}>
        <Text style={s.catTitle}>
          {category.code} · {safe(category.name)}
        </Text>
        <Text style={s.catMeta}>
          {category.credits.length} credit
          {category.credits.length === 1 ? "" : "s"} · {reqTotal} requirement
          {reqTotal === 1 ? "" : "s"}
        </Text>
      </View>
      {category.credits.map((c) => (
        <CreditBlock key={c.code} credit={c} />
      ))}
    </View>
  );
}

export interface CatalogReportProps {
  data: VersionExport;
  generatedAt: string; // pre-formatted; the component stays deterministic
}

export function CatalogReport({ data, generatedAt }: CatalogReportProps) {
  const { version, ratingSystemName, source, totals } = data;
  const versionId = safe(
    `${ratingSystemName} · ${version.scheme} ${version.stage} · ${version.versionLabel}`,
  );

  return (
    <Document
      title={`${ratingSystemName} ${version.scheme} ${version.stage} — Catalog extraction review`}
      author="NetZero"
    >
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.coverWrap}>
          <Text style={s.coverKicker}>Catalog extraction review</Text>
          <Text style={s.coverTitle}>{safe(ratingSystemName)}</Text>
          <Text style={s.coverSub}>
            {version.scheme} · {version.stage} · version{" "}
            {safe(version.versionLabel)}
          </Text>

          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Source manual</Text>
              <Text style={s.metaValue}>{safe(source?.fileName) || "—"}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Manual pages</Text>
              <Text style={s.metaValue}>{source?.pageCount ?? "—"}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Credits</Text>
              <Text style={s.metaValue}>{totals.credits}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Requirements</Text>
              <Text style={s.metaValue}>{totals.requirements}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Reviewer notes</Text>
              <Text style={s.metaValue}>
                {totals.reviewNotes} / {totals.credits} generated
              </Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Generated</Text>
              <Text style={s.metaValue}>{generatedAt}</Text>
            </View>
          </View>

          <View style={s.howto}>
            <Text style={s.howtoTitle}>How to use this document</Text>
            <Text>
              This is a read-only reference of everything extracted into the
              catalog — not a fill-in checklist. Read it side-by-side with the
              original manual: for each credit, open the cited manual pages
              (&ldquo;Source: manual pp.X–Y&rdquo;) and confirm the title,
              points, requirements, options, evidence, applicability, and
              reconciliation match. The italic reviewer note under each credit is
              AI-generated to orient you and must itself be verified against the
              manual — it is never authoritative.
            </Text>
          </View>
        </View>
        <Footer left={versionId} />
      </Page>

      {/* Body */}
      <Page size="A4" style={s.page}>
        {data.categories.length === 0 ? (
          <Text style={s.aim}>
            No credits have been promoted into this catalog version yet.
          </Text>
        ) : (
          data.categories.map((cat) => (
            <CategorySection key={cat.code} category={cat} />
          ))
        )}
        <Footer left={versionId} />
      </Page>
    </Document>
  );
}
