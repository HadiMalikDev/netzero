/** Shared bits of the material download routes (PDF and Excel). */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "27 Oct 2026, 17:40 GMT+3", as the other reports print it. */
export function generatedAt(d = new Date()): string {
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
    timeZoneName: "short",
  });
}

export function pdfResponse(buf: Buffer | Uint8Array, fileName: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
