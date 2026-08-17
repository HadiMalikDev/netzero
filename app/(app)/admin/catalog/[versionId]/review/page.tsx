import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../_components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { getVersion, getVersionParsedDrafts } from "@/lib/catalog";
import { promoteDocument } from "../../actions";
import { CreditDiffCard } from "./CreditDiffCard";
import { DiffReview, type TreeCredit } from "./DiffReview";
import { VerifyRunner } from "./VerifyRunner";
import { DeleteDocButton } from "./DeleteDocButton";
import { ReparseButton } from "./ReparseButton";
import { AcceptAllButton } from "./AcceptAllButton";

export default async function VersionReviewPage({
  params,
}: PageProps<"/admin/catalog/[versionId]/review">) {
  const { versionId } = await params;
  const v = await getVersion(versionId);
  if (!v) notFound();
  const docs = await getVersionParsedDrafts(versionId);

  return (
    <PageChrome
      fullBleed
      crumbs={[
        { label: "Admin" },
        { label: "Catalog" },
        { label: `${v.version.scheme} ${v.version.stage}` },
        { label: "Parsed drafts" },
      ]}
    >
      <PageHeader
        title="Parsed drafts"
        subtitle="Verify with AI, review the diff per credit (like a pull request), then promote into the catalog."
      />

      {docs.length === 0 ? (
        <EmptyState
          title="No parse runs yet"
          description="Upload a Mostadam manual for this version to extract draft credits."
        />
      ) : (
        <div className="space-y-10">
          {docs.map(({ document, credits }) => {
            const promotable = credits.filter((c) => !c.dropped && !c.promoted);
            const proposedCount = credits.filter(
              (c) => c.aiStatus === "proposed",
            ).length;

            const tree: TreeCredit[] = credits.map((c) => {
              const chRows = (c.proposal ?? []).filter(
                (p) => p.change !== "unchanged",
              );
              return {
                code: c.code,
                title: c.title,
                categoryCode: c.categoryCode,
                categoryName: c.categoryName,
                pointsRaw: c.pointsRaw,
                isKeystone: c.isKeystone,
                changed: c.aiStatus === "proposed" && chRows.length > 0,
                added: chRows.filter((p) => p.change === "added").length,
                corrected: chRows.filter((p) => p.change === "corrected").length,
              };
            });

            return (
              <div key={document.id}>
                {/* Document header */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-slate-900">
                        {document.fileName}
                      </h2>
                      <StatusPill status={document.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {credits.length} credits
                      {document.pageCount ? ` · ${document.pageCount} pages` : ""}
                      {" · "}Click Verify to recover missing requirements &amp;
                      targets from the source.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ReparseButton
                      documentId={document.id}
                      versionId={versionId}
                    />
                    <VerifyRunner
                      credits={credits.map((c) => ({ id: c.id, code: c.code }))}
                    />
                    {proposedCount > 0 ? (
                      <AcceptAllButton
                        versionId={versionId}
                        documentId={document.id}
                        count={proposedCount}
                      />
                    ) : null}
                    {promotable.length > 0 ? (
                      <form action={promoteDocument}>
                        <input type="hidden" name="versionId" value={versionId} />
                        <input type="hidden" name="documentId" value={document.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                          Promote all {promotable.length}
                        </button>
                      </form>
                    ) : null}
                    <DeleteDocButton
                      documentId={document.id}
                      fileName={document.fileName}
                    />
                  </div>
                </div>

                {document.status === "rejected" ? (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">
                    <strong>Rejected:</strong> {document.error}
                  </div>
                ) : (
                  <DiffReview credits={tree}>
                    {credits.map((c) => (
                      <CreditDiffCard
                        key={c.id}
                        credit={c}
                        versionId={versionId}
                      />
                    ))}
                  </DiffReview>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageChrome>
  );
}
