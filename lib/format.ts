/**
 * Display formatting shared by server and client components. Kept out of any
 * "use client" module so server components can call these directly.
 */

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Unix seconds as a short absolute date — evidence is dated, not "2h ago". */
export function formatUploadedAt(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A requirement's display label: its catalog title, else its first clause. */
export function requirementLabel(title: string | null, text: string): string {
  if (title) return title;
  const s = text.trim();
  const dot = s.indexOf(". ");
  const cut = dot > 8 && dot < 80 ? dot : Math.min(72, s.length);
  return s.slice(0, cut).replace(/[,;:]\s*$/, "") + (cut < s.length ? "…" : "");
}
