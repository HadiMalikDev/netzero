import { extractText, getDocumentProxy } from "unpdf";

export interface ExtractedPdf {
  pageCount: number;
  pages: string[]; // one entry per page (1-indexed => pages[i-1])
  fullText: string;
}

/** Deterministic PDF text extraction with page mapping (for citations). */
export async function extractPdf(data: Uint8Array): Promise<ExtractedPdf> {
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t) => t ?? "");
  return {
    pageCount: totalPages,
    pages,
    fullText: pages.join("\n"),
  };
}
