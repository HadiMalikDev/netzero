/**
 * Download the site team's inspection sheet for this credit (Sprint 2 item
 * 2). Shown only on credits that have a sheet template. The Yes/No/Remarks
 * columns come out blank for the inspector; the app fills the header, the
 * photographs and the advisory "in uploaded plan" column.
 */
export function DownloadInspectionSheetLink({
  projectId,
  code,
}: {
  projectId: string;
  code: string;
}) {
  return (
    <a
      href={`/api/projects/${projectId}/credits/${encodeURIComponent(code)}/inspection-sheet`}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      download
      title="The numbered inspection form for the site team to tick and sign, with the photographs already uploaded. The plan read takes a few seconds."
    >
      Download inspection sheet (PDF)
    </a>
  );
}
