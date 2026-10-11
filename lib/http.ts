/**
 * A Content-Disposition header for a user's file name. HTTP header values are
 * Latin-1 only, so a name with any other character — the narrow no-break
 * space macOS puts in screenshot names ("1.37.18 PM"), any Arabic name —
 * made `new Response` throw. The header carries an ASCII fallback in
 * `filename` and the real name, percent-encoded as UTF-8, in `filename*`
 * (RFC 6266 / 5987), which browsers prefer.
 */
export function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "file";
  const ascii = base.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  const encoded = encodeURIComponent(base).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
