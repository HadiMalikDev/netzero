/**
 * Download the credit's compliance checklist as a PDF (Sprint 2 item 1). It is
 * generated from the project's current state at the moment of download, so
 * there is nothing to fill in first.
 */
export function DownloadChecklistLink({
  projectId,
  code,
}: {
  projectId: string;
  code: string;
}) {
  return (
    <a
      href={`/api/projects/${projectId}/credits/${encodeURIComponent(code)}/checklist`}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      download
      title="A PDF of this credit's requirements, required documents and attached files, as they stand now"
    >
      Download checklist (PDF)
    </a>
  );
}
